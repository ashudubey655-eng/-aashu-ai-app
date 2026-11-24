export type LanguageMode = "auto" | "en" | "hi" | "hinglish";

export type UiLocale = "en" | "hi";

export type AppPage = "chat" | "video";

export type PersonaMode = "assistant" | "tutor" | "writer" | "coder";

export type ModelChoice = "gemini-4-hydrogen" | "gemini-3.1-flash-lite";

export type VideoStyle =
  | "3d_cartoon"
  | "realistic"
  | "cinematic"
  | "anime"
  | "documentary"
  | "dreamscape";

export type VideoDuration = "5s" | "10s";

export type VideoAspectRatio = "16:9" | "9:16";

export type VideoProviderId =
  | "huggingface"
  | "fal"
  | "replicate"
  | "custom"
  | "gemini_paid";

export interface VideoProviderInfo {
  id: VideoProviderId;
  nameHi: string;
  tierLabelHi: string;
  envHint: string;
  configured: boolean;
  enabled: boolean;
  isPaid: boolean;
}

export interface VideoStatusResponse {
  connected: boolean;
  activeProvider: VideoProviderId | null;
  paidServicesEnabled: boolean;
  providers: VideoProviderInfo[];
}

export interface VideoConnectionTestResponse {
  ok: boolean;
  provider: VideoProviderId;
  status:
    | "connected"
    | "not_configured"
    | "auth_error"
    | "paid_disabled"
    | "unreachable";
  message: string;
  latencyMs: number;
  accountInfo?: string;
}

export interface ImageAttachment {
  mimeType: string;
  data: string;
  previewUrl: string;
  name: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
  createdAt: number;
  image?: {
    mimeType: string;
    data: string;
    name?: string;
  };
  error?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
  createdAt: number;
  languageMode: LanguageMode;
  persona: PersonaMode;
  model: ModelChoice;
}
