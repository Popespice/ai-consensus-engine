"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Eye,
  EyeOff,
  Check,
  Trash2,
  ExternalLink,
  KeyRound,
  ShieldCheck,
} from "lucide-react";

// ── Types ──

export interface UserApiKeys {
  openai?: string;
  anthropic?: string;
  google?: string;
}

interface ProviderConfig {
  id: keyof UserApiKeys;
  name: string;
  label: string;
  placeholder: string;
  docsUrl: string;
  webUrl: string;
  color: string;
  dotColor: string;
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: "openai",
    name: "GPT-5.2",
    label: "OpenAI",
    placeholder: "sk-…",
    docsUrl: "https://platform.openai.com/api-keys",
    webUrl: "https://chatgpt.com",
    color:
      "bg-emerald-100/70 text-emerald-700 border-emerald-200/60 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-400/20",
    dotColor: "bg-emerald-500",
  },
  {
    id: "anthropic",
    name: "Claude 3.5 Sonnet",
    label: "Anthropic",
    placeholder: "sk-ant-…",
    docsUrl: "https://console.anthropic.com/settings/keys",
    webUrl: "https://claude.ai",
    color:
      "bg-orange-100/70 text-orange-700 border-orange-200/60 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-400/20",
    dotColor: "bg-orange-500",
  },
  {
    id: "google",
    name: "Gemini 3 Flash",
    label: "Google AI",
    placeholder: "AIza…",
    docsUrl: "https://aistudio.google.com/app/apikey",
    webUrl: "https://gemini.google.com",
    color:
      "bg-blue-100/70 text-blue-700 border-blue-200/60 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-400/20",
    dotColor: "bg-blue-500",
  },
];

const STORAGE_KEY = "consensus-engine-api-keys";

// ── Helpers ──

export function loadKeys(): UserApiKeys {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveKeys(keys: UserApiKeys) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

export function clearKeys() {
  localStorage.removeItem(STORAGE_KEY);
}

export function connectedCount(keys: UserApiKeys): number {
  return Object.values(keys).filter((v) => v && v.trim().length > 0).length;
}

function maskKey(key: string): string {
  if (key.length <= 8) return "••••••••";
  return key.slice(0, 4) + "••••••••" + key.slice(-4);
}

// ── Component ──

interface ApiKeySettingsProps {
  open: boolean;
  onClose: () => void;
  keys: UserApiKeys;
  onKeysChange: (keys: UserApiKeys) => void;
}

export default function ApiKeySettings({
  open,
  onClose,
  keys,
  onKeysChange,
}: ApiKeySettingsProps) {
  const [draft, setDraft] = useState<UserApiKeys>({});
  const [reveals, setReveals] = useState<Record<string, boolean>>({});

  // Sync draft with current keys when opened
  useEffect(() => {
    if (open) {
      setDraft({ ...keys });
      setReveals({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const handleSave = () => {
    // Strip whitespace from keys
    const cleaned: UserApiKeys = {};
    for (const p of PROVIDERS) {
      const val = draft[p.id]?.trim();
      if (val) cleaned[p.id] = val;
    }
    saveKeys(cleaned);
    onKeysChange(cleaned);
    onClose();
  };

  const handleClearAll = () => {
    clearKeys();
    onKeysChange({});
    setDraft({});
  };

  const toggleReveal = (id: string) => {
    setReveals((r) => ({ ...r, [id]: !r[id] }));
  };

  const hasAnyKey = Object.values(draft).some((v) => v && v.trim().length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="glass relative z-10 w-full max-w-lg animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <KeyRound className="size-5 text-primary" />
            <div>
              <h2 className="text-base font-semibold">API Key Settings</h2>
              <p className="text-xs text-muted-foreground">
                Connect your own accounts for personalized responses
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg transition-colors hover:bg-white/10 dark:hover:bg-white/[0.05]"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Info banner */}
        <div className="mx-6 mt-4 flex items-start gap-2.5 rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/10 dark:border-primary/15 px-4 py-3">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="space-y-0.5">
            <p className="text-xs font-medium">Keys stay on your device</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Your API keys are stored in your browser&apos;s local storage and sent
              directly to each provider. They are never saved on our servers. No
              keys? No problem — the free tier works with our shared keys.
            </p>
          </div>
        </div>

        {/* Provider list */}
        <div className="space-y-3 px-6 py-4">
          {PROVIDERS.map((provider) => {
            const value = draft[provider.id] ?? "";
            const isRevealed = reveals[provider.id] ?? false;

            return (
              <div key={provider.id} className="glass-subtle p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`size-2 rounded-full ${provider.dotColor}`}
                    />
                    <span className="text-sm font-medium">
                      {provider.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      ({provider.name})
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <a
                      href={provider.webUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Web Chat ↗
                    </a>
                    <a
                      href={provider.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[11px] text-primary hover:underline font-medium"
                    >
                      Get API Key
                      <ExternalLink className="size-3" />
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type={isRevealed ? "text" : "password"}
                      value={value}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          [provider.id]: e.target.value,
                        }))
                      }
                      placeholder={provider.placeholder}
                      className="w-full rounded-lg border border-white/15 dark:border-white/10 bg-white/30 dark:bg-white/[0.04] px-3 py-2 text-sm font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleReveal(provider.id)}
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/15 dark:border-white/10 transition-colors hover:bg-white/10 dark:hover:bg-white/[0.05]"
                    title={isRevealed ? "Hide key" : "Reveal key"}
                  >
                    {isRevealed ? (
                      <EyeOff className="size-3.5 text-muted-foreground" />
                    ) : (
                      <Eye className="size-3.5 text-muted-foreground" />
                    )}
                  </button>
                </div>

                {value.trim() && (
                  <div className="flex items-center gap-1.5">
                    <Check className="size-3 text-emerald-500" />
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                      Key set: {maskKey(value.trim())}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/10 px-6 py-4">
          <button
            onClick={handleClearAll}
            disabled={!hasAnyKey}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Trash2 className="size-3" />
            Clear all keys
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm transition-colors hover:bg-white/10 dark:hover:bg-white/[0.05]"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90"
            >
              Save & close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
