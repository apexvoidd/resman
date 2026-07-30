"use client";

import { useRBAC } from "@/hooks/use-rbac";
import { fetchAISuggestions, sendAIChatMessage, AIChatMessage } from "@/services/ai";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h1 className="text-sm font-bold text-white mb-2 mt-3 first:mt-0">{children}</h1>,
        h2: ({ children }) => <h2 className="text-xs font-bold text-[#E2E8F0] mb-1.5 mt-3 first:mt-0 uppercase tracking-wide">{children}</h2>,
        h3: ({ children }) => <h3 className="text-xs font-semibold text-[#CBD5E1] mb-1 mt-2 first:mt-0">{children}</h3>,
        p: ({ children }) => <p className="text-xs leading-relaxed text-[#E2E8F0] mb-2 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
        em: ({ children }) => <em className="italic text-[#CBD5E1]">{children}</em>,
        ul: ({ children }) => <ul className="list-none space-y-1 mb-2 pl-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-2 pl-1 text-xs text-[#E2E8F0]">{children}</ol>,
        li: ({ children }) => (
          <li className="flex items-start gap-1.5 text-xs text-[#E2E8F0] leading-relaxed">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2563EB]" />
            <span>{children}</span>
          </li>
        ),
        code: ({ children, className }) => {
          const isBlock = className?.includes("language-");
          return isBlock ? (
            <code className="block bg-[#020617] border border-[#334155] rounded-lg px-3 py-2 text-[11px] font-mono text-[#7DD3FC] my-2 overflow-x-auto">{children}</code>
          ) : (
            <code className="bg-[#1E293B] border border-[#334155] rounded px-1.5 py-0.5 text-[11px] font-mono text-[#7DD3FC]">{children}</code>
          );
        },
        pre: ({ children }) => <pre className="my-2 overflow-x-auto">{children}</pre>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-[#2563EB] pl-3 my-2 text-xs text-[#94A3B8] italic">{children}</blockquote>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-2 rounded-lg border border-[#334155]">
            <table className="w-full text-[11px]">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-[#1E293B] text-[#94A3B8] uppercase tracking-wider">{children}</thead>,
        tbody: ({ children }) => <tbody className="divide-y divide-[#1E293B]">{children}</tbody>,
        tr: ({ children }) => <tr className="hover:bg-[#1E293B]/50 transition-colors">{children}</tr>,
        th: ({ children }) => <th className="px-3 py-2 text-left font-semibold">{children}</th>,
        td: ({ children }) => <td className="px-3 py-2 text-[#CBD5E1]">{children}</td>,
        hr: () => <hr className="border-[#334155] my-3" />,
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#2563EB] underline underline-offset-2 hover:text-[#60A5FA] transition-colors">{children}</a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export function AIChatDrawer() {
  const { getToken } = useAuth();
  const { hasRole, isSuperadmin } = useRBAC();
  const isManagerOrAdmin = hasRole("manager", "admin") || isSuperadmin;

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Fetch starter suggestions when drawer opens
  useEffect(() => {
    if (isOpen && suggestions.length === 0) {
      getToken().then((token) => {
        fetchAISuggestions(token).then((data) => setSuggestions(data));
      });
    }
  }, [isOpen, suggestions.length, getToken]);

  if (!isManagerOrAdmin) {
    return null;
  }

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    const userMsg: AIChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");
    setIsLoading(true);

    try {
      const token = await getToken();
      const response = await sendAIChatMessage(token, {
        message: text,
        session_id: sessionId,
        history: messages,
      });

      setSessionId(response.session_id);
      const assistantMsg: AIChatMessage = {
        role: "assistant",
        content: response.reply,
        engine: response.engine_used,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      if (response.suggested_questions && response.suggested_questions.length > 0) {
        setSuggestions(response.suggested_questions);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch response";
      const errorMsg: AIChatMessage = {
        role: "assistant",
        content: `⚠️ **Error:** ${errorMessage}. Please try again.`,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setSessionId(undefined);
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center space-x-2.5 rounded-full bg-gradient-to-r from-[#2563EB] to-[#7C3AED] px-4 py-3 text-xs font-bold text-white shadow-xl shadow-[#2563EB]/30 transition hover:scale-105 active:scale-95 border border-white/20"
        title="Open AI Manager Assistant"
      >
        <span className="text-base animate-bounce">✨</span>
        <span>AI Assistant</span>
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
        </span>
      </button>

      {/* Slide-over Backdrop */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-50 bg-[#020617]/70 backdrop-blur-sm transition-opacity"
        />
      )}

      {/* Slide-over Drawer Panel */}
      <div
        className={`fixed top-0 bottom-0 right-0 z-50 flex w-full flex-col border-l border-[#334155] bg-[#020617] text-[#F8FAFC] shadow-2xl transition-transform duration-300 ease-in-out sm:w-[450px] ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#334155] bg-[#0F172A] p-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2563EB]/20 border border-[#2563EB]/40 text-lg">
              🤖
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#F8FAFC]">
                AI Manager Assistant
              </h3>
              <p className="text-[10px] font-semibold text-[#22C55E] flex items-center space-x-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E] animate-pulse"></span>
                <span>Connected to Live ResMan DB</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {messages.length > 0 && (
              <button
                onClick={handleClearChat}
                className="rounded-md px-2 py-1 text-[11px] font-medium text-[#94A3B8] hover:bg-[#1E293B] hover:text-white transition"
                title="Clear Chat History"
              >
                Clear
              </button>
            )}
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-md p-1.5 text-xs text-[#CBD5E1] hover:bg-[#1E293B] hover:text-white transition"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Message Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col justify-start space-y-3 px-1 py-2">
              {/* Header */}
              <div className="flex flex-col items-center text-center gap-2 pt-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2563EB]/10 border border-[#2563EB]/30 text-2xl">
                  🧠
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#F8FAFC]">ResMan AI Assistant</h4>
                  <p className="mt-0.5 text-[11px] text-[#64748B]">Powered by live database context</p>
                </div>
              </div>

              {/* Warning Banner */}
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 flex gap-2.5 items-start">
                <span className="text-amber-400 text-sm mt-0.5 shrink-0">⚠️</span>
                <div>
                  <p className="text-[11px] font-semibold text-amber-300">Accuracy Warning</p>
                  <p className="text-[10px] text-amber-400/80 mt-0.5 leading-relaxed">
                    Responses are based on a limited today-only snapshot. Historical trends, multi-day comparisons, and detailed analytics may be incomplete or missing. Always verify critical decisions with full reports.
                  </p>
                </div>
              </div>

              {/* Data Coverage */}
              <div className="rounded-lg border border-[#1E293B] bg-[#0F172A] overflow-hidden">
                <div className="px-3 py-2 border-b border-[#1E293B] flex items-center gap-1.5">
                  <span className="text-[10px]">📦</span>
                  <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">What I know right now</p>
                </div>
                <div className="divide-y divide-[#1E293B]">
                  {[
                    { icon: "💰", label: "Revenue & Bills",       scope: "Today only",         note: "Since midnight UTC" },
                    { icon: "📋", label: "Orders",                scope: "Today + live queue",  note: "Active kitchen tickets" },
                    { icon: "🪑", label: "Table Occupancy",       scope: "Live (right now)",    note: "Current status only" },
                    { icon: "📦", label: "Stock & Ingredients",   scope: "Live levels",         note: "Top 10 low-stock items" },
                    { icon: "🗑️", label: "Waste",                 scope: "Today only",          note: "Cost impact since midnight" },
                    { icon: "📖", label: "Recipe Profitability",  scope: "All-time",            note: "Top 5 lowest margin recipes" },
                    { icon: "⭐", label: "CSAT / Reviews",        scope: "All-time avg only",   note: "No recent review text" },
                    { icon: "👥", label: "Staff Count",           scope: "Live (right now)",    note: "Active staff only" },
                    { icon: "🗨️", label: "Chat Memory",           scope: "Last 10 messages",   note: "~5 turns, then forgotten" },
                  ].map(({ icon, label, scope, note }) => (
                    <div key={label} className="flex items-center justify-between px-3 py-2 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs shrink-0">{icon}</span>
                        <span className="text-[11px] font-medium text-[#CBD5E1] truncate">{label}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] font-semibold text-[#2563EB]">{scope}</p>
                        <p className="text-[9px] text-[#475569]">{note}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Suggested Questions */}
              {suggestions.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-[#475569] uppercase tracking-wider px-1">
                    Try asking:
                  </p>
                  <div className="flex flex-col space-y-1.5">
                    {suggestions.map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSend(q)}
                        className="rounded-lg border border-[#1E293B] bg-[#0F172A] p-2.5 text-left text-[11px] font-medium text-[#CBD5E1] hover:border-[#2563EB] hover:bg-[#1E293B] hover:text-white transition"
                      >
                        💡 {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

          ) : (
            <>
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                      msg.role === "user"
                        ? "bg-[#2563EB] text-white rounded-br-none shadow-md shadow-[#2563EB]/20"
                        : "bg-[#0F172A] text-[#F8FAFC] border border-[#334155] rounded-bl-none shadow-lg"
                    }`}
                  >
                    {msg.role === "assistant" && (
                      <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold uppercase">
                        <span className="text-[#2563EB]">🤖 ResMan AI</span>
                        {msg.engine === "nvidia_nim" ? (
                          <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-purple-300 border border-purple-500/30">
                            ✨ NVIDIA NIM (Llama 3.1)
                          </span>
                        ) : (
                          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-emerald-300 border border-emerald-500/30">
                            📊 Live ResMan DB
                          </span>
                        )}
                      </div>
                    )}
                    {msg.role === "assistant" ? (
                      <MarkdownMessage content={msg.content} />
                    ) : (
                      <div className="text-xs leading-relaxed">{msg.content}</div>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-none border border-[#334155] bg-[#0F172A] p-3 text-xs text-[#94A3B8] flex items-center space-x-2">
                    <span className="h-2 w-2 rounded-full bg-[#2563EB] animate-ping"></span>
                    <span>Analyzing live database context...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Footer Input Area */}
        <div className="border-t border-[#334155] bg-[#0F172A] p-3">
          {messages.length > 0 && suggestions.length > 0 && (
            <div className="mb-3 flex overflow-x-auto gap-2 pb-1 scrollbar-none">
              {suggestions.slice(0, 3).map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(q)}
                  className="whitespace-nowrap shrink-0 rounded-full border border-[#334155] bg-[#020617] px-3 py-1 text-[11px] font-medium text-[#CBD5E1] hover:border-[#2563EB] hover:text-white transition"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center space-x-2"
          >
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask about revenue, low stock, kitchen, tables..."
              disabled={isLoading}
              className="flex-1 rounded-lg border border-[#334155] bg-[#020617] px-3.5 py-2.5 text-xs text-white placeholder-[#64748B] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB] disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || isLoading}
              className="rounded-lg bg-[#2563EB] px-3.5 py-2.5 text-xs font-bold text-white hover:bg-[#1D4ED8] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
