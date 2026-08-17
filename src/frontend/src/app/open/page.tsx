'use client';

import Link from 'next/link';

import CopyButton from '@/components/open/CopyButton';
import PersonaPicker from '@/components/open/PersonaPicker';
import ToolCatalog from '@/components/open/ToolCatalog';
import { FALLBACK_ENDPOINT } from '@/lib/open-api';

/** 首页六条示例问句（spec 005 §5.3）。 */
const SAMPLE_QUESTIONS = [
  '我手上哪几单最危险？',
  '北京大区有哪些线索？',
  'XX 公司这单的 MEDDICC 打几分，弱在哪一维？',
  '团队 pipeline 分布怎么样？',
  '谁最近跟进最不积极？（主管身份才有结果）',
  '必赢那几单里有 warning 的挑出来',
];

function SampleQuestions() {
  return (
    <div className="q-list" data-testid="sample-questions">
      {SAMPLE_QUESTIONS.map((q) => (
        <div className="q-item" key={q}>
          <span>{q}</span>
          <CopyButton value={q} label="复制" accent={false} />
        </div>
      ))}
    </div>
  );
}

export default function OpenHomePage() {
  return (
    <main>
      {/* 第 1 屏 · Hero */}
      <section className="screen" style={{ borderBottom: 'none' }}>
        <h1 className="hero-title">
          让你的 AI 助手
          <br />
          直接读取真实 CRM 数据
        </h1>
        <p className="hero-sub">
          SFA CRM 是一套完整运行的销售管理系统。这里把它的 9 个只读查询能力
          按 MCP 标准开放出来 —— 任何支持 MCP 的 AI 助手都能接上，用自然语言直接问。
        </p>

        <div className="endpoint-box">
          <code data-testid="endpoint">{FALLBACK_ENDPOINT}</code>
          <CopyButton value={FALLBACK_ENDPOINT} label="复制地址" testId="copy-endpoint" />
        </div>

        <div className="hero-meta">
          <span>9 个只读工具</span>
          <span>无需注册</span>
          <span>一分钟接入</span>
          <span>不提供任何写入接口</span>
        </div>
      </section>

      {/* 三步接入 —— 首屏之后直接进入动手环节 */}
      <section className="screen">
        <div className="section-head">
          <h2>接上你自己的 AI 助手</h2>
          <p>三步，一分钟以内。全程不需要注册，也不需要手填任何东西。</p>
        </div>

        <div className="stepper" data-testid="stepper">
          <div className="stepper-item current">
            <span className="stepper-num">步骤 1</span>
            <span className="stepper-title">选身份，领密钥</span>
          </div>
          <div className="stepper-item">
            <span className="stepper-num">步骤 2</span>
            <span className="stepper-title">复制配置（已含密钥）</span>
          </div>
          <div className="stepper-item">
            <span className="stepper-num">步骤 3</span>
            <span className="stepper-title">重启客户端，开口问</span>
          </div>
        </div>

        <PersonaPicker />

        <div className="step-block" data-step="3" style={{ marginTop: 36 }}>
          <h3>重启客户端，然后直接问</h3>
          <p>
            连上之后，你的助手会自动拿到全部 9 个工具和它们的参数说明 ——
            这是 MCP 协议自带的，不需要你再告诉它「这里有哪些接口」。
          </p>
          <div className="step-body">
            <div className="notice">
              试着问一句：<strong>「我团队哪几单有风险？」</strong>
              <br />
              它会自己决定该调哪个工具、怎么传参，然后把结果讲给你听。
            </div>
          </div>
        </div>
      </section>

      {/* 以下为参考资料，不参与步骤编号 */}
      <section className="screen">
        <div className="section-head">
          <h2>接上之后能问什么</h2>
          <p>这些问题都能直接问，助手会自己选工具。点右侧可复制。</p>
        </div>
        <SampleQuestions />
      </section>

      <section className="screen">
        <div className="section-head">
          <h2>开放了哪 9 个能力</h2>
          <p>全部只读。清单由后端按工具定义自动派生，不会与实际能力对不上。</p>
        </div>
        <ToolCatalog />
        <p style={{ marginTop: 18 }}>
          <Link href="/open/tools" className="btn">
            查看完整契约 →
          </Link>
        </p>
      </section>

      <footer className="open-footer" data-testid="open-footer">
        <p>
          <strong>限流：</strong>每把密钥每分钟 30 次、每日 500 次；每个来源每日可领 30 把。
        </p>
        <p>
          <strong>数据：</strong>全部为虚构演示数据，每 30 分钟自动重置一次，
          不含任何真实客户信息。
        </p>
        <p>
          <strong>只读：</strong>本平台不提供任何写入接口。录入、修改、转化等操作
          只能在 CRM 界面上由人工完成。
        </p>
        <p style={{ marginTop: 14 }}>
          <a href="https://github.com/pmYangKun/sfa-crm" target="_blank" rel="noreferrer">
            源码
          </a>
          {' · '}
          <Link href="/open/docs">接入文档</Link>
          {' · '}
          <Link href="/login">进入 CRM 演示环境</Link>
        </p>
      </footer>
    </main>
  );
}
