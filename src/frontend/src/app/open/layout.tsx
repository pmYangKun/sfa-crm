import type { Metadata } from 'next';
import Link from 'next/link';

import './open.css';

export const metadata: Metadata = {
  title: 'SFA CRM 开放平台',
  description: '让你的 AI 助手直接读取真实 CRM 数据 —— 9 个只读工具，无需注册，一分钟接入。',
};

/**
 * /open 是登录页之外的公开面，按项目约定这里**允许**出现站长身份与外站链接；
 * 登录后的 CRM 内部仍须保持纯净，不得混入任何外站入口。
 */
export default function OpenLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="open-root">
      <div className="open-shell">
        <nav className="open-nav">
          <Link href="/open" className="brand">
            SFA CRM 开放平台
          </Link>
          <Link href="/open/tools">工具契约</Link>
          <Link href="/open/docs">接入文档</Link>
          <a href="/open/llms.txt">llms.txt</a>
          <a
            href="https://github.com/pmYangKun/sfa-crm"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </nav>
        {children}
      </div>
    </div>
  );
}
