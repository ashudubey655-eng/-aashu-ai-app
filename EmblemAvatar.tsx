import { useState } from "react";

interface EmblemAvatarProps {
  size?: "sm" | "md" | "lg";
  alt?: string;
}

export function EmblemAvatar({ size = "md", alt = "Aashu AI" }: EmblemAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);

  const sizeClass =
    size === "sm"
      ? "w-8 h-8 rounded-xl"
      : size === "lg"
      ? "w-16 h-16 rounded-2xl"
      : "w-10 h-10 rounded-xl";

  if (imgFailed) {
    return (
      <div
        className={`${sizeClass} shrink-0 bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-white font-bold shadow-sm`}
        aria-label={alt}
      >
        <span className={size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-base"}>
          A
        </span>
      </div>
    );
  }

  return (
    <img
      src="/src/assets/images/aashu_ai_emblem_1795507573057.jpg"
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setImgFailed(true)}
      className={`${sizeClass} shrink-0 object-cover ring-1 ring-indigo-500/20 dark:ring-indigo-400/20 shadow-sm`}
    />
  );
}
