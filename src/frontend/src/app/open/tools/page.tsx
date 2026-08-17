'use client';

import Link from 'next/link';

import ToolCatalog from '@/components/open/ToolCatalog';

export default function OpenToolsPage() {
  return (
    <main>
      <section className="screen" style={{ borderBottom: 'none' }}>
        <p className="screen-label">工具契约</p>
        <h1 className="hero-title" style={{ fontSize: 30 }}>
          9 个只读工具的完整契约
        </h1>
        <p className="hero-sub">
          这份清单由后端按工具定义里的只读标记程序化派生，不是手工维护的 ——
          所以它不可能与实际暴露的能力对不上。
        </p>

        <div className="notice" style={{ marginBottom: 24 }}>
          全部工具都受接入密钥所绑定身份的数据范围约束。同一个工具、同样的参数，
          销售密钥与主管密钥拿到的数据不同。
        </div>

        <ToolCatalog detailed />

        <div className="notice notice-warn" style={{ marginTop: 28 }}>
          <strong>不在这份清单里的能力一律不存在。</strong>
          系统内另有 6 个引导型工具（创建线索、录跟进、转化、释放、标丢失等），
          它们靠浏览器跳转 + 人工确认完成提交，对没有浏览器的调用方毫无意义，
          因此**不对外暴露**，按名调用会返回「工具不存在」。
        </div>

        <p style={{ marginTop: 24 }}>
          <Link href="/open/docs" className="btn">
            接入文档 →
          </Link>{' '}
          <Link href="/open" className="btn">
            ← 回首页领密钥
          </Link>
        </p>
      </section>
    </main>
  );
}
