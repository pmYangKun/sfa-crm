/**
 * Vercel AI SDK configuration — dynamically loads LLM provider from backend.
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
const API_BASE = `${BACKEND_URL}/api/v1`;

export interface LLMConfigResponse {
  configured: boolean;
  provider?: string;
  model?: string;
  // spec 002 T033/FR-029: api_key 字段不再下发，改为 api_key_present 指示位
  api_key_present?: boolean;
  system_prompt?: string;
}

/**
 * Fetch LLM config metadata (provider/model/api_key_present) from backend.
 * spec 002: api_key 不再下发；前端 Next.js Route 走 process.env 读 LLM Key。
 */
export async function getServerLLMConfig(token: string): Promise<LLMConfigResponse> {
  const res = await fetch(`${API_BASE}/agent/llm-config`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch LLM config');
  return res.json();
}

/**
 * Tool definitions matching backend's TOOL_DEFINITIONS.
 * These are passed to the Vercel AI SDK for LLM tool calling.
 */
export const TOOL_SCHEMAS = {
  search_leads: {
    description: '搜索线索，可按公司名、大区筛选',
    parameters: {
      type: 'object' as const,
      properties: {
        search: { type: 'string', description: '公司名关键词' },
        region: { type: 'string', description: '大区' },
      },
    },
  },
  assign_lead: {
    description: '将线索分配给指定销售',
    parameters: {
      type: 'object' as const,
      properties: {
        lead_id: { type: 'string', description: '线索ID' },
        sales_id: { type: 'string', description: '销售用户ID' },
      },
      required: ['lead_id', 'sales_id'],
    },
  },
  release_lead: {
    description: '释放线索回公共池',
    parameters: {
      type: 'object' as const,
      properties: {
        lead_id: { type: 'string', description: '线索ID' },
      },
      required: ['lead_id'],
    },
  },
  log_followup: {
    description: '为线索录入跟进记录',
    parameters: {
      type: 'object' as const,
      properties: {
        lead_id: { type: 'string', description: '线索ID' },
        type: { type: 'string', enum: ['phone', 'wechat', 'visit', 'other'] },
        content: { type: 'string', description: '跟进内容' },
      },
      required: ['lead_id', 'type', 'content'],
    },
  },
};

/**
 * Execute a tool via backend API.
 */
export async function executeToolOnBackend(
  token: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}/agent/execute-tool?tool_name=${encodeURIComponent(toolName)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`Tool execution failed: ${res.statusText}`);
  return res.json();
}
