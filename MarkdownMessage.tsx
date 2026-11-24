import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";

interface MarkdownMessageProps {
  content: string;
}

function CodeBlock({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const rawCode = String(children ?? "").replace(/\n$/, "");
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : "";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard might be blocked in non-HTTPS context
    }
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-slate-200 dark:border-indigo-950/70 bg-slate-950 text-slate-100">
      <div className="flex items-center justify-between px-3.5 py-2 bg-slate-900/90 border-b border-slate-800 text-xs text-slate-300">
        <span className="font-mono">{language || "code"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-slate-800 text-slate-200 transition-colors min-h-[32px] whitespace-nowrap"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-blue-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto text-[13px] leading-relaxed font-mono">
        <code className={className}>{rawCode}</code>
      </pre>
    </div>
  );
}

export function MarkdownMessage({ content }: MarkdownMessageProps) {
  return (
    <div className="text-[15px] leading-[1.65] text-slate-800 dark:text-slate-100 break-words space-y-3">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="leading-[1.7]">{children}</p>,
          h1: ({ children }) => (
            <h1 className="text-xl font-semibold text-slate-950 dark:text-white mt-4 mb-2">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white mt-4 mb-1.5">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold text-slate-950 dark:text-white mt-3 mb-1">
              {children}
            </h3>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-5 space-y-1.5 my-2">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 space-y-1.5 my-2">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-[1.65]">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-slate-950 dark:text-white">
              {children}
            </strong>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-indigo-400 underline underline-offset-2 hover:text-violet-600 dark:hover:text-violet-300 transition-colors"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-3 rounded-xl border border-indigo-200/70 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/30 px-4 py-3 text-slate-700 dark:text-slate-200">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-indigo-950/70">
              <table className="w-full text-left text-sm border-collapse">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-slate-100 dark:bg-[#161C33] text-slate-900 dark:text-slate-100">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 font-semibold border-b border-slate-200 dark:border-indigo-950/70">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 border-b border-slate-100 dark:border-indigo-950/40 tabular-nums">
              {children}
            </td>
          ),
          code: ({ className, children, ...props }) => {
            const isBlock = Boolean(className?.includes("language-")) ||
              String(children).includes("\n");
            if (isBlock) {
              return <CodeBlock className={className}>{children}</CodeBlock>;
            }
            return (
              <code
                className="px-1.5 py-0.5 rounded-md bg-slate-200/70 dark:bg-indigo-950/70 text-indigo-900 dark:text-indigo-200 font-mono text-[13px]"
                {...props}
              >
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
