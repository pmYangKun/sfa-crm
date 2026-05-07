'use client';

// 行内 click-to-edit forecast_category — 选择 6 选 1，触发 AI 校验或直接 PUT
// 下拉菜单 Portal 出 body + fixed 定位（按 trigger getBoundingClientRect），避免被表格 row 的 stacking context 截断
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

interface MenuPos {
  top: number;
  left: number;
  flipUp: boolean;
}

export default function ForecastCellEditor({ leadId, current, disabled, onSaved }: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<ForecastCategory | null>(null);
  const [dialog, setDialog] = useState<ForecastValidationResult | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const showToast = (msg: string, ms = 2500) => {
    setToast(msg);
    setTimeout(() => setToast(null), ms);
  };

  const openMenu = () => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const menuH = 6 * 32 + 12; // 6 选项 * 行高 + padding
    const flipUp = r.bottom + menuH + 8 > window.innerHeight;
    setMenuPos({
      top: flipUp ? r.top - menuH - 4 : r.bottom + 4,
      left: r.left,
      flipUp,
    });
    setEditing(true);
  };

  const closeMenu = () => {
    setEditing(false);
    setMenuPos(null);
  };

  // 点击外部 / Esc / 滚动 关闭
  useEffect(() => {
    if (!editing) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      const menu = document.querySelector(`[data-testid="forecast-cell-menu-${leadId}"]`);
      if (menu?.contains(target)) return;
      closeMenu();
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    const onScrollOrResize = () => closeMenu();
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [editing, leadId]);

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
    closeMenu();
    if (target === current) return;

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
        await doSave(target);
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 408) {
        showToast('AI 暂时校验不上，已放行', 2500);
      } else {
        showToast('AI 暂时校验不上，已放行', 2500);
      }
      await doSave(target);
    }
  };

  const menu = mounted && editing && menuPos ? createPortal(
    <div
      data-testid={`forecast-cell-menu-${leadId}`}
      style={{
        position: 'fixed',
        top: menuPos.top,
        left: menuPos.left,
        zIndex: 9999,
        background: '#fff',
        border: '1px solid #d9d9d9',
        borderRadius: 6,
        boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
        minWidth: 120,
        padding: 4,
      }}
    >
      {FORECAST_CATEGORIES.map((c) => (
        <div
          key={c}
          data-testid={`forecast-option-${c}`}
          onClick={() => handlePick(c)}
          style={{
            padding: '8px 14px',
            fontSize: 13,
            cursor: 'pointer',
            borderRadius: 4,
            color: c === current ? '#1890ff' : '#262626',
            background: c === current ? '#e6f7ff' : 'transparent',
            fontWeight: c === current ? 600 : 400,
            whiteSpace: 'nowrap',
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
    </div>,
    document.body
  ) : null;

  return (
    <>
      <span
        data-testid={`forecast-cell-${leadId}`}
        data-current={current}
        style={{ position: 'relative', display: 'inline-block' }}
      >
        <button
          ref={triggerRef}
          type="button"
          data-testid={`forecast-cell-trigger-${leadId}`}
          disabled={disabled || saving}
          onClick={() => (editing ? closeMenu() : openMenu())}
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

      {menu}

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
