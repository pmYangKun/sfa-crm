'use client';

// PC 端 Warning cell — ⚠️ N + hover/click tooltip 列出 mitigation
// Portal 出 body + fixed 定位，避开表格 row 的 stacking context / overflow 截断
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PipelineWarning, WARNING_CODE_LABELS } from '@/lib/pipeline-types';

interface Props {
  warnings: PipelineWarning[];
  testId?: string;
}

interface TooltipPos {
  top: number;
  left: number;
  flipUp: boolean;
}

const TOOLTIP_W = 320;
const TOOLTIP_MAX_H = 320;

export default function WarningsCell({ warnings, testId = 'warnings-cell' }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<TooltipPos | null>(null);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const count = warnings?.length || 0;

  useEffect(() => setMounted(true), []);

  const computePos = () => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const flipUp = r.bottom + TOOLTIP_MAX_H + 8 > window.innerHeight;
    // 横向：默认从 trigger 左边对齐；如果会溢出右边视口则贴右边
    let left = r.left;
    if (left + TOOLTIP_W + 8 > window.innerWidth) {
      left = Math.max(8, window.innerWidth - TOOLTIP_W - 8);
    }
    setPos({
      top: flipUp ? r.top - 8 - TOOLTIP_MAX_H : r.bottom + 4,
      left,
      flipUp,
    });
  };

  const showTooltip = () => {
    computePos();
    setOpen(true);
  };

  const hideTooltip = () => {
    setOpen(false);
    setPos(null);
  };

  // 滚动 / 缩放 / Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => hideTooltip();
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hideTooltip();
    };
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    document.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  if (count === 0) {
    return (
      <span data-testid={testId} data-count="0" style={{ color: '#bfbfbf', fontSize: 12 }}>
        -
      </span>
    );
  }

  const tooltip = mounted && open && pos ? createPortal(
    <div
      data-testid={`${testId}-tooltip`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={hideTooltip}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        zIndex: 9999,
        width: TOOLTIP_W,
        maxHeight: TOOLTIP_MAX_H,
        overflowY: 'auto',
        background: '#fff',
        border: '1px solid #d9d9d9',
        borderRadius: 6,
        boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        padding: 10,
        color: '#262626',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#d46b08' }}>
        ⚠️ {count} 条风险提示
      </div>
      {warnings.map((w, i) => (
        <div
          key={i}
          data-testid={`${testId}-item-${w.code}`}
          style={{
            padding: '6px 0',
            borderTop: i === 0 ? 'none' : '1px solid #f5f5f5',
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          <div style={{ color: '#d46b08', fontWeight: 600, marginBottom: 2 }}>
            {WARNING_CODE_LABELS[w.code] || w.code}
          </div>
          <div style={{ color: '#595959', wordBreak: 'break-word' }}>{w.mitigation}</div>
        </div>
      ))}
    </div>,
    document.body
  ) : null;

  return (
    <>
      <div
        ref={triggerRef}
        data-testid={testId}
        data-count={count}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onClick={(e) => {
          e.stopPropagation();
          if (open) hideTooltip();
          else showTooltip();
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 8px',
          background: '#fff7e6',
          border: '1px solid #ffd591',
          borderRadius: 12,
          color: '#d46b08',
          fontSize: 12,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        <span>⚠️</span>
        <strong>{count}</strong>
      </div>
      {tooltip}
    </>
  );
}
