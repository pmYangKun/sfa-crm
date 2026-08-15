'use client';

import { useState } from 'react';

/** 一键复制。剪贴板不可用时降级为选中文本，不静默失败。 */
export default function CopyButton({
  value,
  label = '复制',
  testId,
  accent = true,
}: {
  value: string;
  label?: string;
  testId?: string;
  accent?: boolean;
}) {
  const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle');

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState('ok');
    } catch {
      setState('fail');
    }
    setTimeout(() => setState('idle'), 1800);
  }

  return (
    <button
      type="button"
      className={`btn${accent ? ' btn-accent' : ''}`}
      onClick={copy}
      data-testid={testId}
      data-copy-state={state}
    >
      {state === 'ok' ? '已复制 ✓' : state === 'fail' ? '请手动选中复制' : label}
    </button>
  );
}
