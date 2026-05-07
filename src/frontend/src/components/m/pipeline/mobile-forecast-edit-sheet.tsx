'use client';

// 移动端 forecast_category BottomSheet 编辑（spec 004 T049）
// 功能：选择 6 选 1，触发 AI 校验或直接 PUT
import { useState } from 'react';
import {
  ForecastCategory,
  FORECAST_CATEGORIES,
  FORECAST_CATEGORIES_NEED_AI_VALIDATE,
  ForecastValidationResult,
} from '@/lib/pipeline-types';
import { api } from '@/lib/api';
import MobileForecastValidationDialog from './mobile-forecast-validation-dialog';

interface Props {
  open: boolean;
  leadId: string | null;
  current: ForecastCategory;
  onClose: () => void;
  onSaved: () => void;
}

const validateCache: Record<string, { at: number; result: ForecastValidationResult }> = {};
const CACHE_MS = 60_000;

export default function MobileForecastEditSheet({
  open,
  leadId,
  current,
  onClose,
  onSaved,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<ForecastCategory | null>(null);
  const [dialog, setDialog] = useState<ForecastValidationResult | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string, ms = 2500) => {
    setToast(msg);
    setTimeout(() => setToast(null), ms);
  };

  if (!open || !leadId) return null;

  const doSave = async (target: ForecastCategory) => {
    if (!leadId) return;
    setSaving(true);
    try {
      await api.put(`/leads/${leadId}`, { forecast_category: target });
      showToast(`✓ 已改为 "${target}"`);
      onSaved();
      onClose();
    } catch (e) {
      showToast('保存失败', 3000);
    } finally {
      setSaving(false);
      setPendingTarget(null);
      setDialog(null);
    }
  };

  const handlePick = async (target: ForecastCategory) => {
    if (target === current) {
      onClose();
      return;
    }
    if (!FORECAST_CATEGORIES_NEED_AI_VALIDATE.includes(target)) {
      await doSave(target);
      return;
    }

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

    setSaving(true);
    setPendingTarget(target);
    try {
      const result = await api.post<ForecastValidationResult>(
        `/leads/${leadId}/validate-forecast`,
        { target_category: target },
      );
      validateCache[cacheKey] = { at: Date.now(), result };
      if (result.verdict === 'challenge') {
        setSaving(false);
        setDialog(result);
      } else {
        await doSave(target);
      }
    } catch {
      showToast('AI 暂时校验不上，已放行', 2500);
      await doSave(target);
    }
  };

  return (
    <>
      <div
        data-testid="mobile-forecast-edit-sheet"
        onClick={(e) => {
          if (e.target === e.currentTarget && !saving) onClose();
        }}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
          zIndex: 2500,
          display: 'flex',
          alignItems: 'flex-end',
        }}
      >
        <div
          style={{
            background: '#fff',
            borderRadius: '16px 16px 0 0',
            width: '100%',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            paddingBottom: 'env(safe-area-inset-bottom, 0)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              paddingTop: 8,
              paddingBottom: 4,
            }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: '#d9d9d9' }} />
          </div>

          <div
            style={{
              padding: '6px 16px 12px',
              borderBottom: '1px solid #f0f0f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 600 }}>修改 Forecast Category</div>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: 22,
                color: '#8c8c8c',
                cursor: saving ? 'not-allowed' : 'pointer',
                padding: 0,
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {FORECAST_CATEGORIES.map((c) => {
              const isCurrent = c === current;
              return (
                <button
                  key={c}
                  type="button"
                  data-testid={`mobile-forecast-option-${c}`}
                  data-current={isCurrent ? 'true' : 'false'}
                  disabled={saving}
                  onClick={() => handlePick(c)}
                  style={{
                    padding: '12px 14px',
                    background: isCurrent ? '#e6f7ff' : '#fafafa',
                    color: isCurrent ? '#1890ff' : '#262626',
                    border: '1px solid',
                    borderColor: isCurrent ? '#91d5ff' : '#f0f0f0',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: isCurrent ? 600 : 400,
                    fontFamily: 'inherit',
                    textAlign: 'left',
                    cursor: saving ? 'not-allowed' : 'pointer',
                  }}
                >
                  {c}
                  {isCurrent && (
                    <span style={{ marginLeft: 8, fontSize: 12, color: '#1890ff' }}>当前</span>
                  )}
                </button>
              );
            })}
          </div>

          {toast && (
            <div
              style={{
                margin: '0 16px 12px',
                padding: 10,
                background: '#262626',
                color: '#fff',
                borderRadius: 6,
                fontSize: 13,
                textAlign: 'center',
              }}
            >
              {toast}
            </div>
          )}
        </div>
      </div>

      <MobileForecastValidationDialog
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
