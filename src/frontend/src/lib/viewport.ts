'use client';

import { useEffect, useState } from 'react';

const MOBILE_QUERY = '(max-width: 768px)';

/**
 * SSR 安全的视口检测 hook。
 * 首次渲染（含 SSR）返回 null，挂载后才确定 true/false——
 * 调用方应在 null 时按"未知"处理，避免 hydration mismatch。
 */
export function useIsMobile(): boolean | null {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return isMobile;
}
