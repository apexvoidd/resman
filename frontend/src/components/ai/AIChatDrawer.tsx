"use client";

import { useRBAC } from "@/hooks/use-rbac";
import { fetchAISuggestions, sendAIChatMessage, AIChatMessage } from "@/services/ai";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";

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
            <div className="flex h-full flex-col justify-center space-y-4 text-center px-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2563EB]/10 border border-[#2563EB]/30 text-3xl">
                🧠
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#F8FAFC]">
                  Welcome to ResMan AI Assistant
                </h4>
                <p className="mt-1 text-xs text-[#94A3B8]">
                  I am strictly trained on your live restaurant data. Ask me anything about revenue, orders, inventory stock, table occupancy, or staff performance!
                </p>
              </div>

              {suggestions.length > 0 && (
                <div className="mt-4 space-y-2 text-left">
                  <p className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider">
                    Suggested Questions:
                  </p>
                  <div className="flex flex-col space-y-2">
                    {suggestions.map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSend(q)}
                        className="rounded-lg border border-[#334155] bg-[#0F172A] p-2.5 text-left text-xs font-medium text-[#CBD5E1] hover:border-[#2563EB] hover:bg-[#1E293B] hover:text-white transition"
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
                      <div className="mb-1.5 flex items-center space-x-1.5 text-[10px] font-bold uppercase text-[#2563EB]">
                        <span>🤖 ResMan AI</span>
                      </div>
                    )}
                    <div className="whitespace-pre-wrap font-sans">{msg.content}</div>
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
