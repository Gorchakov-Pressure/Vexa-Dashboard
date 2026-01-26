"use client";

import { useEffect, useState } from "react";
import { extractBotDefaults, getLocalBotDefaults, type BotDefaults } from "@/lib/bot-defaults";

interface UserBotDefaultsState {
  defaults: BotDefaults | null;
  isLoading: boolean;
  isSupported: boolean;
  error: string | null;
}

let cached: BotDefaults | null = null;
let cachedSupported: boolean | null = null;
let inFlight: Promise<BotDefaults | null> | null = null;

async function fetchUserBotDefaults(): Promise<BotDefaults | null> {
  const res = await fetch("/api/vexa/user/data", { method: "GET" });
  if (res.status === 404) {
    cachedSupported = false;
    return null;
  }
  cachedSupported = true;
  const json = await res.json().catch(() => ({}));
  const serverDefaults = extractBotDefaults(json) || null;

  // If server returns empty, use local fallback (until backend persists)
  const hasServerValues = Boolean(serverDefaults?.bot_name || serverDefaults?.language || serverDefaults?.task);
  if (hasServerValues) return serverDefaults;

  const local = getLocalBotDefaults();
  return local;
}

export async function prefetchUserBotDefaults(): Promise<BotDefaults | null> {
  if (cachedSupported === false) return null;
  if (cached) return cached;
  if (!inFlight) {
    inFlight = fetchUserBotDefaults()
      .then((v) => {
        cached = v;
        return v;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

export function useUserBotDefaults(): UserBotDefaultsState {
  const [state, setState] = useState<UserBotDefaultsState>({
    defaults: cached,
    isLoading: cached === null && cachedSupported !== false,
    isSupported: cachedSupported !== false,
    error: null,
  });

  useEffect(() => {
    if (cachedSupported === false) {
      setState((s) => ({ ...s, isLoading: false, isSupported: false }));
      return;
    }
    if (cached) {
      setState((s) => ({ ...s, defaults: cached, isLoading: false, isSupported: true }));
      return;
    }

    prefetchUserBotDefaults()
      .then((defaults) => {
        setState({ defaults, isLoading: false, isSupported: cachedSupported !== false, error: null });
      })
      .catch((err) => {
        setState({ defaults: null, isLoading: false, isSupported: true, error: (err as Error).message });
      });
  }, []);

  return state;
}

