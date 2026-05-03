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

  // 折叠式手动登录（管理员等其他账号入口；默认收起，不影响 demo 心智）
  const [manualOpen, setManualOpen] = useState(false);
  const [manualLogin, setManualLogin] = useState('');
  const [manualPwd, setManualPwd] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualBusy, setManualBusy] = useState(false);

  useEffect(() => {
    if (isMobile === true) {
      router.replace('/m/login');
    }
  }, [isMobile, router]);

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
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
    <div style={{ minHeight: '100vh', background: '#f5f7fa', padding: '48px 24px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
        <h1
          data-testid="hero-title"
          style={{ fontSize: 28, fontWeight: 700, color: '#262626', margin: '24px 0 12px', lineHeight: 1.4 }}
        >
          这是一个用 AI 从零写到上线的 Native AI CRM
        </h1>
        <p style={{ fontSize: 14, color: '#8c8c8c', margin: '0 0 40px' }}>
          点击任一角色卡片即可一键登录体验
        </p>

        <div
          data-testid="role-cards-container"
          style={{ display: 'flex', justifyContent: 'center', gap: 24, flexWrap: 'wrap', marginBottom: 16 }}
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

        {/* 折叠式：其他账号（管理员等）登录入口 */}
        <div style={{ marginBottom: 32 }}>
          {!manualOpen ? (
            <button
              type="button"
              onClick={() => setManualOpen(true)}
              data-testid="manual-login-toggle"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#8c8c8c',
                fontSize: 13,
                cursor: 'pointer',
                textDecoration: 'underline',
                fontFamily: 'inherit',
              }}
            >
              其他账号登录（管理员等）→
            </button>
          ) : (
            <form
              onSubmit={handleManualSubmit}
              data-testid="manual-login-form"
              style={{
                display: 'inline-block',
                textAlign: 'left',
                background: '#fff',
                border: '1px solid #e8e8e8',
                borderRadius: 8,
                padding: 20,
                width: 320,
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#262626' }}>
                账号密码登录
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, color: '#595959', marginBottom: 4 }}>账号</label>
                <input
                  type="text"
                  value={manualLogin}
                  onChange={(e) => setManualLogin(e.target.value)}
                  data-testid="manual-login-input"
                  required
                  style={{
                    width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9',
                    borderRadius: 4, fontSize: 14, boxSizing: 'border-box', outline: 'none',
                  }}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, color: '#595959', marginBottom: 4 }}>密码</label>
                <input
                  type="password"
                  value={manualPwd}
                  onChange={(e) => setManualPwd(e.target.value)}
                  data-testid="manual-password-input"
                  required
                  style={{
                    width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9',
                    borderRadius: 4, fontSize: 14, boxSizing: 'border-box', outline: 'none',
                  }}
                />
              </div>
              {manualError && (
                <div style={{ color: '#cf1322', fontSize: 13, marginBottom: 12 }}>{manualError}</div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="submit"
                  disabled={manualBusy}
                  data-testid="manual-login-submit"
                  style={{
                    flex: 1, padding: '8px 0', background: '#1890ff', color: '#fff',
                    border: 'none', borderRadius: 4, fontSize: 14, fontWeight: 500,
                    cursor: manualBusy ? 'not-allowed' : 'pointer', opacity: manualBusy ? 0.7 : 1,
                  }}
                >
                  {manualBusy ? '登录中...' : '登录'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setManualOpen(false);
                    setManualError(null);
                  }}
                  disabled={manualBusy}
                  style={{
                    padding: '8px 12px', background: '#fff', color: '#595959',
                    border: '1px solid #d9d9d9', borderRadius: 4, fontSize: 14,
                    cursor: manualBusy ? 'not-allowed' : 'pointer',
                  }}
                >
                  收起
                </button>
              </div>
            </form>
          )}
        </div>

        <HighlightsPanelPC />
      </div>
    </div>
  );
}
