'use client';

/**
 * spec 002 T027 / FR-021~024
 *
 * 演示数据自动重置倒计时小气泡：
 * - 挂载点：(authenticated)/layout.tsx (PC) 与 m/(mobile-app)/layout.tsx (Mobile) 全局挂载
 * - 位置：右下角 fixed，错开 chat launcher（PC bottom:96px / Mobile bottom:80px）
 * - 行为：每 1 秒本地 tick；每 60 秒重新拉服务端时间纠正漂移
 * - 警示：剩余 < 60 秒时背景从灰变橙
 * - 关闭：enabled=false 时不渲染
 */

import { useEffect, useState } from 'react';

const SYNC_INTERVAL_MS = 60_000;
const TICK_INTERVAL_MS = 1_000;

const API_BASE = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000') + '/api/v1';

type ResetStatus = {
  enabled: boolean;
  next_reset_at: string | null;
  interval_minutes: number | null;
  server_time: string;
};

function formatDuration(seconds: number): string {
  if (seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function ResetCountdownBadge() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [nextResetAtMs, setNextResetAtMs] = useState<number | null>(null);
  const [serverOffsetMs, setServerOffsetMs] = useState<number>(0);
  const [now, setNow] = useState<number>(() => Date.now());
  const [isMobile, setIsMobile] = useState<boolean>(false);

  // viewport detection (与 spec 001 useIsMobile 同语义，简化内联)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // 拉服务端状态
  const fetchStatus = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!token) return;
      const res = await fetch(`${API_BASE}/agent/demo-reset-status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data: ResetStatus = await res.json();
      setEnabled(data.enabled);
      if (data.enabled && data.next_reset_at) {
        const nextMs = new Date(data.next_reset_at).getTime();
        const serverNow = new Date(data.server_time).getTime();
        setNextResetAtMs(nextMs);
        setServerOffsetMs(serverNow - Date.now());
      } else {
        setNextResetAtMs(null);
      }
    } catch {
      // 静默失败，下次 sync 重试
    }
  };

  useEffect(() => {
    fetchStatus();
    const sync = setInterval(fetchStatus, SYNC_INTERVAL_MS);
    return () => clearInterval(sync);
  }, []);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), TICK_INTERVAL_MS);
    return () => clearInterval(tick);
  }, []);

  if (enabled === null || !enabled || !nextResetAtMs) return null;

  // 用 server offset 纠正本地时钟漂移
  const remainingMs = nextResetAtMs - (now + serverOffsetMs);
  const remainingSec = Math.max(0, Math.floor(remainingMs / 1000));
  const isWarning = remainingSec > 0 && remainingSec < 60;

  const positionStyle: React.CSSProperties = isMobile
    ? { right: 16, bottom: 80 }   // 错开金刚区 tabbar (高度~64px)
    : { right: 24, bottom: 96 };  // 错开 chat launcher (bottom:24, 高度~52px)

  const baseStyle: React.CSSProperties = {
    position: 'fixed',
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
    pointerEvents: 'none',  // 不阻挡点击
    ...positionStyle,
  };

  return (
    <div style={baseStyle} aria-live="polite" data-testid="reset-countdown-badge">
      <span style={{ marginRight: 4 }} aria-hidden="true">⟳</span>
      {isWarning
        ? `演示数据将在 ${remainingSec} 秒后重置`
        : `演示数据 ${formatDuration(remainingSec)} 后重置`}
    </div>
  );
}
