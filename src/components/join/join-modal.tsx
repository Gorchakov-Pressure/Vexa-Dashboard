"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Video, Loader2, Sparkles, Globe, ChevronDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { vexaAPI } from "@/lib/api";
import { useLiveStore } from "@/stores/live-store";
import { useJoinModalStore } from "@/stores/join-modal-store";
import { useMeetingsStore } from "@/stores/meetings-store";
import { useRuntimeConfig } from "@/hooks/use-runtime-config";
import { useUserBotDefaults } from "@/hooks/use-user-bot-defaults";
import type { Platform, CreateBotRequest } from "@/types/vexa";
import { SUPPORTED_LANGUAGES } from "@/types/vexa";
import { cn } from "@/lib/utils";
import { getUserFriendlyError } from "@/lib/error-messages";
import { DocsLink } from "@/components/docs/docs-link";

// Parse Google Meet or Teams URL/meeting ID
function parseMeetingInput(
  input: string
): { platform: Platform; meetingId: string; passcode?: string; requiresPasscode?: boolean } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Prefer URL parsing when possible (preserves query params like Teams `context=...`)
  try {
    const url = new URL(trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`);
    const host = url.hostname.toLowerCase();

    // Microsoft Teams (enterprise) meetup-join links
    // Example:
    // https://teams.microsoft.com/l/meetup-join/<native_id>?context=...
    if (host.endsWith("teams.microsoft.com")) {
      if (url.pathname.toLowerCase().startsWith("/l/meetup-join/")) {
        // Keep the full URL (including ?context=...) — backend will normalize to teams_<hash>
        return { platform: "teams", meetingId: url.toString(), requiresPasscode: false };
      }
    }

    // Microsoft Teams (consumer) links
    // Example:
    // https://teams.live.com/meet/<numeric_id>?p=<passcode>
    if (host.endsWith("teams.live.com")) {
      const meetPrefix = "/meet/";
      if (url.pathname.toLowerCase().startsWith(meetPrefix)) {
        const meetingId = url.pathname.slice(meetPrefix.length).split("/")[0];
        const passcode = url.searchParams.get("p") ?? undefined;
        return { platform: "teams", meetingId, passcode, requiresPasscode: false };
      }
    }
  } catch {
    // Fall back to regex parsing below
  }

  // Google Meet URL patterns
  // https://meet.google.com/abc-defg-hij
  // meet.google.com/abc-defg-hij
  const googleMeetUrlRegex = /(?:https?:\/\/)?meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i;
  const googleMeetMatch = trimmed.match(googleMeetUrlRegex);
  if (googleMeetMatch) {
    return { platform: "google_meet", meetingId: googleMeetMatch[1].toLowerCase() };
  }

  // Direct Google Meet code (abc-defg-hij)
  const googleMeetCodeRegex = /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/i;
  if (googleMeetCodeRegex.test(trimmed)) {
    return { platform: "google_meet", meetingId: trimmed.toLowerCase() };
  }

  // Microsoft Teams URL patterns
  // https://teams.microsoft.com/l/meetup-join/...
  // https://teams.live.com/meet/9387167464734?p=qxJanYOcdjN4d6UlGa
  // Note: this fallback regex intentionally ignores query params; URL parsing above is preferred.
  const teamsUrlRegex = /(?:https?:\/\/)?(?:teams\.microsoft\.com|teams\.live\.com)\/(?:l\/meetup-join|meet)\/([^\s?#]+)/i;
  const teamsMatch = trimmed.match(teamsUrlRegex);
  if (teamsMatch) {
    // If it's an enterprise meetup-join link, keep the full input as-is.
    if (trimmed.toLowerCase().includes("teams.microsoft.com") && trimmed.toLowerCase().includes("/l/meetup-join/")) {
      const fullUrl = trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`;
      return { platform: "teams", meetingId: fullUrl, requiresPasscode: false };
    }

    // Extract meeting ID and passcode from the URL
    const meetingPath = teamsMatch[1];
    // Keep the encoded meeting id if present (Teams often requires URL-safe encoding)
    const meetingId = meetingPath.split("/")[0] || meetingPath;
    
    // Extract passcode from query parameter (p=...)
    const passcodeMatch = trimmed.match(/[?&]p=([^&]+)/i);
    const passcode = passcodeMatch ? decodeURIComponent(passcodeMatch[1]) : undefined;
    
    return { platform: "teams", meetingId, passcode, requiresPasscode: false };
  }

  // Teams meeting ID (numeric or alphanumeric with specific patterns)
  if (/^\d{9,}$/.test(trimmed)) {
    return { platform: "teams", meetingId: trimmed, requiresPasscode: false };
  }

  // Generic Teams detection - contains teams.microsoft.com
  if (trimmed.toLowerCase().includes('teams.microsoft.com') || trimmed.toLowerCase().includes('teams.live.com')) {
    // Try to extract any usable ID
    const genericId = trimmed.replace(/^https?:\/\//, '').split('/').pop()?.split('?')[0];
    if (genericId) {
      // Also try to extract passcode from query string
      const passcodeMatch = trimmed.match(/[?&]p=([^&]+)/i);
      const passcode = passcodeMatch ? decodeURIComponent(passcodeMatch[1]) : undefined;
      return { platform: "teams", meetingId: genericId, passcode, requiresPasscode: false };
    }
  }

  return null;
}

