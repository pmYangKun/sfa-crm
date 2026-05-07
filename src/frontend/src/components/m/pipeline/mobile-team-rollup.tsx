'use client';

// 移动端 Team Rollup 卡片栈（spec 004 T051）
import { TeamRollupRow, scoreColor, formatAmount, formatRelativeTime } from '@/lib/pipeline-types';

interface Props {
  rows: TeamRollupRow[];
  onSalesClick: (salesId: string) => void;
}

export default function MobileTeamRollup({ rows, onSalesClick }: Props) {
  if (rows.length === 0) {
    return (
      <div
        data-testid="mobile-team-rollup-empty"
        style={{
          padding: '40px 20px',
          textAlign: 'center',
          color: '#999',
          fontSize: 14,
          background: '#fff',
          borderRadius: 8,
        }}
      >
        暂无团队数据
      </div>
    );
  }

  return (
    <div data-testid="mobile-team-rollup" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((row) => {
        const c = scoreColor(row.avg_meddicc_score);
        return (
          <button
            key={row.sales.id}
            type="button"
            data-testid={`mobile-team-card-${row.sales.id}`}
            onClick={() => onSalesClick(row.sales.id)}
            style={{
              background: '#fff',
              borderRadius: 8,
              padding: 14,
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'inherit',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: '#1890ff',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {row.sales.name.slice(-2)}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#262626' }}>
                  {row.sales.name}
                </div>
                <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                  Active {row.active_lead_count} 单
                </div>
              </div>
              <span
                data-score-bucket={c.label}
                style={{
                  padding: '4px 10px',
                  background: c.bg,
                  color: c.text,
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                {row.avg_meddicc_score == null
                  ? '-'
                  : row.avg_meddicc_score.toFixed(1)}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                fontSize: 12,
                color: '#595959',
              }}
            >
              {row.warnings_count > 0 && (
                <span style={{ color: '#d46b08' }}>⚠️ {row.warnings_count}</span>
              )}
              <span>总额 {formatAmount(row.total_amount)}</span>
              <span style={{ marginLeft: 'auto', color: '#bfbfbf' }}>
                {formatRelativeTime(row.last_activity_at)}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
