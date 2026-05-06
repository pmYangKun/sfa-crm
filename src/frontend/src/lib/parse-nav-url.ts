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
    /** 必填字段（spec edge case：AI 没预填时 sheet 红色标记 + 允许用户补充） */
    requiredFields: string[];
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
  ke_content: '事件备注',
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

const KE_TYPE_LABELS: Record<string, string> = {
  visited_kp: '拜访 KP',
  book_sent: '送书',
  attended_small_course: '参加小课',
  purchased_big_course: '购买大课',
  contact_relation_discovered: '发现人脉关系',
};

const REGION_LABELS: Record<string, string> = {
  华南: '华南', 华东: '华东', 华北: '华北', 华中: '华中', 西南: '西南', 西北: '西北', 东北: '东北',
};

export function displayValue(key: string, value: string): string {
  if (key === 'source') return SOURCE_LABELS[value] ?? value;
  if (key === 'fu_type') return FU_TYPE_LABELS[value] ?? value;
  if (key === 'ke_type') return KE_TYPE_LABELS[value] ?? value;
  return value;
}

/** 字段渲染 hint：text / textarea / select。mobile-form-sheet 据此选输入控件。 */
export type FieldKind = 'text' | 'textarea' | 'select';

export function fieldKind(key: string): FieldKind {
  if (key === 'fu_content' || key === 'ke_content') return 'textarea';
  if (key === 'source' || key === 'fu_type' || key === 'ke_type' || key === 'region') return 'select';
  return 'text';
}

export function fieldOptions(key: string): { value: string; label: string }[] {
  if (key === 'source') return Object.entries(SOURCE_LABELS).map(([v, l]) => ({ value: v, label: l }));
  if (key === 'fu_type') return Object.entries(FU_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }));
  if (key === 'ke_type') return Object.entries(KE_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }));
  if (key === 'region') return Object.entries(REGION_LABELS).map(([v, l]) => ({ value: v, label: l }));
  return [];
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
        requiredFields: ['company_name', 'region', 'source'],
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
          requiredFields: ['fu_type', 'fu_content'],
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
        submit: {
          method: 'POST',
          path: `/leads/${leadId}/key-events`,
          requiredFields: ['ke_type'],
          buildBody: (p) => ({
            type: p.ke_type ?? 'visited_kp',
            occurred_at: NOW_ISO(),
            payload: p.ke_content ? { note: p.ke_content } : {},
          }),
        },
      };
    }
    if (hash === 'actions') {
      // 从 label 推断动作（"转化客户" / "释放线索" / "标记流失"）
      let action: 'convert' | 'release' | 'mark-lost' = 'convert';
      let actionLabel = '转化客户';
      if (label.includes('释放')) {
        action = 'release';
        actionLabel = '释放线索';
      } else if (label.includes('流失') || label.includes('标记')) {
        action = 'mark-lost';
        actionLabel = '标记流失';
      }
      return {
        type: 'lead-action',
        typeLabel: actionLabel,
        rawLabel: label,
        leadId,
        prefill,
        submit: {
          method: 'POST',
          path: `/leads/${leadId}/${action}`,
          requiredFields: [],
          buildBody: () => ({}),
        },
      };
    }

    // /leads/{id} (no hash) → mobile 直接跳转详情页（不显示 sheet）
    if (!hash) {
      return {
        type: 'lead-action',
        typeLabel: '查看详情',
        rawLabel: label,
        leadId,
        prefill,
        // 无 submit 块；mobile 端走纯导航路径在 chat-fullscreen 里处理
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
