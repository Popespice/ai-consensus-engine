"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Send,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  Sparkles,
  BrainCircuit,
  ArrowRight,
  Settings,
  KeyRound,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ApiKeySettings, {
  type UserApiKeys,
  loadKeys,
  connectedCount,
} from "@/components/api-key-settings";

// ── Types ──

interface Claim {
  text: string;
  supporters: string[];
  dissenters: string[];
  warning?: string;
}

interface Conflict {
  topic: string;
  description: string;
}

interface ConsensusResult {
  consensus_score: number;
  consensus_level: "High" | "Medium" | "Low";
  summary: string;
  claims: Claim[];
  conflicts?: Conflict[];
  raw_answers: {
    gpt: string;
    claude: string;
    gemini: string;
  };
}

// ── Sub-Components ──

function ScoreRing({ score, level }: { score: number; level: string }) {
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;

  const color =
    level === "High"
      ? "oklch(0.65 0.20 145)"
      : level === "Medium"
        ? "oklch(0.75 0.18 85)"
        : "oklch(0.65 0.22 30)";

  const labelColor =
    level === "High"
      ? "text-emerald-600 dark:text-emerald-400"
      : level === "Medium"
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-500 dark:text-red-400";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative size-32">
        <svg className="size-full -rotate-90" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke="oklch(0.9 0.01 270 / 30%)"
            strokeWidth="8"
          />
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tracking-tight">{score}</span>
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
            / 100
          </span>
        </div>
      </div>
      <span className={`text-sm font-semibold ${labelColor}`}>
        {level} Consensus
      </span>
    </div>
  );
}

function ModelBadge({ name }: { name: string }) {
  const colors: Record<string, string> = {
    "GPT-4o Mini":
      "bg-emerald-100/70 text-emerald-700 border-emerald-200/60 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-400/20",
    "Claude 3.5 Sonnet":
      "bg-orange-100/70 text-orange-700 border-orange-200/60 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-400/20",
    "Gemini 1.5 Flash":
      "bg-blue-100/70 text-blue-700 border-blue-200/60 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-400/20",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${colors[name] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}
    >
      {name}
    </span>
  );
}

