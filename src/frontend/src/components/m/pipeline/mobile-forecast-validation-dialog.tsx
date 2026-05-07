'use client';

// 移动端 AI 校验全屏 dialog (spec 004 T050)
import { ForecastCategory, ForecastValidationResult } from '@/lib/pipeline-types';
import { DIMENSION_SHORT } from '@/lib/meddicc-types';

interface Props {
  open: boolean;
  result: ForecastValidationResult | null;
  targetCategory: ForecastCategory;
  onContinue: () => void;
  onUseSuggested: () => void;
  onCancel: () => void;
}

export default function MobileForecastValidationDialog({
  open,
  result,
  targetCategory,
  onContinue,
  onUseSuggested,
  onCancel,
}: Props) {
  if (!open || !result) return null;
  const showSuggested =
    !!result.suggested_category && result.suggested_category !== targetCategory;
  const missing = result.missing_dimensions || [];

  return (
    <div
      data-testid="mobile-forecast-validation-dialog"
      role="dialog"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 3000,
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 20 }}>⚠️</span>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
          AI 看了下你的证据
        </h3>
        <button
          type="button"
          data-testid="mobile-validation-close"
          onClick={onCancel}
          style={{
            marginLeft: 'auto',
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

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        <div
          data-testid="mobile-validation-reasoning"
          style={{
            background: '#fafafa',
            border: '1px solid #f0f0f0',
            borderRadius: 8,
            padding: 14,
            fontSize: 14,
            color: '#262626',
            lineHeight: 1.6,
            marginBottom: 14,
          }}
        >
          {result.reasoning}
        </div>

        {missing.length > 0 && (
          <div
            data-testid="mobile-validation-missing"
            style={{
              padding: 12,
              background: '#fff7e6',
              border: '1px solid #ffd591',
              borderRadius: 6,
              fontSize: 13,
              color: '#874d00',
              marginBottom: 14,
            }}
          >
            <strong>缺失维度：</strong>
            <span style={{ marginLeft: 6 }}>
              {missing
                .map(
                  (d) =>
                    DIMENSION_SHORT[d as keyof typeof DIMENSION_SHORT] || d,
                )
                .join('、')}
            </span>
          </div>
        )}

        {showSuggested && (
          <div
            style={{
              padding: 12,
              background: '#e6f7ff',
              border: '1px solid #91d5ff',
              borderRadius: 6,
              fontSize: 14,
              color: '#0050b3',
              marginBottom: 14,
            }}
          >
            AI 建议改标 <strong>&quot;{result.suggested_category}&quot;</strong>
          </div>
        )}
      </div>

      <div
        style={{
          padding: 12,
          borderTop: '1px solid #f0f0f0',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0))',
        }}
      >
        <button
          type="button"
          data-testid="mobile-validation-continue"
          onClick={onContinue}
          style={{
            padding: 12,
            background: '#fa8c16',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 14,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          继续标 &quot;{targetCategory}&quot;
        </button>
        {showSuggested && (
          <button
            type="button"
            data-testid="mobile-validation-use-suggested"
            onClick={onUseSuggested}
            style={{
              padding: 12,
              background: '#1890ff',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 14,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            改标 &quot;{result.suggested_category}&quot;
          </button>
        )}
        <button
          type="button"
          data-testid="mobile-validation-cancel"
          onClick={onCancel}
          style={{
            padding: 12,
            background: '#fff',
            color: '#595959',
            border: '1px solid #d9d9d9',
            borderRadius: 6,
            fontSize: 14,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          先去补证据
        </button>
      </div>
    </div>
  );
}
