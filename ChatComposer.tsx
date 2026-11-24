import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  ImagePlus,
  Mic,
  MicOff,
  Square,
  X,
} from "lucide-react";
import type {
  ImageAttachment,
  LanguageMode,
  ModelChoice,
  UiLocale,
} from "../types/chat";
import { UI_COPY } from "../constants/prompts";

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
  isFinal: boolean;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface ChatComposerProps {
  uiLocale: UiLocale;
  languageMode: LanguageMode;
  model: ModelChoice;
  isStreaming: boolean;
  onChangeLanguageMode: (mode: LanguageMode) => void;
  onChangeModel: (model: ModelChoice) => void;
  onSend: (text: string, attachment?: ImageAttachment | null) => void;
  onStop: () => void;
}

export function ChatComposer({
  uiLocale,
  languageMode,
  model,
  isStreaming,
  onChangeLanguageMode,
  onChangeModel,
  onSend,
  onStop,
}: ChatComposerProps) {
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState<ImageAttachment | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const copy = UI_COPY[uiLocale];

  useEffect(() => {
    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    setSpeechSupported(Boolean(win.SpeechRecognition || win.webkitSpeechRecognition));
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 148)}px`;
  }, [text]);

  const toggleVoiceInput = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRec) return;

    const recognition = new SpeechRec();
    recognition.lang =
      languageMode === "hi"
        ? "hi-IN"
        : languageMode === "en"
        ? "en-IN"
        : uiLocale === "hi"
        ? "hi-IN"
        : "en-IN";
    recognition.interimResults = true;
    recognition.continuous = false;

    const baseText = text.trim() ? `${text.trim()} ` : "";
    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setText(baseText + transcript);
    };
    recognition.onerror = () => {
      setIsListening(false);
    };
    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.split(",")[1] || "";
      if (!base64) return;
      setAttachment({
        mimeType: file.type,
        data: base64,
        previewUrl: result,
        name: file.name,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSubmit = () => {
    if (isStreaming) return;
    const trimmed = text.trim();
    if (!trimmed && !attachment) return;
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }
    onSend(trimmed, attachment);
    setText("");
    setAttachment(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const languageOptions: LanguageMode[] = ["auto", "en", "hi", "hinglish"];
  const canSend = (text.trim().length > 0 || Boolean(attachment)) && !isStreaming;

  return (
    <div className="shrink-0 w-full bg-gradient-to-t from-[#F6F8FC] via-[#F6F8FC] to-transparent dark:from-[#0B0E1A] dark:via-[#0B0E1A] pt-2 pb-safe px-3 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-2">
        {/* Compact Control Bar: Reply Language + Speed */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
          <div
            className="inline-flex items-center p-0.5 rounded-xl bg-slate-200/75 dark:bg-[#13182B] border border-slate-200/80 dark:border-indigo-950/70 shrink-0"
            role="group"
            aria-label={copy.replyLanguage}
          >
            {languageOptions.map((lang) => {
              const active = languageMode === lang;
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => onChangeLanguageMode(lang)}
                  className={`min-h-[34px] px-2.5 sm:px-3 rounded-[10px] text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? "bg-white dark:bg-gradient-to-r dark:from-blue-600 dark:to-violet-600 text-blue-700 dark:text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  {copy.languages[lang]}
                </button>
              );
            })}
          </div>

          <div
            className="inline-flex items-center p-0.5 rounded-xl bg-slate-200/75 dark:bg-[#13182B] border border-slate-200/80 dark:border-indigo-950/70 shrink-0"
            role="group"
            aria-label={copy.modelSpeed}
          >
            <button
              type="button"
              onClick={() => onChangeModel("gemini-4-hydrogen")}
              className={`min-h-[34px] px-2.5 rounded-[10px] text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                model === "gemini-4-hydrogen"
                  ? "bg-white dark:bg-[#232C4D] text-blue-700 dark:text-indigo-200 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              {copy.balancedModel}
            </button>
            <button
              type="button"
              onClick={() => onChangeModel("gemini-3.1-flash-lite")}
              className={`min-h-[34px] px-2.5 rounded-[10px] text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                model === "gemini-3.1-flash-lite"
                  ? "bg-white dark:bg-[#232C4D] text-blue-700 dark:text-indigo-200 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              {copy.fastModel}
            </button>
          </div>
        </div>

        {/* Main Input Box */}
        <div className="rounded-2xl bg-white dark:bg-[#13182B] border border-slate-200/90 dark:border-indigo-900/60 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/40 focus-within:border-indigo-500/50 transition-all">
          {attachment && (
            <div className="px-3 pt-3 flex items-center gap-2">
              <div className="relative inline-block">
                <img
                  src={attachment.previewUrl}
                  alt={attachment.name}
                  className="h-16 w-16 object-cover rounded-xl border border-slate-200 dark:border-indigo-900/60"
                />
                <button
                  type="button"
                  onClick={() => setAttachment(null)}
                  aria-label="Remove attachment"
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-md hover:bg-rose-600 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                {attachment.name}
              </span>
            </div>
          )}

          <div className="flex items-end gap-1.5 p-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label={copy.attachImage}
              title={copy.attachImage}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-indigo-300 hover:bg-slate-100 dark:hover:bg-[#1C2340] transition-colors shrink-0"
            >
              <ImagePlus className="w-5 h-5" />
            </button>

            <textarea
              ref={textareaRef}
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={
                isListening ? copy.listeningPlaceholder : copy.inputPlaceholder
              }
              className="flex-1 min-w-0 bg-transparent py-2.5 px-1 text-[15px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 resize-none focus:outline-none max-h-[148px] leading-relaxed"
            />

            {speechSupported && (
              <button
                type="button"
                onClick={toggleVoiceInput}
                aria-label={isListening ? copy.stopVoice : copy.voiceInput}
                title={isListening ? copy.stopVoice : copy.voiceInput}
                className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl transition-colors shrink-0 ${
                  isListening
                    ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/40"
                    : "text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-indigo-300 hover:bg-slate-100 dark:hover:bg-[#1C2340]"
                }`}
              >
                {isListening ? (
                  <MicOff className="w-5 h-5" />
                ) : (
                  <Mic className="w-5 h-5" />
                )}
              </button>
            )}

            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                aria-label={copy.stop}
                title={copy.stop}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 active:scale-95 transition-all shrink-0"
              >
                <Square className="w-4 h-4 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSend}
                aria-label={copy.send}
                title={copy.send}
                className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl transition-all shrink-0 ${
                  canSend
                    ? "bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white shadow-sm shadow-indigo-600/25 active:scale-95"
                    : "bg-slate-100 dark:bg-[#1B223C] text-slate-400 dark:text-slate-500 cursor-not-allowed"
                }`}
              >
                <ArrowUp className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        <p className="text-[11px] text-center text-slate-400 dark:text-slate-500">
          {copy.disclaimer}
        </p>
      </div>
    </div>
  );
}
