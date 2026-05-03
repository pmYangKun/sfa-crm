'use client';

import { useState, useEffect } from 'react';
import { fieldLabel, displayValue } from '@/lib/parse-nav-url';
import { ChatFormCardState } from './chat-form-card';

interface MobileFormSheetProps {
  open: boolean;
  card: ChatFormCardState | null;
  onClose: (lastValues: Record<string, string>) => void;
  onSubmit: (values: Record<string, string>) => Promise<{ id: string }>;
}

export default function MobileFormSheet({ open, card, onClose, onSubmit }: MobileFormSheetProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (card) {
      setValues({ ...card.values });
      setError(null);
      setBusy(false);
    }
  }, [card?.cardKey, open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || !card) return null;

  const supported = !!card.parsed.submit;
  const required = card.parsed.submit?.requiredFields ?? [];
  // 必填 + AI 预填的字段都要在 sheet 里展示，缺失必填字段也要给 input 让用户补
  const fieldKeys = Array.from(new Set<string>([
    ...required,
    ...Object.keys(values),
  ]));
  const fields = fieldKeys.length > 0 ? fieldKeys : Object.keys(card.parsed.prefill);
  const isMissing = (key: string) => required.includes(key) && !values[key];
  const hasMissing = fields.some(isMissing);

  const handleClose = () => onClose(values);

  const handleSubmit = async () => {
    if (!supported) return;
    if (hasMissing) {
      setError('请填完红色标记的必填字段');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(values);
    } catch (e) {
      setError(e instanceof Error ? e.message : '提交失败');
      setBusy(false);
    }
  };

  return (
    <div
      data-testid="mobile-form-sheet"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) handleClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'flex-end',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '16px 16px 0 0',
          width: '100%',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          paddingBottom: 'env(safe-area-inset-bottom, 0)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8, paddingBottom: 4 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#d9d9d9' }} />
        </div>

        <div style={{ padding: '8px 16px 12px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{card.parsed.typeLabel}</div>
          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            style={{ background: 'transparent', border: 'none', fontSize: 22, color: '#8c8c8c', cursor: busy ? 'not-allowed' : 'pointer', padding: 0, lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>
          {!supported && (
            <div style={{ padding: 12, background: '#fff7e6', border: '1px solid #ffe58f', color: '#874d00', borderRadius: 6, fontSize: 13, lineHeight: 1.6 }}>
              此操作（{card.parsed.typeLabel}）本期移动端尚不支持完整提交。请去 PC 端用 chat 完成。
              <br />
              下面字段是 AI 帮你预填的内容，可参考：
            </div>
          )}
          {fields.length === 0 ? (
            <p style={{ color: '#999', fontSize: 14 }}>AI 没有提供预填字段，请直接用 PC 端操作。</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: supported ? 0 : 12 }}>
              {fields.map((key) => {
                const missing = isMissing(key);
                const borderColor = missing ? '#cf1322' : '#d9d9d9';
                return (
                  <div key={key} data-field-missing={missing ? 'true' : 'false'}>
                    <label style={{ display: 'block', fontSize: 12, color: missing ? '#cf1322' : '#595959', marginBottom: 4 }}>
                      {fieldLabel(key)}{required.includes(key) && <span style={{ color: '#cf1322' }}>*</span>}
                    </label>
                    {key === 'fu_content' || key === 'ke_content' ? (
                      <textarea
                        value={values[key] ?? ''}
                        onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                        data-testid={`sheet-field-${key}`}
                        rows={3}
                        style={{
                          width: '100%', padding: 10, border: `1px solid ${borderColor}`,
                          borderRadius: 6, fontSize: 14, outline: 'none',
                          boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical',
                        }}
                      />
                    ) : (
                      <input
                        value={values[key] ?? ''}
                        onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                        data-testid={`sheet-field-${key}`}
                        style={{
                          width: '100%', padding: '10px 12px', border: `1px solid ${borderColor}`,
                          borderRadius: 6, fontSize: 14, outline: 'none', boxSizing: 'border-box',
                        }}
                      />
                    )}
                    {missing && (
                      <div style={{ fontSize: 11, color: '#cf1322', marginTop: 2 }}>
                        必填字段，AI 没能从消息里提取，请手动补充
                      </div>
                    )}
                    {!supported && values[key] && (
                      <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>
                        显示值：{displayValue(key, values[key])}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {error && (
            <div style={{ marginTop: 12, padding: '8px 12px', background: '#fff1f0', border: '1px solid #ffccc7', color: '#cf1322', fontSize: 13, borderRadius: 6 }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ padding: 12, borderTop: '1px solid #f0f0f0', display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            style={{ flex: 1, padding: 12, background: '#fff', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 14, cursor: busy ? 'not-allowed' : 'pointer' }}
          >
            关闭
          </button>
          {supported && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={busy}
              data-testid="sheet-submit"
              style={{
                flex: 1, padding: 12, background: '#1890ff', color: '#fff',
                border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 500,
                cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1,
              }}
            >
              {busy ? '提交中...' : '确认提交'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
