/**
 * Shared TypeScript types matching backend models.
 */

export interface UserInfo {
  id: string;
  name: string;
  roles: string[];
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: UserInfo;
}

export interface OrgNode {
  id: string;
  name: string;
  type: 'root' | 'region' | 'team' | 'custom';
  parent_id: string | null;
  created_at: string;
  children?: OrgNode[];
}

export interface Lead {
  id: string;
  company_name: string;
  unified_code: string | null;
  region: string;
  stage: 'active' | 'converted' | 'lost';
  pool: 'private' | 'public';
  owner_id: string | null;
  owner?: { id: string; name: string };
  source: 'referral' | 'organic' | 'koc_sem' | 'outbound';
  created_at: string;
  last_followup_at: string | null;
  converted_at: string | null;
  lost_at: string | null;
}

export interface Customer {
  id: string;
  lead_id: string;
  company_name: string;
  unified_code: string | null;
  region: string;
  owner_id: string;
  owner?: { id: string; name: string };
  source: string;
  created_at: string;
  conversion_window?: {
    in_window: boolean;
    days_remaining: number;
    has_big_course: boolean;
  };
}

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

export interface FollowUp {
  id: string;
  lead_id: string | null;
  customer_id: string | null;
  contact_id: string | null;
  owner_id: string;
  type: 'phone' | 'wechat' | 'visit' | 'other';
  source: 'manual' | 'ai';
  content: string;
  followed_at: string;
  created_at: string;
}

export interface KeyEvent {
  id: string;
  lead_id: string | null;
  customer_id: string | null;
  type: 'visited_kp' | 'book_sent' | 'attended_small_course' | 'purchased_big_course' | 'contact_relation_discovered';
  payload: Record<string, unknown>;
  created_by: string;
  occurred_at: string;
  created_at: string;
}

export interface DailyReport {
  id: string;
  owner_id: string;
  report_date: string;
  content: string;
  status: 'draft' | 'submitted';
  submitted_at: string | null;
  created_at: string;
}

export interface SystemConfigItem {
  key: string;
  value: string;
  description: string | null;
  updated_at: string;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
}

export interface Permission {
  id: string;
  code: string;
  module: string;
  name: string;
}

export interface AuditLogEntry {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  payload: string | null;
  ip: string | null;
  created_at: string;
}

export interface PaginatedResponse<T> {
  total: number;
  items: T[];
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  content: string;
  is_read: boolean;
  created_at: string;
}
