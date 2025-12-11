"use client";

import { useEffect, useState } from "react";
import { Loader2, Check, Clock, DoorOpen, Radio, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { MeetingStatus } from "@/types/vexa";

interface BotStatusIndicatorProps {
  status: MeetingStatus;
  platform: string;
  meetingId: string;
}

const STATUS_STEPS = [
  { key: "requested", label: "Requested", description: "Bot is starting up" },
  { key: "joining", label: "Joining", description: "Connecting to meeting" },
  { key: "awaiting_admission", label: "Waiting", description: "Waiting to be admitted" },
  { key: "active", label: "Recording", description: "Transcribing audio" },
] as const;

const STATUS_ORDER: Record<string, number> = {
  requested: 0,
  joining: 1,
  awaiting_admission: 2,
  active: 3,
  completed: 4,
  failed: -1,
};

export function BotStatusIndicator({ status, platform, meetingId }: BotStatusIndicatorProps) {
  const [dots, setDots] = useState("");

  // Animate dots for loading states
  useEffect(() => {
    if (status === "requested" || status === "joining" || status === "awaiting_admission") {
      const interval = setInterval(() => {
        setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
      }, 500);
      return () => clearInterval(interval);
    }
  }, [status]);

  const currentStep = STATUS_ORDER[status] ?? -1;
  const isEarlyState = currentStep >= 0 && currentStep < 3;

  if (!isEarlyState) return null;

  const getStatusIcon = (stepStatus: string, isActive: boolean, isCompleted: boolean) => {
    if (isCompleted) {
      return <Check className="h-5 w-5 text-green-500" />;
    }
    if (!isActive) {
      return <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />;
    }
    switch (stepStatus) {
      case "requested":
        return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
      case "joining":
        return <DoorOpen className="h-5 w-5 text-primary animate-pulse" />;
      case "awaiting_admission":
        return <Clock className="h-5 w-5 text-orange-500 animate-pulse" />;
      default:
        return <Radio className="h-5 w-5 text-primary" />;
    }
  };

  const getStatusMessage = () => {
    switch (status) {
      case "requested":
        return "Starting transcription bot";
      case "joining":
        return "Joining the meeting";
      case "awaiting_admission":
        return "Please admit the bot to the meeting";
      default:
        return "Preparing";
    }
  };

  return (
    <Card className="border-0 shadow-lg bg-gradient-to-br from-background to-muted/30">
      <CardContent className="pt-8 pb-8">
        {/* Main status display */}
        <div className="flex flex-col items-center text-center mb-10">
          <div className="relative mb-6">
            {/* Outer glow ring */}
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: "2s" }} />
            {/* Inner container */}
            <div className="relative h-20 w-20 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 flex items-center justify-center">
              {status === "awaiting_admission" ? (
                <Clock className="h-10 w-10 text-orange-500" />
              ) : (
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              )}
            </div>
          </div>

          <h2 className="text-xl font-semibold mb-2">
            {getStatusMessage()}{dots}
          </h2>

          <p className="text-sm text-muted-foreground max-w-sm">
            {status === "awaiting_admission" ? (
              <>Look for <span className="font-medium text-foreground">Vexa Bot</span> in your meeting&apos;s waiting room and click admit</>
            ) : (
              "This usually takes a few seconds"
            )}
          </p>
        </div>

        {/* Progress steps */}
        <div className="max-w-md mx-auto">
          <div className="relative">
            {/* Progress line */}
            <div className="absolute left-[22px] top-0 bottom-0 w-0.5 bg-muted" />
            <div
              className="absolute left-[22px] top-0 w-0.5 bg-primary transition-all duration-500"
              style={{ height: `${Math.max(0, currentStep) * 33.33}%` }}
            />

            {/* Steps */}
            <div className="relative space-y-6">
              {STATUS_STEPS.map((step, index) => {
                const isCompleted = currentStep > index;
                const isActive = currentStep === index;

                return (
                  <div
                    key={step.key}
                    className={cn(
                      "flex items-start gap-4 transition-opacity duration-300",
                      !isCompleted && !isActive && "opacity-40"
                    )}
                  >
                    {/* Step icon */}
                    <div className={cn(
                      "flex-shrink-0 h-11 w-11 rounded-full flex items-center justify-center border-2 transition-all duration-300",
                      isCompleted && "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800",
                      isActive && "bg-primary/10 border-primary shadow-lg shadow-primary/20",
                      !isCompleted && !isActive && "bg-muted border-muted"
                    )}>
                      {getStatusIcon(step.key, isActive, isCompleted)}
                    </div>

                    {/* Step text */}
                    <div className="flex-1 pt-2">
                      <p className={cn(
                        "font-medium text-sm",
                        isActive && "text-primary"
                      )}>
                        {step.label}
                        {isActive && <span className="text-muted-foreground">{dots}</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function BotFailedIndicator({
  status,
  onRetry
}: {
  status: MeetingStatus;
  onRetry?: () => void;
}) {
  if (status !== "failed") return null;

  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardContent className="pt-8 pb-8">
        <div className="flex flex-col items-center text-center">
          <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <XCircle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold mb-2 text-destructive">
            Transcription Failed
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm mb-4">
            The bot was unable to join or complete the transcription. This can happen if the meeting ended or the bot was removed.
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="text-sm font-medium text-primary hover:underline"
            >
              Try again with a new bot
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
