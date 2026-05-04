'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useIsMobile } from '@/lib/viewport';
import { mobileToPcPath } from '@/lib/route-map';
import KingKongTabbar, { TABBAR_HEIGHT } from '@/components/mobile/kingkong-tabbar';

export default function MobileAppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/m/login');
    }
  }, [loading, user, router]);

  // PC 视口落在 /m/* → 弹回 PC 等价路由
  useEffect(() => {
    if (isMobile === false) {
      router.replace(mobileToPcPath(pathname));
    }
  }, [isMobile, pathname, router]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <p>加载中...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <>
      <main
        data-testid="mobile-shell-content"
        style={{
          minHeight: '100vh',
          paddingBottom: TABBAR_HEIGHT,
          background: '#f5f7fa',
        }}
      >
        {children}
      </main>
      <KingKongTabbar />
    </>
  );
}
