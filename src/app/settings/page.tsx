"use client";

import { useState, useEffect, useMemo } from "react";
import { Settings, Loader2, Save, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { SUPPORTED_LANGUAGES } from "@/types/vexa";
import {
  type BotTask,
  type BotDefaults,
  extractBotDefaults,
  getLocalBotDefaults,
  setLocalBotDefaults,
  clearLocalBotDefaults,
  toBotDefaultsPayload,
} from "@/lib/bot-defaults";

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [storageMode, setStorageMode] = useState<"server" | "local">("server");

  const [botName, setBotName] = useState("");
  const [language, setLanguage] = useState<string>("auto");
  const [task, setTask] = useState<BotTask>("transcribe");

  const languageOptions = useMemo(() => {
    // Ensure "auto" exists for UX even if list changes
    const hasAuto = SUPPORTED_LANGUAGES.some((l) => l.code === "auto");
    return hasAuto ? SUPPORTED_LANGUAGES : [{ code: "auto", name: "Auto-detect" }, ...SUPPORTED_LANGUAGES];
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/vexa/user/data", { method: "GET" });
        if (res.status === 404) {
          // Backend not yet supports /user/data
          setIsSupported(false);
          return;
        }
        const json = await res.json().catch(() => ({}));
        const serverDefaults = extractBotDefaults(json) || {};

        const hasServerValues = Boolean(serverDefaults.bot_name || serverDefaults.language || serverDefaults.task);
        if (hasServerValues) {
          setStorageMode("server");
          if (serverDefaults.bot_name) setBotName(serverDefaults.bot_name);
          if (serverDefaults.language) setLanguage(serverDefaults.language);
          if (serverDefaults.task) setTask(serverDefaults.task);
          clearLocalBotDefaults();
          return;
        }

        // Fallback: localStorage (until backend persists values reliably)
        const localDefaults = getLocalBotDefaults();
        if (localDefaults && (localDefaults.bot_name || localDefaults.language || localDefaults.task)) {
          setStorageMode("local");
          if (localDefaults.bot_name) setBotName(localDefaults.bot_name);
          if (localDefaults.language) setLanguage(localDefaults.language);
          if (localDefaults.task) setTask(localDefaults.task);
        } else {
          setStorageMode("server");
        }
      } catch (err) {
        console.error("Failed to load user bot defaults:", err);
        toast.error("Не удалось загрузить настройки", {
          description: (err as Error).message,
        });
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const desired: BotDefaults = {
        bot_name: botName.trim() || undefined,
        language: language === "auto" ? undefined : language,
        task,
      };

      const payload = toBotDefaultsPayload(desired);

      const res = await fetch("/api/vexa/user/data", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `HTTP ${res.status}`);
      }

      // Verify persistence (some backend versions may accept request but not persist yet)
      try {
        const verifyRes = await fetch("/api/vexa/user/data", { method: "GET" });
        const verifyJson = await verifyRes.json().catch(() => ({}));
        const serverDefaults = extractBotDefaults(verifyJson) || {};

        const sameBotName = (serverDefaults.bot_name || "") === (desired.bot_name || "");
        const sameLanguage = (serverDefaults.language || "") === (desired.language || "");
        const sameTask = (serverDefaults.task || "") === (desired.task || "");

        if (sameBotName && sameLanguage && sameTask) {
          setStorageMode("server");
          clearLocalBotDefaults();
          toast.success("Настройки сохранены", {
            description: "Будут применяться по умолчанию при подключении бота.",
          });
        } else {
          setStorageMode("local");
          setLocalBotDefaults(desired);
          toast.warning("Сервер не подтвердил сохранение", {
            description: "Пока сохраняю локально в браузере, чтобы значения не пропадали после обновления страницы.",
          });
        }
      } catch {
        setStorageMode("local");
        setLocalBotDefaults(desired);
        toast.warning("Не удалось проверить сохранение на сервере", {
          description: "Сохранил локально в браузере, чтобы значения не пропадали после обновления страницы.",
        });
      }
    } catch (err) {
      console.error("Failed to save user bot defaults:", err);
      // Fallback to local storage to avoid losing user input
      setStorageMode("local");
      setLocalBotDefaults({
        bot_name: botName.trim() || undefined,
        language: language === "auto" ? undefined : language,
        task,
      });
      toast.error("Не удалось сохранить настройки", {
        description: "Сохранил локально в браузере. Серверная запись пока недоступна.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Настройки</h1>
        <p className="text-muted-foreground">Персональные настройки для подключения бота</p>
      </div>

      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Настройки бота по умолчанию
            </CardTitle>
            <CardDescription>
              Эти параметры будут автоматически подставляться при создании бота через «Join Meeting».
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!isSupported ? (
              <div className="flex items-start gap-3 rounded-lg border p-4 text-sm">
                <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium">Сервер пока не поддерживает сохранение настроек</p>
                  <p className="text-muted-foreground">
                    Нужен endpoint <code className="bg-muted px-1 rounded">GET/PATCH /user/data</code> в Vexa (через
                    Gateway). После добавления настройки появятся здесь автоматически.
                  </p>
                </div>
              </div>
            ) : isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Загружаем настройки…</span>
              </div>
            ) : (
              <>
                {storageMode === "local" && (
                  <div className="flex items-start gap-3 rounded-lg border p-4 text-sm">
                    <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-medium">Сейчас используется локальное сохранение</p>
                      <p className="text-muted-foreground">
                        Сервер не вернул сохранённые значения. Как только Vexa начнёт реально сохранять{" "}
                        <code className="bg-muted px-1 rounded">user.data</code>, дашборд автоматически переключится на
                        серверное хранение.
                      </p>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="default-bot-name">Имя бота</Label>
                  <Input
                    id="default-bot-name"
                    placeholder="Vexa - Open Source Bot"
                    value={botName}
                    onChange={(e) => setBotName(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Отображается в списке участников встречи.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="default-language">Язык</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger id="default-language">
                      <SelectValue placeholder="Выберите язык" />
                    </SelectTrigger>
                    <SelectContent>
                      {languageOptions.map((lang) => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    При <code className="bg-muted px-1 rounded">auto</code> язык будет определён автоматически.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="default-task">Задача</Label>
                  <Select value={task} onValueChange={(v) => setTask(v as BotTask)}>
                    <SelectTrigger id="default-task">
                      <SelectValue placeholder="Выберите режим" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="transcribe">Транскрибация (transcribe)</SelectItem>
                      <SelectItem value="translate">Перевод (translate)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    В режиме <code className="bg-muted px-1 rounded">translate</code> Whisper обычно переводит в
                    английский (target language не настраивается).
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Сохраняем…
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Сохранить
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
