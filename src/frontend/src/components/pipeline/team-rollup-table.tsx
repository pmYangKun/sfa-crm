'use client';

// Team Rollup 表 — 行 = sales 员工
import { TeamRollupRow, scoreColor, formatAmount, formatRelativeTime } from '@/lib/pipeline-types';

interface Props {
  rows: TeamRollupRow[];
  onSalesClick: (salesId: string) => void;
}

export default function TeamRollupTable({ rows, onSalesClick }: Props) {
  if (rows.length === 0) {
    return (
      <div
        data-testid="team-rollup-empty"
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
    <div
      data-testid="team-rollup-table"
      style={{ background: '#fff', borderRadius: 8, overflow: 'hidden' }}
    >
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#fafafa', color: '#595959' }}>
              <Th>销售</Th>
              <Th>Active 数</Th>
              <Th>平均 Score</Th>
              <Th>Warnings</Th>
              <Th>总金额</Th>
              <Th>最近活动</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const c = scoreColor(row.avg_meddicc_score);
              return (
                <tr
                  key={row.sales.id}
                  data-testid={`team-row-${row.sales.id}`}
                  data-sales-id={row.sales.id}
                  onClick={() => onSalesClick(row.sales.id)}
                  style={{
                    borderTop: '1px solid #f0f0f0',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#fafafa')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <Td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: '#1890ff',
                          color: '#fff',
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {row.sales.name.slice(-2)}
                      </span>
                      <span style={{ fontWeight: 500, color: '#1890ff' }}>{row.sales.name}</span>
                    </div>
                  </Td>
                  <Td>{row.active_lead_count}</Td>
                  <Td>
                    <span
                      data-testid={`team-row-${row.sales.id}-avg-score`}
                      data-score-bucket={c.label}
                      style={{
                        display: 'inline-block',
                        minWidth: 40,
                        textAlign: 'center',
                        padding: '2px 8px',
                        background: c.bg,
                        color: c.text,
                        borderRadius: 4,
                        fontWeight: 600,
                      }}
                    >
                      {row.avg_meddicc_score == null
                        ? '-'
                        : row.avg_meddicc_score.toFixed(1)}
                    </span>
                  </Td>
                  <Td>
                    {row.warnings_count > 0 ? (
                      <span
                        style={{
                          color: '#d46b08',
                          fontWeight: 600,
                        }}
                      >
                        ⚠️ {row.warnings_count}
                      </span>
                    ) : (
                      <span style={{ color: '#bfbfbf' }}>-</span>
                    )}
                  </Td>
                  <Td>{formatAmount(row.total_amount)}</Td>
                  <Td>{formatRelativeTime(row.last_activity_at)}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: 'left',
        padding: '10px 12px',
        fontWeight: 600,
        fontSize: 12,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td
      style={{
        padding: '12px',
        verticalAlign: 'middle',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </td>
  );
}
