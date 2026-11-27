import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Film, Menu, MessageSquare, SquarePen } from "lucide-react";
import type {
  AppPage,
  ChatMessage,
  Conversation,
  ImageAttachment,
  LanguageMode,
  ModelChoice,
  PersonaMode,
  UiLocale,
} from "./types/chat";
import { UI_COPY } from "./constants/prompts";
import { ChatSidebar } from "./ChatSidebar";
import { EmptyState } from "./components/EmptyState";
import { ChatThread } from "./components/ChatThread";
import { ChatComposer } from "./components/ChatComposer";
import { VideoGeneratorPage } from "./components/VideoGeneratorPage";

const STORAGE_KEY_CHATS = "aashu_ai_conversations_v1";
const STORAGE_KEY_THEME = "aashu_ai_theme_v1";
const STORAGE_KEY_LOCALE = "aashu_ai_locale_v1";

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function createEmptyConversation(
  languageMode: LanguageMode = "auto",
  persona: PersonaMode = "assistant",
  model: ModelChoice = "gemini-3.1-flash-lite"
): Conversation {
  const now = Date.now();
  return {
    id: createId(),
    title: "New chat",
    messages: [],
    createdAt: now,
    updatedAt: now,
    languageMode,
    persona,
    model,
  };
}

const STORAGE_KEY_MODEL_MIGRATED = "aashu_ai_model_migrated_v2";

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CHATS);
      if (raw) {
        const parsed = JSON.parse(raw) as Conversation[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const migrated = localStorage.getItem(STORAGE_KEY_MODEL_MIGRATED);
          if (!migrated) {
            localStorage.setItem(STORAGE_KEY_MODEL_MIGRATED, "1");
            return parsed.map((c) => ({
              ...c,
              model: "gemini-3.1-flash-lite" as ModelChoice,
            }));
          }
          return parsed;
        }
      }
    } catch {
      // ignore malformed storage
    }
    return [createEmptyConversation()];
  });

  const [activeId, setActiveId] = useState<string>(() => conversations[0].id);
  const [activePage, setActivePage] = useState<AppPage>("chat");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_THEME);
      if (saved === "light" || saved === "dark") return saved;
    } catch {
      // ignore
    }
    return "dark";
  });

  const [uiLocale, setUiLocale] = useState<UiLocale>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LOCALE);
      if (saved === "en" || saved === "hi") return saved;
    } catch {
      // ignore
    }
    return "en";
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const copy = UI_COPY[uiLocale];

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    try {
      localStorage.setItem(STORAGE_KEY_THEME, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_LOCALE, uiLocale);
    } catch {
      // ignore
    }
  }, [uiLocale]);

  useEffect(() => {
    try {
      const toStore = conversations.filter(
        (c) => c.messages.length > 0 || c.id === activeId
      );
      localStorage.setItem(STORAGE_KEY_CHATS, JSON.stringify(toStore));
    } catch {
      // ignore quota overflow
    }
  }, [conversations, activeId]);

  const activeConversation = useMemo(() => {
    return (
      conversations.find((c) => c.id === activeId) ||
      conversations[0] ||
      createEmptyConversation()
    );
  }, [conversations, activeId]);

  const updateConversation = useCallback(
    (id: string, updater: (conv: Conversation) => Conversation) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? updater(c) : c))
      );
    },
    []
  );

  const handleNewChat = useCallback(() => {
    if (isStreaming) {
      abortControllerRef.current?.abort();
      setIsStreaming(false);
    }
    const existingEmpty = conversations.find((c) => c.messages.length === 0);
    if (existingEmpty) {
      setActiveId(existingEmpty.id);
      return;
    }
    const fresh = createEmptyConversation(
      activeConversation.languageMode,
      activeConversation.persona,
      activeConversation.model
    );
    setConversations((prev) => [fresh, ...prev]);
    setActiveId(fresh.id);
  }, [conversations, isStreaming, activeConversation]);

  const handleDeleteChat = useCallback(
    (id: string) => {
      if (id === activeId && isStreaming) {
        abortControllerRef.current?.abort();
        setIsStreaming(false);
      }
      setConversations((prev) => {
        const remaining = prev.filter((c) => c.id !== id);
        if (remaining.length === 0) {
          const fresh = createEmptyConversation();
          setActiveId(fresh.id);
          return [fresh];
        }
        if (id === activeId) {
          setActiveId(remaining[0].id);
        }
        return remaining;
      });
    },
    [activeId, isStreaming]
  );

  const handleRenameChat = useCallback(
    (id: string, title: string) => {
      updateConversation(id, (c) => ({ ...c, title }));
    },
    [updateConversation]
  );

  const requestTitle = useCallback(
    async (convId: string, firstMessage: string, languageMode: LanguageMode) => {
      try {
        const res = await fetch("/api/chat/title", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ firstMessage, languageMode }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { title?: string };
        if (data.title) {
          updateConversation(convId, (c) => ({ ...c, title: data.title! }));
        }
      } catch {
        // non-critical title generation
      }
    },
    [updateConversation]
  );

  const streamAssistantReply = useCallback(
    async (
      convId: string,
      historyForApi: ChatMessage[],
      languageMode: LanguageMode,
      persona: PersonaMode,
      model: ModelChoice
    ) => {
      const assistantMsgId = createId();
      const assistantPlaceholder: ChatMessage = {
        id: assistantMsgId,
        role: "model",
        text: "",
        createdAt: Date.now(),
      };

      updateConversation(convId, (c) => ({
        ...c,
        messages: [...historyForApi, assistantPlaceholder],
        updatedAt: Date.now(),
      }));

      const controller = new AbortController();
      abortControllerRef.current = controller;
      setIsStreaming(true);

      try {
        const requestBody = JSON.stringify({
          messages: historyForApi.map((m) => ({
            role: m.role,
            text: m.text,
            image: m.image
              ? { mimeType: m.image.mimeType, data: m.image.data }
              : undefined,
          })),
          languageMode,
          persona,
          model,
        });

        let res = await fetch("/api/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: requestBody,
        });

        if (res.status === 503 && !controller.signal.aborted) {
          await new Promise((r) => setTimeout(r, 700));
          res = await fetch("/api/chat/stream", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: requestBody,
          });
        }

        if (!res.ok || !res.body) {
          const errPayload = await res
            .json()
            .catch(() => ({ error: `Server error (${res.status})` }));
          throw new Error(errPayload.error || `Request failed (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const events = buffer.split("\n\n");
          buffer = events.pop() || "";

          for (const rawEvent of events) {
            const line = rawEvent
              .split("\n")
              .find((l) => l.startsWith("data: "));
            if (!line) continue;

            const payloadStr = line.slice(6).trim();
            if (!payloadStr) continue;

            const payload = JSON.parse(payloadStr) as {
              text?: string;
              done?: boolean;
              error?: string;
            };

            if (payload.error) {
              throw new Error(payload.error);
            }

            if (payload.text) {
              updateConversation(convId, (c) => ({
                ...c,
                updatedAt: Date.now(),
                messages: c.messages.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, text: m.text + payload.text }
                    : m
                ),
              }));
            }
          }
        }
      } catch (err) {
        if ((err as Error)?.name === "AbortError") {
          return;
        }
        const message =
          err instanceof Error
            ? err.message
            : "Could not reach Aashu AI server.";
        updateConversation(convId, (c) => ({
          ...c,
          messages: c.messages.map((m) =>
            m.id === assistantMsgId ? { ...m, error: message } : m
          ),
        }));
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [updateConversation]
  );

  const handleSend = useCallback(
    async (
      text: string,
      attachment?: ImageAttachment | null,
      overridePersona?: PersonaMode,
      overrideLanguageMode?: LanguageMode
    ) => {
      const convId = activeConversation.id;
      const isFirstMessage = activeConversation.messages.length === 0;
      const languageMode = overrideLanguageMode ?? activeConversation.languageMode;
      const persona = overridePersona ?? activeConversation.persona;
      const model = activeConversation.model;

      const userMsg: ChatMessage = {
        id: createId(),
        role: "user",
        text,
        createdAt: Date.now(),
        image: attachment
          ? {
              mimeType: attachment.mimeType,
              data: attachment.data,
              name: attachment.name,
            }
          : undefined,
      };

      const updatedHistory = [...activeConversation.messages, userMsg];
      const fallbackTitle =
        text.trim().slice(0, 38) || attachment?.name || "Image query";

      updateConversation(convId, (c) => ({
        ...c,
        title: isFirstMessage ? fallbackTitle : c.title,
        languageMode,
        persona,
        messages: updatedHistory,
        updatedAt: Date.now(),
      }));

      if (isFirstMessage && text.trim()) {
        void requestTitle(convId, text.trim(), languageMode);
      }

      await streamAssistantReply(
        convId,
        updatedHistory,
        languageMode,
        persona,
        model
      );
    },
    [activeConversation, updateConversation, requestTitle, streamAssistantReply]
  );

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const handleRegenerate = useCallback(async () => {
    if (isStreaming) return;
    const msgs = activeConversation.messages;
    if (msgs.length === 0) return;

    let sliceEnd = msgs.length;
    if (msgs[msgs.length - 1].role === "model") {
      sliceEnd = msgs.length - 1;
    }
    const baseHistory = msgs.slice(0, sliceEnd);
    if (baseHistory.length === 0) return;

    await streamAssistantReply(
      activeConversation.id,
      baseHistory,
      activeConversation.languageMode,
      activeConversation.persona,
      activeConversation.model
    );
  }, [activeConversation, isStreaming, streamAssistantReply]);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-[#F6F8FC] dark:bg-[#0B0E1A] text-slate-900 dark:text-slate-100">
      <ChatSidebar
        conversations={conversations}
        activeId={activeConversation.id}
        activePage={activePage}
        isOpen={sidebarOpen}
        uiLocale={uiLocale}
        theme={theme}
        onClose={() => setSidebarOpen(false)}
        onSelectPage={setActivePage}
        onSelectChat={(id) => {
          setActivePage("chat");
          setActiveId(id);
        }}
        onNewChat={() => {
          setActivePage("chat");
          handleNewChat();
        }}
        onDeleteChat={handleDeleteChat}
        onRenameChat={handleRenameChat}
        onToggleUiLocale={setUiLocale}
        onToggleTheme={() =>
          setTheme((prev) => (prev === "dark" ? "light" : "dark"))
        }
      />

      {/* Main Assistant Workspace */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        {/* Compact Top App Bar (52px, <= 15% mobile height) */}
        <header className="shrink-0 h-[52px] px-3 sm:px-6 flex items-center justify-between gap-3 border-b border-slate-200/70 dark:border-indigo-950/60 bg-white/80 dark:bg-[#0B0E1A]/85 backdrop-blur-md z-20">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              className="lg:hidden min-h-[44px] min-w-[44px] -ml-1.5 flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-[#192038] transition-colors shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-base font-bold tracking-tight text-slate-950 dark:text-white whitespace-nowrap truncate">
              {copy.brandName}
            </span>
          </div>

          {/* Center Page Switcher */}
          <nav
            className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-[#151B31] border border-slate-200/80 dark:border-indigo-950/70 shrink-0"
            aria-label="Aashu AI pages"
          >
            <button
              type="button"
              onClick={() => setActivePage("chat")}
              className={`min-h-[34px] px-2.5 sm:px-3.5 rounded-[10px] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                activePage === "chat"
                  ? "bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 shrink-0" />
              <span>{uiLocale === "hi" ? "चैट" : "Chat"}</span>
            </button>
            <button
              type="button"
              onClick={() => setActivePage("video")}
              className={`min-h-[34px] px-2.5 sm:px-3.5 rounded-[10px] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                activePage === "video"
                  ? "bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white"
              }`}
            >
              <Film className="w-3.5 h-3.5 shrink-0" />
              <span>{uiLocale === "hi" ? "वीडियो" : "Video"}</span>
            </button>
          </nav>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setUiLocale((prev) => (prev === "en" ? "hi" : "en"))}
              aria-label="Toggle Hindi or English UI"
              className="hidden sm:inline-flex items-center min-h-[36px] px-2.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-[#151B31] text-blue-700 dark:text-indigo-300 border border-slate-200/80 dark:border-indigo-950/70 hover:border-indigo-400/50 transition-colors whitespace-nowrap"
            >
              {uiLocale === "en" ? "हिंदी UI" : "English UI"}
            </button>

            {activePage === "chat" && (
              <button
                type="button"
                onClick={handleNewChat}
                aria-label={copy.newChat}
                title={copy.newChat}
                className="lg:hidden min-h-[44px] min-w-[44px] -mr-1.5 flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-[#192038] transition-colors shrink-0"
              >
                <SquarePen className="w-5 h-5" />
              </button>
            )}
          </div>
        </header>

        {activePage === "video" ? (
          <VideoGeneratorPage />
        ) : (
          <>
            {/* Scrollable Thread or Welcome Screen */}
            <main className="flex-1 overflow-y-auto min-h-0">
              {activeConversation.messages.length === 0 ? (
                <EmptyState
                  uiLocale={uiLocale}
                  persona={activeConversation.persona}
                  onSelectPersona={(persona) =>
                    updateConversation(activeConversation.id, (c) => ({
                      ...c,
                      persona,
                    }))
                  }
                  onSelectQuickPrompt={(prompt, persona, lang) => {
                    void handleSend(prompt, null, persona, lang);
                  }}
                />
              ) : (
                <ChatThread
                  messages={activeConversation.messages}
                  isStreaming={isStreaming}
                  uiLocale={uiLocale}
                  onRegenerate={handleRegenerate}
                />
              )}
            </main>

            {/* Bottom Thumb-Zone Composer */}
            <ChatComposer
              uiLocale={uiLocale}
              languageMode={activeConversation.languageMode}
              model={activeConversation.model}
              isStreaming={isStreaming}
              onChangeLanguageMode={(languageMode) =>
                updateConversation(activeConversation.id, (c) => ({
                  ...c,
                  languageMode,
                }))
              }
              onChangeModel={(model) =>
                updateConversation(activeConversation.id, (c) => ({
                  ...c,
                  model,
                }))
              }
              onSend={(text, attachment) => {
                void handleSend(text, attachment);
              }}
              onStop={handleStop}
            />
          </>
        )}
      </div>
    </div>
  );
}
