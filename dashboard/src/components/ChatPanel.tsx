"use client";
import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2, Trash2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hey! I'm Mother Algo's AI assistant. Ask me anything about markets, trading strategies, technical analysis, options Greeks, or risk management. I have full context of this dashboard." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const userMsg: Message = { role: "user", content: text };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMsgs.filter(m => m.role !== "assistant" || m !== messages[0]).slice(-10) }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.response }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: "Connection error. Please try again." }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="bg-[#262626] rounded-xl border border-[#3a3a3a] flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#3a3a3a] flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
            <Bot className="w-3.5 h-3.5 text-white" />
          </div>
          <h2 className="text-[11px] font-bold text-white">Mother Algo AI</h2>
          <span className="text-[8px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 font-bold">CLAUDE</span>
        </div>
        <button onClick={() => setMessages([messages[0]])} className="text-slate-600 hover:text-slate-400 transition" title="Clear chat">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto p-3 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && (
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="w-3 h-3 text-white" />
              </div>
            )}
            <div className={`max-w-[80%] rounded-xl px-3 py-2 text-[11px] leading-relaxed ${
              m.role === "user"
                ? "bg-blue-500/20 text-blue-100 rounded-br-sm"
                : "bg-[#333333] border border-[#3a3a3a] text-slate-300 rounded-bl-sm"
            }`}>
              {m.content.split("\n").map((line, j) => (
                <p key={j} className={j > 0 ? "mt-1.5" : ""}>{line}</p>
              ))}
            </div>
            {m.role === "user" && (
              <div className="w-5 h-5 rounded-full bg-blue-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <User className="w-3 h-3 text-blue-400" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-2">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center flex-shrink-0">
              <Bot className="w-3 h-3 text-white" />
            </div>
            <div className="bg-[#333333] border border-[#3a3a3a] rounded-xl px-3 py-2 rounded-bl-sm">
              <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-[#3a3a3a] flex-shrink-0">
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Ask about markets, strategies, risk..."
          className="flex-1 bg-[#333333] border border-[#3a3a3a] rounded-lg px-3 py-1.5 text-[11px] text-white placeholder:text-slate-600 outline-none focus:border-purple-500/50 transition"
          disabled={loading}
        />
        <button onClick={send} disabled={loading || !input.trim()}
          className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition flex items-center justify-center disabled:opacity-30">
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-1 px-3 pb-2 flex-shrink-0 flex-wrap">
        {["What's the oil market outlook?", "Explain my risk exposure", "Best strategy for NIFTY today?", "Analyze crude technicals"].map((q, i) => (
          <button key={i} onClick={() => { setInput(q); }}
            className="text-[8px] px-2 py-0.5 rounded-full bg-[#333333] text-slate-500 hover:text-slate-300 transition">
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
