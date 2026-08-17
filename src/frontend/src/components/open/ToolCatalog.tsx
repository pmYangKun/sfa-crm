'use client';

import { useEffect, useState } from 'react';

import { fetchToolCatalog, type ToolDoc } from '@/lib/open-api';

/**
 * 工具目录（spec 005 FR-021 / research Decision 6）。
 *
 * **数据必须从后端取**，不能在前端硬编码一份清单 —— 否则新增工具时站点展示
 * 与实际暴露能力必然漂移，而这是一个对外宣称"完整契约"的页面。
 */
export default function ToolCatalog({ detailed = false }: { detailed?: boolean }) {
  const [tools, setTools] = useState<ToolDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchToolCatalog()
      .then((c) => setTools(c.tools))
      .catch((e) => setError(e instanceof Error ? e.message : '工具目录加载失败'));
  }, []);

  if (error) {
    return (
      <div className="notice notice-warn" data-testid="catalog-error">
        {error}
      </div>
    );
  }

  if (!tools) {
    return (
      <p className="tool-example" data-testid="catalog-loading">
        正在加载工具目录…
      </p>
    );
  }

  return (
    <div className="card-grid" data-testid="tool-catalog" data-tool-count={tools.length}>
      {tools.map((t) => {
        const props = t.parameters?.properties ?? {};
        const required = t.parameters?.required ?? [];
        const paramNames = Object.keys(props);

        return (
          <div className="tool-card" key={t.name} data-testid={`tool-${t.name}`}>
            <h4 className="tool-name">{t.name}</h4>
            <p className="tool-desc">{detailed ? t.description : t.summary}</p>

            {detailed && (
              <p className="tool-desc">
                参数：
                {paramNames.length === 0
                  ? '无'
                  : paramNames
                      .map(
                        (n) =>
                          `${n}: ${props[n]?.type ?? 'string'}${
                            required.includes(n) ? '（必填）' : ''
                          }`,
                      )
                      .join('，')}
              </p>
            )}

            {t.example_question && (
              <p className="tool-example">试问：{t.example_question}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
