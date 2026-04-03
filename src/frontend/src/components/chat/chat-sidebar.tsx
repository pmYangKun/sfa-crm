'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Parse [[nav:label|url]] markers in AI response and split into
 * text segments and navigation button segments.
 */
function parseNavMarkers(text: string): Array<{ type: 'text'; value: string } | { type: 'nav'; label: string; url: string }> {
  const parts: Array<{ type: 'text'; value: string } | { type: 'nav'; label: string; url: string }> = [];
  const regex = /\[\[nav:(.+?)\|(.+?)\]\]/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'nav', label: match[1].trim(), url: match[2].trim() });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return parts;
}

function MessageContent({ content, onNavigate }: { content: string; onNavigate: (url: string) => void }) {
  const parts = parseNavMarkers(content);

  if (parts.length === 1 && parts[0].type === 'text') {
    return <>{content}</>;
  }

  return (
    <>
      {parts.map((part, i) => {
        if (part.type === 'text') {
          return <span key={i}>{part.value}</span>;
        }
        return (
          <button
            key={i}
            onClick={() => onNavigate(part.url)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              margin: '4px 2px',
              padding: '6px 12px',
              background: '#1890ff',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontSize: 14 }}>→</span> {part.label}
          </button>
        );
      })}
    </>
  );
}

export default function ChatSidebar() {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleNavigate = useCallback((url: string) => {
    // Validate: /leads/{id} URLs must use UUID format IDs (not company names)
    const leadIdMatch = url.match(/^\/leads\/([^/?#]+)/);
    if (leadIdMatch) {
      const id = decodeURIComponent(leadIdMatch[1]);
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (!isUUID && id !== 'new') {
        alert('导航链接无效，请重新向 AI 提问。');
        return;
      }
    }

    // Normalize LLM-generated sub-path URLs to hash-anchor format
    // e.g. /leads/{id}/followup → /leads/{id}#followup
    const subPathMap: Record<string, string> = {
      'followup': 'followup',
      'follow-up': 'followup',
      'key-events': 'keyevent',
      'key-event': 'keyevent',
      'keyevent': 'keyevent',
      'actions': 'actions',
    };
    let normalized = url;
    const leadSubPath = normalized.match(/^(\/leads\/[^/?#]+)\/([\w-]+)/);
    if (leadSubPath) {
      const anchor = subPathMap[leadSubPath[2]];
      if (anchor) {
        const qIdx = normalized.indexOf('?');
        const query = qIdx >= 0 ? normalized.slice(qIdx).split('#')[0] : '';
        normalized = `${leadSubPath[1]}${query}#${anchor}`;
      }
    }

    // Write prefill data to sessionStorage, then navigate
    const urlObj = new URL(normalized, window.location.origin);
    const searchStr = urlObj.searchParams.toString();
    if (searchStr) {
      sessionStorage.setItem('copilot_prefill', searchStr);
    }
    const hash = urlObj.hash.slice(1);

    // Add timestamp to force React to re-mount the page component
    // (router.push to the same path without this won't re-trigger useEffect)
    const navPath = `${urlObj.pathname}?_t=${Date.now()}`;
    router.push(navPath);

    if (hash) {
      setTimeout(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' });
      }, 600);
    }
  }, [router]);

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
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
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          sessionId,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: err.error || '请求失败，请稍后重试。',
        }]);
        return;
      }

      // Read streaming response
      const reader = res.body?.getReader();
      if (!reader) return;

      const assistantId = crypto.randomUUID();
      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        if (chunk) {
          setMessages(prev => prev.map(m =>
            m.id === assistantId ? { ...m, content: m.content + chunk } : m
          ));
        }
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '网络错误，请检查连接后重试。',
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Toggle button — only visible when panel is closed */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
            width: 56, height: 56, borderRadius: '50%',
            background: '#1890ff', color: '#fff', border: 'none',
            fontSize: 24, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          title="AI 助手"
        >
          🤖
        </button>
      )}

      {/* Chat panel — full-height right sidebar */}
      {open && (
        <div style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 999,
          width: 420, background: '#fff',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '16px 20px', background: '#1890ff', color: '#fff',
            fontWeight: 600, fontSize: 16,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🤖</span>
              <span>AI 助手 (Copilot)</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{
                background: 'transparent', border: 'none', color: '#fff',
                fontSize: 20, cursor: 'pointer', padding: '0 4px',
                lineHeight: 1, opacity: 0.85,
              }}
              title="关闭"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: 20,
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            {messages.length === 0 && (
              <div style={{ color: '#999', textAlign: 'center', marginTop: 60, fontSize: 13, lineHeight: 2.2 }}>
                <p style={{ fontSize: 15, marginBottom: 12, color: '#666' }}>你可以这样问我：</p>
                <p>&ldquo;帮我搜一下华北的线索&rdquo;</p>
                <p>&ldquo;帮我给数字颗粒录一条拜访记录&rdquo;</p>
                <p>&ldquo;我想把这条线索转成客户&rdquo;</p>
              </div>
            )}
            {messages.map(msg => (
              <div
                key={msg.id}
                style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  background: msg.role === 'user' ? '#1890ff' : '#f5f5f5',
                  color: msg.role === 'user' ? '#fff' : '#333',
                  padding: '8px 12px', borderRadius: 8,
                  maxWidth: '85%', fontSize: 14, lineHeight: 1.6,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}
              >
                {msg.role === 'assistant' ? (
                  <MessageContent content={msg.content || (loading ? '思考中...' : '')} onNavigate={handleNavigate} />
                ) : (
                  msg.content
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} style={{
            padding: '12px 16px', borderTop: '1px solid #e8e8e8',
            display: 'flex', gap: 8,
          }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="输入消息..."
              disabled={loading}
              style={{
                flex: 1, padding: '8px 12px', border: '1px solid #d9d9d9',
                borderRadius: 6, fontSize: 14, outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              style={{
                padding: '8px 16px', background: '#1890ff', color: '#fff',
                border: 'none', borderRadius: 6, cursor: 'pointer',
                opacity: loading || !input.trim() ? 0.5 : 1,
              }}
            >
              发送
            </button>
          </form>
        </div>
      )}
    </>
  );
}
