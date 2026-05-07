// Pipeline / Manager 视角共享类型 (spec 004)
// 与后端 schema 镜像（contracts/api-contracts.md）

export type ForecastCategory =
  | '进行中'
  | '必赢'
  | '大概率'
  | '乐观估算'
  | '已赢单'
  | '已丢单';

export const FORECAST_CATEGORIES: ForecastCategory[] = [
  '进行中',
  '必赢',
  '大概率',
  '乐观估算',
  '已赢单',
  '已丢单',
];

export const FORECAST_ACTIVE_CATEGORIES: ForecastCategory[] = [
  '进行中',
  '必赢',
  '大概率',
  '乐观估算',
];

// AI 校验仅触发于这两种升级
export const FORECAST_CATEGORIES_NEED_AI_VALIDATE: ForecastCategory[] = [
  '必赢',
  '大概率',
];

// MEDDICC 7 维 letter codes（用于紧凑圆点显示）
export const MEDDICC_LETTERS = ['M', 'E', 'D', 'D', 'I', 'C', 'C'] as const;

// 后端 dimension key → letter index
export const DIMENSION_LETTER_MAP: Record<string, string> = {
  metrics: 'M',
  economic_buyer: 'E',
  decision_criteria: 'D',
  decision_process: 'D',
  pain: 'I',
  champion: 'C',
  competition: 'C',
};

// dimensions 顺序（与 letters 对齐）
export const DIMENSION_ORDER = [
  'metrics',
  'economic_buyer',
  'decision_criteria',
  'decision_process',
  'pain',
  'champion',
  'competition',
] as const;

export interface PipelineWarning {
  code: string;
  mitigation: string;
}

export interface PipelineLeadOwner {
  id: string;
  name: string;
  avatar_url?: string | null;
}

export interface PipelineLead {
  id: string;
  company_name: string;
  owner: PipelineLeadOwner | null;
  amount: number | null;
  close_date: string | null;
  forecast_category: ForecastCategory;
  stage: 'active' | 'converted' | 'lost';
  meddicc_score: number | null;
  meddicc_completion: number;
  dimensions_lit: string[]; // 后端返回 dimension key 列表（只包含 lit 的维度，例如 ['metrics','champion']）
  warnings: PipelineWarning[];
  warnings_count: number;
  last_activity_at: string | null;
  next_call_at: string | null;
  contacts_count: number;
}

export interface PipelineResponse {
  leads: PipelineLead[];
  total: number;
  category_counts: Record<ForecastCategory, number>;
  category_warning_counts: Record<ForecastCategory, number>;
}

export interface TeamRollupRow {
  sales: { id: string; name: string; avatar_url?: string | null };
  active_lead_count: number;
  avg_meddicc_score: number | null;
  warnings_count: number;
  total_amount: number;
  last_activity_at: string | null;
}

export interface TeamRollupResponse {
  rows: TeamRollupRow[];
  total: number;
}

export interface ForecastValidationResult {
  verdict: 'support' | 'challenge' | 'abstain';
  reasoning: string;
  suggested_category: ForecastCategory | null;
  missing_dimensions: string[];
}

export interface MeddiccHistorySnapshot {
  snapshot_at: string;
  meddicc_score: number | null;
  meddicc_completion: number;
  trigger_reason: string;
}

export interface MeddiccHistoryResponse {
  snapshots: MeddiccHistorySnapshot[];
  lead_id: string;
}

// Score 颜色映射: ≥80 绿 / 60-79 灰 / <60 红
export function scoreColor(score: number | null | undefined): {
  bg: string;
  text: string;
  label: 'high' | 'mid' | 'low' | 'na';
} {
  if (score == null) return { bg: '#f5f5f5', text: '#999', label: 'na' };
  if (score >= 80) return { bg: '#f6ffed', text: '#52c41a', label: 'high' };
  if (score >= 60) return { bg: '#fafafa', text: '#595959', label: 'mid' };
  return { bg: '#fff1f0', text: '#cf1322', label: 'low' };
}

// 把后端返回的 dimensions_lit (dimension key 列表，例如 ['metrics','champion']) 按 DIMENSION_ORDER 转成 boolean[7]
export function litArrayToBitmap(dimensions_lit: string[] | undefined | null): boolean[] {
  if (!Array.isArray(dimensions_lit)) return new Array(7).fill(false);
  const set = new Set(dimensions_lit);
  return DIMENSION_ORDER.map((d) => set.has(d));
}

export function formatAmount(n: number | null | undefined): string {
  if (n == null) return '-';
  if (n >= 10000) {
    const wan = n / 10000;
    if (wan >= 100) return `¥${Math.round(wan)}万`;
    return `¥${wan.toFixed(wan >= 10 ? 0 : 1)}万`;
  }
  return `¥${n.toLocaleString('zh-CN')}`;
}

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return '-';
  try {
    const dt = new Date(iso).getTime();
    const now = Date.now();
    const diff = Math.max(0, now - dt);
    if (diff < 60_000) return '刚刚';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
    if (diff < 30 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`;
    return new Date(iso).toLocaleDateString('zh-CN');
  } catch {
    return iso || '-';
  }
}

// Warning code → 中文短标签
export const WARNING_CODE_LABELS: Record<string, string> = {
  silent_deal: '沉默 deal',
  brag_without_evidence: '吹牛无证据',
  close_imminent_low_score: '临门准备不足',
  overdue_not_closed: '逾期未关闭',
  no_champion_after_followups: '无 Champion',
  single_contact_exposed: '单点暴露',
  big_deal_thin_evidence: '大单证据薄',
};
