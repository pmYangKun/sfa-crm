// MEDDICC TS types — 与后端 schema 镜像（spec 003 T005）

export type Dimension =
  | 'metrics'
  | 'economic_buyer'
  | 'decision_criteria'
  | 'decision_process'
  | 'pain'
  | 'champion'
  | 'competition';

export const DIMENSIONS: Dimension[] = [
  'metrics',
  'economic_buyer',
  'decision_criteria',
  'decision_process',
  'pain',
  'champion',
  'competition',
];

export const DIMENSION_LABELS: Record<Dimension, string> = {
  metrics: 'M Metrics',
  economic_buyer: 'E Economic Buyer',
  decision_criteria: 'D Decision Criteria',
  decision_process: 'D Decision Process',
  pain: 'I Implicate Pain',
  champion: 'C Champion',
  competition: 'C Competition',
};

export const DIMENSION_SHORT: Record<Dimension, string> = {
  metrics: '量化指标',
  economic_buyer: '决策人',
  decision_criteria: '决策标准',
  decision_process: '决策流程',
  pain: '痛点',
  champion: '内部支持者',
  competition: '竞争',
};

export interface Evidence {
  id: string;
  lead_id: string;
  dimension: Dimension;
  source_type: 'conversation' | 'followup' | 'key_event';
  source_id: string;
  evidence_text: string;
  confidence: number;
  created_at: string;
}

export interface DimensionStatus {
  dimension: Dimension;
  is_lit: boolean;
  count: number;
  evidences: Evidence[];
}

export interface DashboardData {
  lead_id: string;
  meddicc_score: number | null;
  meddicc_completion: number;
  last_analyzed_at: string | null;
  dimensions: DimensionStatus[];
}

export interface ConversationItem {
  id: string;
  lead_id: string;
  recorded_at: string;
  content: string;
  source: 'manual' | 'scenario_card' | 'mock_seed';
  scenario_card_id: string | null;
  created_by: string;
  created_at: string;
}

export interface ScenarioCardItem {
  id: string;
  title: string;
  description: string;
  applies_to_lead_company: string;
  applied: boolean;
  conversation_count: number;
}
