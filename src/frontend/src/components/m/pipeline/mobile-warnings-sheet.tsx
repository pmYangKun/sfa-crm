'use client';

// 移动端 warning 列表 BottomSheet — 替代 PC tooltip。卡片内一个圆形按钮 + 数字，
// 点击后从底部上滑展开 warning 列表（不再被卡片宽度切）
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { PipelineWarning, WARNING_CODE_LABELS } from '@/lib/pipeline-types';

interface BadgeProps {
  warnings: PipelineWarning[];
  testId?: string;
  leadName?: string;
}

export default function MobileWarningsBadge({
  warnings,
  testId = 'mobile-warnings',
  leadName,
}: BadgeProps) {
  const [open, setOpen] = useState(false);
  const count = warnings?.length || 0;

  if (count === 0) {
    return (
      <span data-testid={testId} data-count="0" style={{ color: '#bfbfbf', fontSize: 12 }}>
        -
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        data-testid={testId}
        data-count={count}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen(true);
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
          fontFamily: 'inherit',
          lineHeight: 1.4,
        }}
      >
        <span>⚠️</span>
        <strong>{count}</strong>
      </button>
      <MobileWarningsSheet
        open={open}
        warnings={warnings}
        leadName={leadName}
        onClose={() => setOpen(false)}
        testId={`${testId}-sheet`}
      />
    </>
  );
}

interface SheetProps {
  open: boolean;
  warnings: PipelineWarning[];
  leadName?: string;
  onClose: () => void;
  testId: string;
}

function MobileWarningsSheet({ open, warnings, leadName, onClose, testId }: SheetProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!open || !mounted) return null;

  const node = (
    <div
      data-testid={testId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 2500,
        display: 'flex',
        alignItems: 'flex-end',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '16px 16px 0 0',
          width: '100%',
          maxHeight: '75vh',
          display: 'flex',
          flexDirection: 'column',
          paddingBottom: 'env(safe-area-inset-bottom, 0)',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            paddingTop: 8,
            paddingBottom: 4,
          }}
        >
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#d9d9d9' }} />
        </div>

        <div
          style={{
            padding: '6px 16px 12px',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 600, color: '#d46b08' }}>
            ⚠️ {warnings.length} 条风险提示
            {leadName && (
              <span style={{ fontSize: 12, color: '#8c8c8c', marginLeft: 8, fontWeight: 400 }}>
                {leadName}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 22,
              color: '#8c8c8c',
              cursor: 'pointer',
              padding: 0,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        <div
          style={{
            padding: 12,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {warnings.map((w, i) => (
            <div
              key={i}
              data-testid={`${testId}-item-${w.code}`}
              style={{
                padding: 12,
                background: '#fffbe6',
                border: '1px solid #ffe58f',
                borderRadius: 8,
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              <div style={{ color: '#d46b08', fontWeight: 600, marginBottom: 4 }}>
                {WARNING_CODE_LABELS[w.code] || w.code}
              </div>
              <div style={{ color: '#595959', wordBreak: 'break-word' }}>{w.mitigation}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
