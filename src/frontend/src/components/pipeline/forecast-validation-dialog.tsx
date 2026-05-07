'use client';

// AI 校验 forecast_category dialog (PC) — 显示 verdict + 3 个按钮
// Portal 出 body + 高 zIndex，避免被 chat-sidebar / 其他 fixed 元素遮住
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ForecastValidationResult,
  ForecastCategory,
  DIMENSION_LETTER_MAP,
} from '@/lib/pipeline-types';
import { DIMENSION_SHORT } from '@/lib/meddicc-types';

interface Props {
  open: boolean;
  result: ForecastValidationResult | null;
  targetCategory: ForecastCategory;
  onContinue: () => void;
  onUseSuggested: () => void;
  onCancel: () => void;
}

export default function ForecastValidationDialog({
  open,
  result,
  targetCategory,
  onContinue,
  onUseSuggested,
  onCancel,
}: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!open || !result || !mounted) return null;

  const showSuggested =
    !!result.suggested_category && result.suggested_category !== targetCategory;
  const missing = result.missing_dimensions || [];

  const node = (
    <div
      data-testid="forecast-validation-dialog"
      role="dialog"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        boxSizing: 'border-box',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          maxWidth: 520,
          width: '100%',
          maxHeight: 'calc(100vh - 40px)',
          overflowY: 'auto',
          padding: 24,
          boxSizing: 'border-box',
          boxShadow: '0 10px 32px rgba(0,0,0,0.18)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 22 }}>⚠️</span>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
            AI 看了下你这条 lead 的证据
          </h3>
        </div>

        <div
          data-testid="validation-reasoning"
          style={{
            background: '#fafafa',
            border: '1px solid #f0f0f0',
            borderRadius: 6,
            padding: 12,
            fontSize: 14,
            color: '#262626',
            lineHeight: 1.6,
            marginBottom: 14,
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
          }}
        >
          {result.reasoning}
        </div>

        {missing.length > 0 && (
          <div
            data-testid="validation-missing"
            style={{
              marginBottom: 14,
              fontSize: 13,
              color: '#595959',
              wordBreak: 'break-word',
              lineHeight: 1.6,
            }}
          >
            <strong>缺失维度：</strong>
            <span style={{ marginLeft: 6 }}>
              {missing
                .map((d) => DIMENSION_SHORT[d as keyof typeof DIMENSION_SHORT] || DIMENSION_LETTER_MAP[d] || d)
                .join('、')}
            </span>
          </div>
        )}

        {showSuggested && (
          <div
            style={{
              padding: '8px 12px',
              background: '#e6f7ff',
              border: '1px solid #91d5ff',
              borderRadius: 6,
              fontSize: 13,
              color: '#0050b3',
              marginBottom: 16,
              wordBreak: 'break-word',
            }}
          >
            AI 建议改标 <strong>&quot;{result.suggested_category}&quot;</strong>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
          <button
            type="button"
            data-testid="validation-continue"
            onClick={onContinue}
            style={{
              padding: '10px 16px',
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
              data-testid="validation-use-suggested"
              onClick={onUseSuggested}
              style={{
                padding: '10px 16px',
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
            data-testid="validation-cancel"
            onClick={onCancel}
            style={{
              padding: '10px 16px',
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
    </div>
  );

  return createPortal(node, document.body);
}
