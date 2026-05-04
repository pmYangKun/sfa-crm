'use client';

interface HighlightItem {
  icon: string;
  title: string;
  body: string;
}

const HIGHLIGHTS: HighlightItem[] = [
  {
    icon: '🎬',
    title: 'VibeCoding × Spec Coding',
    body: 'AI 全程编码 + 文档约束生成，避免决策漂移',
  },
  {
    icon: '🧬',
    title: 'Palantir Ontology 落地',
    body: '业务对象 / 关系 / Action 在底层显式建模',
  },
  {
    icon: '🤝',
    title: 'Copilot 人机协同',
    body: '界面全 API 化，AI 直接调接口而不是模拟点击',
  },
];

export default function HighlightsPanelMobile() {
  return (
    <section
      data-testid="highlights-panel-mobile"
      style={{
        marginTop: 32,
        padding: '20px 16px',
        background: '#fafafa',
        borderRadius: 8,
        border: '1px solid #f0f0f0',
      }}
    >
      {HIGHLIGHTS.map((h, i) => (
        <div
          key={h.title}
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
            paddingBottom: i < HIGHLIGHTS.length - 1 ? 12 : 0,
            marginBottom: i < HIGHLIGHTS.length - 1 ? 12 : 0,
            borderBottom: i < HIGHLIGHTS.length - 1 ? '1px dashed #e8e8e8' : 'none',
          }}
        >
          <div style={{ fontSize: 22, lineHeight: 1.2, flexShrink: 0 }}>{h.icon}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#262626' }}>{h.title}</div>
            <div style={{ fontSize: 12, color: '#595959', marginTop: 2, lineHeight: 1.5 }}>
              {h.body}
            </div>
          </div>
        </div>
      ))}
      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #e8e8e8', fontSize: 11, color: '#8c8c8c', textAlign: 'center' }}>
        公众号「pmYangKun」全程记录
      </div>
    </section>
  );
}
