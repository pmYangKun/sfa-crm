'use client';

import { useState } from 'react';

import { issueToken, type IssuedToken, type Persona } from '@/lib/open-api';
import ClientConfigTabs from './ClientConfigTabs';

/**
 * 身份选择 + 配置原地展开（spec 005 FR-003 / US2）。
 *
 * 为什么不跳页：跳页会让访客丢失上下文，还得再点回来对照。
 * 领密钥 → 看配置 → 复制，全程停在同一屏。
 */

const PERSONAS: {
  id: Persona;
  name: string;
  who: string;
  scope: string;
}[] = [
  {
    id: 'sales',
    name: '销售',
    who: '王小明 · sales01',
    scope: '只能看到自己名下的线索与客户。问「哪几单有风险」，回答里只有他自己的单。',
  },
  {
    id: 'manager',
    name: '主管',
    who: '陈队长 · manager01',
    scope: '能看到整个团队的线索，以及团队级的汇总与排名。同一个问题，回答覆盖全队。',
  },
];

export default function PersonaPicker() {
  const [issued, setIssued] = useState<IssuedToken | null>(null);
  const [loading, setLoading] = useState<Persona | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(persona: Persona) {
    setLoading(persona);
    setError(null);
    try {
      setIssued(await issueToken(persona));
    } catch (e) {
      setError(e instanceof Error ? e.message : '领取失败，请稍后再试');
      setIssued(null);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div>
      <div className="persona-grid" data-testid="persona-grid">
        {PERSONAS.map((p) => (
          <div
            key={p.id}
            className={`persona-card ${p.id === 'manager' ? 'manager' : ''} ${
              issued?.persona === p.id ? 'active' : ''
            }`}
          >
            <h3 className="persona-name">{p.name}</h3>
            <p className="persona-who">{p.who}</p>
            <p className="persona-scope">{p.scope}</p>
            <button
              type="button"
              className="btn btn-block"
              data-testid={`persona-${p.id}`}
              disabled={loading !== null}
              onClick={() => pick(p.id)}
            >
              {loading === p.id ? '生成中…' : `以${p.name}身份连接`}
            </button>
          </div>
        ))}
      </div>

      <p className="tool-example" style={{ marginTop: 14 }}>
        两种身份用的是同一个地址、同一套 9 个工具。差异只在能看到多少数据 —— 这是系统
        既有的数据可见性规则在起作用，不是两套接口。
      </p>

      {error && (
        <div className="notice notice-warn" data-testid="issue-error" style={{ marginTop: 16 }}>
          {error}
        </div>
      )}

      {issued && (
        <div style={{ marginTop: 28 }} data-testid="issued-panel">
          <div className="notice">
            已生成 <strong>{issued.persona_label}</strong> 的接入密钥
            <code style={{ margin: '0 6px', color: 'var(--accent)' }}>
              {issued.token_prefix}…
            </code>
            ，有效期至 {new Date(issued.expires_at).toLocaleDateString('zh-CN')}。
            密钥只在这里显示一次，换个地方就看不到了。
          </div>
          <ClientConfigTabs issued={issued} />
        </div>
      )}
    </div>
  );
}
