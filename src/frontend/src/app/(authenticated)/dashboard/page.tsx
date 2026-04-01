'use client';

import { useAuth } from '@/lib/auth-context';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>数据概览</h1>
      <p>欢迎回来，{user?.name}！</p>
      <p style={{ color: '#999', marginTop: 8 }}>仪表板数据将在后续阶段实现。</p>
    </div>
  );
}
