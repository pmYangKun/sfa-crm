'use client';

import Link from 'next/link';

import { FALLBACK_ENDPOINT } from '@/lib/open-api';

const TOKEN_PLACEHOLDER = '<你的密钥>';

const JSON_CONFIG = `{
  "mcpServers": {
    "sfa-crm": {
      "type": "streamable_http",
      "url": "${FALLBACK_ENDPOINT}",
      "headers": {
        "Authorization": "Bearer ${TOKEN_PLACEHOLDER}"
      }
    }
  }
}`;

export default function OpenDocsPage() {
  return (
    <main>
      <section className="screen" style={{ borderBottom: 'none' }}>
        <p className="screen-label">接入文档</p>
        <h1 className="hero-title" style={{ fontSize: 30 }}>
          接入指南
        </h1>
        <p className="hero-sub">
          一个标准 MCP 服务，任何支持 MCP 的客户端都能接。下面五种是常见的，
          写法不同，接的是同一个端点。
        </p>

        <div className="endpoint-box" style={{ marginBottom: 28 }}>
          <code>{FALLBACK_ENDPOINT}</code>
        </div>

        <h2 style={{ fontSize: 18, margin: '32px 0 12px' }}>1. 先领一把密钥</h2>
        <p className="tool-desc">
          到 <Link href="/open">首页</Link> 点「以销售身份连接」或「以主管身份连接」，
          当场生成，无需注册。密钥只显示一次，7 天有效，可以随时再领。
        </p>

        <h2 style={{ fontSize: 18, margin: '32px 0 12px' }}>2. 按客户端写配置</h2>

        <div data-testid="docs-clients">
          <h3 style={{ fontSize: 15, margin: '24px 0 8px' }}>WorkBuddy / Claude Desktop / Cursor</h3>
          <p className="tool-desc">三者都用同一段 JSON，写进各自的 MCP 配置：</p>
          <pre className="code-block">{JSON_CONFIG}</pre>
          <p className="tool-example">
            WorkBuddy：设置 → MCP → 添加自定义服务器；
            Claude Desktop：claude_desktop_config.json；
            Cursor：.cursor/mcp.json
          </p>

          <h3 style={{ fontSize: 15, margin: '28px 0 8px' }}>Claude Code</h3>
          <p className="tool-desc">一行命令，不用手改配置文件：</p>
          <pre className="code-block">{`claude mcp add --transport http sfa-crm ${FALLBACK_ENDPOINT} \\
  --header "Authorization: Bearer ${TOKEN_PLACEHOLDER}"`}</pre>

          <div data-testid="docs-codex">
            <h3 style={{ fontSize: 15, margin: '28px 0 8px' }}>
              Codex（写法不同，注意）
            </h3>
            <p className="tool-desc">
              Codex 倾向让凭证走<strong>环境变量</strong>而不是内联进配置文件，
              所以比其他四个多一步：
            </p>
            <pre className="code-block">{`# 1) 先设置环境变量
export SFA_CRM_TOKEN="${TOKEN_PLACEHOLDER}"

# 2) 再写入 ~/.codex/config.toml
[mcp_servers.sfa-crm]
url = "${FALLBACK_ENDPOINT}"
bearer_token_env_var = "SFA_CRM_TOKEN"`}</pre>
          </div>
        </div>

        <h2 style={{ fontSize: 18, margin: '32px 0 12px' }}>3. 重启客户端，然后提问</h2>
        <p className="tool-desc">
          试试「我团队哪几单有风险？」。如果连得上但列不出工具，多半是凭证没带对；
          如果调用长时间无响应，检查网络代理是否缓冲了流式响应。
        </p>

        <h2 style={{ fontSize: 18, margin: '40px 0 12px' }}>限流</h2>
        <ul className="tool-desc" style={{ paddingLeft: 20 }}>
          <li>每把密钥：30 次/分钟、500 次/天</li>
          <li>每个来源 IP：每天最多领 30 把密钥</li>
          <li>首页演示区有独立配额，与你的密钥额度互不影响</li>
        </ul>

        <h2 style={{ fontSize: 18, margin: '40px 0 12px' }}>错误码</h2>
        <div className="card-grid">
          {[
            ['401 · 缺少密钥', '配置里没带 Authorization 头'],
            ['401 · 密钥无效', '密钥不存在，去首页重新领'],
            ['401 · 密钥已过期', '超过 7 天，去首页重新领'],
            ['401 · 密钥已吊销', '这把被停用了，领新的'],
            ['429 · 调用太频繁', '等一分钟，或明天再来'],
            ['工具不存在', '调了未暴露的工具（比如写操作）'],
          ].map(([code, why]) => (
            <div className="tool-card" key={code}>
              <h4 className="tool-name" style={{ fontSize: 13 }}>{code}</h4>
              <p className="tool-desc" style={{ margin: 0 }}>{why}</p>
            </div>
          ))}
        </div>

        <h2 style={{ fontSize: 18, margin: '40px 0 12px' }}>常见问题</h2>

        <p className="tool-desc">
          <strong>能写数据吗？</strong>不能。本平台只提供查询。录入、修改、转化、
          释放这些操作必须在 CRM 界面上由人确认提交 —— 这是产品设计上的选择，
          不是还没做。
        </p>
        <p className="tool-desc">
          <strong>数据是真的吗？</strong>系统是真在跑的，数据是虚构的演示数据，
          每 30 分钟重置一次。重置不会影响你已领的密钥。
        </p>
        <p className="tool-desc">
          <strong>密钥能分享吗？</strong>能，随便分享。它开不出任何写权限，
          看到的也全是演示数据。
        </p>
        <p className="tool-desc">
          <strong>为什么不用 OAuth？</strong>OAuth 解决的是「代表某个真实用户授权
          访问其真实数据」。这里是公开演示环境、数据虚构、身份只有两个固定角色，
          上 OAuth 只会给访客增加三步跳转，换不来任何实际安全收益。
        </p>

        <p style={{ marginTop: 32 }}>
          <Link href="/open/tools" className="btn">
            查看工具契约 →
          </Link>{' '}
          <a href="/open/llms.txt" className="btn">
            llms.txt →
          </a>
        </p>
      </section>
    </main>
  );
}
