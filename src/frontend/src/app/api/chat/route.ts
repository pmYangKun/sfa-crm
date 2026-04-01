/**
 * Next.js API route for streaming AI chat (T102).
 *
 * Flow:
 * 1. Read Bearer token from Authorization header (forwarded from client)
 * 2. Fetch active LLMConfig from backend
 * 3. Stream response using Vercel AI SDK
 * 4. Tools execute backend API calls with the user's token
 */

import { streamText, tool } from "ai";
import { z } from "zod";
import { NextRequest } from "next/server";
import { buildModel, fetchChatConfig } from "@/lib/ai";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const runtime = "nodejs";
export const maxDuration = 60;

async function backendCall(token: string, path: string, method = "GET", body?: unknown) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Backend call failed");
  }
  if (res.status === 204) return { ok: true };
  return res.json();
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const config = await fetchChatConfig(token);
  if (!config) {
    return new Response(
      JSON.stringify({ error: "AI 功能未配置，请管理员配置 LLM" }),
      { status: 503 }
    );
  }

  const { messages } = await req.json();
  const model = buildModel(config);

  const result = await streamText({
    model,
    system: `你是 SFA CRM 系统的 AI 销售助手，帮助销售团队管理线索、客户、跟进记录和日报。
你可以调用工具查询和操作 CRM 数据。请用中文回复，保持专业、简洁。`,
    messages,
    tools: {
      list_leads: tool({
        description: "列出线索列表，支持按状态筛选",
        parameters: z.object({
          stage: z.string().optional().describe("线索阶段: new | contacted | negotiating | converted | lost"),
          pool: z.string().optional().describe("线索池: private | public"),
          limit: z.number().optional().describe("返回条数"),
        }),
        execute: async ({ stage, pool, limit }) => {
          const params = new URLSearchParams();
          if (stage) params.set("stage", stage);
          if (pool) params.set("pool", pool);
          if (limit) params.set("limit", String(limit));
          return backendCall(token, `/leads?${params}`);
        },
      }),

      get_lead: tool({
        description: "获取单条线索详情",
        parameters: z.object({ lead_id: z.string() }),
        execute: async ({ lead_id }) => backendCall(token, `/leads/${lead_id}`),
      }),

      list_customers: tool({
        description: "列出客户列表",
        parameters: z.object({
          limit: z.number().optional(),
        }),
        execute: async ({ limit }) => {
          const params = new URLSearchParams();
          if (limit) params.set("limit", String(limit));
          return backendCall(token, `/customers?${params}`);
        },
      }),

      get_customer: tool({
        description: "获取单个客户详情，含转化窗口状态",
        parameters: z.object({ customer_id: z.string() }),
        execute: async ({ customer_id }) => backendCall(token, `/customers/${customer_id}`),
      }),

      log_followup: tool({
        description: "记录一次跟进活动（适用于线索或客户）",
        parameters: z.object({
          entity_type: z.enum(["lead", "customer"]),
          entity_id: z.string(),
          type: z.enum(["call", "wechat", "visit", "email", "other"]),
          content: z.string(),
        }),
        execute: async ({ entity_type, entity_id, type, content }) => {
          const path = entity_type === "lead"
            ? `/leads/${entity_id}/followups`
            : `/customers/${entity_id}/followups`;
          return backendCall(token, path, "POST", { type, content });
        },
      }),

      record_key_event: tool({
        description: "记录关键销售事件",
        parameters: z.object({
          entity_type: z.enum(["lead", "customer"]),
          entity_id: z.string(),
          type: z.string().describe("book_sent | small_course_confirmed | big_course_registered | other"),
          payload: z.record(z.unknown()).optional(),
        }),
        execute: async ({ entity_type, entity_id, type, payload }) => {
          const path = entity_type === "lead"
            ? `/leads/${entity_id}/key-events`
            : `/customers/${entity_id}/key-events`;
          return backendCall(token, path, "POST", { type, payload: payload ?? {} });
        },
      }),

      get_my_stats: tool({
        description: "查询当前用户今天的跟进数统计",
        parameters: z.object({}),
        execute: async () => backendCall(token, "/reports/today-draft"),
      }),
    },
    maxSteps: 5,
  });

  return result.toDataStreamResponse();
}
