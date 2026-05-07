'use client';

// Deals / Team 视图 toggle (页面右上角)
export type PipelineView = 'deals' | 'team';

interface Props {
  value: PipelineView;
  onChange: (v: PipelineView) => void;
}

export default function DealsTeamToggle({ value, onChange }: Props) {
  return (
    <div
      data-testid="deals-team-toggle"
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
            data-testid={`toggle-${v}`}
            data-active={active ? 'true' : 'false'}
            onClick={() => onChange(v)}
            style={{
              padding: '6px 16px',
              fontSize: 13,
              fontFamily: 'inherit',
              border: 'none',
              borderRadius: 4,
              background: active ? '#fff' : 'transparent',
              color: active ? '#1890ff' : '#595959',
              fontWeight: active ? 600 : 400,
              cursor: 'pointer',
              boxShadow: active ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              minWidth: 70,
            }}
          >
            {v === 'deals' ? 'Deals' : 'Team'}
          </button>
        );
      })}
    </div>
  );
}
