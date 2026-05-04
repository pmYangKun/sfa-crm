'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useIsMobile } from '@/lib/viewport';
import { ROLE_CARDS } from '@/lib/onboarding-config';
import RoleCard from '@/components/auth/role-card';
import HighlightsPanelPC from '@/components/auth/highlights-panel-pc';

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const isMobile = useIsMobile();
  const [busyLogin, setBusyLogin] = useState<string | null>(null);

  const [manualLogin, setManualLogin] = useState('');
  const [manualPwd, setManualPwd] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualBusy, setManualBusy] = useState(false);

  useEffect(() => {
    if (isMobile === true) router.replace('/m/login');
  }, [isMobile, router]);

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [loading, user, router]);

  const handleSelect = async (loginName: string, password: string) => {
    setBusyLogin(loginName);
    try {
      await login(loginName, password);
      router.push('/dashboard');
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
      router.push('/dashboard');
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
          'radial-gradient(1200px 600px at 50% -200px, #eef2ff 0%, transparent 60%), #fafbfc',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 32px 64px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 380px',
            gap: 48,
            alignItems: 'stretch',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h1
              data-testid="hero-title"
              style={{
                fontSize: 34,
                fontWeight: 700,
                color: '#0f172a',
                margin: 0,
                lineHeight: 1.2,
                letterSpacing: -0.5,
              }}
            >
              Native AI CRM
            </h1>
            <p
              style={{
                fontSize: 15,
                color: '#475569',
                margin: '14px 0 32px',
                lineHeight: 1.7,
                maxWidth: 560,
              }}
            >
              一个用 AI 从零写到上线的 CRM 系统。把对话当成一等接入方式，
              选一个角色一键体验，看 AI 怎么帮你查线索、录跟进、做决策。
            </p>

            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#64748b',
                letterSpacing: 1.4,
                marginBottom: 12,
                textTransform: 'uppercase',
              }}
            >
              选择角色 · 一键登录
            </div>
            <div
              data-testid="role-cards-container"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 14,
                alignItems: 'stretch',
                flex: 1,
              }}
            >
              {ROLE_CARDS.map((role) => (
                <RoleCard
                  key={role.loginName}
                  role={role}
                  layout="pc"
                  onSelect={handleSelect}
                  busyLogin={busyLogin}
                />
              ))}
            </div>
          </div>

          <form
            onSubmit={handleManualSubmit}
            data-testid="manual-login-form"
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              padding: '28px 26px',
              boxShadow: '0 1px 3px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.06)',
              display: 'flex',
              flexDirection: 'column',
              alignSelf: 'stretch',
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 600, color: '#0f172a', margin: 0 }}>
              账号登录
            </h2>
            <p style={{ fontSize: 13, color: '#64748b', margin: '6px 0 22px' }}>
              使用账号密码登录管理后台
            </p>

            <label style={labelStyle}>账号</label>
            <input
              type="text"
              value={manualLogin}
              onChange={(e) => setManualLogin(e.target.value)}
              data-testid="manual-login-input"
              required
              placeholder="请输入账号"
              style={inputStyle}
            />

            <label style={{ ...labelStyle, marginTop: 14 }}>密码</label>
            <input
              type="password"
              value={manualPwd}
              onChange={(e) => setManualPwd(e.target.value)}
              data-testid="manual-password-input"
              required
              placeholder="••••••"
              style={inputStyle}
            />

            {manualError && <div style={errorStyle}>{manualError}</div>}

            <button
              type="submit"
              disabled={manualBusy}
              data-testid="manual-login-submit"
              style={{
                width: '100%',
                marginTop: 20,
                padding: '11px 0',
                background: '#0f172a',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                cursor: manualBusy ? 'not-allowed' : 'pointer',
                opacity: manualBusy ? 0.7 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {manualBusy ? '登录中...' : '登录'}
            </button>

            {/* 底部占位块：保持 marginTop:auto 撑住表单总高，让右侧登录卡跟左侧角色卡下端对齐；
                内容换成中性产品说明，不再暴露 admin / sales01 等具体账号 */}
            <div
              style={{
                marginTop: 'auto',
                paddingTop: 20,
                borderTop: '1px solid #f1f5f9',
                fontSize: 12,
                color: '#94a3b8',
                lineHeight: 1.7,
              }}
            >
              <div style={{ marginBottom: 2 }}>Demo 演示环境</div>
              <div>业务数据每 30 分钟自动重置</div>
            </div>
          </form>
        </div>

        <HighlightsPanelPC />
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
  transition: 'border-color 0.15s, background 0.15s',
};

const errorStyle: React.CSSProperties = {
  marginTop: 14,
  padding: '8px 12px',
  background: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: 6,
  color: '#dc2626',
  fontSize: 13,
};
