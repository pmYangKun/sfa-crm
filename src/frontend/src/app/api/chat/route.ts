/**
 * Next.js API Route for AI Chat (Copilot mode).
 *
 * Flow: browser → this route → read LLM config + system prompt from FastAPI
 * → call LLM via Vercel AI SDK → on tool_call → execute via FastAPI
 * → return result to LLM → stream response back.
 *
 * Tools are split into two categories:
 * - Read tools: execute directly and return data
 * - Navigate tools: return navigation instructions for write operations
 *   The LLM formats these as [[nav:label|url]] markers in its response,
 *   which the frontend chat component renders as clickable buttons.
 */

import { streamText, jsonSchema, stepCountIs } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
const API_BASE = `${BACKEND_URL}/api/v1`;

// Helper: define tool with inputSchema (workaround for ai@6 bug where tool() uses 'parameters' but streamText reads 'inputSchema')
function defineTool(
  description: string,
  properties: Record<string, { type: string; description: string }>,
  required: string[],
  execute: (args: Record<string, unknown>) => Promise<unknown>,
) {
  return {
    description,
    inputSchema: jsonSchema<Record<string, unknown>>({
      type: 'object' as const,
      properties,
      ...(required.length ? { required } : {}),
    }),
    execute,
  };
}

export async function POST(req: Request) {
  const { messages, sessionId } = await req.json();
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || '';

  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // 1. Read LLM config + system prompt from backend
  const configRes = await fetch(`${API_BASE}/agent/llm-config/full`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!configRes.ok) {
    return new Response(JSON.stringify({ error: 'Failed to load LLM config' }), { status: 500 });
  }
  const config = await configRes.json();
  if (!config.configured) {
    return new Response(JSON.stringify({ error: 'AI 助手尚未配置，请联系管理员。' }), { status: 503 });
  }

  // 2. Save user message to backend + run spec 002 防护门（限流 / 黑名单 / 熔断 / 超长）
  const lastUserMsg = messages[messages.length - 1];
  if (lastUserMsg?.role === 'user') {
    const chatRes = await fetch(`${API_BASE}/agent/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ session_id: sessionId, message: lastUserMsg.content }),
    });

    // spec 002 FR-001/008/010: 4xx/5xx → 短路返回友好错误，不进 LLM
    if (chatRes.status === 422) {
      return new Response(
        JSON.stringify({ error: '消息过长，请精简（最多 2000 字）', code: 'INPUT_TOO_LONG' }),
        { status: 422, headers: { 'Content-Type': 'application/json' } },
      );
    }
    if (chatRes.status === 429) {
      const retryAfter = chatRes.headers.get('Retry-After') || '60';
      return new Response(
        JSON.stringify({ error: '请求过于频繁，稍等片刻再试', code: 'RATE_LIMITED', retry_after_seconds: Number(retryAfter) }),
        { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': retryAfter } },
      );
    }
    if (chatRes.status === 503) {
      const data = await chatRes.json().catch(() => ({}));
      return new Response(
        JSON.stringify({
          error: data.message || '演示站当前调用量较高，请稍后再试',
          code: data.code || 'LLM_CIRCUIT_BREAKER_OPEN',
          retry_after_seconds: data.retry_after_seconds,
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      );
    }
    // 200 + blocked_by=prompt_guard：后端已记 audit + 写过固定话术为 assistant message；
    // 前端这里继续走 LLM 流，让 system prompt 边界条款（spec 002 FR-004）兜底拒绝。
    // 完整短路（替换为固定话术流）需要 Vercel AI SDK 协议级实现，留给 Phase 6 后端代理统一处理。
  }

  // 3. Build LLM provider dynamically based on provider config
  const apiKey = config.api_key || '';
  const provider = (config.provider || 'anthropic').toLowerCase();

  let model;
  if (provider === 'anthropic') {
    const anthropic = createAnthropic({ apiKey: apiKey || process.env.ANTHROPIC_API_KEY || '' });
    model = anthropic(config.model || 'claude-sonnet-4-20250514');
  } else {
    const baseURLMap: Record<string, string> = {
      openai: 'https://api.openai.com/v1',
      deepseek: 'https://api.deepseek.com/v1',
      minimax: 'https://api.minimax.chat/v1',
    };
    const baseURL = baseURLMap[provider] || baseURLMap.openai;
    const openai = createOpenAI({ apiKey, baseURL });
    model = openai.chat(config.model || 'gpt-4o');
  }

  // 4. Backend tool executor
  const exec = async (toolName: string, args: Record<string, unknown>) => {
    const res = await fetch(`${API_BASE}/agent/execute-tool?tool_name=${encodeURIComponent(toolName)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(args),
    });
    return res.json();
  };

  // 5. System prompt
  const systemPrompt = config.system_prompt || '你是 SFA CRM 的 AI 助手。请用中文回答。';

  // 6. Stream response with tool use
  const result = streamText({
    model,
    system: systemPrompt,
    messages,
    tools: {
      // ── Read tools ──
      search_leads: defineTool(
        '搜索线索，可按公司名、大区筛选',
        { search: { type: 'string', description: '公司名关键词' }, region: { type: 'string', description: '大区' } },
        [],
        (args) => exec('search_leads', args),
      ),
      get_lead_detail: defineTool(
        '查看指定线索的详细信息（含联系人）',
        { lead_id: { type: 'string', description: '线索ID' } },
        ['lead_id'],
        (args) => exec('get_lead_detail', args),
      ),
      get_followup_history: defineTool(
        '查看指定线索的跟进记录历史',
        { lead_id: { type: 'string', description: '线索ID' } },
        ['lead_id'],
        (args) => exec('get_followup_history', args),
      ),
      list_customers: defineTool(
        '查看客户列表',
        { search: { type: 'string', description: '公司名关键词' } },
        [],
        (args) => exec('list_customers', args),
      ),

      // ── Navigate tools ──
      navigate_create_lead: defineTool(
        '引导用户去创建新线索（返回导航链接，不直接创建）',
        {
          company_name: { type: 'string', description: '公司名称（预填）' },
          region: { type: 'string', description: '大区（预填）' },
          source: { type: 'string', description: '来源（预填）' },
        },
        [],
        (args) => exec('navigate_create_lead', args),
      ),
      navigate_log_followup: defineTool(
        '引导用户去录入跟进记录，可预填跟进类型和内容',
        {
          lead_id: { type: 'string', description: '线索ID' },
          company_name: { type: 'string', description: '公司名称' },
          followup_type: { type: 'string', description: '跟进类型：phone/wechat/visit/other' },
          content: { type: 'string', description: '跟进内容摘要（从用户对话中提取）' },
        },
        ['lead_id'],
        (args) => exec('navigate_log_followup', args),
      ),
      navigate_create_key_event: defineTool(
        '引导用户去记录关键事件（拜访KP、赠书、小课、大课等）',
        {
          lead_id: { type: 'string', description: '线索ID' },
          company_name: { type: 'string', description: '公司名称' },
          event_type: { type: 'string', description: '事件类型：visited_kp/book_sent/attended_small_course/purchased_big_course/contact_relation_discovered' },
        },
        ['lead_id'],
        (args) => exec('navigate_create_key_event', args),
      ),
      navigate_convert_lead: defineTool(
        '引导用户去将线索转化为客户',
        { lead_id: { type: 'string', description: '线索ID' }, company_name: { type: 'string', description: '公司名称' } },
        ['lead_id'],
        (args) => exec('navigate_convert_lead', args),
      ),
      navigate_release_lead: defineTool(
        '引导用户去释放线索回公共池',
        { lead_id: { type: 'string', description: '线索ID' }, company_name: { type: 'string', description: '公司名称' } },
        ['lead_id'],
        (args) => exec('navigate_release_lead', args),
      ),
      navigate_mark_lost: defineTool(
        '引导用户去标记线索为流失',
        { lead_id: { type: 'string', description: '线索ID' }, company_name: { type: 'string', description: '公司名称' } },
        ['lead_id'],
        (args) => exec('navigate_mark_lost', args),
      ),
    },
    stopWhen: stepCountIs(8),
  });

  return result.toTextStreamResponse();
}
