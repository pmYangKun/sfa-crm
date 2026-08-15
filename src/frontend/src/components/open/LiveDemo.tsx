'use client';

import { useEffect, useState } from 'react';

import { API_BASE } from '@/lib/open-api';

/**
 * Live 演示区（spec 005 US3）。
 *
 * 存在的理由：访客在投入配置成本之前，得先能确认这不是一个静态宣传页。
 * 所以这里跑的是**真实调用** —— 预置问句打到后端，后端用服务端持有的凭证
 * 调真正的工具，把过程流式吐回来。
 *
 * 凭证全程不下发前端（FR-021）：写进页面 JS 就等于公开一把不受配额约束的钥匙。
 */

interface DemoQuestion {
  id: string;
  question: string;
  tool: string;
}

type Line = { kind: 'info' | 'tool' | 'result' | 'err'; text: string };

export default function LiveDemo() {
  const [questions, setQuestions] = useState<DemoQuestion[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/mcp/demo/questions`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((b) => setQuestions(b.questions ?? []))
      .catch(() => setQuestions([]));
  }, []);

  async function run(q: DemoQuestion) {
    if (running) return;
    setRunning(true);
    setLines([{ kind: 'info', text: `> ${q.question}` }]);

    try {
      const res = await fetch(`${API_BASE}/mcp/demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_id: q.id }),
      });

      if (!res.ok) {
        let detail = '演示暂时不可用';
        try {
          detail = (await res.json())?.detail ?? detail;
        } catch {
          /* 用默认文案 */
        }
        setLines((p) => [...p, { kind: 'err', text: detail }]);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setLines((p) => [...p, { kind: 'err', text: '当前浏览器不支持流式读取' }]);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() ?? '';

        for (const chunk of chunks) {
          const line = chunk.split('\n').find((l) => l.startsWith('data: '));
          if (!line) continue;
          const evt = JSON.parse(line.slice(6));
          setLines((prev) => [...prev, toLine(evt)]);
        }
      }
    } catch {
      setLines((p) => [...p, { kind: 'err', text: '演示调用失败，请稍后再试' }]);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div data-testid="live-demo">
      <div className="q-list" style={{ marginBottom: 16 }}>
        {questions.map((q) => (
          <button
            key={q.id}
            type="button"
            className="q-item"
            data-testid={`demo-q-${q.id}`}
            disabled={running}
            onClick={() => run(q)}
          >
            <span>{q.question}</span>
            <span className="q-hint">{running ? '运行中…' : '点这里真跑一次'}</span>
          </button>
        ))}
      </div>

      <div className="demo-stream" data-testid="demo-stream">
        {lines.length === 0
          ? '点上面任意一句，这里会打印真实的工具调用过程与返回数据。\n不需要领密钥，也不需要配置任何客户端。'
          : lines.map((l, i) => (
              <div
                key={i}
                className={
                  l.kind === 'tool'
                    ? 'demo-line-tool'
                    : l.kind === 'err'
                      ? 'demo-line-err'
                      : undefined
                }
              >
                {l.text}
              </div>
            ))}
      </div>
    </div>
  );
}

function toLine(evt: Record<string, unknown>): Line {
  switch (evt.type) {
    case 'question':
      return { kind: 'info', text: `> ${evt.text}` };
    case 'tool_call':
      return {
        kind: 'tool',
        text: `调用工具 ${evt.tool}(${JSON.stringify(evt.args ?? {})})`,
      };
    case 'result':
      return {
        kind: 'result',
        text: JSON.stringify(evt.payload, null, 2),
      };
    case 'error':
      return { kind: 'err', text: String(evt.text ?? '演示失败') };
    case 'done':
      return { kind: 'info', text: '— 演示结束 —' };
    default:
      return { kind: 'info', text: JSON.stringify(evt) };
  }
}
