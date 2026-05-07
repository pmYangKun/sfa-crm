'use client';

// 移动端 deal 紧凑卡片（spec 004 T048）
import Link from 'next/link';
import {
  PipelineLead,
  scoreColor,
  formatAmount,
  formatRelativeTime,
} from '@/lib/pipeline-types';
import MeddiccDotsCompact from '@/components/pipeline/meddicc-dots-compact';
import WarningsCell from '@/components/pipeline/warnings-cell';

interface Props {
  lead: PipelineLead;
  onForecastTap: (lead: PipelineLead) => void;
}

export default function DealCard({ lead, onForecastTap }: Props) {
  const c = scoreColor(lead.meddicc_score);
  return (
    <div
      data-testid={`deal-card-${lead.id}`}
      style={{
        background: '#fff',
        borderRadius: 8,
        padding: 12,
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        marginBottom: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Link
          href={`/m/leads/${lead.id}`}
          style={{
            color: '#262626',
            textDecoration: 'none',
            fontSize: 15,
            fontWeight: 600,
            flex: 1,
            wordBreak: 'break-all',
          }}
        >
          {lead.company_name}
        </Link>
        <span
          data-testid={`deal-card-score-${lead.id}`}
          data-score-bucket={c.label}
          style={{
            padding: '2px 8px',
            background: c.bg,
            color: c.text,
            borderRadius: 4,
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          {lead.meddicc_score == null ? '-' : Math.round(lead.meddicc_score)}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#8c8c8c' }}>
        <span>{lead.owner?.name || '公共池'}</span>
        <span style={{ flex: 1 }} />
        <WarningsCell warnings={lead.warnings} testId={`deal-warn-${lead.id}`} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <MeddiccDotsCompact
          dimensionsLit={lead.dimensions_lit}
          size={12}
          testIdPrefix={`deal-dot-${lead.id}`}
        />
        <span style={{ fontSize: 12, color: '#8c8c8c' }}>
          {formatAmount(lead.amount)}
        </span>
        <span style={{ fontSize: 12, color: '#bfbfbf' }}>
          {formatRelativeTime(lead.last_activity_at)}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#595959' }}>
        <span>Forecast：</span>
        <button
          type="button"
          data-testid={`deal-forecast-trigger-${lead.id}`}
          onClick={() => onForecastTap(lead)}
          style={{
            padding: '4px 10px',
            border: '1px solid #e8e8e8',
            background: '#fff',
            borderRadius: 14,
            fontSize: 12,
            color: '#1890ff',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {lead.forecast_category} ▾
        </button>
        {lead.close_date && (
          <span style={{ marginLeft: 'auto', color: '#8c8c8c' }}>关单：{lead.close_date}</span>
        )}
      </div>
    </div>
  );
}
