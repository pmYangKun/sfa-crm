// Next Best Action 文案字典（spec 003 T006）— 按最弱维度查表给一句建议

import { Dimension, DashboardData, DIMENSIONS } from './meddicc-types';

const TEMPLATES: Record<Dimension, string> = {
  metrics:
    'Metrics 维度还没亮，建议下次拜访问一下："您希望培训能改变哪些具体数字？比如业绩、留存、人效。"',
  economic_buyer:
    'Economic Buyer 维度证据不足，建议确认："这事最终是您拍板还是其他人？要不要安排个见面？"',
  decision_criteria:
    'Decision Criteria 还不清晰，建议问一下："您选培训公司主要看哪几个因素？讲师品牌？案例？价格？"',
  decision_process:
    'Decision Process 维度还没亮，建议下次拜访问一下："您内部一般这种采购走什么流程？老板自己定还是要跟合伙人/配偶讨论？"',
  pain:
    'Pain 维度证据较弱，建议深挖："这个问题不解决的话，下季度会怎么样？现在最让您头疼的是什么？"',
  champion:
    'Champion 维度还没亮，建议识别内部教练："谁在内部支持您们做这个决定？配偶？合伙人？或者 HR？"',
  competition:
    'Competition 维度证据不足，建议确认："您们还在看哪几家培训公司？或者考虑过自己摸索？"',
};

const ALL_FILLED_MESSAGE =
  '7 个维度已全部覆盖，证据扎实。建议保持节奏，安排下一步签约动作。';

const NO_DATA_MESSAGE =
  '暂无 MEDDICC 证据。请先录入对话/跟进记录，或点击演示场景卡片一键体验。';

/**
 * 根据 dashboard 数据生成 Next Best Action 文案。
 * 选最弱维度（先按是否亮，后按 count 升序，再按 confidence 平均升序）。
 */
export function getNextBestAction(data: DashboardData | null): string {
  if (!data) return NO_DATA_MESSAGE;
  const dims = data.dimensions || [];
  if (dims.length === 0) return NO_DATA_MESSAGE;

  // 找出 is_lit=false 的维度
  const unlit = dims.filter((d) => !d.is_lit);
  if (unlit.length === 0) {
    // 全亮：选 count 最少的维度作为"建议加强"的对象
    const sorted = [...dims].sort((a, b) => a.count - b.count);
    if (sorted[0].count >= 2) return ALL_FILLED_MESSAGE;
    return TEMPLATES[sorted[0].dimension];
  }

  // 否则取第一个未亮维度（按 DIMENSIONS 固定顺序）
  for (const d of DIMENSIONS) {
    if (unlit.find((u) => u.dimension === d)) {
      return TEMPLATES[d];
    }
  }
  return NO_DATA_MESSAGE;
}
