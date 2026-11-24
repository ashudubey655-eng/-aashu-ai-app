import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import type { Content, Part, GenerateContentResponse } from "@google/genai";
import { InferenceClient } from "@huggingface/inference";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === "production";

type LanguageMode = "auto" | "en" | "hi" | "hinglish";
type PersonaMode = "assistant" | "tutor" | "writer" | "coder";
type AllowedModel = "gemini-4-hydrogen" | "gemini-3.1-flash-lite";
type VideoProviderId =
  | "huggingface"
  | "fal"
  | "replicate"
  | "custom"
  | "gemini_paid";

interface IncomingMessage {
  role: "user" | "model";
  text: string;
  image?: {
    mimeType: string;
    data: string;
  };
}

interface ChatRequestBody {
  messages?: IncomingMessage[];
  languageMode?: LanguageMode;
  persona?: PersonaMode;
  model?: AllowedModel;
}

interface TitleRequestBody {
  firstMessage?: string;
  languageMode?: LanguageMode;
}

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY_MISSING");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function buildSystemInstruction(
  languageMode: LanguageMode,
  persona: PersonaMode
): string {
  const languageDirective: Record<LanguageMode, string> = {
    auto: "Detect the user's language automatically. If the user writes in Hindi (Devanagari), reply in natural, clear Hindi (Devanagari). If the user writes in Hinglish (Hindi in Latin script), reply in natural Hinglish or offer clear Hindi/English as appropriate. If the user writes in English, reply in crisp English.",
    en: "Always respond in clear, natural English unless the user explicitly asks for a Hindi translation or example.",
    hi: "हमेशा स्पष्ट, स्वाभाविक और सम्मानजनक हिंदी (देवनागरी लिपि) में उत्तर दें। तकनीकी शब्दों को सरल हिंदी में समझाएँ और जहाँ आवश्यक हो वहां अंग्रेजी शब्द कोष्ठक में लिखें।",
    hinglish:
      "Always respond in conversational, friendly Hinglish (natural Hindi written in Roman/Latin script mixed with everyday English), easy to read on a mobile phone.",
  };

  const personaDirective: Record<PersonaMode, string> = {
    assistant:
      "You are Aashu AI, a thoughtful, fast, and reliable Android personal AI assistant. Give direct, well-structured, mobile-friendly answers with clean bullet points when helpful.",
    tutor:
      "You are Aashu AI in Study & Explain mode. Break down complex concepts step by step with relatable everyday examples, clear analogies, and short check-in summaries.",
    writer:
      "You are Aashu AI in Writing & Translate mode. Craft polished messages, WhatsApp notes, emails, essays, and accurate Hindi-English translations preserving tone and nuance.",
    coder:
      "You are Aashu AI in Coding & Tech mode. Provide clean, production-ready code with concise explanations, edge-case notes, and clear formatting.",
  };

  return [
    personaDirective[persona],
    languageDirective[languageMode],
    "Never claim to be running on a different brand name—your name is Aashu AI.",
    "Keep formatting clean Markdown without excessive filler.",
  ].join("\n\n");
}

function isRetryableOrFallbackError(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err);
  return (
    raw.includes("503") ||
    raw.includes("UNAVAILABLE") ||
    raw.includes("Service Unavailable") ||
    raw.includes("high demand") ||
    raw.includes("RESOURCE_EXHAUSTED") ||
    raw.includes("429") ||
    raw.includes("NOT_FOUND") ||
    raw.includes("404") ||
    raw.includes("MODEL_FIRST_CHUNK_TIMEOUT")
  );
}

