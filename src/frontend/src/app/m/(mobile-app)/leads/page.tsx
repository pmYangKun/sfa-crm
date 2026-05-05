'use client';

import LeadsPage from '@/app/(authenticated)/leads/page';

/**
 * 移动端 /m/leads — 复用 PC LeadsPage，组件内部据 pathname 自动渲染卡片列表 + 移动端友好 Link prefix。
 */
export default function MobileLeadsPage() {
  return (
    <div style={{ padding: 12 }}>
      <LeadsPage />
    </div>
  );
}
