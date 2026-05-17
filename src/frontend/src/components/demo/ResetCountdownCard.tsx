'use client';

/**
 * 移动端 /m/me 页面内嵌的演示数据重置卡片。
 * PC 用 ResetCountdownBadge（右下角浮动），移动端用此 inline 卡片。
 *
 * 复用 useResetCountdown hook 拉取 + tick + 漂移纠正。
 */

import { useResetCountdown } from './useResetCountdown';

export default function ResetCountdownCard() {
  const { enabled, remainingSec, isWarning, formatted } = useResetCountdown();

  if (!enabled) return null;

  return (
    <div
      data-testid="reset-countdown-card"
      style={{
        padding: '14px 16px',
        background: isWarning ? '#fff7ed' : '#f8fafc',
        border: `1px solid ${isWarning ? '#fb923c' : '#e2e8f0'}`,
        borderRadius: 8,
        marginBottom: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          fontSize: 18,
          color: isWarning ? '#9a3412' : '#64748b',
        }}
      >
        ⟳
      </span>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 12,
            color: '#8c8c8c',
            marginBottom: 2,
          }}
        >
          演示数据自动重置
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: isWarning ? '#9a3412' : '#334155',
          }}
        >
          {isWarning
            ? `${remainingSec} 秒后重置（即将进行）`
            : `${formatted} 后重置`}
        </div>
      </div>
    </div>
  );
}
