'use client';

// Warning cell — ⚠️ N + hover tooltip 列出 mitigation
import { useState } from 'react';
import { PipelineWarning, WARNING_CODE_LABELS } from '@/lib/pipeline-types';

interface Props {
  warnings: PipelineWarning[];
  testId?: string;
}

export default function WarningsCell({ warnings, testId = 'warnings-cell' }: Props) {
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
    <div
      data-testid={testId}
      data-count={count}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={() => setOpen(!open)}
      style={{
        position: 'relative',
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

      {open && (
        <div
          data-testid={`${testId}-tooltip`}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            zIndex: 30,
            minWidth: 240,
            maxWidth: 340,
            background: '#fff',
            border: '1px solid #d9d9d9',
            borderRadius: 6,
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            padding: 10,
            color: '#262626',
            cursor: 'default',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
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
              <div style={{ color: '#595959' }}>{w.mitigation}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
