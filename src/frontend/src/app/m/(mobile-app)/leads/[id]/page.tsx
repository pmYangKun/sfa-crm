'use client';

import LeadDetailPage from '@/app/(authenticated)/leads/[id]/page';

/**
 * 移动端线索详情页 — 复用 PC 详情组件，含 MEDDICC 仪表盘 + 场景卡 + 对话录入。
 * 外层加移动端 padding；PC 详情页内部已用 grid + flex-wrap 自适应窄屏。
 */
export default function MobileLeadDetailPage() {
  return (
    <div style={{ padding: 12 }}>
      <LeadDetailPage />
    </div>
  );
}
