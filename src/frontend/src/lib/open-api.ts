/**
 * /open 开放平台的取数层（spec 005）。
 *
 * 与 lib/api.ts 的区别：开放平台是**公开页面**，访客没有登录态，
 * 不能走那套自动注入 JWT 的 apiFetch。
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
export const API_BASE = `${BACKEND_URL}/api/v1`;

export type Persona = 'sales' | 'manager';

export interface IssuedToken {
  token: string;
  token_prefix: string;
  persona: Persona;
  persona_label: string;
  scope: string;
  expires_at: string;
  endpoint: string;
}

export interface ToolDoc {
  name: string;
  summary: string;
  description: string;
  parameters: {
    type: string;
    properties?: Record<string, { type?: string; description?: string }>;
    required?: string[];
  };
  example_question: string;
}

export interface ToolCatalog {
  tools: ToolDoc[];
  count: number;
  endpoint: string;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `请求失败（${res.status}）`;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch {
      /* 保持默认文案 */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export async function issueToken(persona: Persona): Promise<IssuedToken> {
  const res = await fetch(`${API_BASE}/mcp/tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ persona }),
  });
  return jsonOrThrow<IssuedToken>(res);
}

export async function fetchToolCatalog(): Promise<ToolCatalog> {
  const res = await fetch(`${API_BASE}/mcp/tools`, { cache: 'no-store' });
  return jsonOrThrow<ToolCatalog>(res);
}

/** 默认端点：后端未响应时页面仍要能展示一个可复制的地址。 */
export const FALLBACK_ENDPOINT = `${BACKEND_URL}/api/v1/mcp`;
