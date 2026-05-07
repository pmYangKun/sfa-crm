'use client';

// 行内 click-to-edit forecast_category — 选择 6 选 1，触发 AI 校验或直接 PUT
import { useState } from 'react';
import {
  ForecastCategory,
  FORECAST_CATEGORIES,
  FORECAST_CATEGORIES_NEED_AI_VALIDATE,
  ForecastValidationResult,
} from '@/lib/pipeline-types';
import { api, ApiError } from '@/lib/api';
import ForecastValidationDialog from './forecast-validation-dialog';

interface Props {
  leadId: string;
  current: ForecastCategory;
  disabled?: boolean;
  onSaved?: (newCategory: ForecastCategory) => void;
}

// 60s lead-level dedup cache（同一 lead 60s 内不再调 LLM）
const validateCache: Record<string, { at: number; result: ForecastValidationResult }> = {};
const CACHE_MS = 60_000;

export default function ForecastCellEditor({ leadId, current, disabled, onSaved }: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<ForecastCategory | null>(null);
  const [dialog, setDialog] = useState<ForecastValidationResult | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string, ms = 2500) => {
    setToast(msg);
    setTimeout(() => setToast(null), ms);
  };

  const doSave = async (target: ForecastCategory) => {
    setSaving(true);
    try {
      await api.put(`/leads/${leadId}`, { forecast_category: target });
      onSaved?.(target);
      showToast(`✓ 已改为 "${target}"`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '保存失败';
      showToast(`保存失败：${msg}`, 3500);
    } finally {
      setSaving(false);
      setPendingTarget(null);
      setDialog(null);
    }
  };

  const handlePick = async (target: ForecastCategory) => {
    setEditing(false);
    if (target === current) return;

    // 不需要 AI 校验：降级 / 进行中 / 已赢单 / 已丢单
    if (!FORECAST_CATEGORIES_NEED_AI_VALIDATE.includes(target)) {
      await doSave(target);
      return;
    }

    // 60s cache check
    const cacheKey = `${leadId}:${target}`;
    const cached = validateCache[cacheKey];
    if (cached && Date.now() - cached.at < CACHE_MS) {
      if (cached.result.verdict === 'challenge') {
        setPendingTarget(target);
        setDialog(cached.result);
      } else {
        await doSave(target);
      }
      return;
    }

    // 调 AI 校验（3s timeout，超时放行）
    setSaving(true);
    setPendingTarget(target);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const result = await api.post<ForecastValidationResult>(
        `/leads/${leadId}/validate-forecast`,
        { target_category: target },
      );
      clearTimeout(timeout);
      validateCache[cacheKey] = { at: Date.now(), result };
      if (result.verdict === 'challenge') {
        setSaving(false);
        setDialog(result);
      } else {
        // support / abstain → 直接放行
        await doSave(target);
      }
    } catch (e) {
      // timeout / 接口失败 → 直接放行 + toast
      if (e instanceof ApiError && e.status === 408) {
        showToast('AI 暂时校验不上，已放行', 2500);
      } else {
        showToast('AI 暂时校验不上，已放行', 2500);
      }
      await doSave(target);
    }
  };

  return (
    <>
      <span
        data-testid={`forecast-cell-${leadId}`}
        data-current={current}
        style={{ position: 'relative', display: 'inline-block' }}
      >
        <button
          type="button"
          data-testid={`forecast-cell-trigger-${leadId}`}
          disabled={disabled || saving}
          onClick={() => setEditing(!editing)}
          style={{
            background: '#fff',
            border: '1px solid #e8e8e8',
            borderRadius: 4,
            padding: '4px 10px',
            fontSize: 12,
            cursor: disabled ? 'not-allowed' : 'pointer',
            color: forecastBadgeColor(current),
            fontFamily: 'inherit',
            whiteSpace: 'nowrap',
          }}
        >
          {saving ? '保存中…' : current} ▾
        </button>

        {editing && (
          <div
            data-testid={`forecast-cell-menu-${leadId}`}
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 4,
              zIndex: 50,
              background: '#fff',
              border: '1px solid #d9d9d9',
              borderRadius: 6,
              boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
              minWidth: 110,
              padding: 4,
            }}
          >
            {FORECAST_CATEGORIES.map((c) => (
              <div
                key={c}
                data-testid={`forecast-option-${c}`}
                onClick={() => handlePick(c)}
                style={{
                  padding: '6px 12px',
                  fontSize: 13,
                  cursor: 'pointer',
                  borderRadius: 4,
                  color: c === current ? '#1890ff' : '#262626',
                  background: c === current ? '#e6f7ff' : 'transparent',
                  fontWeight: c === current ? 600 : 400,
                }}
                onMouseEnter={(e) => {
                  if (c !== current) e.currentTarget.style.background = '#fafafa';
                }}
                onMouseLeave={(e) => {
                  if (c !== current) e.currentTarget.style.background = 'transparent';
                }}
              >
                {c}
              </div>
            ))}
          </div>
        )}

        {toast && (
          <div
            data-testid={`forecast-toast-${leadId}`}
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 4,
              zIndex: 60,
              background: '#262626',
              color: '#fff',
              padding: '4px 10px',
              borderRadius: 4,
              fontSize: 12,
              whiteSpace: 'nowrap',
            }}
          >
            {toast}
          </div>
        )}
      </span>

      <ForecastValidationDialog
        open={!!dialog && !!pendingTarget}
        result={dialog}
        targetCategory={pendingTarget || '必赢'}
        onContinue={() => pendingTarget && doSave(pendingTarget)}
        onUseSuggested={() => {
          if (dialog?.suggested_category) doSave(dialog.suggested_category);
        }}
        onCancel={() => {
          setDialog(null);
          setPendingTarget(null);
        }}
      />
    </>
  );
}

function forecastBadgeColor(c: ForecastCategory): string {
  switch (c) {
    case '必赢':
      return '#cf1322';
    case '大概率':
      return '#fa8c16';
    case '乐观估算':
      return '#1890ff';
    case '已赢单':
      return '#52c41a';
    case '已丢单':
      return '#8c8c8c';
    default:
      return '#262626';
  }
}
