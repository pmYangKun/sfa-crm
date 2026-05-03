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
    body: '14 个 Phase、132 次 commit，AI 协助完成全部编码。不是"想到哪写到哪"——每个增量先把决策结构化（specify → plan → tasks → implement），再让 AI 编码。用文档约束生成行为，避免 AI 决策漂移。',
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
    <section
      data-testid="highlights-panel-pc"
      style={{
        marginTop: 48,
        maxWidth: 720,
        marginLeft: 'auto',
        marginRight: 'auto',
        padding: '32px 24px',
        background: '#fafafa',
        borderRadius: 12,
        border: '1px solid #f0f0f0',
      }}
    >
      <p style={{ fontSize: 16, color: '#262626', marginBottom: 24, fontWeight: 500, textAlign: 'center' }}>
        这不是一次玩具实验，是一场对传统软件工程的正面挑战。
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {HIGHLIGHTS.map((h) => (
          <div key={h.title} style={{ display: 'flex', gap: 16 }}>
            <div style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>{h.icon}</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: '#262626' }}>{h.title}</div>
              <div style={{ fontSize: 13, color: '#595959', lineHeight: 1.7 }}>{h.body}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #e8e8e8', fontSize: 12, color: '#8c8c8c', lineHeight: 1.8 }}>
        GitHub 源码：github.com/pmYangKun/sfa-crm
        <br />
        系列文章：公众号「pmYangKun」搜 &quot;VibeCoding&quot;
      </div>
    </section>
  );
}
