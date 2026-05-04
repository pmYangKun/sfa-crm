'use client';

import { useEffect, useState } from 'react';
import { getRoleCardByLogin } from '@/lib/onboarding-config';

interface RoleSwitchConfirmProps {
  open: boolean;
  fromLogin: string;
  toLogin: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export default function RoleSwitchConfirm({
  open,
  fromLogin,
  toLogin,
  onConfirm,
  onCancel,
}: RoleSwitchConfirmProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setBusy(false);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const fromRole = getRoleCardByLogin(fromLogin);
  const toRole = getRoleCardByLogin(toLogin);

  const handleConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      setBusy(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : '切换失败');
      setBusy(false);
    }
  };

  return (
    <div
      data-testid="role-switch-confirm"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div style={{ background: '#fff', borderRadius: 8, padding: 24, width: '100%', maxWidth: 360, boxShadow: '0 12px 32px rgba(0,0,0,0.2)' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 600 }}>
          切换到 {toRole?.displayName ?? toLogin}？
        </h3>
        <p style={{ margin: '0 0 20px', color: '#666', fontSize: 14, lineHeight: 1.6 }}>
          当前以 <strong>{fromRole?.displayName ?? fromLogin}</strong> 登录。
          切换后当前对话和未保存内容将清空。
        </p>
        {error && (
          <div style={{ marginBottom: 16, padding: '8px 12px', background: '#fff1f0', border: '1px solid #ffccc7', color: '#cf1322', fontSize: 13, borderRadius: 4 }}>
            {error}
          </div>
        )}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{ padding: '8px 16px', border: '1px solid #d9d9d9', background: '#fff', borderRadius: 4, cursor: busy ? 'not-allowed' : 'pointer', fontSize: 14 }}
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            data-testid="role-switch-confirm-btn"
            style={{ padding: '8px 16px', background: '#1890ff', color: '#fff', border: 'none', borderRadius: 4, cursor: busy ? 'not-allowed' : 'pointer', fontSize: 14, opacity: busy ? 0.7 : 1 }}
          >
            {busy ? '切换中...' : '确认切换'}
          </button>
        </div>
      </div>
    </div>
  );
}
