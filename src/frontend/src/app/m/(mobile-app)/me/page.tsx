'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getRoleCardByLogin, ROLE_CARDS } from '@/lib/onboarding-config';
import RoleSwitchConfirm from '@/components/onboarding/role-switch-confirm';

export default function MobileMePage() {
  const { user, loginName, logout, quickSwitchRole } = useAuth();
  const [confirmTarget, setConfirmTarget] = useState<string | null>(null);

  if (!user || !loginName) return null;

  const me = getRoleCardByLogin(loginName);
  const targetRole = ROLE_CARDS.find((r) => r.loginName !== loginName);

  const handleConfirmSwitch = async () => {
    if (!confirmTarget) return;
    const target = getRoleCardByLogin(confirmTarget);
    if (!target) return;
    await quickSwitchRole(target.loginName, target.password);
    setConfirmTarget(null);
  };

  return (
    <>
      <div style={{ padding: 16 }}>
        <div
          data-testid="me-current-role"
          style={{
            padding: 20,
            background: '#fff',
            border: '1px solid #e8e8e8',
            borderTop: `4px solid ${me?.accentColor ?? '#1890ff'}`,
            borderRadius: 8,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 6 }}>当前登录</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: me?.accentColor ?? '#1890ff' }}>
            {me?.displayName ?? user.name}
          </div>
          <div style={{ fontSize: 13, color: '#595959', marginTop: 6, lineHeight: 1.5 }}>
            {me?.description}
          </div>
        </div>

        {targetRole && (
          <button
            type="button"
            onClick={() => setConfirmTarget(targetRole.loginName)}
            data-testid="me-switch-btn"
            style={{
              width: '100%',
              padding: '14px',
              background: '#fff',
              border: `1px solid ${targetRole.accentColor}`,
              borderRadius: 8,
              cursor: 'pointer',
              fontFamily: 'inherit',
              color: targetRole.accentColor,
              fontSize: 15,
              fontWeight: 600,
              marginBottom: 12,
            }}
          >
            🔄 切换到 {targetRole.displayName}
          </button>
        )}

        <button
          type="button"
          onClick={logout}
          data-testid="me-logout-btn"
          style={{
            width: '100%',
            padding: '12px',
            background: 'transparent',
            border: '1px solid #d9d9d9',
            borderRadius: 8,
            cursor: 'pointer',
            fontFamily: 'inherit',
            color: '#595959',
            fontSize: 14,
          }}
        >
          退出登录
        </button>
      </div>
      <RoleSwitchConfirm
        open={confirmTarget !== null}
        fromLogin={loginName}
        toLogin={confirmTarget ?? ''}
        onConfirm={handleConfirmSwitch}
        onCancel={() => setConfirmTarget(null)}
      />
    </>
  );
}
