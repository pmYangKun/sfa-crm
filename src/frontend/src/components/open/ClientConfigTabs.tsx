'use client';

import { useState } from 'react';

import type { IssuedToken } from '@/lib/open-api';
import CopyButton from './CopyButton';

/**
 * 五种客户端的接入配置（spec 005 FR-017 / FR-018）。
 *
 * 这不是"适配了五个客户端"——服务端只有一个标准 MCP 端点，
 * 这里只是把同一把钥匙用五种语法写出来。
 *
 * Codex 单独处理：它的凭证走环境变量而非配置内联，步骤比其他四个多一步。
 */

type ClientId = 'workbuddy' | 'claude-code' | 'claude-desktop' | 'cursor' | 'codex';

const CLIENTS: { id: ClientId; label: string }[] = [
  { id: 'workbuddy', label: 'WorkBuddy' },
  { id: 'claude-code', label: 'Claude Code' },
  { id: 'claude-desktop', label: 'Claude Desktop' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'codex', label: 'Codex' },
];

function jsonConfig(endpoint: string, token: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        'sfa-crm': {
          type: 'streamable_http',
          url: endpoint,
          headers: { Authorization: `Bearer ${token}` },
        },
      },
    },
    null,
    2,
  );
}

export function buildSnippet(client: ClientId, endpoint: string, token: string): string {
  switch (client) {
    case 'claude-code':
      return `claude mcp add --transport http sfa-crm ${endpoint} \\\n  --header "Authorization: Bearer ${token}"`;
    case 'codex':
      // Codex 倾向让凭证走环境变量，不写进配置文件
      return `# 1) 先设置环境变量\nexport SFA_CRM_TOKEN="${token}"\n\n# 2) 再写入 ~/.codex/config.toml\n[mcp_servers.sfa-crm]\nurl = "${endpoint}"\nbearer_token_env_var = "SFA_CRM_TOKEN"`;
    default:
      return jsonConfig(endpoint, token);
  }
}

const FILE_HINT: Record<ClientId, string> = {
  workbuddy: 'WorkBuddy 设置 → MCP → 添加自定义服务器（或直接编辑其 MCP 配置文件）',
  'claude-code': '终端里执行这一行即可，无需手改配置文件',
  'claude-desktop': 'claude_desktop_config.json',
  cursor: '.cursor/mcp.json',
  codex: '~/.codex/config.toml（注意凭证走环境变量）',
};

export default function ClientConfigTabs({ issued }: { issued: IssuedToken }) {
  const [active, setActive] = useState<ClientId>('workbuddy');
  const snippet = buildSnippet(active, issued.endpoint, issued.token);

  return (
    <div data-testid="client-config">
      <div className="tabs" role="tablist" aria-label="客户端">
        {CLIENTS.map((c) => (
          <button
            key={c.id}
            role="tab"
            aria-selected={active === c.id}
            className="tab"
            data-testid={`tab-${c.id}`}
            onClick={() => setActive(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <p className="tool-example" style={{ marginBottom: 10 }}>
        写入位置：{FILE_HINT[active]}
      </p>

      <pre className="code-block" data-testid="config-snippet">
        {snippet}
      </pre>

      <div style={{ marginTop: 12 }}>
        <CopyButton value={snippet} label="复制配置" testId="copy-config" />
      </div>

      <ol className="steps">
        <li>复制上面这段</li>
        <li>粘进 {CLIENTS.find((c) => c.id === active)?.label} 的 MCP 配置</li>
        <li>重启客户端</li>
        <li>问它一句「我团队哪几单有风险？」</li>
      </ol>
    </div>
  );
}
