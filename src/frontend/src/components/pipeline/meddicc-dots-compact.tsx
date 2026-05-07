'use client';

// 紧凑版 7 圆点 — Pipeline 表 + 卡片用，比 spec 003 dashboard 版小
import { MEDDICC_LETTERS, litArrayToBitmap } from '@/lib/pipeline-types';

interface Props {
  dimensionsLit?: string[] | null;
  size?: number; // 圆点直径
  showLetters?: boolean; // 是否显示字母（true: 字母圆点；false: 实心点）
  testIdPrefix?: string;
}

export default function MeddiccDotsCompact({
  dimensionsLit,
  size = 14,
  showLetters = true,
  testIdPrefix = 'dot',
}: Props) {
  const bitmap = litArrayToBitmap(dimensionsLit);
  return (
    <div
      data-testid="meddicc-dots-compact"
      style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}
    >
      {MEDDICC_LETTERS.map((letter, idx) => {
        const lit = bitmap[idx];
        return (
          <span
            key={idx}
            data-testid={`${testIdPrefix}-${idx}`}
            data-lit={lit ? 'true' : 'false'}
            title={`${letter} - ${lit ? '已亮' : '未亮'}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: size,
              height: size,
              borderRadius: '50%',
              background: lit ? '#52c41a' : '#e8e8e8',
              color: lit ? '#fff' : '#bfbfbf',
              fontSize: Math.max(8, size - 6),
              fontWeight: 600,
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            {showLetters ? letter : ''}
          </span>
        );
      })}
    </div>
  );
}
