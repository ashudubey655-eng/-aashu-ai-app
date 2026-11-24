import { useMemo, useState } from "react";
import {
  Check,
  Film,
  MessageSquare,
  Moon,
  Pencil,
  Plus,
  Search,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import type { AppPage, Conversation, UiLocale } from "../types/chat";
import { UI_COPY } from "../constants/prompts";
import { EmblemAvatar } from "./EmblemAvatar";

interface ChatSidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  activePage: AppPage;
  isOpen: boolean;
  uiLocale: UiLocale;
  theme: "light" | "dark";
  onClose: () => void;
  onSelectPage: (page: AppPage) => void;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
  onRenameChat: (id: string, title: string) => void;
  onToggleUiLocale: (locale: UiLocale) => void;
  onToggleTheme: () => void;
}

export function ChatSidebar({
  conversations,
  activeId,
  activePage,
  isOpen,
  uiLocale,
  theme,
  onClose,
  onSelectPage,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onRenameChat,
  onToggleUiLocale,
  onToggleTheme,
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const copy = UI_COPY[uiLocale];

  const grouped = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = conversations
      .filter((c) => c.messages.length > 0 || c.id === activeId)
      .filter((c) => {
        if (!q) return true;
        if (c.title.toLowerCase().includes(q)) return true;
        return c.messages.some((m) => m.text.toLowerCase().includes(q));
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);

    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const sevenDays = 7 * oneDay;

    const today: Conversation[] = [];
    const prev7Days: Conversation[] = [];
    const older: Conversation[] = [];

    for (const chat of filtered) {
      const age = now - chat.updatedAt;
      if (age < oneDay) {
        today.push(chat);
      } else if (age < sevenDays) {
        prev7Days.push(chat);
      } else {
        older.push(chat);
      }
    }

    return { today, prev7Days, older, total: filtered.length };
  }, [conversations, searchQuery, activeId]);

  const startEditing = (chat: Conversation) => {
    setEditingId(chat.id);
    setDraftTitle(chat.title);
  };

  const commitEditing = (id: string) => {
    const clean = draftTitle.trim();
    if (clean) {
      onRenameChat(id, clean);
    }
    setEditingId(null);
  };

  const renderGroup = (label: string, items: Conversation[]) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-1">
        <div className="px-3 pt-3 pb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
          {label}
        </div>
        {items.map((chat) => {
          const isActive = chat.id === activeId;
          const isEditing = editingId === chat.id;

          return (
            <div
              key={chat.id}
              className={`group flex items-center gap-2 rounded-xl px-2.5 transition-colors min-h-[44px] ${
                isActive
                  ? "bg-gradient-to-r from-blue-600/15 to-violet-600/15 text-blue-700 dark:text-indigo-200 ring-1 ring-indigo-500/25"
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-[#192038]"
              }`}
            >
              {isEditing ? (
                <div className="flex items-center gap-1.5 w-full py-1">
                  <input
                    type="text"
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEditing(chat.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    autoFocus
                    className="flex-1 min-w-0 bg-white dark:bg-[#0B0E1A] text-sm px-2.5 py-1.5 rounded-lg border border-indigo-500/50 focus:outline-none text-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => commitEditing(chat.id)}
                    aria-label={copy.renameChat}
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-blue-600 dark:text-indigo-300 hover:bg-indigo-500/15"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectPage("chat");
                      onSelectChat(chat.id);
                      onClose();
                    }}
                    className="flex-1 min-w-0 flex items-center gap-2.5 text-left py-2.5 focus-visible:outline-none"
                  >
                    <MessageSquare className="w-4 h-4 shrink-0 opacity-70" />
                    <span className="truncate text-sm font-medium">
                      {chat.title}
                    </span>
                  </button>
                  <div className="flex items-center gap-0.5 lg:opacity-0 lg:group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditing(chat);
                      }}
                      aria-label={copy.renameChat}
                      title={copy.renameChat}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300/50 dark:hover:bg-slate-800"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteChat(chat.id);
                      }}
                      aria-label={copy.deleteChat}
                      title={copy.deleteChat}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const sidebarContent = (
    <div className="flex flex-col h-full w-72 bg-slate-50 dark:bg-[#0F1426] border-r border-slate-200/80 dark:border-indigo-950/70 select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200/70 dark:border-indigo-950/60">
        <div className="flex items-center gap-2.5 min-w-0">
          <EmblemAvatar size="sm" alt={copy.brandName} />
          <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap truncate">
            {copy.brandName}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close sidebar"
          className="lg:hidden min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-[#192038]"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Primary Destinations + New Chat Button + Search */}
      <div className="p-3 space-y-2.5">
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-200/75 dark:bg-[#151B31]">
          <button
            type="button"
            onClick={() => {
              onSelectPage("chat");
              onClose();
            }}
            className={`min-h-[40px] px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
              activePage === "chat"
                ? "bg-white dark:bg-[#232C4D] text-blue-700 dark:text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
            <span>{uiLocale === "hi" ? "चैट" : "Chat"}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onSelectPage("video");
              onClose();
            }}
            className={`min-h-[40px] px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
              activePage === "video"
                ? "bg-white dark:bg-[#232C4D] text-blue-700 dark:text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Film className="w-3.5 h-3.5 shrink-0" />
            <span>{uiLocale === "hi" ? "वीडियो" : "Video"}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            onSelectPage("chat");
            onNewChat();
            onClose();
          }}
          className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 active:scale-[0.99] text-white text-sm font-semibold shadow-sm shadow-indigo-600/20 transition-all whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>{copy.newChat}</span>
        </button>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={copy.searchPlaceholder}
            className="w-full min-h-[40px] pl-9 pr-3 rounded-xl bg-white dark:bg-[#151B31] border border-slate-200 dark:border-indigo-950/80 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {grouped.total === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
            {searchQuery.trim() ? copy.noMatches : copy.noConversations}
          </div>
        ) : (
          <div className="space-y-2">
            {renderGroup(copy.today, grouped.today)}
            {renderGroup(copy.prev7Days, grouped.prev7Days)}
            {renderGroup(copy.older, grouped.older)}
          </div>
        )}
      </div>

      {/* Bottom Controls: UI Language + Theme */}
      <div className="p-3 border-t border-slate-200/70 dark:border-indigo-950/60 flex items-center justify-between gap-2 pb-safe">
        <div
          className="flex items-center p-1 rounded-xl bg-slate-200/70 dark:bg-[#161C33]"
          role="group"
          aria-label="Interface language"
        >
          <button
            type="button"
            onClick={() => onToggleUiLocale("en")}
            className={`min-h-[36px] px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              uiLocale === "en"
                ? "bg-white dark:bg-[#232C4D] text-blue-700 dark:text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => onToggleUiLocale("hi")}
            className={`min-h-[36px] px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              uiLocale === "hi"
                ? "bg-white dark:bg-[#232C4D] text-blue-700 dark:text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            हिं
          </button>
        </div>

        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={theme === "dark" ? copy.themeLight : copy.themeDark}
          title={theme === "dark" ? copy.themeLight : copy.themeDark}
          className="min-h-[44px] px-3 flex items-center gap-2 rounded-xl bg-white dark:bg-[#161C33] border border-slate-200/80 dark:border-indigo-950/70 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1E2644] transition-colors whitespace-nowrap"
        >
          {theme === "dark" ? (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              <span>{copy.themeLight}</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-indigo-600" />
              <span>{copy.themeDark}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop persistent sidebar */}
      <aside className="hidden lg:block shrink-0 h-full">
        {sidebarContent}
      </aside>

      {/* Mobile slide-over drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={onClose}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full shadow-2xl">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