function formatErrorMessage(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw === "GEMINI_API_KEY_MISSING") {
    return {
      status: 500,
      message:
        "Gemini API key is not configured. Please check Settings > Secrets in AI Studio.",
    };
  }
  if (raw.includes("PERMISSION_DENIED") || raw.includes("403")) {
    return {
      status: 403,
      message:
        "Permission denied by Gemini API. Please check your API key in Settings > Secrets.",
    };
  }
  if (raw.includes("API_KEY_INVALID") || raw.includes("400")) {
    return {
      status: 400,
      message:
        "Invalid request or API key. Please verify your API key in Settings > Secrets.",
    };
  }
  if (raw.includes("RESOURCE_EXHAUSTED") || raw.includes("429")) {
    return {
      status: 429,
      message:
        "Rate limit reached on the Gemini API. Please wait a moment and try again.",
    };
  }
  if (
    raw.includes("503") ||
    raw.includes("UNAVAILABLE") ||
    raw.includes("Service Unavailable") ||
    raw.includes("high demand") ||
    raw.includes("MODEL_FIRST_CHUNK_TIMEOUT")
  ) {
    return {
      status: 503,
      message:
        "The AI service is temporarily busy. Please try sending your message again in a moment.",
    };
  }
  if (raw.includes("NOT_FOUND") || raw.includes("404")) {
    return {
      status: 404,
      message: "Requested Gemini model was not found.",
    };
  }
  return {
    status: 500,
    message: raw || "Unexpected server error while contacting Gemini.",
  };
}

function toGeminiParts(msg: IncomingMessage): Part[] {
  const parts: Part[] = [];
  if (msg.image?.data && msg.image?.mimeType) {
    parts.push({
      inlineData: {
        mimeType: msg.image.mimeType,
        data: msg.image.data,
      },
    });
  }
  if (msg.text && msg.text.trim().length > 0) {
    parts.push({ text: msg.text });
  } else if (parts.length > 0) {
    parts.push({ text: "Please describe or help with this image." });
  }
  return parts;
}

async function streamModelResponse(
  ai: GoogleGenAI,
  model: AllowedModel,
  history: Content[],
  currentParts: Part[],
  systemInstruction: string,
  abortSignal: AbortSignal,
  onChunk: (delta: string) => void
): Promise<boolean> {
  const chat = ai.chats.create({
    model,
    history,
    config: {
      systemInstruction,
      ...(model === "gemini-4-hydrogen"
        ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
        : {}),
    },
  });

  const FIRST_CHUNK_TIMEOUT_MS =
    model === "gemini-3.1-flash-lite" ? 10000 : 7000;
  let emittedAnyText = false;

  const streamPromise = chat.sendMessageStream({
    message: currentParts,
  });

  const stream = await Promise.race([
    streamPromise,
    new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("MODEL_FIRST_CHUNK_TIMEOUT"));
      }, FIRST_CHUNK_TIMEOUT_MS);
      abortSignal.addEventListener(
        "abort",
        () => clearTimeout(timer),
        { once: true }
      );
    }),
  ]);

  const iterator = stream[Symbol.asyncIterator]();

  while (true) {
    if (abortSignal.aborted) break;

    const nextPromise = iterator.next();
    const result = !emittedAnyText
      ? await Promise.race([
          nextPromise,
          new Promise<never>((_, reject) => {
            const timer = setTimeout(() => {
              reject(new Error("MODEL_FIRST_CHUNK_TIMEOUT"));
            }, FIRST_CHUNK_TIMEOUT_MS);
            abortSignal.addEventListener(
              "abort",
              () => clearTimeout(timer),
              { once: true }
            );
          }),
        ])
      : await nextPromise;

    if (result.done) break;
    const c = result.value as GenerateContentResponse;
    const delta = c.text;
    if (delta) {
      emittedAnyText = true;
      onChunk(delta);
    }
  }

  return emittedAnyText;
}

