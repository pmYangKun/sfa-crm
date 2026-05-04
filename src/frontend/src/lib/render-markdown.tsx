// 极简 Markdown 渲染（无外部依赖）。专为 chat assistant 气泡用。
// 支持：标题（#/##/###）、列表（- 与 1.）、代码块（三反引号围栏）、
//       管道表格（含对齐冒号）、水平线（三横线/三星号/三下划线）、
//       行内：粗体（双星号 / 双下划线）、斜体（单星号 / 单下划线）、行内代码、链接。
// 流式友好：未闭合的标记不会破坏渲染，只会暂时显示为字面文本。

import React from 'react';

type Token =
  | { type: 'heading'; level: number; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'code-block'; code: string }
  | { type: 'table'; header: string[]; rows: string[][]; align: ('left' | 'right' | 'center')[] }
  | { type: 'hr' }
  | { type: 'paragraph'; text: string };

function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((c) => c.trim());
}

function parseAlign(sep: string[]): ('left' | 'right' | 'center')[] {
  return sep.map((c) => {
    const left = c.startsWith(':');
    const right = c.endsWith(':');
    if (left && right) return 'center';
    if (right) return 'right';
    return 'left';
  });
}

function tokenize(md: string): Token[] {
  const lines = md.split('\n');
  const tokens: Token[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (/^```/.test(line)) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      tokens.push({ type: 'code-block', code: buf.join('\n') });
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      tokens.push({ type: 'heading', level: heading[1].length, text: heading[2] });
      i++;
      continue;
    }

    // 水平分隔线：--- / *** / ___（独占一行）
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      tokens.push({ type: 'hr' });
      i++;
      continue;
    }

    // 表格：当前行起头是 |...|，下一行是分隔行 |---|---|（允许 :--- / ---: / :---:）
    if (/^\s*\|.+\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(lines[i + 1])) {
      const header = splitRow(line);
      const align = parseAlign(splitRow(lines[i + 1]));
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.+\|?\s*$/.test(lines[i])) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      tokens.push({ type: 'table', header, rows, align });
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ''));
        i++;
      }
      tokens.push({ type: 'ul', items });
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''));
        i++;
      }
      tokens.push({ type: 'ol', items });
      continue;
    }

    if (!line.trim()) {
      i++;
      continue;
    }

    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,3}\s|[-*]\s|\d+\.\s|```)/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    tokens.push({ type: 'paragraph', text: para.join('\n') });
  }
  return tokens;
}

const codeStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.06)',
  padding: '1px 5px',
  borderRadius: 3,
  fontSize: '0.92em',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
};

function renderInline(text: string, keyPrefix: string): React.ReactNode {
  const nodes: React.ReactNode[] = [];
  const codeRe = /`([^`]+)`/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = codeRe.exec(text)) !== null) {
    if (m.index > lastIdx) {
      nodes.push(...renderRich(text.slice(lastIdx, m.index), `${keyPrefix}-r${n++}`));
    }
    nodes.push(
      <code key={`${keyPrefix}-c${n++}`} style={codeStyle}>
        {m[1]}
      </code>,
    );
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) {
    nodes.push(...renderRich(text.slice(lastIdx), `${keyPrefix}-r${n++}`));
  }
  return nodes;
}

function renderRich(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|(?<![A-Za-z0-9_])\*([^*\n]+)\*(?![A-Za-z0-9_])|(?<![A-Za-z0-9_])_([^_\n]+)_(?![A-Za-z0-9_])/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIdx) {
      nodes.push(<React.Fragment key={`${keyPrefix}-t${n++}`}>{text.slice(lastIdx, m.index)}</React.Fragment>);
    }
    if (m[1] !== undefined) {
      nodes.push(
        <a
          key={`${keyPrefix}-a${n++}`}
          href={m[2]}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#1890ff', textDecoration: 'underline' }}
        >
          {m[1]}
        </a>,
      );
    } else if (m[3] !== undefined || m[4] !== undefined) {
      nodes.push(<strong key={`${keyPrefix}-b${n++}`}>{m[3] ?? m[4]}</strong>);
    } else {
      nodes.push(<em key={`${keyPrefix}-i${n++}`}>{m[5] ?? m[6]}</em>);
    }
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) {
    nodes.push(<React.Fragment key={`${keyPrefix}-t${n++}`}>{text.slice(lastIdx)}</React.Fragment>);
  }
  return nodes;
}

export function RenderMarkdown({ content }: { content: string }) {
  if (!content) return null;
  const tokens = tokenize(content);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {tokens.map((t, i) => {
        if (t.type === 'heading') {
          const fontSize = t.level === 1 ? 16 : t.level === 2 ? 15 : 14;
          return (
            <div key={i} style={{ fontSize, fontWeight: 600, lineHeight: 1.4 }}>
              {renderInline(t.text, `h${i}`)}
            </div>
          );
        }
        if (t.type === 'ul') {
          return (
            <ul key={i} style={{ margin: 0, paddingLeft: 20, lineHeight: 1.6 }}>
              {t.items.map((it, j) => (
                <li key={j} style={{ marginBottom: 2 }}>
                  {renderInline(it, `ul${i}-${j}`)}
                </li>
              ))}
            </ul>
          );
        }
        if (t.type === 'ol') {
          return (
            <ol key={i} style={{ margin: 0, paddingLeft: 22, lineHeight: 1.6 }}>
              {t.items.map((it, j) => (
                <li key={j} style={{ marginBottom: 2 }}>
                  {renderInline(it, `ol${i}-${j}`)}
                </li>
              ))}
            </ol>
          );
        }
        if (t.type === 'hr') {
          return (
            <hr
              key={i}
              style={{
                border: 0,
                borderTop: '1px solid rgba(0,0,0,0.12)',
                margin: '4px 0',
              }}
            />
          );
        }
        if (t.type === 'table') {
          return (
            <div key={i} style={{ overflowX: 'auto' }}>
              <table
                style={{
                  borderCollapse: 'collapse',
                  fontSize: 13,
                  width: '100%',
                  background: 'rgba(255,255,255,0.6)',
                }}
              >
                <thead>
                  <tr>
                    {t.header.map((h, j) => (
                      <th
                        key={j}
                        style={{
                          textAlign: t.align[j] ?? 'left',
                          padding: '6px 8px',
                          borderBottom: '1px solid rgba(0,0,0,0.18)',
                          background: 'rgba(0,0,0,0.04)',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {renderInline(h, `th${i}-${j}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {t.rows.map((row, ri) => (
                    <tr key={ri}>
                      {row.map((cell, ci) => (
                        <td
                          key={ci}
                          style={{
                            textAlign: t.align[ci] ?? 'left',
                            padding: '6px 8px',
                            borderBottom: '1px solid rgba(0,0,0,0.08)',
                            verticalAlign: 'top',
                          }}
                        >
                          {renderInline(cell, `td${i}-${ri}-${ci}`)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (t.type === 'code-block') {
          return (
            <pre
              key={i}
              style={{
                background: 'rgba(0,0,0,0.06)',
                padding: 8,
                borderRadius: 4,
                fontSize: 12,
                overflowX: 'auto',
                margin: 0,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              }}
            >
              <code>{t.code}</code>
            </pre>
          );
        }
        const parts = t.text.split('\n');
        return (
          <div key={i} style={{ lineHeight: 1.6 }}>
            {parts.map((p, j) => (
              <React.Fragment key={j}>
                {renderInline(p, `p${i}-${j}`)}
                {j < parts.length - 1 && <br />}
              </React.Fragment>
            ))}
          </div>
        );
      })}
    </div>
  );
}
