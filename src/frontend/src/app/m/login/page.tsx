'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useIsMobile } from '@/lib/viewport';
import { ROLE_CARDS } from '@/lib/onboarding-config';
import RoleCard from '@/components/auth/role-card';
import HighlightsPanelMobile from '@/components/auth/highlights-panel-mobile';

export default function MobileLoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const isMobile = useIsMobile();
  const [busyLogin, setBusyLogin] = useState<string | null>(null);

  const [manualLogin, setManualLogin] = useState('');
  const [manualPwd, setManualPwd] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualBusy, setManualBusy] = useState(false);

  useEffect(() => {
    if (isMobile === false) router.replace('/login');
  }, [isMobile, router]);

  useEffect(() => {
    if (!loading && user) router.replace('/m/chat');
  }, [loading, user, router]);

  const handleSelect = async (loginName: string, password: string) => {
    setBusyLogin(loginName);
    try {
      await login(loginName, password);
      router.push('/m/chat');
    } catch (e) {
      setBusyLogin(null);
      throw e;
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualLogin || !manualPwd) return;
    setManualBusy(true);
    setManualError(null);
    try {
      await login(manualLogin, manualPwd);
      router.push('/m/chat');
    } catch (err) {
      setManualError(err instanceof Error ? err.message : '登录失败');
      setManualBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(800px 400px at 50% -100px, #eef2ff 0%, transparent 60%), #fafbfc',
        padding: '28px 20px 40px',
      }}
    >
      <div style={{ maxWidth: 420, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 18 }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              background: 'linear-gradient(135deg, #1890ff 0%, #722ed1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            S
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', letterSpacing: 0.3 }}>
            SFA CRM
          </div>
        </div>

        <h1
          data-testid="hero-title-mobile"
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: '#0f172a',
            margin: '4px 0 8px',
            lineHeight: 1.3,
            textAlign: 'center',
            letterSpacing: -0.3,
          }}
        >
          Native AI CRM
        </h1>
        <p
          style={{
            fontSize: 13,
            color: '#64748b',
            margin: '0 0 24px',
            textAlign: 'center',
            lineHeight: 1.6,
          }}
        >
          一个用 AI 从零写到上线的 CRM。<br />选一个角色一键体验对话式操作。
        </p>

        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#64748b',
            letterSpacing: 1.2,
            marginBottom: 10,
            textTransform: 'uppercase',
          }}
        >
          选择角色 · 一键登录
        </div>
        <div
          data-testid="role-cards-container-mobile"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 10,
            marginBottom: 24,
            alignItems: 'stretch',
          }}
        >
          {ROLE_CARDS.map((role) => (
            <RoleCard
              key={role.loginName}
              role={role}
              layout="mobile"
              onSelect={handleSelect}
              busyLogin={busyLogin}
            />
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0 16px' }}>
          <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
          <div style={{ fontSize: 11, color: '#94a3b8', letterSpacing: 0.5 }}>或用账号密码登录</div>
          <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
        </div>

        <form
          onSubmit={handleManualSubmit}
          data-testid="manual-login-form-mobile"
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: '20px 18px',
            boxShadow: '0 1px 3px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.04)',
            marginBottom: 28,
          }}
        >
          <label style={labelStyle}>账号</label>
          <input
            type="text"
            value={manualLogin}
            onChange={(e) => setManualLogin(e.target.value)}
            data-testid="manual-login-input-mobile"
            required
            placeholder="admin / sales01"
            style={inputStyle}
          />

          <label style={{ ...labelStyle, marginTop: 12 }}>密码</label>
          <input
            type="password"
            value={manualPwd}
            onChange={(e) => setManualPwd(e.target.value)}
            data-testid="manual-password-input-mobile"
            required
            placeholder="••••••"
            style={inputStyle}
          />

          {manualError && <div style={errorStyle}>{manualError}</div>}

          <button
            type="submit"
            disabled={manualBusy}
            data-testid="manual-login-submit-mobile"
            style={{
              width: '100%',
              marginTop: 16,
              padding: '11px 0',
              background: '#0f172a',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              cursor: manualBusy ? 'not-allowed' : 'pointer',
              opacity: manualBusy ? 0.7 : 1,
            }}
          >
            {manualBusy ? '登录中...' : '登录'}
          </button>

          <div
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTop: '1px solid #f1f5f9',
              fontSize: 11,
              color: '#94a3b8',
              lineHeight: 1.6,
            }}
          >
            演示账号：admin / sales01 / sales02 / manager01<br />
            密码均为：12345
          </div>
        </form>

        <HighlightsPanelMobile />
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 500,
  color: '#334155',
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  fontSize: 14,
  boxSizing: 'border-box',
  outline: 'none',
  background: '#fafbfc',
};

const errorStyle: React.CSSProperties = {
  marginTop: 12,
  padding: '8px 12px',
  background: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: 6,
  color: '#dc2626',
  fontSize: 13,
};
