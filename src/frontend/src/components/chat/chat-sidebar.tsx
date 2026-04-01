"use client";

import { useChat } from "ai/react";
import { useRef, useEffect, useState } from "react";

export default function ChatSidebar() {
  const [open, setOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
    api: "/api/chat",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    onError: (err) => console.error("Chat error:", err),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!open) {
    return (
      <button className="chat-fab" onClick={() => setOpen(true)} title="AI 助手">
        💬
        <style jsx>{`
          .chat-fab {
            position: fixed;
            bottom: 24px;
            right: 24px;
            width: 48px;
            height: 48px;
            background: var(--color-primary);
            color: #fff;
            border: none;
            border-radius: 50%;
            font-size: 20px;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .chat-fab:hover { opacity: 0.9; }
        `}</style>
      </button>
    );
  }

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <span>AI 助手</span>
        <button className="close-btn" onClick={() => setOpen(false)}>×</button>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <p className="chat-hint">你好！我是 AI 销售助手，可以帮你查询线索、记录跟进、分析数据。</p>
        )}
        {messages.map(m => (
          <div key={m.id} className={`chat-bubble ${m.role}`}>
            {m.role === "assistant" && <span className="role-label">助手</span>}
            {m.role === "user" && <span className="role-label">我</span>}
            <div className="bubble-content">
              {m.content}
              {m.toolInvocations && m.toolInvocations.length > 0 && (
                <div className="tool-calls">
                  {m.toolInvocations.map((ti, i) => (
                    <div key={i} className="tool-call">
                      <span className="tool-name">⚙ {ti.toolName}</span>
                      {ti.state === "result" && (
                        <span className="tool-status done">完成</span>
                      )}
                      {ti.state === "call" && (
                        <span className="tool-status running">执行中…</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="chat-bubble assistant">
            <span className="role-label">助手</span>
            <div className="bubble-content typing">…</div>
          </div>
        )}
        {error && <p className="chat-error">{error.message}</p>}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="chat-input-row">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="输入问题…"
          disabled={isLoading}
          className="chat-input"
        />
        <button type="submit" disabled={isLoading || !input.trim()} className="chat-send">
          发送
        </button>
      </form>

      <style jsx>{`
        .chat-panel {
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 360px;
          height: 520px;
          background: #fff;
          border: 1px solid var(--color-border);
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 8px 24px rgba(0,0,0,0.15);
          z-index: 1000;
          overflow: hidden;
        }
        .chat-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: var(--color-primary);
          color: #fff;
          font-size: 14px;
          font-weight: 600;
        }
        .close-btn {
          background: none;
          border: none;
          color: #fff;
          font-size: 18px;
          cursor: pointer;
          line-height: 1;
          padding: 0 4px;
        }
        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .chat-hint {
          font-size: 13px;
          color: var(--color-text-secondary);
          text-align: center;
          padding: 20px 0;
        }
        .chat-bubble {
          display: flex;
          flex-direction: column;
          gap: 2px;
          max-width: 85%;
        }
        .chat-bubble.user {
          align-self: flex-end;
          align-items: flex-end;
        }
        .chat-bubble.assistant {
          align-self: flex-start;
          align-items: flex-start;
        }
        .role-label {
          font-size: 11px;
          color: var(--color-text-secondary);
        }
        .bubble-content {
          background: #f0f0f0;
          padding: 8px 12px;
          border-radius: 10px;
          font-size: 13px;
          line-height: 1.5;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .chat-bubble.user .bubble-content {
          background: var(--color-primary);
          color: #fff;
        }
        .typing {
          color: #999;
          font-style: italic;
        }
        .tool-calls {
          margin-top: 6px;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .tool-call {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
        }
        .tool-name { color: #666; }
        .tool-status.done { color: #38a169; }
        .tool-status.running { color: #e67e22; }
        .chat-input-row {
          display: flex;
          gap: 8px;
          padding: 10px 12px;
          border-top: 1px solid var(--color-border);
        }
        .chat-input {
          flex: 1;
          padding: 7px 10px;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          font-size: 13px;
          outline: none;
        }
        .chat-input:focus { border-color: var(--color-primary); }
        .chat-send {
          background: var(--color-primary);
          color: #fff;
          border: none;
          padding: 7px 14px;
          border-radius: 8px;
          font-size: 13px;
          cursor: pointer;
        }
        .chat-send:disabled { opacity: 0.5; cursor: not-allowed; }
        .chat-error { color: #e53e3e; font-size: 12px; text-align: center; }
      `}</style>
    </div>
  );
}
