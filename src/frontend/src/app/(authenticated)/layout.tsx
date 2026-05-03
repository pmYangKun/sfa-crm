'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import Sidebar from '@/components/nav/sidebar';
import ChatSidebar from '@/components/chat/chat-sidebar';
import NotificationBell from '@/components/notifications/notification-bell';
import { useIsMobile } from '@/lib/viewport';
import { pcToMobilePath } from '@/lib/route-map';

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // 移动视口落在 PC layout → 弹去 /m/* 等价路由
  useEffect(() => {
    if (isMobile === true) {
      router.replace(pcToMobilePath(pathname));
    }
  }, [isMobile, pathname, router]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <p>加载中...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main
        style={{
          marginLeft: 220,
          marginRight: 'var(--chat-panel-width, 0px)',
          transition: 'margin-right 0.2s ease',
          flex: 1,
          padding: 24,
          minHeight: '100vh',
          position: 'relative',
        }}
      >
        <div style={{ position: 'absolute', top: 16, right: 24 }}>
          <NotificationBell />
        </div>
        {children}
      </main>
      <ChatSidebar />
    </div>
  );
}
