'use client';

// Pipeline 主表 — 行 = lead
import Link from 'next/link';
import {
  PipelineLead,
  scoreColor,
  formatAmount,
  formatRelativeTime,
} from '@/lib/pipeline-types';
import MeddiccDotsCompact from './meddicc-dots-compact';
import WarningsCell from './warnings-cell';
import ForecastCellEditor from './forecast-cell-editor';

interface Props {
  leads: PipelineLead[];
  onLeadUpdated?: () => void;
}

export default function PipelineTable({ leads, onLeadUpdated }: Props) {
  if (leads.length === 0) {
    return (
      <div
        data-testid="pipeline-empty"
        style={{
          padding: '40px 20px',
          textAlign: 'center',
          color: '#999',
          fontSize: 14,
          background: '#fff',
          borderRadius: 8,
        }}
      >
        当前 forecast 桶下暂无 lead
      </div>
    );
  }

  return (
    <div
      data-testid="pipeline-table"
      style={{ background: '#fff', borderRadius: 8, overflow: 'hidden' }}
    >
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#fafafa', color: '#595959' }}>
              <Th>名称</Th>
              <Th>Score</Th>
              <Th>Warnings</Th>
              <Th>MEDDICC</Th>
              <Th>Forecast</Th>
              <Th>金额</Th>
              <Th>预计关单</Th>
              <Th>最近活动</Th>
              <Th>负责人</Th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr
                key={lead.id}
                data-testid={`pipeline-row-${lead.id}`}
                style={{ borderTop: '1px solid #f0f0f0' }}
              >
                <Td>
                  <Link
                    href={`/leads/${lead.id}`}
                    style={{
                      color: '#1890ff',
                      textDecoration: 'none',
                      fontWeight: 500,
                    }}
                  >
                    {lead.company_name}
                  </Link>
                </Td>
                <Td>
                  <ScoreBadge score={lead.meddicc_score} />
                </Td>
                <Td>
                  <WarningsCell
                    warnings={lead.warnings}
                    testId={`warnings-${lead.id}`}
                  />
                </Td>
                <Td>
                  <MeddiccDotsCompact
                    dimensionsLit={lead.dimensions_lit}
                    testIdPrefix={`dot-${lead.id}`}
                  />
                </Td>
                <Td>
                  <ForecastCellEditor
                    leadId={lead.id}
                    current={lead.forecast_category}
                    disabled={lead.stage !== 'active'}
                    onSaved={() => onLeadUpdated?.()}
                  />
                </Td>
                <Td>{formatAmount(lead.amount)}</Td>
                <Td>{lead.close_date || '-'}</Td>
                <Td>{formatRelativeTime(lead.last_activity_at)}</Td>
                <Td>{lead.owner?.name || '公共池'}</Td>
              </tr>
            ))}
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
        padding: '10px 12px',
        verticalAlign: 'middle',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </td>
  );
}

function ScoreBadge({ score }: { score: number | null }) {
  const c = scoreColor(score);
  return (
    <span
      data-testid="score-badge"
      data-score-bucket={c.label}
      style={{
        display: 'inline-block',
        minWidth: 36,
        textAlign: 'center',
        padding: '2px 8px',
        background: c.bg,
        color: c.text,
        borderRadius: 4,
        fontWeight: 600,
        fontSize: 13,
      }}
    >
      {score == null ? '-' : Math.round(score)}
    </span>
  );
}
