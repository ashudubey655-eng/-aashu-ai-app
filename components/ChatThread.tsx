import { useEffect, useRef, useState } from "react";
import {
AlertCircle,
Check,
Copy,
RotateCcw,
Volume2,
VolumeX,
} from "lucide-react";
import type { ChatMessage, UiLocale } from "../types/chat";
import { UI_COPY } from "../constants/prompts";
import { EmblemAvatar } from "./EmblemAvatar";
import { MarkdownMessage } from "./MarkdownMessage";

interface ChatThreadProps {
messages: ChatMessage[];
isStreaming: boolean;
uiLocale: UiLocale;
onRegenerate: () => void;
}

function hasDevanagari(text: string): boolean {
return /[\u0900-\u097F]/.test(text);
}

export function ChatThread({
messages,
isStreaming,
uiLocale,
onRegenerate,
}: ChatThreadProps) {
const bottomRef = useRef<HTMLDivElement | null>(null);
const [copiedId, setCopiedId] = useState<string | null>(null);
const [speakingId, setSpeakingId] = useState<string | null>(null);
const copy = UI_COPY[uiLocale];

useEffect(() => {
bottomRef.current?.scrollIntoView({ behavior: "smooth" });
}, [messages.length, messages[messages.length - 1]?.text]);

useEffect(() => {
return () => {
if ("speechSynthesis" in window) {
window.speechSynthesis.cancel();
}
};
}, []);

const handleCopy = async (id: string, text: string) => {
try {
await navigator.clipboard.writeText(text);
setCopiedId(id);
setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1800);
} catch {
// ignore clipboard denial
}
};

const handleSpeak = (id: string, text: string) => {
if (!("speechSynthesis" in window)) return;
window.speechSynthesis.cancel();

if (speakingId === id) {  
  setSpeakingId(null);  
  return;  
}  

const cleanText = text  
  .replace(/```[\s\S]*?```/g, " code block ")  
  .replace(/[*_`#>]/g, "")  
  .trim();  
if (!cleanText) return;  

const utterance = new SpeechSynthesisUtterance(cleanText);  
utterance.lang = hasDevanagari(cleanText) ? "hi-IN" : "en-IN";  
utterance.rate = 1.0;  
utterance.onend = () => setSpeakingId(null);  
utterance.onerror = () => setSpeakingId(null);  

setSpeakingId(id);  
window.speechSynthesis.speak(utterance);

};

const lastModelIdx = [...messages]
.reverse()
.findIndex((m) => m.role === "model");
const lastModelId =
lastModelIdx >= 0 ? messages[messages.length - 1 - lastModelIdx]?.id : null;

return (
<div className="max-w-3xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-6">
{messages.map((msg) => {
const isUser = msg.role === "user";
const isLastModel = msg.id === lastModelId;
const showTyping =
!isUser && isStreaming && isLastModel && msg.text.length === 0 && !msg.error;

if (isUser) {  
      return (  
        <div key={msg.id} className="flex justify-end">  
          <div className="max-w-[85%] sm:max-w-[75%] space-y-2">  
            {msg.image && (  
              <div className="flex justify-end">  
                <img  
                  src={`data:${msg.image.mimeType};base64,${msg.image.data}`}  
                  alt={msg.image.name || "Uploaded photo"}  
                  className="max-h-60 rounded-2xl border border-indigo-500/30 object-cover shadow-sm"  
                />  
              </div>  
            )}  
            {msg.text && (  
              <div className="rounded-2xl rounded-tr-sm px-4 py-3 bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-sm shadow-indigo-600/15 text-[15px] leading-[1.6] whitespace-pre-wrap break-words">  
                {msg.text}  
              </div>  
            )}  
          </div>  
        </div>  
      );  
    }  

    return (  
      <div key={msg.id} className="flex items-start gap-3 sm:gap-4">  
        <div className="pt-0.5">  
          <EmblemAvatar size="sm" alt={copy.brandName} />  
        </div>  

        <div className="flex-1 min-w-0 space-y-2">  
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">  
            <span>{copy.brandName}</span>  
            <span aria-hidden="true" className="text-slate-400">  
              ·  
            </span>  
            <span className="font-normal text-slate-500 dark:text-slate-400 tabular-nums">  
              {new Date(msg.createdAt).toLocaleTimeString([], {  
                hour: "2-digit",  
                minute: "2-digit",  
              })}  
            </span>  
          </div>  

          {showTyping ? (  
            <div className="py-1 text-sm text-indigo-600 dark:text-indigo-300 font-medium">  
              {copy.thinking}  
            </div>  
          ) : msg.error ? (  
            <div className="rounded-xl border border-rose-300 dark:border-rose-800/70 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-sm text-rose-700 dark:text-rose-200 flex items-start gap-2.5">  
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />  
              <div className="space-y-2">  
                <p>{msg.error}</p>  
                {isLastModel && !isStreaming && (  
                  <button  
                    type="button"  
                    onClick={onRegenerate}  
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-medium hover:bg-rose-500 transition-colors min-h-[36px]"  
                  >  
                    <RotateCcw className="w-3.5 h-3.5" />  
                    <span>{copy.regenerate}</span>  
                  </button>  
                )}  
              </div>  
            </div>  
          ) : (  
            <MarkdownMessage content={msg.text} />  
          )}  

          {/* Message Action Row */}  
          {!showTyping && !msg.error && msg.text && !(isStreaming && isLastModel) && (  
            <div className="flex items-center gap-1 pt-0.5">  
              <button  
                type="button"  
                onClick={() => handleCopy(msg.id, msg.text)}  
                aria-label={copy.copy}  
                className="min-h-[36px] px-2.5 rounded-lg inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-[#192038] transition-colors whitespace-nowrap"  
              >  
                {copiedId === msg.id ? (  
                  <>  
                    <Check className="w-3.5 h-3.5 text-blue-600 dark:text-indigo-400" />  
                    <span>{copy.copied}</span>  
                  </>  
                ) : (  
                  <>  
                    <Copy className="w-3.5 h-3.5" />  
                    <span>{copy.copy}</span>  
                  </>  
                )}  
              </button>  

              {"speechSynthesis" in window && (  
                <button  
                  type="button"  
                  onClick={() => handleSpeak(msg.id, msg.text)}  
                  aria-label={  
                    speakingId === msg.id ? copy.stopSpeaking : copy.speak  
                  }  
                  className={`min-h-[36px] px-2.5 rounded-lg inline-flex items-center gap-1.5 text-xs transition-colors whitespace-nowrap ${  
                    speakingId === msg.id  
                      ? "text-blue-600 dark:text-indigo-300 bg-indigo-500/10"  
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-[#192038]"  
                  }`}  
                >  
                  {speakingId === msg.id ? (  
                    <>  
                      <VolumeX className="w-3.5 h-3.5" />  
                      <span>{copy.stopSpeaking}</span>  
                    </>  
                  ) : (  
                    <>  
                      <Volume2 className="w-3.5 h-3.5" />  
                      <span>{copy.speak}</span>  
                    </>  
                  )}  
                </button>  
              )}  

              {isLastModel && (  
                <button  
                  type="button"  
                  onClick={onRegenerate}  
                  aria-label={copy.regenerate}  
                  className="min-h-[36px] px-2.5 rounded-lg inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-[#192038] transition-colors whitespace-nowrap"  
                >  
                  <RotateCcw className="w-3.5 h-3.5" />  
                  <span>{copy.regenerate}</span>  
                </button>  
              )}  
            </div>  
          )}  
        </div>  
      </div>  
    );  
  })}  
  <div ref={bottomRef} className="h-2" />  
</div>

);
           }
