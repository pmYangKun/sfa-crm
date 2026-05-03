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
          style={{ display: 'flex', justifyContent: 'center', gap: 24, flexWrap: 'wrap', marginBottom: 32 }}
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
    </div>
  );
}
