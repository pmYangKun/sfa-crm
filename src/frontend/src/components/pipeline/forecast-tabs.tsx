'use client';

// 6 tab Forecast Categories 切换 + 计数 + warnings 数指示
import { ForecastCategory, FORECAST_CATEGORIES } from '@/lib/pipeline-types';

interface Props {
  active: ForecastCategory;
  counts: Partial<Record<ForecastCategory, number>>;
  warningCounts: Partial<Record<ForecastCategory, number>>;
  onChange: (cat: ForecastCategory) => void;
}

export default function ForecastTabs({ active, counts, warningCounts, onChange }: Props) {
  return (
    <div
      data-testid="forecast-tabs"
      style={{
        display: 'flex',
        gap: 4,
        flexWrap: 'wrap',
        padding: '8px 0',
        borderBottom: '1px solid #f0f0f0',
      }}
    >
      {FORECAST_CATEGORIES.map((cat) => {
        const isActive = cat === active;
        const cnt = counts[cat] ?? 0;
        const warn = warningCounts[cat] ?? 0;
        return (
          <button
            key={cat}
            type="button"
            onClick={() => onChange(cat)}
            data-testid={`forecast-tab-${cat}`}
            data-active={isActive ? 'true' : 'false'}
            style={{
              padding: '8px 14px',
              border: 'none',
              borderBottom: isActive ? '2px solid #1890ff' : '2px solid transparent',
              background: 'transparent',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 14,
              color: isActive ? '#1890ff' : '#595959',
              fontWeight: isActive ? 600 : 400,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>{cat}</span>
            <span
              style={{
                fontSize: 12,
                color: isActive ? '#1890ff' : '#8c8c8c',
                background: isActive ? '#e6f7ff' : '#f5f5f5',
                padding: '1px 8px',
                borderRadius: 10,
                fontWeight: 500,
              }}
            >
              {cnt}
            </span>
            {warn > 0 && (
              <span
                title={`${warn} 条风险提示`}
                style={{
                  fontSize: 11,
                  color: '#d46b08',
                  background: '#fff7e6',
                  border: '1px solid #ffd591',
                  padding: '1px 6px',
                  borderRadius: 8,
                }}
              >
                ⚠️ {warn}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
