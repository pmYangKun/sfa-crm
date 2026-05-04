'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import OnboardingCardsMobile from '@/components/onboarding/onboarding-cards-mobile';
import {
  PENDING_PROMPT_EVENT,
  PENDING_PROMPT_KEY,
} from '@/components/onboarding/onboarding-panel';
import { parseNavMarkers } from '@/lib/parse-nav-markers';
import { parseNavUrl } from '@/lib/parse-nav-url';
import ChatFormCard, { ChatFormCardState } from './chat-form-card';
import MobileFormSheet from './mobile-form-sheet';
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
  // sessionId 用 state，切换角色时换新会话避免上一身份的 conversation_history 串联
  const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID());
  const bottomRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(loading);
  loadingRef.current = loading;
  // 切换角色时 abort 正在进行的 fetch
  const abortControllerRef = useRef<AbortController | null>(null);
  /** 同步追踪 messages 最新值（修 React 18 batching 导致 setMessages updater 异步执行的 bug） */
  const messagesRef = useRef<Message[]>([]);

  // 每张待确认卡片独立状态，cardKey = `${msgId}-${navIndex}`
  const [cardStates, setCardStates] = useState<Record<string, ChatFormCardState>>({});
  const [openCardKey, setOpenCardKey] = useState<string | null>(null);

  // 同步 messagesRef + 滚到底
  useEffect(() => {
    messagesRef.current = messages;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 切换角色 / 登出 → 清空 chat 状态（含 abort 正在进行的流式响应）
  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setMessages([]);
    setCardStates({});
    setOpenCardKey(null);
    setLoading(false);
    loadingRef.current = false;
    setSessionId(crypto.randomUUID());
  }, [user?.id]);

  // 监听消息流，发现新的 nav 标记时往 cardStates 加；已存在的卡不动（保留用户编辑状态）
  useEffect(() => {
    setCardStates((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const msg of messages) {
        if (msg.role !== 'assistant') continue;
        const parts = parseNavMarkers(msg.content);
        let navIdx = 0;
        for (const p of parts) {
          if (p.type !== 'nav') continue;
          const cardKey = `${msg.id}-${navIdx}`;
          if (!next[cardKey]) {
            const parsed = parseNavUrl(p.url, p.label);
            next[cardKey] = {
              cardKey,
              parsed,
              values: { ...parsed.prefill },
              status: 'pending',
            };
            changed = true;
          }
          navIdx++;
        }
      }
      return changed ? next : prev;
    });
  }, [messages]);

  const sendPrompt = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    // 用户要求：loading 中点卡片直接忽略，不再排队后续执行
    if (loadingRef.current) return;
    loadingRef.current = true;

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: trimmed };
    const messagesForApi = [...messagesRef.current, userMsg];
    setMessages(messagesForApi);
    setLoading(true);

    const ac = new AbortController();
    abortControllerRef.current = ac;

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
        signal: ac.signal,
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
      // AbortError = 切换角色 / 登出主动 abort，user.id useEffect 已清空 messages，不再插脏数据
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '网络错误，请检查连接后重试。',
      }]);
    } finally {
      loadingRef.current = false;
      setLoading(false);
      if (abortControllerRef.current === ac) {
        abortControllerRef.current = null;
      }
    }
  }, [sessionId]);

  const resetChat = useCallback(() => {
    setMessages([]);
    setCardStates({});
    setOpenCardKey(null);
  }, []);

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

  const handleSheetClose = useCallback((lastValues: Record<string, string>) => {
    setCardStates((prev) => {
      if (!openCardKey || !prev[openCardKey]) return prev;
      return {
        ...prev,
        [openCardKey]: { ...prev[openCardKey], values: lastValues },
      };
    });
    setOpenCardKey(null);
  }, [openCardKey]);

  const handleSheetSubmit = useCallback(async (values: Record<string, string>): Promise<{ id: string }> => {
    const key = openCardKey;
    if (!key) throw new Error('no open card');
    const card = cardStates[key];
    if (!card?.parsed.submit) throw new Error('该对象类型本期不支持提交');

    setCardStates((prev) => ({
      ...prev,
      [key]: { ...prev[key], status: 'submitting', values },
    }));

    try {
      const body = card.parsed.submit.buildBody(values);
      const res = await api.post<{ id: string }>(card.parsed.submit.path, body);
      const id = res.id ?? 'unknown';
      setCardStates((prev) => ({
        ...prev,
        [key]: { ...prev[key], status: 'submitted', createdId: id, values },
      }));
      setOpenCardKey(null);
      return { id };
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : '提交失败';
      setCardStates((prev) => ({
        ...prev,
        [key]: { ...prev[key], status: 'failed', errorMsg, values },
      }));
      throw e;
    }
  }, [openCardKey, cardStates]);

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input;
    setInput('');
    await sendPrompt(text);
  };

  const showOnboarding = messages.length === 0 && !loading;

  return (
    <>
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
        {messages.length > 0 && (
          <button
            type="button"
            onClick={resetChat}
            data-testid="reset-chat-btn"
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.4)',
              color: '#fff',
              borderRadius: 4,
              padding: '4px 10px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            ↺ 新对话
          </button>
        )}
      </div>

      <div
        data-testid="chat-fullscreen-body"
        style={{ flex: 1, overflowY: 'auto', background: '#f5f7fa' }}
      >
        {showOnboarding && loginName && (
          <OnboardingCardsMobile currentLoginName={loginName} collapsed={false} />
        )}
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.map((msg) => {
            if (msg.role === 'user') {
              return (
                <div
                  key={msg.id}
                  data-testid="chat-msg-user"
                  style={{
                    alignSelf: 'flex-end',
                    background: '#1890ff',
                    color: '#fff',
                    padding: '8px 12px',
                    borderRadius: 8,
                    maxWidth: '85%',
                    fontSize: 14,
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.content}
                </div>
              );
            }

            // assistant：把消息切成 text + nav 段，nav 段渲染为 ChatFormCard
            const parts = parseNavMarkers(msg.content);
            let navIdx = 0;
            return (
              <div
                key={msg.id}
                data-testid="chat-msg-assistant"
                style={{
                  alignSelf: 'stretch',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                {parts.map((p, i) => {
                  if (p.type === 'text') {
                    if (!p.value.trim()) return null;
                    return (
                      <div
                        key={i}
                        style={{
                          alignSelf: 'flex-start',
                          background: '#fff',
                          color: '#262626',
                          padding: '8px 12px',
                          borderRadius: 8,
                          maxWidth: '85%',
                          fontSize: 14,
                          lineHeight: 1.6,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                        }}
                      >
                        {p.value}
                      </div>
                    );
                  }
                  const cardKey = `${msg.id}-${navIdx++}`;
                  const card = cardStates[cardKey];
                  if (!card) return null;
                  return (
                    <ChatFormCard
                      key={i}
                      state={card}
                      onClick={() => setOpenCardKey(cardKey)}
                    />
                  );
                })}
                {/* 流式中且消息空时显示思考中 */}
                {!msg.content && loading && (
                  <div
                    style={{
                      alignSelf: 'flex-start',
                      background: '#fff',
                      color: '#999',
                      padding: '8px 12px',
                      borderRadius: 8,
                      fontSize: 14,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    }}
                  >
                    思考中...
                  </div>
                )}
              </div>
            );
          })}
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

    {/* Sheet 渲染在 chat-fullscreen 外，避开父级 position:fixed 创建的 stacking context */}
    <MobileFormSheet
      open={openCardKey !== null}
      card={openCardKey ? cardStates[openCardKey] ?? null : null}
      onClose={handleSheetClose}
      onSubmit={handleSheetSubmit}
    />
    </>
  );
}
