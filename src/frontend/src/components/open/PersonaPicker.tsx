'use client';

import { useState } from 'react';

import { issueToken, type IssuedToken, type Persona } from '@/lib/open-api';
import ClientConfigTabs from './ClientConfigTabs';

/**
 * 接入流程的步骤 1 与步骤 2（spec 005 FR-003 / US2）。
 *
 * 设计要点：
 * - 密钥由服务端生成后**直接填进配置片段**，访客不需要手工替换任何占位符
 * - 配置原地展开，不跳页 —— 跳页会让访客丢失上下文，还得再点回来对照
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
      setError(
        e instanceof Error && e.message !== 'Failed to fetch'
          ? e.message
          : '连不上服务端。如果你在本地跑，确认后端已在 8000 端口启动。',
      );
      setIssued(null);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div>
      {/* ── 步骤 1 ── */}
      <div className="step-block" data-step="1">
        <h3>选一个身份，当场领密钥</h3>
        <p>
          不用注册、不用填手机号。两种身份用的是同一个地址、同一套 9 个工具，
          差异只在能看到多少数据 —— 这是系统既有的数据可见性规则在起作用，不是两套接口。
        </p>

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
                className="btn btn-block btn-accent"
                data-testid={`persona-${p.id}`}
                disabled={loading !== null}
                onClick={() => pick(p.id)}
              >
                {loading === p.id ? '生成中…' : `以${p.name}身份连接`}
              </button>
            </div>
          ))}
        </div>

        {error && (
          <div className="notice notice-warn" data-testid="issue-error" style={{ marginTop: 16 }}>
            {error}
          </div>
        )}
      </div>

      {/* ── 步骤 2 ── */}
      <div className="step-block" data-step="2">
        <h3>复制配置，粘进你的 AI 助手</h3>
        <p>
          <strong>密钥已经替你填好了</strong>，复制下来直接用，不需要替换任何占位符。
        </p>

        <div className="step-body">
          {issued ? (
            <div data-testid="issued-panel">
              <div className="notice">
                已生成 <strong>{issued.persona_label}</strong> 的接入密钥
                <code style={{ margin: '0 6px', color: 'var(--accent)' }}>
                  {issued.token_prefix}…
                </code>
                ，有效期至 {new Date(issued.expires_at).toLocaleDateString('zh-CN')}。
                下面的配置里已包含完整密钥，页面刷新后就看不到了。
              </div>
              <ClientConfigTabs issued={issued} />
            </div>
          ) : (
            <p className="step-waiting" data-testid="step2-waiting">
              ← 先在上一步选一个身份，这里会自动出现填好密钥的配置。
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
