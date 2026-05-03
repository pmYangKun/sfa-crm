/**
 * 解析后端 navigate_* tool 返回的 URL，把它映射成"待确认对象"卡片所需的元数据。
 * 移动端 chat 内嵌卡片范式核心：把 PC 模式的"跳转 URL"翻译成"待确认对象 + prefill 字段"。
 */

export type NavObjectType =
  | 'create-lead'
  | 'log-followup'
  | 'create-keyevent'
  | 'lead-action'
  | 'unsupported';

export interface ParsedNav {
  type: NavObjectType;
  typeLabel: string;
  rawLabel: string;
  leadId?: string;
  prefill: Record<string, string>;
  /** 不存在则该对象类型本期移动端不支持完整提交，sheet 显示 fallback 文案 */
  submit?: {
    method: 'POST';
    path: string;
    buildBody: (values: Record<string, string>) => Record<string, unknown>;
  };
}

const NOW_ISO = () => new Date().toISOString();

const FIELD_LABELS: Record<string, string> = {
  company_name: '公司名',
  region: '大区',
  source: '来源',
  fu_type: '跟进类型',
  fu_content: '跟进内容',
  ke_type: '事件类型',
  ke_content: '事件内容',
  unified_code: '统一社会信用代码',
};

export function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key;
}

const SOURCE_LABELS: Record<string, string> = {
  referral: '转介绍',
  organic: '自然来源',
  koc_sem: 'KOC/SEM',
  outbound: '陌拜外呼',
};

const FU_TYPE_LABELS: Record<string, string> = {
  phone: '电话',
  wechat: '微信',
  visit: '拜访',
  other: '其他',
};

export function displayValue(key: string, value: string): string {
  if (key === 'source') return SOURCE_LABELS[value] ?? value;
  if (key === 'fu_type') return FU_TYPE_LABELS[value] ?? value;
  return value;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseNavUrl(url: string, label: string): ParsedNav {
  let pathname = url;
  let search = '';
  let hash = '';

  const hashIdx = url.indexOf('#');
  if (hashIdx >= 0) {
    hash = url.slice(hashIdx + 1);
    pathname = url.slice(0, hashIdx);
  }
  const qIdx = pathname.indexOf('?');
  if (qIdx >= 0) {
    search = pathname.slice(qIdx + 1);
    pathname = pathname.slice(0, qIdx);
  }

  const params = new URLSearchParams(search);
  const prefill: Record<string, string> = {};
  params.forEach((v, k) => {
    prefill[k] = decodeURIComponent(v);
  });

  if (pathname === '/leads/new') {
    return {
      type: 'create-lead',
      typeLabel: '新建线索',
      rawLabel: label,
      prefill,
      submit: {
        method: 'POST',
        path: '/leads',
        buildBody: (p) => ({
          company_name: p.company_name ?? '',
          region: p.region ?? '华南',
          source: p.source ?? 'referral',
          unified_code: p.unified_code || null,
        }),
      },
    };
  }

  const leadIdMatch = pathname.match(/^\/leads\/([^/?#]+)$/);
  if (leadIdMatch && UUID_RE.test(leadIdMatch[1])) {
    const leadId = leadIdMatch[1];
    if (hash === 'followup') {
      return {
        type: 'log-followup',
        typeLabel: '录入跟进',
        rawLabel: label,
        leadId,
        prefill,
        submit: {
          method: 'POST',
          path: `/leads/${leadId}/followups`,
          buildBody: (p) => ({
            type: p.fu_type ?? 'visit',
            content: p.fu_content ?? '',
            followed_at: NOW_ISO(),
          }),
        },
      };
    }
    if (hash === 'keyevent') {
      return {
        type: 'create-keyevent',
        typeLabel: '关键事件',
        rawLabel: label,
        leadId,
        prefill,
      };
    }
    if (hash === 'actions') {
      return {
        type: 'lead-action',
        typeLabel: '线索状态变更',
        rawLabel: label,
        leadId,
        prefill,
      };
    }
  }

  return {
    type: 'unsupported',
    typeLabel: '其他操作',
    rawLabel: label,
    prefill,
  };
}
