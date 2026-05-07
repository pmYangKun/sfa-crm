'use client';

// 移动端 6 tab 横滑切换 + 计数 + warnings 数（spec 004 T047）
import { ForecastCategory, FORECAST_CATEGORIES } from '@/lib/pipeline-types';

interface Props {
  active: ForecastCategory;
  counts: Partial<Record<ForecastCategory, number>>;
  warningCounts: Partial<Record<ForecastCategory, number>>;
  onChange: (cat: ForecastCategory) => void;
}

export default function MobileForecastTabs({ active, counts, warningCounts, onChange }: Props) {
  return (
    <div
      data-testid="mobile-forecast-tabs"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        padding: '8px 12px',
        background: '#fff',
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
            data-testid={`mobile-forecast-tab-${cat}`}
            data-active={isActive ? 'true' : 'false'}
            style={{
              flexShrink: 0,
              padding: '6px 12px',
              border: 'none',
              borderRadius: 16,
              background: isActive ? '#1890ff' : '#f0f2f5',
              color: isActive ? '#fff' : '#595959',
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              fontFamily: 'inherit',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span>{cat}</span>
            <span style={{ fontSize: 11, opacity: 0.85 }}>({cnt})</span>
            {warn > 0 && (
              <span
                style={{
                  fontSize: 11,
                  background: isActive ? 'rgba(255,255,255,0.2)' : '#fff7e6',
                  color: isActive ? '#fff' : '#d46b08',
                  padding: '0 6px',
                  borderRadius: 8,
                }}
              >
                ⚠️{warn}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
