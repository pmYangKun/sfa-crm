/**
 * Next.js API Route for AI Chat (Copilot mode).
 *
 * Flow: browser → this route → read LLM provider/model/system_prompt from FastAPI
 * (NOT api_key — spec 002 T033/FR-029) → read provider-specific api_key from
 * process.env → call LLM via Vercel AI SDK → on tool_call → execute via FastAPI
 * → return result to LLM → stream response back.
 *
 * spec 002 T036/FR-030: api_key 不再走 /agent/llm-config/full 响应；
 * 浏览器从来拿不到 key（这条 Route 是 Next.js server-side），但 server-to-server
 * 拉 api_key 依然形成横向暴露面（任何带 agent.chat 权限的认证用户都能直接 curl
 * /llm-config/full）。改为从 server env 读 → 收口在 systemd EnvironmentFile，
 * 跟 JWT_SECRET / LLM_KEY_FERNET_KEY 同一管控级别。
 *
 * Provider → env var 映射（与 docs/deploy.md 一致）：
 *   anthropic → ANTHROPIC_API_KEY
 *   openai    → OPENAI_API_KEY
 *   deepseek  → DEEPSEEK_API_KEY
 *   minimax   → MINIMAX_API_KEY
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
  //    spec 002 T036/FR-030 双路径 fallback：
  //    - 生产：env 变量是唯一路径（后端 ENV=production 不下发 api_key）
  //    - 本地 dev：env 变量缺则 fallback 到后端 /llm-config/full 下发的明文
  //      （后端 ENV != production 时会把解密后的 key 一起返回）
  const provider = (config.provider || 'anthropic').toLowerCase();

  const envKeyMap: Record<string, string> = {
    anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    deepseek: 'DEEPSEEK_API_KEY',
    minimax: 'MINIMAX_API_KEY',
  };
  const envKeyName = envKeyMap[provider] || 'ANTHROPIC_API_KEY';
  const apiKey = process.env[envKeyName] || config.api_key || '';

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: `LLM API Key 未配置。本地开发：去 admin → LLM 配置 录入 Key；生产部署：systemd EnvironmentFile 配 ${envKeyName}。`,
        code: 'LLM_KEY_NOT_CONFIGURED',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }

  let model;
  if (provider === 'anthropic') {
    const anthropic = createAnthropic({ apiKey });
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
  // 关键：onError 让 LLM 调用失败（如 Anthropic 401 假 Key）能透出给前端，
  // 不再走 Vercel AI SDK toTextStreamResponse 默认的"静默吞错误"路径
  const result = streamText({
    model,
    system: systemPrompt,
    messages,
    onError: ({ error }) => {
      console.error('[chat/route.ts] streamText error:', error);
    },
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

  // 自己消费 fullStream，手动处理 text-delta + error chunk。
  // toTextStreamResponse() 在 v6 里只输出 text-delta、忽略 error chunk → 流变成空 → 前端"没任何反应"。
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const part of result.fullStream) {
          if (part.type === 'text-delta') {
            // v6 text-delta 字段叫 delta
            const delta = (part as { delta?: string }).delta;
            if (delta) controller.enqueue(encoder.encode(delta));
          } else if (part.type === 'error') {
            const err = (part as { error?: unknown }).error;
            const raw = err instanceof Error ? err.message : String(err ?? 'unknown error');
            console.error('[chat/route.ts] fullStream error:', raw);

            const lower = raw.toLowerCase();
            let friendly: string;
            // Key 无效场景（覆盖 Anthropic 401 / DeepSeek "Authentication Fails" / OpenAI "Incorrect API key"）
            if (
              raw.includes('401') ||
              lower.includes('invalid api key') ||
              lower.includes('incorrect api key') ||
              lower.includes('authentication fail') ||
              (lower.includes('api key') && (lower.includes('invalid') || lower.includes('incorrect'))) ||
              lower.includes('unauthorized')
            ) {
              friendly = `\n\n[LLM API Key 无效] 请到 admin → LLM 配置 重新输入有效的 ${provider} Key。\n\n原始错误：${raw}`;
            } else if (raw.includes('403') || lower.includes('forbidden') || lower.includes('not allowed')) {
              friendly = `\n\n[LLM Provider 拒绝请求（403）] 常见原因：(1) Key 失效或被吊销；(2) 账号所属地区不允许访问该 Provider（如 Anthropic 在中国大陆 IP 禁用）；(3) 账号被风控。\n\n原始错误：${raw}`;
            } else if (raw.includes('429') || lower.includes('rate') || lower.includes('quota') || lower.includes('insufficient')) {
              friendly = `\n\n[LLM 限流或配额不足] ${raw}`;
            } else if (lower.includes('connect') || lower.includes('network') || lower.includes('fetch fail') || lower.includes('etimedout')) {
              friendly = `\n\n[无法连接 LLM Provider] 检查网络 / 代理。\n\n原始错误：${raw}`;
            } else {
              friendly = `\n\n[LLM 调用错误] ${raw}`;
            }
            controller.enqueue(encoder.encode(friendly));
          }
          // 其它 chunk type（tool-call/tool-result/finish/...）静默吞，不进 text stream
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[chat/route.ts] stream consume exception:', msg);
        controller.enqueue(encoder.encode(`\n\n[流处理异常] ${msg}`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
