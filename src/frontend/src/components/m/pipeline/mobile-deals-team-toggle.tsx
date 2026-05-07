'use client';

// 移动端 Deals/Team toggle (spec 004 T052)
import { PipelineView } from '@/components/pipeline/deals-team-toggle';

interface Props {
  value: PipelineView;
  onChange: (v: PipelineView) => void;
}

export default function MobileDealsTeamToggle({ value, onChange }: Props) {
  return (
    <div
      data-testid="mobile-deals-team-toggle"
      style={{
        display: 'inline-flex',
        background: '#f0f2f5',
        borderRadius: 6,
        padding: 2,
      }}
    >
      {(['deals', 'team'] as PipelineView[]).map((v) => {
        const active = v === value;
        return (
          <button
            key={v}
            type="button"
            data-testid={`mobile-toggle-${v}`}
            data-active={active ? 'true' : 'false'}
            onClick={() => onChange(v)}
            style={{
              padding: '5px 12px',
              fontSize: 12,
              fontFamily: 'inherit',
              border: 'none',
              borderRadius: 4,
              background: active ? '#fff' : 'transparent',
              color: active ? '#1890ff' : '#595959',
              fontWeight: active ? 600 : 400,
              cursor: 'pointer',
              boxShadow: active ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              minWidth: 60,
            }}
          >
            {v === 'deals' ? 'Deals' : 'Team'}
          </button>
        );
      })}
    </div>
  );
}
