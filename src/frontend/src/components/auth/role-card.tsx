'use client';

import { useState } from 'react';
import { RoleCard as RoleCardType } from '@/lib/onboarding-config';

interface RoleCardProps {
  role: RoleCardType;
  layout: 'pc' | 'mobile';
  onSelect: (loginName: string, password: string) => Promise<void>;
  /** 父组件可传入正在登录中的卡片 loginName，禁用所有点击 */
  busyLogin?: string | null;
}

export default function RoleCard({ role, layout, onSelect, busyLogin }: RoleCardProps) {
  const [localBusy, setLocalBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBusy = localBusy || busyLogin === role.loginName;
  const someoneElseBusy = busyLogin !== null && busyLogin !== undefined && busyLogin !== role.loginName;
  const disabled = isBusy || someoneElseBusy;

  const handleClick = async () => {
    if (disabled) return;
    setLocalBusy(true);
    setError(null);
    try {
      await onSelect(role.loginName, role.password);
    } catch (e) {
      setError(e instanceof Error ? e.message : '登录失败');
      setLocalBusy(false);
    }
  };

  const isPc = layout === 'pc';
  const desc = isPc ? role.description : role.descriptionMobile;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      data-testid={`role-card-${role.loginName}`}
      style={{
        position: 'relative',
        textAlign: 'left',
        background: '#fff',
        border: '1px solid #e8e8e8',
        borderTop: `4px solid ${role.accentColor}`,
        borderRadius: 8,
        padding: isPc ? '24px 24px 20px' : '20px',
        width: isPc ? 320 : '100%',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: someoneElseBusy ? 0.5 : 1,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        transition: 'transform 0.15s, box-shadow 0.15s',
        fontFamily: 'inherit',
        fontSize: 'inherit',
        color: 'inherit',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.1)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = '';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
      }}
    >
      <div style={{ fontSize: isPc ? 18 : 16, fontWeight: 600, marginBottom: 8, color: role.accentColor }}>
        {role.displayName}
      </div>
      <div style={{ fontSize: 14, color: '#555', lineHeight: 1.6, marginBottom: 16, minHeight: isPc ? 44 : undefined }}>
        {desc}
      </div>
      <div style={{ display: 'inline-block', padding: '8px 16px', background: role.accentColor, color: '#fff', borderRadius: 4, fontSize: 14, fontWeight: 500 }}>
        {isBusy ? '登录中...' : '一键登录 →'}
      </div>
      {error && (
        <div style={{ marginTop: 12, padding: '6px 10px', background: '#fff1f0', border: '1px solid #ffccc7', color: '#cf1322', fontSize: 13, borderRadius: 4 }}>
          {error}
        </div>
      )}
    </button>
  );
}
