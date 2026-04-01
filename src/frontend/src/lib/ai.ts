/**
 * AI provider factory (T101).
 * Reads active LLMConfig from backend and instantiates the correct Vercel AI SDK provider.
 * This module is intended for server-side use only (Next.js API routes).
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface ChatConfig {
  provider: string;
  model_name: string;
  api_key: string;
  base_url: string | null;
}

/**
 * Fetch the active LLM config from the backend (server-side).
 * The caller must supply a valid Bearer token.
 */
export async function fetchChatConfig(token: string): Promise<ChatConfig | null> {
  const res = await fetch(`${BACKEND_URL}/agent/chat-config`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

/**
 * Build a Vercel AI SDK LanguageModel from the fetched config.
 */
export function buildModel(config: ChatConfig) {
  if (config.provider === "anthropic") {
    const anthropic = createAnthropic({ apiKey: config.api_key });
    return anthropic(config.model_name);
  }
  // OpenAI-compatible (including OpenAI, DeepSeek, etc.)
  const openai = createOpenAI({
    apiKey: config.api_key,
    baseURL: config.base_url ?? undefined,
  });
  return openai(config.model_name);
}