// Get browser language code
function getBrowserLanguage(): string {
  if (typeof window === "undefined") return "auto";

  const browserLang = navigator.language.split("-")[0].toLowerCase();
  const supported = SUPPORTED_LANGUAGES.find((l) => l.code === browserLang);
  return supported ? browserLang : "auto";
}

export function JoinModal() {
  const router = useRouter();
  const { isOpen, closeModal } = useJoinModalStore();
  const { setActiveMeeting } = useLiveStore();
  const { setCurrentMeeting } = useMeetingsStore();
  const { config } = useRuntimeConfig();
  const { defaults: userDefaults } = useUserBotDefaults();

  const [meetingInput, setMeetingInput] = useState("");
  const [platform, setPlatform] = useState<Platform>("google_meet");
  const [language, setLanguage] = useState("auto");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [botName, setBotName] = useState("");
  const [passcode, setPasscode] = useState("");
  const [languageTouched, setLanguageTouched] = useState(false);
  const [botNameTouched, setBotNameTouched] = useState(false);

  // Set default language on mount
  useEffect(() => {
    setLanguage(getBrowserLanguage());
  }, []);

  // Apply user defaults (do not override explicit user choice)
  useEffect(() => {
    if (!userDefaults) return;
    if (!languageTouched && userDefaults.language) {
      setLanguage(userDefaults.language);
    }
    if (!botNameTouched && !botName.trim() && userDefaults.bot_name) {
      setBotName(userDefaults.bot_name);
    }
  }, [userDefaults, languageTouched, botNameTouched, botName]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setMeetingInput("");
      setPlatform("google_meet");
      setIsSubmitting(false);
      setShowAdvanced(false);
      setBotName("");
      setPasscode("");
      setLanguageTouched(false);
      setBotNameTouched(false);
    }
  }, [isOpen]);

  // Parse input and auto-detect platform
  const parsedInput = useMemo(() => {
    return parseMeetingInput(meetingInput);
  }, [meetingInput]);

  // Update platform and passcode when detected from URL
  useEffect(() => {
    if (parsedInput) {
      setPlatform(parsedInput.platform);
      // Auto-populate passcode if detected from URL
      if (parsedInput.passcode) {
        setPasscode(parsedInput.passcode);
      }
    }
  }, [parsedInput]);

  const isValid = parsedInput !== null;

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!parsedInput) {
      toast.error("Invalid meeting", {
        description: "Please enter a Google Meet URL/code or a Microsoft Teams meetup link / Meeting ID",
      });
      return;
    }

    // Validate Teams passcode requirement and prepare final passcode
    let finalPasscode: string | undefined;
    if (parsedInput.platform === "teams") {
      // Use passcode from parsedInput (URL) if available, otherwise use manually entered passcode
      finalPasscode = parsedInput.passcode || passcode.trim();
    }

    if (parsedInput.platform === "teams" && finalPasscode) {
      if (!/^[A-Za-z0-9]{8,20}$/.test(finalPasscode)) {
        toast.error("Неверный passcode", {
          description: "Для Teams passcode должен быть 8–20 символов (только латиница и цифры).",
        });
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const request: CreateBotRequest = {
        platform: parsedInput.platform,
        native_meeting_id: parsedInput.meetingId,
      };

      // Add passcode for Teams meetings
      if (parsedInput.platform === "teams" && finalPasscode) {
        request.passcode = finalPasscode;
      }

      // Set bot name - use custom name or configured default
      request.bot_name =
        botName.trim() ||
        userDefaults?.bot_name ||
        config?.defaultBotName ||
        "Vexa - Open Source Bot";

      if (language && language !== "auto") {
        request.language = language;
      } else if (userDefaults?.language && userDefaults.language !== "auto") {
        request.language = userDefaults.language;
      }

      if (userDefaults?.task) {
        request.task = userDefaults.task;
      }

      const meeting = await vexaAPI.createBot(request);

      toast.success("Bot joining meeting", {
        description: "The transcription bot is connecting...",
      });

      // Set meeting in both stores to ensure fresh data is used immediately
      setActiveMeeting(meeting);
      setCurrentMeeting(meeting);
      closeModal();

      // Navigate to the meeting page
      router.push(`/meetings/${meeting.id}`);
    } catch (error) {
      console.error("Failed to create bot:", error);
      const { title, description } = getUserFriendlyError(error as Error);
      toast.error(title, { description });
    } finally {
      setIsSubmitting(false);
    }
  }, [parsedInput, passcode, botName, language, config, userDefaults, setActiveMeeting, setCurrentMeeting, closeModal, router]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Video className="h-4 w-4 text-primary-foreground" />
            </div>
            Join a Meeting
          </DialogTitle>
          <DialogDescription>
            Paste a Google Meet or Teams URL to start transcribing automatically
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Meeting Input */}
          <div className="space-y-2">
            <Label htmlFor="meetingInput" className="sr-only">
              Meeting URL or Code
            </Label>
            <div className="relative">
              {/* Platform Icon - appears when detected */}
              {parsedInput && (
                <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10 animate-fade-in">
                  {parsedInput.platform === "google_meet" ? (
                    <div className="h-6 w-6 rounded-md bg-green-500 flex items-center justify-center shadow-sm">
                      <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                      </svg>
                    </div>
                  ) : (
                    <div className="h-6 w-6 rounded-md bg-[#5059C9] flex items-center justify-center shadow-sm">
                      <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19.98 7.89A2.14 2.14 0 1 0 17.84 10V7.89h2.14zm-5.27 0A2.14 2.14 0 1 0 12.58 10V7.89h2.13zM12.58 14.5h-1.11v-1.8h1.11zm4.13 0h-1.11v-1.8h1.11zM21 11.36v5.5a3 3 0 0 1-3 3h-3.86v-4.5H12.5v4.5H8.64v-4.5h-1.78a3 3 0 0 1-3-3v-5.5a3 3 0 0 1 3-3h11.14a3 3 0 0 1 3 3z"/>
                      </svg>
                    </div>
                  )}
                </div>
              )}
              <Input
                id="meetingInput"
                placeholder="Paste meeting URL (Google Meet or Teams)..."
                value={meetingInput}
                onChange={(e) => setMeetingInput(e.target.value)}
                className={cn(
                  "h-12 text-base pr-12 font-mono transition-all",
                  parsedInput ? "pl-12" : "pl-4",
                  meetingInput && (
                    isValid
                      ? parsedInput?.platform === "google_meet"
                        ? "border-green-500 focus-visible:ring-green-500/20"
                        : "border-[#5059C9] focus-visible:ring-[#5059C9]/20"
                      : "border-orange-500 focus-visible:ring-orange-500/20"
                  )
                )}
                autoFocus
                autoComplete="off"
              />
              {/* Valid indicator */}
              {meetingInput && isValid && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className={cn(
                    "h-6 w-6 rounded-full flex items-center justify-center animate-fade-in",
                    parsedInput?.platform === "google_meet" ? "bg-green-100 dark:bg-green-950" : "bg-blue-100 dark:bg-blue-950"
                  )}>
                    <svg className={cn(
                      "h-4 w-4",
                      parsedInput?.platform === "google_meet" ? "text-green-600 dark:text-green-400" : "text-[#5059C9]"
                    )} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                </div>
              )}
            </div>

            {/* Detected platform indicator */}
            {parsedInput && (
              <div className="flex items-center gap-2 text-sm animate-fade-in">
                <span className={cn(
                  "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium",
                  parsedInput.platform === "google_meet"
                    ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                    : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                )}>
                  {parsedInput.platform === "google_meet" ? (
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                  ) : (
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19.98 7.89A2.14 2.14 0 1 0 17.84 10V7.89h2.14zm-5.27 0A2.14 2.14 0 1 0 12.58 10V7.89h2.13zM12.58 14.5h-1.11v-1.8h1.11zm4.13 0h-1.11v-1.8h1.11zM21 11.36v5.5a3 3 0 0 1-3 3h-3.86v-4.5H12.5v4.5H8.64v-4.5h-1.78a3 3 0 0 1-3-3v-5.5a3 3 0 0 1 3-3h11.14a3 3 0 0 1 3 3z"/>
                    </svg>
                  )}
                  {parsedInput.platform === "google_meet" ? "Google Meet" : "Microsoft Teams"}
                </span>
                <span className="font-mono text-xs bg-muted px-2 py-1 rounded-md truncate max-w-[200px]">
                  {parsedInput.meetingId}
                </span>
              </div>
            )}
          </div>

          {/* Language Selection */}
          <div className="space-y-2">
            <Label htmlFor="language" className="text-sm flex items-center gap-2">
              <Globe className="h-3.5 w-3.5" />
              Transcription Language
            </Label>
            <Select value={language} onValueChange={(v) => { setLanguageTouched(true); setLanguage(v); }}>
              <SelectTrigger id="language" className="h-10">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Advanced Options Toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className={cn(
              "h-4 w-4 transition-transform",
              showAdvanced && "rotate-180"
            )} />
            Advanced options
          </button>

          {/* Advanced Options */}
          {showAdvanced && (
            <div className="space-y-4 animate-fade-in pt-2 border-t">
              {/* Bot Name */}
              <div className="space-y-2">
                <Label htmlFor="botName" className="text-sm">
                  Bot Name (optional)
                </Label>
                <Input
                  id="botName"
                  placeholder="Meeting Assistant"
                  value={botName}
                  onChange={(e) => { setBotNameTouched(true); setBotName(e.target.value); }}
                  className="h-10"
                />
              </div>

              {/* Passcode for Teams */}
              {platform === "teams" && (
                <div className="space-y-2">
                  <Label htmlFor="passcode" className="text-sm">
                    Passcode (optional)
                  </Label>
                  <Input
                    id="passcode"
                    placeholder="Enter meeting passcode (if required)"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    className="h-10"
                  />
                </div>
              )}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex items-center gap-2">
            <Button
              type="submit"
              className={cn(
                "flex-1 h-12 text-base transition-all duration-300",
                isValid && !isSubmitting && "shadow-lg shadow-primary/25"
              )}
              disabled={isSubmitting || !isValid}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Start Transcription
                </>
              )}
            </Button>
            <DocsLink href="/docs/rest/bots#create-bot" />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
