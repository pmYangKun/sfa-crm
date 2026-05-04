'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  PENDING_PROMPT_EVENT,
  PENDING_PROMPT_KEY,
} from '@/components/onboarding/onboarding-panel';
import { parseNavMarkers } from '@/lib/parse-nav-markers';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
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
  // PC 端登录后默认展开 chat 面板（不让用户多点一下；移动端走 /m/chat 全屏路由不受影响）
  const [open, setOpen] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const bottomRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(loading);
  loadingRef.current = loading;
  /** loading 时入队，本次结束自动消费下一个，避免快速连点丢 prompt */
  const queueRef = useRef<string[]>([]);
  /** 同步追踪 messages 最新值。useCallback 闭包里读 messages 会 stale；
   *  原代码用 setMessages(prev => { messagesForApi = ...; }) 闭包赋值，但 React 18
   *  自动批处理可能把 updater 推迟到下一个 microtask，导致 fetch 时 messagesForApi 仍为 []。 */
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 同步 messagesRef
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const handleNavigate = useCallback((url: string) => {
    const leadIdMatch = url.match(/^\/leads\/([^/?#]+)/);
    if (leadIdMatch) {
      const id = decodeURIComponent(leadIdMatch[1]);
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (!isUUID && id !== 'new') {
        alert('导航链接无效，请重新向 AI 提问。');
        return;
      }
    }

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

    const urlObj = new URL(normalized, window.location.origin);
    const searchStr = urlObj.searchParams.toString();
    if (searchStr) {
      sessionStorage.setItem('copilot_prefill', searchStr);
    }
    const hash = urlObj.hash.slice(1);

    const navPath = searchStr
      ? `${urlObj.pathname}?${searchStr}&_t=${Date.now()}`
      : `${urlObj.pathname}?_t=${Date.now()}`;
    router.push(navPath);

    if (hash) {
      setTimeout(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' });
      }, 600);
    }
  }, [router]);

  const sendPrompt = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (loadingRef.current) {
      queueRef.current.push(trimmed);
      return;
    }
    loadingRef.current = true;

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: trimmed };
    // 同步构建 messagesForApi，不依赖 setMessages 的 updater 异步执行
    const messagesForApi = [...messagesRef.current, userMsg];
    setMessages(messagesForApi);
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
          messages: messagesForApi.map(m => ({ role: m.role, content: m.content })),
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
      loadingRef.current = false;
      setLoading(false);
      // 消费队列里下一个 prompt
      const next = queueRef.current.shift();
      if (next) setTimeout(() => sendPromptRef.current(next), 0);
    }
  }, [sessionId]);
  // 用 ref 解递归依赖（finally 里调 sendPrompt 自己）
  const sendPromptRef = useRef(sendPrompt);
  sendPromptRef.current = sendPrompt;

  // 监听 OnboardingPanel 派发的事件 + 挂载时检查 sessionStorage
  useEffect(() => {
    if (!user) return;
    const consume = () => {
      const prompt = sessionStorage.getItem(PENDING_PROMPT_KEY);
      if (prompt) {
        sessionStorage.removeItem(PENDING_PROMPT_KEY);
        setOpen(true);
        setTimeout(() => sendPrompt(prompt), 0);
      }
    };
    consume();
    window.addEventListener(PENDING_PROMPT_EVENT, consume);
    return () => window.removeEventListener(PENDING_PROMPT_EVENT, consume);
  }, [user, sendPrompt]);

  // chat 打开时给主内容腾出 420px 右边距，避免主区域内容（dashboard 卡片等）被 chat 覆盖导致点击被拦截
  useEffect(() => {
    document.documentElement.style.setProperty('--chat-panel-width', open ? '420px' : '0px');
    return () => {
      document.documentElement.style.setProperty('--chat-panel-width', '0px');
    };
  }, [open]);

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input;
    setInput('');
    await sendPrompt(text);
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          data-testid="chat-toggle-btn"
          aria-label="打开 AI 助手"
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
            width: 52, height: 52, borderRadius: '50%',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: '#fff', border: 'none', cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.32), 0 0 0 1px rgba(99, 102, 241, 0.35), 0 0 22px rgba(129, 140, 248, 0.28)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'transform 0.18s ease, box-shadow 0.18s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px) scale(1.04)';
            e.currentTarget.style.boxShadow = '0 12px 28px rgba(15, 23, 42, 0.4), 0 0 0 1px rgba(129, 140, 248, 0.55), 0 0 28px rgba(129, 140, 248, 0.45)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(15, 23, 42, 0.32), 0 0 0 1px rgba(99, 102, 241, 0.35), 0 0 22px rgba(129, 140, 248, 0.28)';
          }}
          title="AI 助手"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <defs>
              <linearGradient id="copilot-spark" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#a5b4fc" />
                <stop offset="100%" stopColor="#818cf8" />
              </linearGradient>
            </defs>
            <path
              d="M12 2.5l1.85 5.18a3.5 3.5 0 0 0 2.12 2.12L21.15 11.65l-5.18 1.85a3.5 3.5 0 0 0-2.12 2.12L12 20.8l-1.85-5.18a3.5 3.5 0 0 0-2.12-2.12L2.85 11.65l5.18-1.85a3.5 3.5 0 0 0 2.12-2.12L12 2.5z"
              fill="url(#copilot-spark)"
            />
            <circle cx="19" cy="5" r="1.4" fill="#c7d2fe" />
            <circle cx="5" cy="19" r="1" fill="#c7d2fe" opacity="0.85" />
          </svg>
        </button>
      )}

      {open && (
        <div
          data-testid="chat-panel"
          style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 999,
            width: 420, background: '#fff',
            boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}
        >
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

          <div
            data-testid="chat-messages"
            style={{
              flex: 1, overflowY: 'auto', padding: 20,
              display: 'flex', flexDirection: 'column', gap: 12,
            }}
          >
            {messages.length === 0 && (
              <div style={{ color: '#999', textAlign: 'center', marginTop: 40, fontSize: 13, lineHeight: 2.2 }}>
                <div
                  data-testid="chat-empty-onboarding-hint"
                  style={{
                    background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
                    border: '1px solid #c7d2fe',
                    borderRadius: 10,
                    padding: '12px 14px',
                    color: '#3730a3',
                    fontSize: 13,
                    lineHeight: 1.6,
                    marginBottom: 20,
                    textAlign: 'left',
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                  }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1, marginTop: 1 }}>👈</span>
                  <span>
                    <strong style={{ color: '#1e1b4b' }}>新手提示：</strong>
                    点击页面左侧的<strong>引导卡片</strong>，可一键带入演示场景，快速体验 AI 助手能力。
                  </span>
                </div>
                <p style={{ fontSize: 15, marginBottom: 12, color: '#666' }}>也可以直接这样问我：</p>
                <p>&ldquo;帮我搜一下华北的线索&rdquo;</p>
                <p>&ldquo;帮我给数字颗粒录一条拜访记录&rdquo;</p>
                <p>&ldquo;我想把这条线索转成客户&rdquo;</p>
              </div>
            )}
            {messages.map(msg => (
              <div
                key={msg.id}
                data-testid={`chat-msg-${msg.role}`}
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
