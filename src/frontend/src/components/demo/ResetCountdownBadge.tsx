'use client';

/**
 * spec 002 T027 / FR-021~024
 *
 * 演示数据自动重置倒计时小气泡 —— **PC 浮动版**：
 * - 挂载点：(authenticated)/layout.tsx 全局挂载
 * - 位置：右下角 fixed，错开 chat launcher（bottom:96px）
 * - 行为：每 1 秒本地 tick；每 60 秒重新拉服务端时间纠正漂移
 * - 警示：剩余 < 60 秒时背景从灰变橙
 * - 关闭：enabled=false 时不渲染
 *
 * 移动端 NOT 用此浮动版（会遮挡 chat 输入/发送按钮）——移动端的倒计时显示
 * 在 /m/me 页面内嵌（参见 ResetCountdownCard）。
 */

import { useEffect, useState } from 'react';
import { useResetCountdown } from './useResetCountdown';

export default function ResetCountdownBadge() {
  const { enabled, remainingSec, isWarning, formatted } = useResetCountdown();
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // 移动端走 /m/me 内嵌卡片，浮动 badge 不渲染
  if (isMobile) return null;
  if (!enabled) return null;

  const baseStyle: React.CSSProperties = {
    position: 'fixed',
    right: 24,
    bottom: 96,
    zIndex: 999,
    padding: '6px 12px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 500,
    fontFamily: 'inherit',
    backdropFilter: 'blur(8px)',
    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.12)',
    border: isWarning ? '1px solid #fb923c' : '1px solid #e2e8f0',
    background: isWarning ? 'rgba(255, 237, 213, 0.95)' : 'rgba(241, 245, 249, 0.95)',
    color: isWarning ? '#9a3412' : '#475569',
    transition: 'background 0.3s ease, border-color 0.3s ease, color 0.3s ease',
    pointerEvents: 'none',
  };

  return (
    <div style={baseStyle} aria-live="polite" data-testid="reset-countdown-badge">
      <span style={{ marginRight: 4 }} aria-hidden="true">⟳</span>
      {isWarning
        ? `演示数据将在 ${remainingSec} 秒后重置`
        : `演示数据 ${formatted} 后重置`}
    </div>
  );
}
