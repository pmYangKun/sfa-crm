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

  useEffect(() => {
    if (isMobile === false) {
      router.replace('/login');
    }
  }, [isMobile, router]);

  useEffect(() => {
    if (!loading && user) {
      router.replace('/m/chat');
    }
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

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa', padding: '32px 20px' }}>
      <div style={{ maxWidth: 420, margin: '0 auto' }}>
        <h1
          data-testid="hero-title-mobile"
          style={{ fontSize: 22, fontWeight: 700, color: '#262626', margin: '16px 0 10px', lineHeight: 1.4, textAlign: 'center' }}
        >
          这是一个用 AI 从零写到上线的 Native AI CRM
        </h1>
        <p style={{ fontSize: 13, color: '#8c8c8c', margin: '0 0 28px', textAlign: 'center' }}>
          点击任一角色一键登录体验
        </p>

        <div
          data-testid="role-cards-container-mobile"
          style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 8 }}
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

        <HighlightsPanelMobile />
      </div>
    </div>
  );
}
