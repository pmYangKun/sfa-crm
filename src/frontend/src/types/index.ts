// ── Org ──────────────────────────────────────────────────────────────────────

export interface OrgNode {
  id: string;
  name: string;
  type: "root" | "region" | "team" | "custom";
  parent_id: string | null;
  created_at: string;
}

export interface User {
  id: string;
  name: string;
  login: string;
  org_node_id: string;
  is_active: boolean;
  created_at: string;
}

// ── Lead ─────────────────────────────────────────────────────────────────────

export type LeadStage = "active" | "converted" | "lost";
export type LeadPool = "private" | "public";
export type LeadSource = "referral" | "organic" | "koc_sem" | "outbound";

export interface Lead {
  id: string;
  company_name: string;
  unified_code: string | null;
  region: string;
  stage: LeadStage;
  pool: LeadPool;
  owner_id: string | null;
  source: LeadSource;
  created_at: string;
  last_followup_at: string | null;
  converted_at: string | null;
  lost_at: string | null;
}

// ── Customer ──────────────────────────────────────────────────────────────────

export interface Customer {
  id: string;
  lead_id: string;
  company_name: string;
  unified_code: string | null;
  region: string;
  owner_id: string;
  source: string;
  created_at: string;
  days_since_conversion: number;
}

// ── Contact ───────────────────────────────────────────────────────────────────

export interface Contact {
  id: string;
  lead_id: string | null;
  customer_id: string | null;
  name: string;
  role: string | null;
  is_key_decision_maker: boolean;
  wechat_id: string | null;
  phone: string | null;
  created_at: string;
}

// ── FollowUp ──────────────────────────────────────────────────────────────────

export type FollowUpType = "phone" | "wechat" | "visit" | "other";

export interface FollowUp {
  id: string;
  lead_id: string | null;
  customer_id: string | null;
  contact_id: string | null;
  owner_id: string;
  type: FollowUpType;
  content: string;
  followed_at: string;
  created_at: string;
}

// ── KeyEvent ──────────────────────────────────────────────────────────────────

export type KeyEventType =
  | "visited_kp"
  | "book_sent"
  | "attended_small_course"
  | "purchased_big_course"
  | "contact_relation_discovered";

export interface KeyEvent {
  id: string;
  lead_id: string | null;
  customer_id: string | null;
  type: KeyEventType;
  payload: Record<string, unknown>;
  created_by: string;
  occurred_at: string;
  created_at: string;
}

// ── DailyReport ───────────────────────────────────────────────────────────────

export interface DailyReport {
  id: string;
  owner_id: string;
  report_date: string;
  content: string;
  status: "draft" | "submitted";
  submitted_at: string | null;
  created_at: string;
}

// ── Pagination ────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}
