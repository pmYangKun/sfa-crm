'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import OnboardingCardsMobile from '@/components/onboarding/onboarding-cards-mobile';
import {
  PENDING_PROMPT_EVENT,
  PENDING_PROMPT_KEY,
} from '@/components/onboarding/onboarding-panel';
import { TABBAR_HEIGHT } from './kingkong-tabbar';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const HEADER_HEIGHT = 48;

export default function ChatFullscreen() {
  const { user, loginName } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const bottomRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(loading);
  loadingRef.current = loading;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendPrompt = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loadingRef.current) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: trimmed };
    let messagesForApi: Message[] = [];
    setMessages((prev) => {
      messagesForApi = [...prev, userMsg];
      return messagesForApi;
    });
    setLoading(true);

    try {
      const token = localStorage.getItem('access_token') || '';
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: messagesForApi.map((m) => ({ role: m.role, content: m.content })),
          sessionId,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        setMessages((prev) => [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: err.error || '请求失败，请稍后重试。',
        }]);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      const assistantId = crypto.randomUUID();
      setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (chunk) {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk } : m)),
          );
        }
      }
    } catch (err) {
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '网络错误，请检查连接后重试。',
      }]);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!user) return;
    const consume = () => {
      const prompt = sessionStorage.getItem(PENDING_PROMPT_KEY);
      if (prompt) {
        sessionStorage.removeItem(PENDING_PROMPT_KEY);
        setTimeout(() => sendPrompt(prompt), 0);
      }
    };
    consume();
    window.addEventListener(PENDING_PROMPT_EVENT, consume);
    return () => window.removeEventListener(PENDING_PROMPT_EVENT, consume);
  }, [user, sendPrompt]);

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input;
    setInput('');
    await sendPrompt(text);
  };

  const showOnboarding = messages.length === 0 && !loading;

  return (
    <div
      data-testid="chat-fullscreen"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: TABBAR_HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
      }}
    >
      <div
        style={{
          height: HEADER_HEIGHT,
          padding: '0 16px',
          background: '#1890ff',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 15,
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🤖</span>
          <span>AI 助手</span>
        </div>
      </div>

      <div
        data-testid="chat-fullscreen-body"
        style={{ flex: 1, overflowY: 'auto', background: '#f5f7fa' }}
      >
        {showOnboarding && loginName && (
          <OnboardingCardsMobile currentLoginName={loginName} collapsed={false} />
        )}
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              data-testid={`chat-msg-${msg.role}`}
              style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                background: msg.role === 'user' ? '#1890ff' : '#fff',
                color: msg.role === 'user' ? '#fff' : '#262626',
                padding: '8px 12px',
                borderRadius: 8,
                maxWidth: '85%',
                fontSize: 14,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                boxShadow: msg.role === 'assistant' ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
              }}
            >
              {msg.content || (loading ? '思考中...' : '')}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{ padding: '8px 12px', background: '#fff', borderTop: '1px solid #e8e8e8', display: 'flex', gap: 8, flexShrink: 0 }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="向 AI 提问..."
          disabled={loading}
          style={{ flex: 1, padding: '10px 12px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 14, outline: 'none' }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          style={{
            padding: '10px 16px',
            background: '#1890ff',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            opacity: loading || !input.trim() ? 0.5 : 1,
            fontSize: 14,
          }}
        >
          发送
        </button>
      </form>
    </div>
  );
}
