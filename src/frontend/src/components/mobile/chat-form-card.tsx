'use client';

import { ParsedNav, fieldLabel, displayValue } from '@/lib/parse-nav-url';

export type ChatFormCardStatus = 'pending' | 'editing' | 'submitting' | 'submitted' | 'failed';

export interface ChatFormCardState {
  cardKey: string;
  parsed: ParsedNav;
  /** 用户编辑后的 values（首次为 parsed.prefill 拷贝） */
  values: Record<string, string>;
  status: ChatFormCardStatus;
  createdId?: string;
  errorMsg?: string;
}

const STATUS_BADGE: Record<ChatFormCardStatus, { text: string; bg: string; color: string }> = {
  pending: { text: '待确认', bg: '#fff7e6', color: '#d46b08' },
  editing: { text: '编辑中', bg: '#e6f7ff', color: '#1890ff' },
  submitting: { text: '提交中', bg: '#e6f7ff', color: '#1890ff' },
  submitted: { text: '✅ 已创建', bg: '#f6ffed', color: '#389e0d' },
  failed: { text: '❌ 失败', bg: '#fff1f0', color: '#cf1322' },
};

interface ChatFormCardProps {
  state: ChatFormCardState;
  onClick: () => void;
}

export default function ChatFormCard({ state, onClick }: ChatFormCardProps) {
  const { parsed, values, status, createdId, errorMsg } = state;
  const badge = STATUS_BADGE[status];

  const previewKeys = Object.keys(values).filter((k) => values[k]).slice(0, 3);
  const clickable = status === 'pending' || status === 'failed' || status === 'editing';

  const cta = (() => {
    if (status === 'pending') return '点击审核 →';
    if (status === 'editing') return '继续编辑 →';
    if (status === 'submitting') return '提交中...';
    if (status === 'submitted') return createdId ? `ID: ${createdId.slice(0, 8)}...` : '已创建';
    if (status === 'failed') return '点击重试 →';
    return '';
  })();

  return (
    <div
      data-testid={`chat-form-card-${state.cardKey}`}
      data-card-status={status}
      onClick={clickable ? onClick : undefined}
      style={{
        background: '#fff',
        border: '1px solid #e8e8e8',
        borderLeft: `4px solid ${badge.color}`,
        borderRadius: 8,
        padding: 12,
        marginTop: 8,
        marginBottom: 4,
        cursor: clickable ? 'pointer' : 'default',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        opacity: status === 'submitted' ? 0.85 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#262626' }}>{parsed.typeLabel}</div>
        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: badge.bg, color: badge.color, fontWeight: 500 }}>
          {badge.text}
        </span>
      </div>
      {previewKeys.length > 0 && (
        <div style={{ fontSize: 12, color: '#595959', lineHeight: 1.7 }}>
          {previewKeys.map((k) => (
            <div key={k}>
              <span style={{ color: '#8c8c8c' }}>{fieldLabel(k)}：</span>
              <span style={{ color: '#262626' }}>{displayValue(k, values[k])}</span>
            </div>
          ))}
        </div>
      )}
      {status === 'failed' && errorMsg && (
        <div style={{ fontSize: 12, color: '#cf1322', marginTop: 6 }}>{errorMsg}</div>
      )}
      <div style={{ marginTop: 8, fontSize: 12, color: clickable ? '#1890ff' : '#8c8c8c', fontWeight: 500 }}>
        {cta}
      </div>
    </div>
  );
}
