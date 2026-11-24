import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Film,
  ImagePlus,
  Loader2,
  RectangleHorizontal,
  RectangleVertical,
  RotateCcw,
  ShieldCheck,
  Trash2,
  WifiOff,
} from "lucide-react";
import type {
  ImageAttachment,
  VideoAspectRatio,
  VideoConnectionTestResponse,
  VideoDuration,
  VideoProviderId,
  VideoStatusResponse,
  VideoStyle,
} from "../types/chat";

interface StyleOption {
  id: VideoStyle;
  title: string;
  englishTag: string;
  description: string;
}

const VIDEO_STYLES: StyleOption[] = [
  {
    id: "3d_cartoon",
    title: "3D कार्टून",
    englishTag: "3D cartoon animation style, vibrant global illumination",
    description: "आधुनिक स्टाइलाइज़्ड 3D कार्टून विज़ुअल और गहराई",
  },
  {
    id: "realistic",
    title: "यथार्थवादी",
    englishTag: "photorealistic, natural daylight, authentic motion",
    description: "प्राकृतिक रोशनी और वास्तविक जीवन जैसा दृश्य",
  },
  {
    id: "cinematic",
    title: "सिनेमाई",
    englishTag: "cinematic film look, dramatic lighting, smooth camera dolly",
    description: "ड्रामैटिक लाइटिंग और स्मूद कैमरा गति",
  },
  {
    id: "anime",
    title: "एनीमे",
    englishTag: "high-detail anime style, fluid dynamic motion",
    description: "जीवंत एनीमे आर्ट और गतिशील फ़्रेम",
  },
  {
    id: "documentary",
    title: "डॉक्यूमेंट्री",
    englishTag: "clean documentary framing, natural lighting",
    description: "स्थिर, स्पष्ट और नैचुरल कैमरा शॉट",
  },
  {
    id: "dreamscape",
    title: "ड्रीमस्केप",
    englishTag: "ethereal dreamlike atmosphere, soft glowing highlights",
    description: "कलात्मक, स्वप्निल और मुलायम प्रकाश प्रभाव",
  },
];

const SAMPLE_HINDI_PROMPTS = [
  "सुबह की हल्की धूप में हिमालय की बर्फीली चोटियों के ऊपर से उड़ता हुआ शांत ड्रोन दृश्य, हल्की धुंध और सुनहरी रोशनी।",
  "बारिश की बूंदों से भीगी मुंबई की रात की सड़क, नीले और बैंगनी नियॉन प्रकाश का प्रतिबिंब, धीमी कैमरा गति।",
  "ताज़े फूलों के बगीचे में उड़ती हुई रंग-बिरंगी तितली, क्लोज़-अप मैक्रो शॉट और मुलायम बैकग्राउंड बोकेह।",
];

const FREE_VIDEO_MAKER_PRIMARY_URL = "https://huggingface.co/spaces/Wan-AI/Wan2.1";
const FREE_VIDEO_MAKER_FAST_URL =
  "https://huggingface.co/spaces/Lightricks/ltx-video-distilled";

