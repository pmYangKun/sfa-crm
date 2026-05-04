'use client';

import LeadsPage from '@/app/(authenticated)/leads/page';

/**
 * 移动端 /m/leads 复用既有 PC LeadsPage 组件（spec.md FR-029）。
 * 外层 overflow-x 让宽表格可横向滑动，符合 spec Assumption 中
 * "业务页面在移动端可读不崩溃"的最低保证策略。
 */
export default function MobileLeadsPage() {
  return (
    <div style={{ padding: 12, overflowX: 'auto' }}>
      <LeadsPage />
    </div>
  );
}
