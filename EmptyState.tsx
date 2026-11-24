import { ArrowUpRight, BookOpen, Code2, Compass, PenLine } from "lucide-react";
import type { LanguageMode, PersonaMode, UiLocale } from "../types/chat";
import { QUICK_PROMPTS, UI_COPY } from "../constants/prompts";
import { EmblemAvatar } from "./EmblemAvatar";

interface EmptyStateProps {
  uiLocale: UiLocale;
  persona: PersonaMode;
  onSelectPersona: (persona: PersonaMode) => void;
  onSelectQuickPrompt: (
    prompt: string,
    persona: PersonaMode,
    languageMode: LanguageMode
  ) => void;
}

const PERSONA_ICONS: Record<PersonaMode, React.ComponentType<{ className?: string }>> = {
  assistant: Compass,
  tutor: BookOpen,
  writer: PenLine,
  coder: Code2,
};

export function EmptyState({
  uiLocale,
  persona,
  onSelectPersona,
  onSelectQuickPrompt,
}: EmptyStateProps) {
  const copy = UI_COPY[uiLocale];
  const personaKeys: PersonaMode[] = ["assistant", "tutor", "writer", "coder"];

  return (
    <div className="flex flex-col items-center justify-center min-h-full px-4 py-6 sm:py-10">
      <div className="w-full max-w-2xl mx-auto flex flex-col items-center text-center space-y-6">
        <EmblemAvatar size="lg" alt={copy.brandName} />

        <div className="space-y-2 max-w-xl">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white text-balance">
            {copy.greetingTitle}
          </h1>
          <p className="text-sm sm:text-[15px] text-slate-600 dark:text-slate-300 leading-relaxed">
            {copy.greetingSubtitle}
          </p>
        </div>

        {/* Interactive Assistant Mode Switcher */}
        <div
          className="w-full flex flex-wrap items-center justify-center gap-2"
          role="group"
          aria-label={copy.assistantMode}
        >
          {personaKeys.map((key) => {
            const Icon = PERSONA_ICONS[key];
            const active = persona === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelectPersona(key)}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl flex items-center gap-2 text-xs sm:text-sm font-medium transition-all whitespace-nowrap shrink-0 ${
                  active
                    ? "bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-sm shadow-indigo-600/20"
                    : "bg-white dark:bg-[#141A30] text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-indigo-950/70 hover:border-indigo-400/50"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{copy.personas[key].label}</span>
              </button>
            );
          })}
        </div>

        {/* Quick Prompts Grid */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 text-left pt-1">
          {QUICK_PROMPTS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() =>
                onSelectQuickPrompt(item.prompt, item.persona, item.languageMode)
              }
              className="group flex flex-col justify-between p-4 rounded-2xl bg-white dark:bg-[#13182B] border border-slate-200/80 dark:border-indigo-950/70 hover:border-indigo-500/50 dark:hover:border-indigo-500/50 transition-all text-left min-h-[96px] active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold text-slate-900 dark:text-white leading-snug">
                  {uiLocale === "hi" ? item.titleHi : item.titleEn}
                </span>
                <ArrowUpRight className="w-4 h-4 shrink-0 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-indigo-400 transition-colors mt-0.5" />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                {uiLocale === "hi" ? item.subtitleHi : item.subtitleEn}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
