/**
 * Next.js API Route for AI Chat.
 *
 * Flow: browser → this route → read LLM config from FastAPI → call LLM via Vercel AI SDK
 * → on tool_call → execute via FastAPI → return result to LLM → stream response back.
 */

import { streamText, tool } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
const API_BASE = `${BACKEND_URL}/api/v1`;

export async function POST(req: Request) {
  const { messages, sessionId } = await req.json();
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || '';

  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // 1. Read LLM config from backend
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

  // 2. Save user message to backend
  const lastUserMsg = messages[messages.length - 1];
  if (lastUserMsg?.role === 'user') {
    await fetch(`${API_BASE}/agent/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ session_id: sessionId, message: lastUserMsg.content }),
    });
  }

  // 3. Build LLM provider dynamically
  // For now we support anthropic; can be extended for openai/deepseek
  const anthropic = createAnthropic({ apiKey: config.api_key || process.env.ANTHROPIC_API_KEY || '' });
  const model = anthropic(config.model || 'claude-sonnet-4-20250514');

  // 4. Define tools that proxy to backend
  const executeBackendTool = async (toolName: string, args: Record<string, unknown>) => {
    const res = await fetch(`${API_BASE}/agent/execute-tool?tool_name=${encodeURIComponent(toolName)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(args),
    });
    return res.json();
  };

  // 5. Stream response with tool use
  const result = await streamText({
    // @ts-expect-error — SDK version type mismatch between ai and @ai-sdk/anthropic
    model,
    system: `你是 SFA CRM 的 AI 助手。你可以帮助用户搜索线索、分配线索、释放线索、录入跟进记录等。请用中文回答。`,
    messages,
    tools: {
      search_leads: tool({
        description: '搜索线索，可按公司名、大区筛选',
        parameters: z.object({
          search: z.string().optional().describe('公司名关键词'),
          region: z.string().optional().describe('大区'),
        }),
        execute: async (args) => executeBackendTool('search_leads', args),
      }),
      assign_lead: tool({
        description: '将线索分配给指定销售',
        parameters: z.object({
          lead_id: z.string().describe('线索ID'),
          sales_id: z.string().describe('销售用户ID'),
        }),
        execute: async (args) => executeBackendTool('assign_lead', args),
      }),
      release_lead: tool({
        description: '释放线索回公共池',
        parameters: z.object({
          lead_id: z.string().describe('线索ID'),
        }),
        execute: async (args) => executeBackendTool('release_lead', args),
      }),
      log_followup: tool({
        description: '为线索录入跟进记录',
        parameters: z.object({
          lead_id: z.string().describe('线索ID'),
          type: z.enum(['phone', 'wechat', 'visit', 'other']).describe('跟进类型'),
          content: z.string().describe('跟进内容'),
        }),
        execute: async (args) => executeBackendTool('log_followup', args),
      }),
    },
    maxSteps: 5,
  });

  return result.toDataStreamResponse();
}
