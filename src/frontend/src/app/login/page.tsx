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

  // 右侧手动登录表单（管理员等其他账号入口；常驻可见）
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
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Hero 横跨两列 */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1
            data-testid="hero-title"
            style={{ fontSize: 28, fontWeight: 700, color: '#262626', margin: '24px 0 12px', lineHeight: 1.4 }}
          >
            这是一个用 AI 从零写到上线的 Native AI CRM
          </h1>
          <p style={{ fontSize: 14, color: '#8c8c8c', margin: 0 }}>
            点击左侧角色卡片一键体验，或在右侧用账号密码登录
          </p>
        </div>

        {/* 两栏布局 */}
        <div
          style={{
            display: 'flex',
            gap: 32,
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            justifyContent: 'center',
            marginBottom: 32,
          }}
        >
          {/* 左：角色卡片 + 项目亮点（演示入口 + 介绍） */}
          <div style={{ flex: '1 1 700px', minWidth: 320 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#8c8c8c', marginBottom: 12, letterSpacing: 0.5 }}>
              ✨ 体验演示 · 一键登录
            </div>
            <div
              data-testid="role-cards-container"
              style={{ display: 'flex', justifyContent: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 32 }}
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
            <HighlightsPanelPC />
          </div>

          {/* 右：账号密码登录（常驻可见，参考正常系统登录页） */}
          <div style={{ flex: '0 0 360px', minWidth: 320 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#8c8c8c', marginBottom: 12, letterSpacing: 0.5 }}>
              🔐 账号密码登录
            </div>
            <form
              onSubmit={handleManualSubmit}
              data-testid="manual-login-form"
              style={{
                background: '#fff',
                border: '1px solid #e8e8e8',
                borderRadius: 12,
                padding: 28,
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              }}
            >
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#262626', marginBottom: 6, fontWeight: 500 }}>
                  账号
                </label>
                <input
                  type="text"
                  value={manualLogin}
                  onChange={(e) => setManualLogin(e.target.value)}
                  data-testid="manual-login-input"
                  required
                  placeholder="如 admin / sales01"
                  style={{
                    width: '100%', padding: '10px 12px', border: '1px solid #d9d9d9',
                    borderRadius: 6, fontSize: 14, boxSizing: 'border-box', outline: 'none',
                  }}
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#262626', marginBottom: 6, fontWeight: 500 }}>
                  密码
                </label>
                <input
                  type="password"
                  value={manualPwd}
                  onChange={(e) => setManualPwd(e.target.value)}
                  data-testid="manual-password-input"
                  required
                  placeholder="演示密码 12345"
                  style={{
                    width: '100%', padding: '10px 12px', border: '1px solid #d9d9d9',
                    borderRadius: 6, fontSize: 14, boxSizing: 'border-box', outline: 'none',
                  }}
                />
              </div>
              {manualError && (
                <div
                  style={{
                    color: '#cf1322',
                    background: '#fff1f0',
                    border: '1px solid #ffccc7',
                    padding: '8px 12px',
                    borderRadius: 4,
                    fontSize: 13,
                    marginBottom: 16,
                  }}
                >
                  {manualError}
                </div>
              )}
              <button
                type="submit"
                disabled={manualBusy}
                data-testid="manual-login-submit"
                style={{
                  width: '100%', padding: '10px 0', background: '#1890ff', color: '#fff',
                  border: 'none', borderRadius: 6, fontSize: 15, fontWeight: 500,
                  cursor: manualBusy ? 'not-allowed' : 'pointer', opacity: manualBusy ? 0.7 : 1,
                }}
              >
                {manualBusy ? '登录中...' : '登录'}
              </button>
              <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 16, lineHeight: 1.6 }}>
                演示账号：admin / sales01 / sales02 / manager01<br />
                密码均为：12345
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
