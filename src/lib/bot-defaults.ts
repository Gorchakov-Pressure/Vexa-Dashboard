"use client";

export type BotTask = "transcribe" | "translate";

export interface BotDefaults {
  bot_name?: string;
  language?: string;
  task?: BotTask;
}

const LOCAL_STORAGE_KEY = "vexa-dashboard:bot-defaults";

export function extractBotDefaults(payload: unknown): BotDefaults | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;

  // Allowed shapes:
  // 1) { data: { vexa_dashboard: { bot_defaults: {...} } } }
  // 2) { vexa_dashboard: { bot_defaults: {...} } }
  // 3) { bot_defaults: {...} }
  // 4) { bot_name, language, task } (direct)
  const data = obj.data && typeof obj.data === "object" ? (obj.data as Record<string, unknown>) : null;
  const vdFromData =
    data?.vexa_dashboard && typeof data.vexa_dashboard === "object"
      ? (data.vexa_dashboard as Record<string, unknown>)
      : null;
  const vd =
    obj.vexa_dashboard && typeof obj.vexa_dashboard === "object"
      ? (obj.vexa_dashboard as Record<string, unknown>)
      : vdFromData;

  const botDefaults =
    vd?.bot_defaults && typeof vd.bot_defaults === "object"
      ? (vd.bot_defaults as Record<string, unknown>)
      : obj.bot_defaults && typeof obj.bot_defaults === "object"
      ? (obj.bot_defaults as Record<string, unknown>)
      : obj;

  const result: BotDefaults = {};
  if (typeof botDefaults.bot_name === "string" && botDefaults.bot_name.trim()) {
    result.bot_name = botDefaults.bot_name.trim();
  }
  if (typeof botDefaults.language === "string" && botDefaults.language.trim()) {
    result.language = botDefaults.language.trim();
  }
  if (botDefaults.task === "transcribe" || botDefaults.task === "translate") {
    result.task = botDefaults.task;
  }

  return result;
}

export function getLocalBotDefaults(): BotDefaults | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    const extracted = extractBotDefaults(parsed);
    if (!extracted) return null;
    return extracted;
  } catch {
    return null;
  }
}

export function setLocalBotDefaults(defaults: BotDefaults): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(defaults));
  } catch {
    // ignore
  }
}

export function clearLocalBotDefaults(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function toBotDefaultsPayload(defaults: BotDefaults): Record<string, unknown> {
  return {
    vexa_dashboard: {
      bot_defaults: {
        bot_name: defaults.bot_name || undefined,
        language: defaults.language || undefined,
        task: defaults.task || undefined,
      },
    },
  };
}

