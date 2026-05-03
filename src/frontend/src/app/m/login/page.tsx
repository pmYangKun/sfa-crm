'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useIsMobile } from '@/lib/viewport';

/**
 * Phase 2 占位：仅满足 foundational 跨端跳转的反向边界（PC 视口落在 /m/login 弹回 /login）。
 * 一键登录卡片 + 项目亮点在 US2 阶段（T022）填充。
 */
export default function MobileLoginPage() {
  const router = useRouter();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isMobile === false) {
      router.replace('/login');
    }
  }, [isMobile, router]);

  return (
    <div data-testid="mobile-login-placeholder" style={{ padding: 24, minHeight: '100vh', background: '#f5f7fa' }}>
      <h1 style={{ fontSize: 20, marginTop: 24 }}>移动端登录页</h1>
      <p style={{ color: '#8c8c8c', fontSize: 14, marginTop: 12 }}>
        US2 阶段实现一键登录卡片。当前为 Phase 2 骨架占位。
      </p>
    </div>
  );
}
