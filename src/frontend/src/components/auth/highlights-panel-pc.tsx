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
    body: '14 个 Phase、132 次 commit，AI 协助完成全部编码。每个增量先把决策结构化（specify → plan → tasks → implement），再让 AI 编码——用文档约束生成行为，避免决策漂移。',
  },
  {
    icon: '🧬',
    title: 'Palantir Ontology 落地',
    body: '在系统底层把业务对象、关系、可执行动作（Action）显式建模，让 AI 真正理解业务，而不是把业务知识塞进 system prompt。',
  },
  {
    icon: '🤝',
    title: 'Copilot 人机协同',
    body: '所有界面 API 化，AI Agent 与人协同操控同一套系统——AI 不靠"模拟点击"，而是直接调接口，各司其职。',
  },
];

export default function HighlightsPanelPC() {
  return (
    <section data-testid="highlights-panel-pc" style={{ marginTop: 72 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: '#64748b',
          letterSpacing: 1.4,
          textTransform: 'uppercase',
          marginBottom: 12,
        }}
      >
        Why this matters
      </div>
      <h2
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: '#0f172a',
          margin: '0 0 32px',
          maxWidth: 720,
          letterSpacing: -0.3,
          lineHeight: 1.4,
        }}
      >
        这不是一次玩具实验，是一场对传统软件工程的正面挑战。
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 32,
        }}
      >
        {HIGHLIGHTS.map((h) => (
          <div key={h.title}>
            <div style={{ fontSize: 22, lineHeight: 1, marginBottom: 12 }}>{h.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 6 }}>
              {h.title}
            </div>
            <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.7 }}>{h.body}</div>
          </div>
        ))}
      </div>
      <div
        style={{
          marginTop: 36,
          paddingTop: 20,
          borderTop: '1px solid #e2e8f0',
          fontSize: 12,
          color: '#94a3b8',
          lineHeight: 1.8,
        }}
      >
        GitHub 源码：github.com/pmYangKun/sfa-crm
        <span style={{ margin: '0 10px', color: '#cbd5e1' }}>·</span>
        系列文章：公众号「pmYangKun」搜 &quot;VibeCoding&quot;
      </div>
    </section>
  );
}