export function VideoGeneratorPage() {
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState<ImageAttachment | null>(null);
  const [style, setStyle] = useState<VideoStyle>("3d_cartoon");
  const [duration, setDuration] = useState<VideoDuration>("5s");
  const [aspectRatio, setAspectRatio] = useState<VideoAspectRatio>("16:9");

  const [statusData, setStatusData] = useState<VideoStatusResponse | null>(null);
  const [selectedProvider, setSelectedProvider] =
    useState<VideoProviderId>("huggingface");
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] =
    useState<VideoConnectionTestResponse | null>(null);

  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(
    null
  );
  const [generatedMeta, setGeneratedMeta] = useState<{
    duration: VideoDuration;
    aspectRatio: VideoAspectRatio;
    styleTitle: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/video/status");
      if (!res.ok) return;
      const data = (await res.json()) as VideoStatusResponse;
      setStatusData(data);
      if (data.activeProvider && data.activeProvider !== "gemini_paid") {
        setSelectedProvider(data.activeProvider);
      }
    } catch {
      setStatusData({
        connected: false,
        activeProvider: null,
        paidServicesEnabled: false,
        providers: [],
      });
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const handleTestConnection = async () => {
    if (isTestingConnection) return;
    setIsTestingConnection(true);
    setTestResult(null);

    try {
      await fetchStatus();
      const res = await fetch("/api/video/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: selectedProvider }),
      });
      const result = (await res.json()) as VideoConnectionTestResponse;
      setTestResult(result);
    } catch {
      setTestResult({
        ok: false,
        provider: selectedProvider,
        status: "unreachable",
        message: "कनेक्शन जाँच पूरी नहीं हो सकी। सर्वर से संपर्क टूट गया।",
        latencyMs: 0,
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleCopyPreparedPrompt = async () => {
    const selectedStyleObj =
      VIDEO_STYLES.find((s) => s.id === style) || VIDEO_STYLES[0];
    const baseText =
      prompt.trim() ||
      "A peaceful cinematic sunrise over misty Himalayan mountain peaks";
    const formatted = `${baseText}\n[Style: ${selectedStyleObj.englishTag} | Duration: ${duration} | Format: ${aspectRatio}]`;
    try {
      await navigator.clipboard.writeText(formatted);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch {
      // Clipboard blocked
    }
  };

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.split(",")[1] || "";
      if (!base64) return;
      setImage({
        mimeType: file.type,
        data: base64,
        previewUrl: result,
        name: file.name,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleGenerate = async () => {
    if (isGenerating) return;
    if (!prompt.trim() && !image) {
      setErrorMessage(
        "कृपया वीडियो बनाने के लिए विवरण (प्रॉम्प्ट) लिखें या एक छवि अपलोड करें।"
      );
      return;
    }

    setErrorMessage(null);
    setIsGenerating(true);

    try {
      const res = await fetch("/api/video/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedProvider,
          prompt: prompt.trim(),
          style,
          duration,
          aspectRatio,
          image: image
            ? { mimeType: image.mimeType, data: image.data }
            : undefined,
        }),
      });

      const data = (await res.json()) as {
        videoUrl?: string;
        error?: string;
        configured?: boolean;
      };

      if (!res.ok || !data.videoUrl) {
        setErrorMessage(
          data.error ||
            "बिना API के वीडियो नहीं बन सका। आप नीचे ‘Free Video Maker’ बटन से मुफ़्त वेबसाइट पर वीडियो बना सकते हैं।"
        );
        return;
      }

      const activeStyle = VIDEO_STYLES.find((s) => s.id === style);
      setGeneratedVideoUrl(data.videoUrl);
      setGeneratedMeta({
        duration,
        aspectRatio,
        styleTitle: activeStyle?.title || "3D कार्टून",
      });
    } catch {
      setErrorMessage(
        "सर्वर से संपर्क नहीं हो सका। आप ‘Free Video Maker’ बटन से मुफ़्त वेबसाइट का उपयोग कर सकते हैं।"
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReset = () => {
    setPrompt("");
    setImage(null);
    setErrorMessage(null);
    setGeneratedVideoUrl(null);
    setGeneratedMeta(null);
  };

  const selectedStyleObj =
    VIDEO_STYLES.find((s) => s.id === style) || VIDEO_STYLES[0];
  const freeProviders = (statusData?.providers || []).filter((p) => !p.isPaid);
  const selectedProviderMeta = freeProviders.find(
    (p) => p.id === selectedProvider
  );
  const isConnected = Boolean(statusData?.connected);

  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Page Heading */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-b border-slate-200/80 dark:border-indigo-950/70 pb-5">
          <div className="space-y-1.5 max-w-2xl">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white text-balance">
              मुफ़्त एआई वीडियो जनरेटर
            </h1>
            <p className="text-sm sm:text-[15px] text-slate-600 dark:text-slate-300 leading-relaxed">
              बिना किसी पेड API या बिलिंग के वीडियो प्रॉम्प्ट तैयार करें — मुफ़्त API से या सीधे{" "}
              <span className="font-semibold text-slate-900 dark:text-white">
                Free Video Maker
              </span>{" "}
              वेबसाइट पर वास्तविक वीडियो बनाएँ।
            </p>
          </div>

          <div className="flex items-center gap-2.5 text-xs font-medium shrink-0">
            {isConnected ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>फ़्री API जुड़ा है</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300">
                <WifiOff className="w-4 h-4 shrink-0" />
                <span>API कनेक्ट नहीं · Free Maker तैयार</span>
              </span>
            )}
            <span aria-hidden="true" className="text-slate-400">
              ·
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              बिलिंग की आवश्यकता नहीं
            </span>
          </div>
        </div>

        {/* Free Connection Status + Free Video Maker Direct Banner */}
        <section
          aria-label="मुफ़्त वीडियो सेवा और कनेक्शन स्थिति"
          className="rounded-2xl bg-white dark:bg-[#13182B] border border-slate-200/85 dark:border-indigo-950/70 p-4 sm:p-5 space-y-4"
        >
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
                <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-indigo-400 shrink-0" />
                <span>मुफ़्त वीडियो सेवा और कनेक्शन स्थिति</span>
              </div>
              <p className="text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed">
                कोई पेड सेवा सक्रिय नहीं है। यदि आपके पास फ़्री API टोकन नहीं है, तो{" "}
                <span className="font-medium text-slate-900 dark:text-white">
                  Free Video Maker
                </span>{" "}
                बटन से बिना बिलिंग के मुफ़्त वेबसाइट पर वीडियो बनाएँ। कोई नकली वीडियो नहीं दिखाया जाएगा।
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTestingConnection}
                className="min-h-[44px] px-4 rounded-xl bg-slate-100 dark:bg-[#192038] hover:bg-indigo-50 dark:hover:bg-[#232C4D] border border-slate-200 dark:border-indigo-900/70 text-xs sm:text-sm font-semibold text-blue-700 dark:text-indigo-200 inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
              >
                {isTestingConnection ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>जाँच जारी है...</span>
                  </>
                ) : (
                  <>
                    <Activity className="w-4 h-4" />
                    <span>API कनेक्शन जाँचें</span>
                  </>
                )}
              </button>

              <a
                href={FREE_VIDEO_MAKER_PRIMARY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] px-4 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-sm shadow-indigo-600/20 transition-all whitespace-nowrap"
              >
                <ExternalLink className="w-4 h-4 shrink-0" />
                <span>Free Video Maker खोलें</span>
              </a>
            </div>
          </div>

          {/* Free-Tier Integration Options Grid */}
          {freeProviders.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {freeProviders.map((provider) => {
                const isSelected = selectedProvider === provider.id;

                return (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => {
                      setSelectedProvider(provider.id);
                      setTestResult(null);
                    }}
                    className={`p-3 rounded-xl text-left transition-all min-h-[72px] flex flex-col justify-between ${
                      isSelected
                        ? "bg-gradient-to-br from-blue-600/15 to-violet-600/15 border border-indigo-500 text-blue-900 dark:text-white ring-1 ring-indigo-500/30"
                        : "bg-slate-50 dark:bg-[#0D1222] border border-slate-200/80 dark:border-indigo-950/70 text-slate-800 dark:text-slate-200 hover:border-indigo-400/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold leading-snug">
                        {provider.nameHi}
                      </span>
                      {provider.configured ? (
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                      ) : (
                        <WifiOff className="w-3.5 h-3.5 shrink-0 text-slate-400 mt-0.5" />
                      )}
                    </div>

                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 flex items-center gap-1.5 truncate">
                      <span>{provider.tierLabelHi}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {provider.configured ? "सेट है" : provider.envHint}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Live Connection Test Result */}
          {testResult && (
            <div
              role="status"
              className={`rounded-xl border px-3.5 py-3 text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 ${
                testResult.ok
                  ? "border-emerald-300 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200"
                  : "border-amber-300 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200"
              }`}
            >
              <div className="flex items-start gap-2.5">
                {testResult.ok ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <span>{testResult.message}</span>
              </div>
              <div className="text-xs opacity-80 tabular-nums shrink-0">
                {testResult.latencyMs > 0
                  ? `${testResult.latencyMs} ms`
                  : "Free Maker उपलब्ध"}
              </div>
            </div>
          )}
        </section>

        {/* Main 2-Column Studio Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Controls Column */}
          <section className="lg:col-span-7 space-y-5 rounded-2xl bg-white dark:bg-[#13182B] border border-slate-200/85 dark:border-indigo-950/70 p-4 sm:p-6">
            {/* 1. Prompt Input Box */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="video-prompt-input"
                  className="text-sm font-semibold text-slate-900 dark:text-white"
                >
                  वीडियो विवरण (प्रॉम्प्ट)
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleCopyPreparedPrompt}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-indigo-300 hover:underline min-h-[32px]"
                  >
                    {copiedPrompt ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>कॉपी हो गया</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>प्रॉम्प्ट कॉपी करें</span>
                      </>
                    )}
                  </button>
                  <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {prompt.length} अक्षर
                  </span>
                </div>
              </div>

              <textarea
                id="video-prompt-input"
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="उदाहरण: सुबह की सुनहरी धूप में हिमालय की वादियों के ऊपर से उड़ता हुआ ड्रोन दृश्य, शांत बादल और सिनेमाई गति..."
                className="w-full rounded-xl bg-slate-50 dark:bg-[#0D1222] border border-slate-200 dark:border-indigo-950/80 px-3.5 py-3 text-[15px] leading-relaxed text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 resize-y min-h-[112px]"
              />

              {/* Helpful Prompt Suggestions */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  सुझाव:
                </span>
                {SAMPLE_HINDI_PROMPTS.map((sample, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPrompt(sample)}
                    className="min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-[#192038] text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-slate-200/70 dark:border-indigo-950/70 transition-colors whitespace-nowrap"
                  >
                    उदाहरण {idx + 1}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Reference Image Upload */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  संदर्भ छवि अपलोड (वैकल्पिक)
                </span>
                {image && (
                  <button
                    type="button"
                    onClick={() => setImage(null)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline min-h-[32px]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>छवि हटाएँ</span>
                  </button>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImagePick}
                className="hidden"
              />

              {image ? (
                <div className="flex items-center gap-3.5 p-3 rounded-xl bg-slate-50 dark:bg-[#0D1222] border border-slate-200 dark:border-indigo-950/80">
                  <img
                    src={image.previewUrl}
                    alt={image.name}
                    className="w-16 h-16 rounded-lg object-cover border border-slate-200 dark:border-indigo-900/70 shrink-0"
                  />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {image.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      शुरुआती फ़्रेम के रूप में उपयोग की जाएगी
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="min-h-[40px] px-3 rounded-lg text-xs font-medium bg-white dark:bg-[#192038] border border-slate-200 dark:border-indigo-900/70 text-slate-700 dark:text-slate-200 hover:border-indigo-500/50 transition-colors whitespace-nowrap shrink-0"
                  >
                    बदलें
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full min-h-[84px] rounded-xl border border-dashed border-slate-300 dark:border-indigo-900/80 bg-slate-50/70 dark:bg-[#0D1222]/70 hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50/40 dark:hover:bg-[#131A33] transition-colors flex flex-col items-center justify-center gap-1.5 px-4 py-4 text-center"
                >
                  <ImagePlus className="w-5 h-5 text-blue-600 dark:text-indigo-400" />
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    इमेज-टू-वीडियो के लिए छवि चुनें
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    PNG, JPG या WEBP · वैकल्पिक संदर्भ फ़्रेम
                  </span>
                </button>
              )}
            </div>

            {/* 3. Video Style Selection */}
            <div className="space-y-2.5">
              <span className="block text-sm font-semibold text-slate-900 dark:text-white">
                वीडियो शैली चुनें
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {VIDEO_STYLES.map((item) => {
                  const active = style === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setStyle(item.id)}
                      className={`p-3 rounded-xl text-left transition-all min-h-[68px] flex flex-col justify-between ${
                        active
                          ? "bg-gradient-to-br from-blue-600/15 to-violet-600/15 border border-indigo-500 text-blue-800 dark:text-white ring-1 ring-indigo-500/30"
                          : "bg-slate-50 dark:bg-[#0D1222] border border-slate-200/80 dark:border-indigo-950/70 text-slate-800 dark:text-slate-200 hover:border-indigo-400/50"
                      }`}
                    >
                      <span className="text-sm font-semibold leading-snug">
                        {item.title}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-1 line-clamp-2">
                        {item.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Duration (5s / 10s) & Aspect Ratio (9:16 / 16:9) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Duration */}
              <div className="space-y-2">
                <span className="block text-sm font-semibold text-slate-900 dark:text-white">
                  वीडियो अवधि
                </span>
                <div
                  className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-[#0D1222] border border-slate-200/80 dark:border-indigo-950/70"
                  role="group"
                  aria-label="वीडियो अवधि"
                >
                  {(["5s", "10s"] as VideoDuration[]).map((opt) => {
                    const active = duration === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setDuration(opt)}
                        className={`min-h-[44px] rounded-lg text-sm font-semibold transition-all whitespace-nowrap tabular-nums ${
                          active
                            ? "bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-sm"
                            : "text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white"
                        }`}
                      >
                        {opt === "5s" ? "5 सेकंड" : "10 सेकंड"}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Aspect Ratio */}
              <div className="space-y-2">
                <span className="block text-sm font-semibold text-slate-900 dark:text-white">
                  वीडियो फ़ॉर्मेट
                </span>
                <div
                  className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-[#0D1222] border border-slate-200/80 dark:border-indigo-950/70"
                  role="group"
                  aria-label="वीडियो फ़ॉर्मेट"
                >
                  <button
                    type="button"
                    onClick={() => setAspectRatio("16:9")}
                    className={`min-h-[44px] px-3 rounded-lg text-sm font-semibold transition-all inline-flex items-center justify-center gap-2 whitespace-nowrap tabular-nums ${
                      aspectRatio === "16:9"
                        ? "bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-sm"
                        : "text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white"
                    }`}
                  >
                    <RectangleHorizontal className="w-4 h-4 shrink-0" />
                    <span>16:9</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAspectRatio("9:16")}
                    className={`min-h-[44px] px-3 rounded-lg text-sm font-semibold transition-all inline-flex items-center justify-center gap-2 whitespace-nowrap tabular-nums ${
                      aspectRatio === "9:16"
                        ? "bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-sm"
                        : "text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white"
                    }`}
                  >
                    <RectangleVertical className="w-4 h-4 shrink-0" />
                    <span>9:16</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 5. Generate Video CTA + Free Video Maker Button */}
            <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="flex-1 min-h-[48px] px-5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 disabled:opacity-60 text-white font-semibold text-[15px] shadow-md shadow-indigo-600/20 active:scale-[0.99] transition-all inline-flex items-center justify-center gap-2 whitespace-nowrap"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>वीडियो बन रहा है...</span>
                  </>
                ) : (
                  <>
                    <Film className="w-5 h-5" />
                    <span>वीडियो बनाएँ</span>
                  </>
                )}
              </button>

              <a
                href={FREE_VIDEO_MAKER_PRIMARY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[48px] px-4 rounded-xl bg-indigo-50 dark:bg-[#192038] border border-indigo-200 dark:border-indigo-900/70 text-blue-700 dark:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-[#232C4D] text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
              >
                <ExternalLink className="w-4 h-4 shrink-0" />
                <span>Free Video Maker</span>
              </a>

              {(prompt || image || generatedVideoUrl || errorMessage) && (
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isGenerating}
                  className="min-h-[48px] px-4 rounded-xl bg-slate-100 dark:bg-[#192038] text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#232C4D] text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>रीसेट करें</span>
                </button>
              )}
            </div>
          </section>

          {/* Preview & Download Column */}
          <section className="lg:col-span-5 space-y-4 rounded-2xl bg-white dark:bg-[#13182B] border border-slate-200/85 dark:border-indigo-950/70 p-4 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-950 dark:text-white">
                वीडियो प्रीव्यू
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {generatedMeta
                  ? `${generatedMeta.styleTitle} · ${
                      generatedMeta.duration === "5s" ? "5 सेकंड" : "10 सेकंड"
                    } · ${generatedMeta.aspectRatio}`
                  : `${selectedStyleObj.title} · ${
                      duration === "5s" ? "5 सेकंड" : "10 सेकंड"
                    } · ${aspectRatio}`}
              </span>
            </div>

            {/* Preview Viewport */}
            <div className="rounded-xl bg-slate-100 dark:bg-[#0B0E1A] border border-slate-200/80 dark:border-indigo-950/80 p-3 flex items-center justify-center min-h-[260px]">
              {isGenerating ? (
                <div className="py-12 px-4 text-center space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-indigo-400 mx-auto" />
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    वास्तविक वीडियो तैयार किया जा रहा है...
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedProviderMeta?.nameHi || selectedProvider} के माध्यम से प्रोसेसिंग जारी है।
                  </p>
                </div>
              ) : generatedVideoUrl ? (
                <div
                  className={
                    (generatedMeta?.aspectRatio || aspectRatio) === "9:16"
                      ? "w-full max-w-[260px] aspect-[9/16] rounded-lg overflow-hidden bg-black"
                      : "w-full aspect-video rounded-lg overflow-hidden bg-black"
                  }
                >
                  <video
                    src={generatedVideoUrl}
                    controls
                    playsInline
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div
                  className={`w-full flex flex-col items-center justify-center text-center p-6 rounded-lg border border-dashed border-slate-300 dark:border-indigo-900/60 ${
                    aspectRatio === "9:16"
                      ? "max-w-[230px] aspect-[9/16]"
                      : "aspect-video"
                  }`}
                >
                  <Film className="w-8 h-8 text-slate-400 dark:text-slate-500 mb-3" />
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    कोई नकली वीडियो नहीं दिखाया गया है
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                    {isConnected
                      ? "बाईं ओर प्रॉम्प्ट लिखें और ‘वीडियो बनाएँ’ दबाएँ।"
                      : "बिना API टोकन के आप ‘Free Video Maker’ वेबसाइट पर मुफ़्त वीडियो बना सकते हैं।"}
                  </p>
                </div>
              )}
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="rounded-xl border border-amber-300 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/30 px-3.5 py-3 text-xs sm:text-sm text-amber-900 dark:text-amber-200 space-y-2.5"
              >
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{errorMessage}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <a
                    href={FREE_VIDEO_MAKER_PRIMARY_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[38px] px-3 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Free Video Maker (Wan 2.1)</span>
                  </a>
                  <a
                    href={FREE_VIDEO_MAKER_FAST_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[38px] px-3 rounded-lg bg-white dark:bg-[#192038] border border-slate-200 dark:border-indigo-900/70 text-slate-800 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>LTX-Video मुफ़्त विकल्प</span>
                  </a>
                </div>
              </div>
            )}

            {/* Free Website Quick Launch Box */}
            <div className="rounded-xl bg-slate-50 dark:bg-[#0D1222] border border-slate-200/80 dark:border-indigo-950/70 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-900 dark:text-white">
                  मुफ़्त वीडियो वेबसाइट (बिना बिलिंग)
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  नया टैब खुलेगा
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <a
                  href={FREE_VIDEO_MAKER_PRIMARY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[42px] px-3 rounded-lg bg-white dark:bg-[#151B31] border border-slate-200 dark:border-indigo-900/70 hover:border-indigo-500 text-xs font-semibold text-blue-700 dark:text-indigo-200 inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  <span>Wan 2.1 Free Maker</span>
                </a>
                <a
                  href={FREE_VIDEO_MAKER_FAST_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[42px] px-3 rounded-lg bg-white dark:bg-[#151B31] border border-slate-200 dark:border-indigo-900/70 hover:border-indigo-500 text-xs font-semibold text-blue-700 dark:text-indigo-200 inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  <span>LTX-Video Free Maker</span>
                </a>
              </div>
            </div>

            {/* Download Button (only active when a real generated video exists) */}
            {generatedVideoUrl ? (
              <a
                href={generatedVideoUrl}
                download={`aashu-ai-video-${Date.now()}.mp4`}
                className="w-full min-h-[48px] px-4 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-semibold text-sm inline-flex items-center justify-center gap-2 shadow-sm transition-all whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                <span>वीडियो डाउनलोड करें</span>
              </a>
            ) : (
              <button
                type="button"
                disabled
                aria-disabled="true"
                className="w-full min-h-[48px] px-4 rounded-xl bg-slate-100 dark:bg-[#192038] text-slate-400 dark:text-slate-500 font-semibold text-sm inline-flex items-center justify-center gap-2 cursor-not-allowed whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                <span>वीडियो डाउनलोड करें</span>
              </button>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
