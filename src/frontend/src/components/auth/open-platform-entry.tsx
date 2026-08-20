'use client';

import Link from 'next/link';

/**
 * 登录页上的「MCP 开放平台」入口（spec 005 的 /open 站点）。
 *
 * 视觉上刻意做成深色终端风 —— 与 /open 的 open.css 同源（近黑底 + 绿色强调色 +
 * 等宽字），在整页浅色的登录页里形成唯一一块深色区，既一眼可辨、又提前预告了
 * 点进去之后是什么调性。
 *
 * 注意：这是**登录页**，按项目约定属于公开面，允许出现外部入口；登录之后的 CRM
 * 内部界面仍须保持纯净，不得混入这类链接。
 */
export default function OpenPlatformEntry({ layout }: { layout: 'pc' | 'mobile' }) {
  const isPc = layout === 'pc';

  return (
    <Link
      href="/open"
      data-testid="open-platform-entry"
      style={{
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid #1e2228',
        background:
          'radial-gradient(ellipse 70% 120% at 12% 0%, rgba(74,222,128,0.16), transparent 70%), #0e1013',
        padding: isPc ? '26px 28px' : '20px 18px',
        boxShadow: '0 1px 3px rgba(15,23,42,0.06), 0 10px 30px rgba(15,23,42,0.10)',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow =
          '0 1px 3px rgba(15,23,42,0.06), 0 16px 40px rgba(15,23,42,0.16)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.boxShadow =
          '0 1px 3px rgba(15,23,42,0.06), 0 10px 30px rgba(15,23,42,0.10)';
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: isPc ? 'row' : 'column',
          alignItems: isPc ? 'center' : 'stretch',
          gap: isPc ? 32 : 16,
        }}
      >
        <div style={{ flex: '1 1 auto', minWidth: 0 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontFamily: MONO,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 1.2,
              color: '#4ade80',
              background: 'rgba(74,222,128,0.12)',
              border: '1px solid rgba(74,222,128,0.35)',
              borderRadius: 999,
              padding: '4px 10px',
              marginBottom: 12,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#4ade80',
                boxShadow: '0 0 6px rgba(74,222,128,0.9)',
              }}
            />
            MCP 开放平台
          </div>

          <div
            style={{
              fontSize: isPc ? 19 : 16,
              fontWeight: 700,
              color: '#e6e8eb',
              lineHeight: 1.45,
              letterSpacing: -0.2,
              marginBottom: 8,
            }}
          >
            让你自己的 AI 助手，直接读取这套 CRM 的真实数据
          </div>

          <div
            style={{
              fontSize: isPc ? 13 : 12.5,
              color: '#8b929c',
              lineHeight: 1.7,
              maxWidth: isPc ? 620 : undefined,
            }}
          >
            本系统的 9 个查询能力已按 MCP 标准开放。任何支持 MCP 的客户端
            （Claude、Cursor 等）都能接上，用自然语言直接问 —— 不用登录这个界面。
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: isPc ? 18 : 12,
              marginTop: 14,
              fontFamily: MONO,
              fontSize: 11,
              color: '#7d8590',
            }}
          >
            {['9 个只读工具', '无需注册', '一分钟接入', '不提供写入接口'].map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </div>

        <div
          style={{
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: isPc ? '11px 20px' : '11px 0',
            width: isPc ? undefined : '100%',
            borderRadius: 8,
            background: '#4ade80',
            color: '#08090b',
            fontFamily: MONO,
            fontSize: 13,
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
        >
          进入开放平台 →
        </div>
      </div>
    </Link>
  );
}

const MONO =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';