const modelCooldownUntil = new Map<AllowedModel, number>();
const COOLDOWN_MS = 5 * 60 * 1000;

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("ABORTED"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("ABORTED"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function getHfToken(): string {
  return (process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY || "").trim();
}

function getFalKey(): string {
  return (process.env.FAL_KEY || "").trim();
}

function getReplicateToken(): string {
  return (process.env.REPLICATE_API_TOKEN || "").trim();
}

function getCustomVideoUrl(): string {
  return (process.env.VIDEO_API_URL || "").trim();
}

function isPaidVideoAllowed(): boolean {
  return process.env.ALLOW_PAID_VIDEO_SERVICES === "true";
}

function getVideoProvidersStatus() {
  const paidAllowed = isPaidVideoAllowed();
  const hfConfigured = Boolean(getHfToken());
  const falConfigured = Boolean(getFalKey());
  const replicateConfigured = Boolean(getReplicateToken());
  const customConfigured = Boolean(getCustomVideoUrl());
  const geminiPaidConfigured =
    paidAllowed && Boolean(process.env.GEMINI_API_KEY?.trim());

  const providers = [
    {
      id: "huggingface" as VideoProviderId,
      nameHi: "Hugging Face Inference",
      tierLabelHi: "फ़्री ट्रायल क्रेडिट",
      envHint: "HF_TOKEN",
      configured: hfConfigured,
      enabled: hfConfigured,
      isPaid: false,
    },
    {
      id: "fal" as VideoProviderId,
      nameHi: "fal.ai (Wan / LTX)",
      tierLabelHi: "फ़्री स्टार्टर क्रेडिट",
      envHint: "FAL_KEY",
      configured: falConfigured,
      enabled: falConfigured,
      isPaid: false,
    },
    {
      id: "replicate" as VideoProviderId,
      nameHi: "Replicate (Wan 2.1)",
      tierLabelHi: "फ़्री ट्रायल क्रेडिट",
      envHint: "REPLICATE_API_TOKEN",
      configured: replicateConfigured,
      enabled: replicateConfigured,
      isPaid: false,
    },
    {
      id: "custom" as VideoProviderId,
      nameHi: "कस्टम फ़्री वीडियो API",
      tierLabelHi: "सेल्फ-होस्टेड / मुफ़्त",
      envHint: "VIDEO_API_URL",
      configured: customConfigured,
      enabled: customConfigured,
      isPaid: false,
    },
    {
      id: "gemini_paid" as VideoProviderId,
      nameHi: "Gemini Omni वीडियो",
      tierLabelHi: "पेड बिलिंग आवश्यक",
      envHint: "ALLOW_PAID_VIDEO_SERVICES=true",
      configured: geminiPaidConfigured,
      enabled: paidAllowed && geminiPaidConfigured,
      isPaid: true,
    },
  ];

  const active = providers.find((p) => p.enabled) || null;
  return {
    connected: Boolean(active),
    activeProvider: active?.id ?? null,
    paidServicesEnabled: paidAllowed,
    providers,
  };
}

async function testProviderConnection(providerId: VideoProviderId): Promise<{
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
}> {
  const start = Date.now();

  if (providerId === "gemini_paid") {
    if (!isPaidVideoAllowed()) {
      return {
        ok: false,
        provider: providerId,
        status: "paid_disabled",
        message:
          "पेड वीडियो सेवाएँ डिफ़ॉल्ट रूप से बंद रखी गई हैं (ALLOW_PAID_VIDEO_SERVICES=false)।",
        latencyMs: Date.now() - start,
      };
    }
    if (!process.env.GEMINI_API_KEY?.trim()) {
      return {
        ok: false,
        provider: providerId,
        status: "not_configured",
        message: "GEMINI_API_KEY कॉन्फ़िगर नहीं है।",
        latencyMs: Date.now() - start,
      };
    }
    return {
      ok: true,
      provider: providerId,
      status: "connected",
      message: "पेड Gemini वीडियो विकल्प सक्रिय है।",
      latencyMs: Date.now() - start,
    };
  }

  if (providerId === "huggingface") {
    const token = getHfToken();
    if (!token) {
      return {
        ok: false,
        provider: providerId,
        status: "not_configured",
        message:
          "Hugging Face फ़्री ट्रायल सेवा कॉन्फ़िगर नहीं है। सर्वर Secrets में HF_TOKEN सेट करें।",
        latencyMs: 0,
      };
    }
    try {
      const resp = await fetch("https://huggingface.co/api/whoami-v2", {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
      });
      const latencyMs = Date.now() - start;
      if (resp.status === 401 || resp.status === 403) {
        return {
          ok: false,
          provider: providerId,
          status: "auth_error",
          message:
            "HF_TOKEN अमान्य है या इसकी अनुमति समाप्त हो गई है। कृपया नया टोकन जाँचें।",
          latencyMs,
        };
      }
      if (!resp.ok) {
        return {
          ok: false,
          provider: providerId,
          status: "unreachable",
          message: `Hugging Face सर्वर से अप्रत्याशित उत्तर मिला (HTTP ${resp.status})।`,
          latencyMs,
        };
      }
      const data = (await resp.json().catch(() => ({}))) as {
        name?: string;
        fullname?: string;
      };
      const account = data.name || data.fullname || "सत्यापित खाता";
      return {
        ok: true,
        provider: providerId,
        status: "connected",
        message: `Hugging Face Inference API से सफलतापूर्वक जुड़ा हुआ है (${account})।`,
        latencyMs,
        accountInfo: account,
      };
    } catch {
      return {
        ok: false,
        provider: providerId,
        status: "unreachable",
        message: "Hugging Face API तक पहुँचने में नेटवर्क त्रुटि हुई।",
        latencyMs: Date.now() - start,
      };
    }
  }

  if (providerId === "fal") {
    const falKey = getFalKey();
    if (!falKey) {
      return {
        ok: false,
        provider: providerId,
        status: "not_configured",
        message:
          "fal.ai फ़्री स्टार्टर सेवा कॉन्फ़िगर नहीं है। सर्वर Secrets में FAL_KEY सेट करें।",
        latencyMs: 0,
      };
    }
    try {
      const resp = await fetch(
        "https://queue.fal.run/fal-ai/wan-t2v/requests/00000000-0000-0000-0000-000000000000/status",
        {
          headers: { Authorization: `Key ${falKey}` },
          signal: AbortSignal.timeout(8000),
        }
      );
      const latencyMs = Date.now() - start;
      if (resp.status === 401 || resp.status === 403) {
        return {
          ok: false,
          provider: providerId,
          status: "auth_error",
          message: "FAL_KEY अमान्य है या क्रेडिट समाप्त हो चुके हैं।",
          latencyMs,
        };
      }
      return {
        ok: true,
        provider: providerId,
        status: "connected",
        message: "fal.ai वीडियो सेवा सत्यापित और तैयार है।",
        latencyMs,
      };
    } catch {
      return {
        ok: false,
        provider: providerId,
        status: "unreachable",
        message: "fal.ai सर्वर से संपर्क नहीं हो सका।",
        latencyMs: Date.now() - start,
      };
    }
  }

  if (providerId === "replicate") {
    const token = getReplicateToken();
    if (!token) {
      return {
        ok: false,
        provider: providerId,
        status: "not_configured",
        message:
          "Replicate फ़्री ट्रायल सेवा कॉन्फ़िगर नहीं है। सर्वर Secrets में REPLICATE_API_TOKEN सेट करें।",
        latencyMs: 0,
      };
    }
    try {
      const resp = await fetch("https://api.replicate.com/v1/account", {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
      });
      const latencyMs = Date.now() - start;
      if (resp.status === 401 || resp.status === 403) {
        return {
          ok: false,
          provider: providerId,
          status: "auth_error",
          message: "REPLICATE_API_TOKEN अमान्य है।",
          latencyMs,
        };
      }
      if (!resp.ok) {
        return {
          ok: false,
          provider: providerId,
          status: "unreachable",
          message: `Replicate API त्रुटि (HTTP ${resp.status})।`,
          latencyMs,
        };
      }
      const data = (await resp.json().catch(() => ({}))) as {
        username?: string;
        name?: string;
      };
      const account = data.username || data.name || "सत्यापित खाता";
      return {
        ok: true,
        provider: providerId,
        status: "connected",
        message: `Replicate API से सफलतापूर्वक जुड़ा हुआ है (${account})।`,
        latencyMs,
        accountInfo: account,
      };
    } catch {
      return {
        ok: false,
        provider: providerId,
        status: "unreachable",
        message: "Replicate सर्वर से संपर्क नहीं हो सका।",
        latencyMs: Date.now() - start,
      };
    }
  }

  // custom provider
  const customUrl = getCustomVideoUrl();
  if (!customUrl) {
    return {
      ok: false,
      provider: "custom",
      status: "not_configured",
      message:
        "कस्टम वीडियो API कॉन्फ़िगर नहीं है। सर्वर में VIDEO_API_URL सेट करें।",
      latencyMs: 0,
    };
  }
  try {
    const headers: Record<string, string> = {};
    if (process.env.VIDEO_API_KEY?.trim()) {
      headers.Authorization = `Bearer ${process.env.VIDEO_API_KEY.trim()}`;
    }
    const resp = await fetch(customUrl, {
      method: "HEAD",
      headers,
      signal: AbortSignal.timeout(8000),
    });
    const latencyMs = Date.now() - start;
    if (resp.status === 401 || resp.status === 403) {
      return {
        ok: false,
        provider: "custom",
        status: "auth_error",
        message: "कस्टम वीडियो API की कुंजी (VIDEO_API_KEY) अमान्य है।",
        latencyMs,
      };
    }
    return {
      ok: resp.status < 500,
      provider: "custom",
      status: resp.status < 500 ? "connected" : "unreachable",
      message:
        resp.status < 500
          ? `कस्टम वीडियो API उपलब्ध है (HTTP ${resp.status})।`
          : `कस्टम वीडियो API त्रुटि (HTTP ${resp.status})।`,
      latencyMs,
    };
  } catch {
    return {
      ok: false,
      provider: "custom",
      status: "unreachable",
      message: "कस्टम वीडियो API (VIDEO_API_URL) तक पहुँच नहीं हो सकी।",
      latencyMs: Date.now() - start,
    };
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "12mb" }));

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.post("/api/chat/stream", async (req: Request, res: Response) => {
    const body = (req.body || {}) as ChatRequestBody;
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const languageMode: LanguageMode =
      body.languageMode &&
      ["auto", "en", "hi", "hinglish"].includes(body.languageMode)
        ? body.languageMode
        : "auto";
    const persona: PersonaMode =
      body.persona &&
      ["assistant", "tutor", "writer", "coder"].includes(body.persona)
        ? body.persona
        : "assistant";
    const requestedModel: AllowedModel =
      body.model === "gemini-4-hydrogen"
        ? "gemini-4-hydrogen"
        : "gemini-3.1-flash-lite";

    if (messages.length === 0) {
      res.status(400).json({ error: "At least one message is required." });
      return;
    }

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== "user") {
      res.status(400).json({ error: "Last message must be from user." });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const abortController = new AbortController();
    res.on("close", () => {
      abortController.abort();
    });

    try {
      const ai = getAiClient();
      const historyMessages = messages.slice(0, -1);
      const history: Content[] = historyMessages
        .filter((m) => m.text?.trim() || m.image)
        .map((m) => ({
          role: m.role,
          parts: toGeminiParts(m),
        }));

      const currentParts = toGeminiParts(lastMessage);
      const systemInstruction = buildSystemInstruction(languageMode, persona);

      const now = Date.now();
      const hydrogenHealthy =
        (modelCooldownUntil.get("gemini-4-hydrogen") ?? 0) <= now;

      const attempts: Array<{ model: AllowedModel; delayMs: number }> =
        requestedModel === "gemini-4-hydrogen" && hydrogenHealthy
          ? [
              { model: "gemini-4-hydrogen", delayMs: 0 },
              { model: "gemini-3.1-flash-lite", delayMs: 0 },
              { model: "gemini-3.1-flash-lite", delayMs: 500 },
              { model: "gemini-3.1-flash-lite", delayMs: 1200 },
            ]
          : [
              { model: "gemini-3.1-flash-lite", delayMs: 0 },
              { model: "gemini-3.1-flash-lite", delayMs: 500 },
              { model: "gemini-3.1-flash-lite", delayMs: 1200 },
              ...(hydrogenHealthy
                ? [{ model: "gemini-4-hydrogen" as AllowedModel, delayMs: 0 }]
                : []),
            ];

      let lastErr: unknown = null;
      let succeeded = false;

      for (const attempt of attempts) {
        if (abortController.signal.aborted) break;
        if (attempt.delayMs > 0) {
          await sleep(attempt.delayMs, abortController.signal);
        }
        let emittedAny = false;
        try {
          emittedAny = await streamModelResponse(
            ai,
            attempt.model,
            history,
            currentParts,
            systemInstruction,
            abortController.signal,
            (delta) => {
              res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
            }
          );
          modelCooldownUntil.delete(attempt.model);
          succeeded = true;
          break;
        } catch (err) {
          lastErr = err;
          if (abortController.signal.aborted) break;
          if (!emittedAny && isRetryableOrFallbackError(err)) {
            if (attempt.model === "gemini-4-hydrogen") {
              modelCooldownUntil.set(
                "gemini-4-hydrogen",
                Date.now() + COOLDOWN_MS
              );
            }
            continue;
          }
          throw err;
        }
      }

      if (!succeeded && lastErr && !abortController.signal.aborted) {
        throw lastErr;
      }

      if (!abortController.signal.aborted) {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
      }
    } catch (err) {
      if (!abortController.signal.aborted) {
        const formatted = formatErrorMessage(err);
        res.write(
          `data: ${JSON.stringify({
            error: formatted.message,
            status: formatted.status,
          })}\n\n`
        );
        res.end();
      }
    }
  });

  app.post("/api/chat/title", async (req: Request, res: Response) => {
    const body = (req.body || {}) as TitleRequestBody;
    const firstMessage = (body.firstMessage || "").trim();
    if (!firstMessage) {
      res.status(400).json({ error: "firstMessage is required" });
      return;
    }

    try {
      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: `Create a very short 3 to 5 word conversation title summarizing this message, in the same language/script as the message (Hindi Devanagari if Hindi, English if English). Output ONLY the plain title without quotes or punctuation:\n\n${firstMessage.slice(0, 400)}`,
      });
      const title = (response.text || "")
        .replace(/^["'«»]+|["'«»]+$/g, "")
        .trim();
      res.json({ title: title || firstMessage.slice(0, 36) });
    } catch {
      res.json({ title: firstMessage.slice(0, 36) });
    }
  });

  app.get("/api/video/status", (_req: Request, res: Response) => {
    res.json(getVideoProvidersStatus());
  });

  app.post("/api/video/test", async (req: Request, res: Response) => {
    const body = (req.body || {}) as { provider?: VideoProviderId };
    const status = getVideoProvidersStatus();
    const targetProvider: VideoProviderId =
      body.provider &&
      ["huggingface", "fal", "replicate", "custom", "gemini_paid"].includes(
        body.provider
      )
        ? body.provider
        : status.activeProvider || "huggingface";

    const result = await testProviderConnection(targetProvider);
    res.json(result);
  });

  app.post("/api/video/generate", async (req: Request, res: Response) => {
    const body = (req.body || {}) as {
      provider?: VideoProviderId;
      prompt?: string;
      style?: string;
      duration?: string;
      aspectRatio?: string;
      image?: { mimeType?: string; data?: string };
    };

    const status = getVideoProvidersStatus();
    const chosenProvider: VideoProviderId | null =
      body.provider &&
      ["huggingface", "fal", "replicate", "custom", "gemini_paid"].includes(
        body.provider
      )
        ? body.provider
        : status.activeProvider;

    if (!chosenProvider) {
      res.status(503).json({
        configured: false,
        error:
          "कोई फ़्री-ट्रायल वीडियो सेवा (HF_TOKEN, FAL_KEY, REPLICATE_API_TOKEN या VIDEO_API_URL) कॉन्फ़िगर नहीं है। बिना वास्तविक सेवा के कोई नकली वीडियो नहीं बनाया जाएगा।",
      });
      return;
    }

    if (chosenProvider === "gemini_paid" && !isPaidVideoAllowed()) {
      res.status(403).json({
        configured: false,
        error:
          "पेड वीडियो सेवाएँ डिफ़ॉल्ट रूप से बंद हैं। कृपया फ़्री-ट्रायल विकल्प (Hugging Face, fal.ai या Replicate) कॉन्फ़िगर करें।",
      });
      return;
    }

    const providerMeta = status.providers.find((p) => p.id === chosenProvider);
    if (!providerMeta?.enabled) {
      res.status(503).json({
        configured: false,
        error: `${providerMeta?.nameHi || chosenProvider} अभी कॉन्फ़िगर नहीं है (${providerMeta?.envHint || "ENV"})। बिना वास्तविक सेवा के नकली वीडियो नहीं दिखाया जाएगा।`,
      });
      return;
    }

    const prompt = (body.prompt || "").trim();
    if (!prompt && !body.image?.data) {
      res.status(400).json({
        error:
          "कृपया वीडियो बनाने के लिए विवरण (प्रॉम्प्ट) लिखें या एक संदर्भ छवि अपलोड करें।",
      });
      return;
    }

    const duration = body.duration === "5s" ? "5s" : "10s";
    const aspectRatio = body.aspectRatio === "9:16" ? "9:16" : "16:9";
    const styleDescriptions: Record<string, string> = {
      "3d_cartoon":
        "Stylized 3D cartoon animation style, expressive proportions, vibrant global illumination, smooth motion",
      realistic:
        "Photorealistic natural lighting, authentic textures, true-to-life camera motion",
      cinematic:
        "Cinematic film look, dramatic lighting, rich color grading, smooth dolly movement",
      anime: "High-detail anime style, crisp cel shading, fluid dynamic motion",
      documentary: "Clean documentary framing, natural ambient lighting, steady lens",
      dreamscape: "Dreamlike ethereal atmosphere, soft glowing highlights, gentle motion",
    };
    const stylePrompt =
      styleDescriptions[body.style || "3d_cartoon"] ||
      styleDescriptions["3d_cartoon"];
    const enhancedPrompt = prompt
      ? `${prompt}. Visual style: ${stylePrompt}.`
      : `Animate this image smoothly. Visual style: ${stylePrompt}.`;

    try {
      if (chosenProvider === "huggingface") {
        const token = getHfToken();
        const hf = new InferenceClient(token);
        const hfProvider =
          process.env.HF_VIDEO_PROVIDER === "replicate" ? "replicate" : "fal-ai";
        const videoBlob = await hf.textToVideo({
          provider: hfProvider,
          model: "Wan-AI/Wan2.1-T2V-14B",
          inputs: enhancedPrompt,
          parameters: {
            num_frames: duration === "5s" ? 81 : 121,
          },
        });
        const buffer = Buffer.from(await videoBlob.arrayBuffer());
        const mimeType = videoBlob.type || "video/mp4";
        res.json({
          videoUrl: `data:${mimeType};base64,${buffer.toString("base64")}`,
          mimeType,
          provider: chosenProvider,
        });
        return;
      }

      if (chosenProvider === "fal") {
        const falKey = getFalKey();
        const hasImage = Boolean(body.image?.data && body.image?.mimeType);
        const endpoint = hasImage
          ? "https://queue.fal.run/fal-ai/wan-i2v"
          : "https://queue.fal.run/fal-ai/wan-t2v";

        const falInput: Record<string, unknown> = {
          prompt: enhancedPrompt,
          aspect_ratio: aspectRatio,
        };
        if (hasImage && body.image) {
          falInput.image_url = `data:${body.image.mimeType};base64,${body.image.data}`;
        }

        const submitResp = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Key ${falKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(falInput),
        });

        const queued = (await submitResp.json().catch(() => ({}))) as {
          request_id?: string;
          status_url?: string;
          response_url?: string;
          detail?: string;
          error?: string;
        };

        if (!submitResp.ok || !queued.request_id) {
          res.status(submitResp.status || 502).json({
            error:
              queued.detail ||
              queued.error ||
              "fal.ai ने वीडियो अनुरोध स्वीकार नहीं किया।",
          });
          return;
        }

        const statusUrl =
          queued.status_url ||
          `${endpoint}/requests/${queued.request_id}/status`;
        const responseUrl =
          queued.response_url || `${endpoint}/requests/${queued.request_id}`;

        for (let i = 0; i < 45; i++) {
          await sleep(3000);
          const poll = await fetch(statusUrl, {
            headers: { Authorization: `Key ${falKey}` },
          });
          const pollData = (await poll.json().catch(() => ({}))) as {
            status?: string;
          };
          if (pollData.status === "COMPLETED") {
            const finalResp = await fetch(responseUrl, {
              headers: { Authorization: `Key ${falKey}` },
            });
            const finalData = (await finalResp.json().catch(() => ({}))) as {
              video?: { url?: string };
            };
            if (finalData.video?.url) {
              res.json({
                videoUrl: finalData.video.url,
                mimeType: "video/mp4",
                provider: chosenProvider,
              });
              return;
            }
            break;
          }
          if (pollData.status === "FAILED") {
            break;
          }
        }

        res.status(504).json({
          error: "fal.ai वीडियो जनरेशन समय सीमा में पूरा नहीं हो सका।",
        });
        return;
      }

      if (chosenProvider === "replicate") {
        const repToken = getReplicateToken();
        const createResp = await fetch(
          "https://api.replicate.com/v1/models/wan-video/wan-2.1-1.3b/predictions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${repToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              input: {
                prompt: enhancedPrompt,
                aspect_ratio: aspectRatio,
              },
            }),
          }
        );

        const prediction = (await createResp.json().catch(() => ({}))) as {
          id?: string;
          urls?: { get?: string };
          detail?: string;
        };

        if (!createResp.ok || !prediction.urls?.get) {
          res.status(createResp.status || 502).json({
            error:
              prediction.detail ||
              "Replicate ने वीडियो अनुरोध स्वीकार नहीं किया।",
          });
          return;
        }

        for (let i = 0; i < 45; i++) {
          await sleep(3000);
          const poll = await fetch(prediction.urls.get, {
            headers: { Authorization: `Bearer ${repToken}` },
          });
          const pollData = (await poll.json().catch(() => ({}))) as {
            status?: string;
            output?: string | string[];
            error?: string;
          };
          if (pollData.status === "succeeded") {
            const outUrl = Array.isArray(pollData.output)
              ? pollData.output[0]
              : pollData.output;
            if (outUrl) {
              res.json({
                videoUrl: outUrl,
                mimeType: "video/mp4",
                provider: chosenProvider,
              });
              return;
            }
          }
          if (pollData.status === "failed" || pollData.status === "canceled") {
            res.status(502).json({
              error: pollData.error || "Replicate वीडियो जनरेशन विफल रहा।",
            });
            return;
          }
        }

        res.status(504).json({
          error: "Replicate वीडियो जनरेशन समय सीमा में पूरा नहीं हो सका।",
        });
        return;
      }

      if (chosenProvider === "custom") {
        const customUrl = getCustomVideoUrl();
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (process.env.VIDEO_API_KEY?.trim()) {
          headers.Authorization = `Bearer ${process.env.VIDEO_API_KEY.trim()}`;
        }
        const upstream = await fetch(customUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({
            prompt: enhancedPrompt,
            style: body.style || "3d_cartoon",
            duration,
            aspectRatio,
            image: body.image,
          }),
        });
        const payload = (await upstream.json().catch(() => ({}))) as {
          videoUrl?: string;
          mimeType?: string;
          error?: string;
        };
        if (!upstream.ok || !payload.videoUrl) {
          res.status(upstream.status || 502).json({
            error:
              payload.error ||
              "कस्टम वीडियो API से वीडियो प्राप्त नहीं हो सका।",
          });
          return;
        }
        res.json({
          videoUrl: payload.videoUrl,
          mimeType: payload.mimeType || "video/mp4",
          provider: chosenProvider,
        });
        return;
      }

      res.status(403).json({
        error: "पेड वीडियो सेवाएँ डिफ़ॉल्ट रूप से बंद हैं।",
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "वीडियो जनरेशन सेवा से संपर्क करने में त्रुटि हुई।";
      res.status(502).json({ error: message });
    }
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (_req: Request, res: Response) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Aashu AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
