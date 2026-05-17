'use client';

/**
 * 共享 hook：拉取 demo-reset 状态 + 本地 tick + 服务端时间漂移纠正。
 *
 * 用于 ResetCountdownBadge (PC 浮动) 与 /m/me 页面 inline 卡片复用，避免重复 fetch。
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

export type CountdownState = {
  enabled: boolean | null;       // null = 初始未拉取
  remainingSec: number;          // 剩余秒数（已纠正服务端时间漂移）
  isWarning: boolean;            // 0 < remainingSec < 60
  formatted: string;             // "X:YY" 格式
};

function formatDuration(seconds: number): string {
  if (seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function useResetCountdown(): CountdownState {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [nextResetAtMs, setNextResetAtMs] = useState<number | null>(null);
  const [serverOffsetMs, setServerOffsetMs] = useState<number>(0);
  const [now, setNow] = useState<number>(() => Date.now());

  const fetchStatus = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
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

  const remainingMs = nextResetAtMs ? nextResetAtMs - (now + serverOffsetMs) : 0;
  const remainingSec = Math.max(0, Math.floor(remainingMs / 1000));
  const isWarning = remainingSec > 0 && remainingSec < 60;

  return {
    enabled: enabled === null ? null : enabled && nextResetAtMs !== null,
    remainingSec,
    isWarning,
    formatted: formatDuration(remainingSec),
  };
}