function ClaimCard({ claim, index }: { claim: Claim; index: number }) {
  const hasWarning = claim.dissenters.length > 0;

  return (
    <div
      className={`group glass-subtle p-4 transition-all duration-300 hover:scale-[1.01] hover:shadow-md ${hasWarning ? "border-amber-300/40 dark:border-amber-500/20" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
          {index + 1}
        </div>
        <div className="flex-1 space-y-2.5">
          <p className="text-sm leading-relaxed">{claim.text}</p>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mr-1">
              Supported by
            </span>
            {claim.supporters.map((s) => (
              <ModelBadge key={s} name={s} />
            ))}
          </div>

          {hasWarning && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50/60 dark:bg-amber-500/10 px-3 py-2 border border-amber-200/40 dark:border-amber-500/15">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    Dissent from
                  </span>
                  {claim.dissenters.map((d) => (
                    <ModelBadge key={d} name={d} />
                  ))}
                </div>
                {claim.warning && (
                  <p className="text-xs text-amber-700 dark:text-amber-300/80 leading-relaxed">
                    {claim.warning}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RawAnswerPanel({
  label,
  text,
  color,
}: {
  label: string;
  text: string;
  color: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const unavailable = text === "[unavailable]";

  return (
    <div className="glass-subtle overflow-hidden transition-all duration-300">
      <button
        onClick={() => !unavailable && setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/10 dark:hover:bg-white/[0.03]"
        disabled={unavailable}
      >
        <div className="flex items-center gap-2.5">
          <div className={`size-2 rounded-full ${color}`} />
          <span className="text-sm font-medium">{label}</span>
          {unavailable && (
            <Badge variant="outline" className="text-[10px] opacity-50">
              Unavailable
            </Badge>
          )}
        </div>
        {!unavailable && (
          <ChevronDown
            className={`size-4 text-muted-foreground transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          />
        )}
      </button>
      {expanded && !unavailable && (
        <div className="border-t border-white/10 px-4 py-3">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {text}
          </p>
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8 py-6 animate-in fade-in duration-500">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="relative">
          <BrainCircuit className="size-10 text-primary pulse-soft" />
          <Sparkles className="absolute -right-1 -top-1 size-4 text-primary/60 float" />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-foreground">
            Querying three AI models…
          </p>
          <p className="text-xs text-muted-foreground">
            GPT-4o Mini · Claude 3.5 Sonnet · Gemini 1.5 Flash
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="glass-subtle h-28 shimmer rounded-xl" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="glass-subtle h-20 shimmer rounded-xl" />
          <div className="glass-subtle h-20 shimmer rounded-xl" />
        </div>
        <div className="glass-subtle h-16 shimmer rounded-xl" />
        <div className="glass-subtle h-16 shimmer rounded-xl" />
      </div>

      <div className="flex items-center justify-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="size-1.5 rounded-full bg-primary/40"
            style={{
              animation: `pulse-soft 1.5s ease-in-out ${i * 0.3}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Welcome Prompt (shown once on first visit) ──

function WelcomePrompt({
  onConnect,
  onSkip,
}: {
  onConnect: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="glass w-full max-w-lg p-6 space-y-6 animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
          <BrainCircuit className="size-7 text-primary" />
        </div>
        <h2 className="text-lg font-semibold tracking-tight">
          Welcome to Consensus Engine
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
          This app queries GPT-4o Mini, Claude 3.5 Sonnet, and Gemini 1.5 Flash simultaneously,
          then cross-references their answers to surface agreement, conflicts,
          and a synthesized truth.
        </p>
      </div>

      <div className="space-y-2.5">
        {/* Connect option */}
        <button
          onClick={onConnect}
          className="glass-subtle flex w-full items-center gap-4 p-4 text-left transition-all hover:scale-[1.01] hover:shadow-md"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <KeyRound className="size-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Connect your own API keys</p>
            <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
              Use your own OpenAI, Anthropic, or Google accounts for
              personalized, higher-limit access.
            </p>
          </div>
          <ArrowRight className="size-4 text-muted-foreground" />
        </button>

        {/* Free tier option */}
        <button
          onClick={onSkip}
          className="glass-subtle flex w-full items-center gap-4 p-4 text-left transition-all hover:scale-[1.01] hover:shadow-md"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100/60 dark:bg-emerald-500/15">
            <Zap className="size-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Continue with free tier</p>
            <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
              No setup needed. Uses shared API keys with standard rate limits.
            </p>
          </div>
          <ArrowRight className="size-4 text-muted-foreground" />
        </button>
      </div>

      <p className="text-center text-[11px] text-muted-foreground/60">
        You can connect or disconnect keys anytime from settings.
      </p>
    </div>
  );
}

// ── Main Component ──

const ONBOARDED_KEY = "consensus-engine-onboarded";

export default function ConsensusEngine() {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<ConsensusResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKeys, setApiKeys] = useState<UserApiKeys>({});
  const [showWelcome, setShowWelcome] = useState(false);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load persisted keys and onboarding state on mount
  useEffect(() => {
    setApiKeys(loadKeys());
    const onboarded = localStorage.getItem(ONBOARDED_KEY);
    if (!onboarded) {
      setShowWelcome(true);
    }
    setMounted(true);
  }, []);

  const autoResize = useCallback((el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  const handleDismissWelcome = () => {
    localStorage.setItem(ONBOARDED_KEY, "true");
    setShowWelcome(false);
  };

  const handleConnectFromWelcome = () => {
    handleDismissWelcome();
    setSettingsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Only include non-empty keys
      const keysToSend: UserApiKeys = {};
      if (apiKeys.openai?.trim()) keysToSend.openai = apiKeys.openai.trim();
      if (apiKeys.anthropic?.trim())
        keysToSend.anthropic = apiKeys.anthropic.trim();
      if (apiKeys.google?.trim()) keysToSend.google = apiKeys.google.trim();

      const res = await fetch("/api/consensus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          keys: keysToSend,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const examplePrompts = [
    "Is coffee good for your health?",
    "What caused the 2008 financial crisis?",
    "How does quantum computing work?",
  ];

  const numConnected = connectedCount(apiKeys);

  // Don't render until client-side hydration is done (prevents flash)
  if (!mounted) return null;

  return (
    <TooltipProvider>
      <div className="mesh-gradient flex min-h-screen flex-col items-center px-4 py-12 sm:px-6 lg:px-8">
        {/* ── Header ── */}
        <header className="mb-10 flex flex-col items-center gap-3 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex items-center gap-2.5">
            <BrainCircuit className="size-7 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Consensus Engine
            </h1>
          </div>
          <p className="max-w-md text-sm text-muted-foreground leading-relaxed">
            Ask anything. Three leading AI models answer independently, then
            their responses are cross-referenced and synthesized into one
            verified answer.
          </p>

          {/* Connection status + settings button */}
          <div className="flex items-center gap-2 mt-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setSettingsOpen(true)}
                  className="glass-subtle flex items-center gap-2 px-3 py-1.5 text-xs transition-all hover:scale-105"
                >
                  <Settings className="size-3.5 text-muted-foreground" />
                  {numConnected > 0 ? (
                    <span className="flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      <span className="text-muted-foreground">
                        {numConnected} key{numConnected !== 1 && "s"} connected
                      </span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      Using free tier
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Manage API keys</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </header>

        {/* ── Welcome Prompt (first visit) ── */}
        {showWelcome && (
          <WelcomePrompt
            onConnect={handleConnectFromWelcome}
            onSkip={handleDismissWelcome}
          />
        )}

        {/* ── Main UI (shown after onboarding) ── */}
        {!showWelcome && (
          <>
            {/* ── Search Input ── */}
            <form
              onSubmit={handleSubmit}
              className="glass w-full max-w-2xl p-1.5 animate-in fade-in slide-in-from-bottom-6 duration-700"
              style={{ animationDelay: "100ms" }}
            >
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={prompt}
                  onChange={(e) => {
                    setPrompt(e.target.value);
                    autoResize(e.target);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a question to cross-check across AI models…"
                  rows={1}
                  className="flex-1 resize-none bg-transparent px-4 py-3 text-sm leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none"
                  style={{
                    minHeight: "44px",
                    maxHeight: "120px",
                  }}
                  disabled={loading}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="submit"
                      disabled={!prompt.trim() || loading}
                      className="mb-1.5 mr-1.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Send className="size-4" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Send query (Enter)</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </form>

            {/* ── Example Prompts ── */}
            {!result && !loading && !error && (
              <div
                className="mt-5 flex flex-wrap justify-center gap-2 animate-in fade-in duration-500"
                style={{ animationDelay: "300ms" }}
              >
                {examplePrompts.map((ep) => (
                  <button
                    key={ep}
                    onClick={() => {
                      setPrompt(ep);
                      inputRef.current?.focus();
                    }}
                    className="glass-subtle flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground transition-all hover:text-foreground hover:scale-105"
                  >
                    <ArrowRight className="size-3 opacity-40" />
                    {ep}
                  </button>
                ))}
              </div>
            )}

            {/* ── Loading ── */}
            {loading && (
              <div className="glass mt-8 w-full max-w-2xl p-6">
                <LoadingSkeleton />
              </div>
            )}

            {/* ── Error ── */}
            {error && (
              <div className="glass mt-8 w-full max-w-2xl border-red-200/50 dark:border-red-500/20 p-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-start gap-3">
                  <XCircle className="mt-0.5 size-5 shrink-0 text-red-500" />
                  <div>
                    <p className="text-sm font-medium text-red-700 dark:text-red-400">
                      Something went wrong
                    </p>
                    <p className="mt-1 text-xs text-red-600/80 dark:text-red-300/60">
                      {error}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Results ── */}
            {result && (
              <div className="mt-8 w-full max-w-2xl space-y-5 animate-in fade-in slide-in-from-bottom-6 duration-700">
                {/* Score + Summary Card */}
                <div className="glass p-6">
                  <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
                    <ScoreRing
                      score={result.consensus_score}
                      level={result.consensus_level}
                    />
                    <div className="flex-1 space-y-3 text-center sm:text-left">
                      <div className="flex items-center justify-center gap-2 sm:justify-start">
                        <Sparkles className="size-4 text-primary" />
                        <h2 className="text-base font-semibold">
                          Synthesized Answer
                        </h2>
                      </div>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {result.summary}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Claims */}
                <div className="glass p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-primary" />
                    <h3 className="text-sm font-semibold">
                      Fact-Checked Claims
                    </h3>
                    <Badge
                      variant="secondary"
                      className="ml-auto text-[10px]"
                    >
                      {result.claims.length} claim
                      {result.claims.length !== 1 && "s"}
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    {result.claims.map((claim, i) => (
                      <ClaimCard key={i} claim={claim} index={i} />
                    ))}
                  </div>
                </div>

                {/* Conflicts */}
                {result.conflicts && result.conflicts.length > 0 && (
                  <div className="glass border-amber-200/40 dark:border-amber-500/15 p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <AlertTriangle className="size-4 text-amber-500" />
                      <h3 className="text-sm font-semibold">
                        Conflicts & Contradictions
                      </h3>
                    </div>
                    <div className="space-y-3">
                      {result.conflicts.map((conflict, i) => (
                        <div key={i} className="glass-subtle p-4">
                          <p className="text-sm font-medium">
                            {conflict.topic}
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            {conflict.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Raw Answers */}
                <div className="glass p-5">
                  <h3 className="mb-3 text-sm font-semibold">
                    Raw Model Responses
                  </h3>
                  <div className="space-y-2">
                    <RawAnswerPanel
                      label="GPT-4o Mini"
                      text={result.raw_answers.gpt}
                      color="bg-emerald-500"
                    />
                    <RawAnswerPanel
                      label="Claude 3.5 Sonnet"
                      text={result.raw_answers.claude}
                      color="bg-orange-500"
                    />
                    <RawAnswerPanel
                      label="Gemini 1.5 Flash"
                      text={result.raw_answers.gemini}
                      color="bg-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Footer ── */}
        <footer className="mt-16 mb-4 text-center text-[11px] text-muted-foreground/50">
          Responses are AI-generated and may contain inaccuracies.
          Cross-referencing does not guarantee correctness.
        </footer>
      </div>

      {/* ── Settings Modal ── */}
      <ApiKeySettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        keys={apiKeys}
        onKeysChange={setApiKeys}
      />
    </TooltipProvider>
  );
}
