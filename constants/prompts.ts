
import type { LanguageMode, PersonaMode, UiLocale } from "../types/chat";

export interface QuickPrompt {
  id: string;
  titleEn: string;
  titleHi: string;
  subtitleEn: string;
  subtitleHi: string;
  prompt: string;
  persona: PersonaMode;
  languageMode: LanguageMode;
}

export const QUICK_PROMPTS: QuickPrompt[] = [
  {
    id: "hi-email",
    titleEn: "Leave request in Hindi",
    titleHi: "हिंदी में छुट्टी का आवेदन",
    subtitleEn: "Polite office message ready for WhatsApp or email",
    subtitleHi: "ऑफिस के लिए विनम्र और स्पष्ट संदेश लिखें",
    prompt: "मेरे मैनेजर को 2 दिन की छुट्टी के लिए एक विनम्र और पेशेवर हिंदी ईमेल लिखिए।",
    persona: "writer",
    languageMode: "hi",
  },
  {
    id: "en-explain",
    titleEn: "Explain UPI & digital security",
    titleHi: "UPI सुरक्षा को सरल भाषा में समझें",
    subtitleEn: "Clear mobile safety checklist in English",
    subtitleHi: "मोबाइल बैंकिंग के 5 ज़रूरी सुरक्षा नियम",
    prompt: "Give me 5 practical tips to stay safe while using UPI and payment apps on Android.",
    persona: "tutor",
    languageMode: "en",
  },
  {
    id: "hinglish-plan",
    titleEn: "7-day fitness routine",
    titleHi: "7 दिन का फिटनेस रूटीन",
    subtitleEn: "Conversational Hinglish home workout plan",
    subtitleHi: "बिना जिम के घर पर आसान व्यायाम प्लान",
    prompt: "Mujhe bina gym ke ghar par karne ke liye ek practical 7-day beginner workout aur diet plan Hinglish mein batao.",
    persona: "assistant",
    languageMode: "hinglish",
  },
  {
    id: "bi-translate",
    titleEn: "Translate Hindi ↔ English",
    titleHi: "हिंदी ↔ अंग्रेज़ी अनुवाद",
    subtitleEn: "Natural phrasing without robotic wording",
    subtitleHi: "सटीक और स्वाभाविक भाषा में अनुवाद करें",
    prompt: "Translate this to natural, fluent English and also explain any idioms: 'मेहनत करने वालों की कभी हार नहीं होती, बस सही दिशा में धैर्य रखना ज़रूरी है।'",
    persona: "writer",
    languageMode: "auto",
  },
];

export const UI_COPY: Record<
  UiLocale,
  {
    brandName: string;
    newChat: string;
    searchPlaceholder: string;
    today: string;
    prev7Days: string;
    older: string;
    noConversations: string;
    noMatches: string;
    greetingTitle: string;
    greetingSubtitle: string;
    inputPlaceholder: string;
    listeningPlaceholder: string;
    disclaimer: string;
    copy: string;
    copied: string;
    speak: string;
    stopSpeaking: string;
    regenerate: string;
    deleteChat: string;
    renameChat: string;
    attachImage: string;
    voiceInput: string;
    stopVoice: string;
    send: string;
    stop: string;
    themeLight: string;
    themeDark: string;
    replyLanguage: string;
    assistantMode: string;
    modelSpeed: string;
    balancedModel: string;
    fastModel: string;
    thinking: string;
    personas: Record<PersonaMode, { label: string; shortDesc: string }>;
    languages: Record<LanguageMode, string>;
  }
> = {
  en: {
    brandName: "Aashu AI",
    newChat: "New chat",
    searchPlaceholder: "Search chats...",
    today: "Today",
    prev7Days: "Previous 7 days",
    older: "Older",
    noConversations: "Your conversations will appear here.",
    noMatches: "No matching chats found.",
    greetingTitle: "Namaste, how can Aashu AI help today?",
    greetingSubtitle:
      "Ask in Hindi, English, or Hinglish. Speak with your mic, attach a photo, or choose a mode below.",
    inputPlaceholder: "Ask Aashu AI in Hindi or English...",
    listeningPlaceholder: "Listening... speak in Hindi or English",
    disclaimer: "Aashu AI can make mistakes. Verify important details.",
    copy: "Copy",
    copied: "Copied",
    speak: "Listen",
    stopSpeaking: "Stop",
    regenerate: "Regenerate",
    deleteChat: "Delete",
    renameChat: "Rename",
    attachImage: "Attach photo",
    voiceInput: "Voice input",
    stopVoice: "Stop listening",
    send: "Send message",
    stop: "Stop generating",
    themeLight: "Light mode",
    themeDark: "Dark mode",
    replyLanguage: "Reply language",
    assistantMode: "Mode",
    modelSpeed: "Speed",
    balancedModel: "Balanced",
    fastModel: "Fast",
    thinking: "Thinking...",
    personas: {
      assistant: { label: "Assistant", shortDesc: "Everyday help" },
      tutor: { label: "Study", shortDesc: "Step-by-step" },
      writer: { label: "Write & Translate", shortDesc: "Drafts & Hindi/EN" },
      coder: { label: "Code", shortDesc: "Tech & scripts" },
    },
    languages: {
      auto: "Auto",
      en: "English",
      hi: "हिंदी",
      hinglish: "Hinglish",
    },
  },
  hi: {
    brandName: "आशु AI",
    newChat: "नई चैट",
    searchPlaceholder: "चैट खोजें...",
    today: "आज",
    prev7Days: "पिछले 7 दिन",
    older: "पुराने",
    noConversations: "आपकी बातचीत यहाँ दिखाई देगी।",
    noMatches: "कोई मिलती-जुलती चैट नहीं मिली।",
    greetingTitle: "नमस्ते, आज आशु AI आपकी क्या मदद कर सकता है?",
    greetingSubtitle:
      "हिंदी, अंग्रेज़ी या हिंग्लिश में पूछें। माइक से बोलें, फ़ोटो जोड़ें या नीचे से मोड चुनें।",
    inputPlaceholder: "हिंदी या अंग्रेज़ी में पूछें...",
    listeningPlaceholder: "सुन रहा हूँ... हिंदी या अंग्रेज़ी में बोलें",
    disclaimer: "आशु AI से भी गलती हो सकती है। ज़रूरी जानकारी की जाँच ज़रूर करें।",
    copy: "कॉपी",
    copied: "कॉपी हुआ",
    speak: "सुनें",
    stopSpeaking: "रोकें",
    regenerate: "फिर से लिखें",
    deleteChat: "हटाएँ",
    renameChat: "नाम बदलें",
    attachImage: "फ़ोटो जोड़ें",
    voiceInput: "बोलकर लिखें",
    stopVoice: "माइक रोकें",
    send: "भेजें",
    stop: "रोकें",
    themeLight: "लाइट मोड",
    themeDark: "डार्क मोड",
    replyLanguage: "उत्तर की भाषा",
    assistantMode: "मोड",
    modelSpeed: "गति",
    balancedModel: "संतुलित",
    fastModel: "तेज़",
    thinking: "सोच रहा हूँ...",
    personas: {
      assistant: { label: "सहायक", shortDesc: "दैनिक मदद" },
      tutor: { label: "पढ़ाई", shortDesc: "सरल व्याख्या" },
      writer: { label: "लेखन व अनुवाद", shortDesc: "ईमेल और हिंदी/EN" },
      coder: { label: "कोडिंग", shortDesc: "टेक व scripts" },
    },
    languages: {
      auto: "ऑटो",
      en: "English",
      hi: "हिंदी",
      hinglish: "Hinglish",
    },
  },
};
      
