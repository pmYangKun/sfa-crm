"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import type { FollowUp } from "@/types";

interface CustomerDetail {
  id: string;
  lead_id: string;
  company_name: string;
  unified_code: string | null;
  region: string;
  owner_id: string;
  source: string;
  created_at: string;
  days_since_conversion: number;
  lead_region: string | null;
  lead_source: string | null;
}

const SOURCE_LABEL: Record<string, string> = {
  referral: "转介绍",
  organic: "自然流量",
  koc_sem: "KOC/SEM",
  outbound: "外呼",
};

const FOLLOWUP_TYPE_LABEL: Record<string, string> = {
  phone: "电话",
  wechat: "微信",
  visit: "拜访",
  other: "其他",
};

const KEY_EVENT_LABELS: Record<string, string> = {
  book_sent: "送书",
  attended_small_course: "参加小课",
  purchased_big_course: "购买大课",
  visited_kp: "拜访关键人",
};

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Followup form
  const [fuType, setFuType] = useState<"phone" | "wechat" | "visit" | "other">("phone");
  const [fuContent, setFuContent] = useState("");
  const [fuDate, setFuDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [fuSaving, setFuSaving] = useState(false);
  const [fuMsg, setFuMsg] = useState<string | null>(null);

  // Key event form
  const [keType, setKeType] = useState("book_sent");
  const [keDate, setKeDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [keAmount, setKeAmount] = useState("");
  const [keSaving, setKeSaving] = useState(false);
  const [keMsg, setKeMsg] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [cData, fuData] = await Promise.all([
        api.get<CustomerDetail>(`/customers/${id}`),
        api.get<FollowUp[]>(`/customers/${id}/followups`).catch(() => []),
      ]);
      setCustomer(cData);
      setFollowups(fuData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, [id]);

  async function handleFollowupSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fuContent.trim()) return;
    setFuSaving(true);
    setFuMsg(null);
    try {
      await api.post(`/customers/${id}/followups`, {
        type: fuType,
        content: fuContent,
        followed_at: new Date(fuDate).toISOString(),
      });
      setFuContent("");
      setFuMsg("已记录");
      loadAll();
    } catch (e) {
      setFuMsg(e instanceof Error ? e.message : "记录失败");
    } finally {
      setFuSaving(false);
    }
  }

  async function handleKeyEventSubmit(e: React.FormEvent) {
    e.preventDefault();
    setKeSaving(true);
    setKeMsg(null);
    try {
      const body: Record<string, unknown> = {
        type: keType,
        occurred_at: new Date(keDate).toISOString(),
      };
      if (keType === "purchased_big_course") body.contract_amount = parseFloat(keAmount);
      await api.post(`/customers/${id}/key-events`, body);
      setKeMsg("已记录");
      setKeAmount("");
    } catch (e) {
      setKeMsg(e instanceof Error ? e.message : "记录失败");
    } finally {
      setKeSaving(false);
    }
  }

  if (loading) return <p className="hint">加载中…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!customer) return null;

  const isLongTerm = customer.days_since_conversion > 90;

  return (
    <div className="page">
      <div className="page-header">
        <Link href="/customers" className="back-link">← 客户列表</Link>
        <h2>{customer.company_name}</h2>
      </div>

      {/* Basic info */}
      <div className="card">
        <h3>基本信息</h3>
        <dl className="info-grid">
          <dt>公司名称</dt><dd>{customer.company_name}</dd>
          <dt>统一代码</dt><dd>{customer.unified_code ?? "—"}</dd>
          <dt>大区</dt><dd>{customer.region}</dd>
          <dt>来源渠道</dt><dd>{SOURCE_LABEL[customer.source] ?? customer.source}</dd>
          <dt>转化时间</dt><dd>{new Date(customer.created_at).toLocaleDateString("zh-CN")}</dd>
          <dt>转化天数</dt>
          <dd>
            <span className={`days-badge ${isLongTerm ? "days-old" : "days-fresh"}`}>
              {customer.days_since_conversion} 天
            </span>
          </dd>
        </dl>
      </div>

      {/* Source lead */}
      <div className="card">
        <h3>来源线索</h3>
        <dl className="info-grid">
          <dt>线索 ID</dt>
          <dd><Link href={`/leads/${customer.lead_id}`} className="link">{customer.lead_id}</Link></dd>
          <dt>线索大区</dt><dd>{customer.lead_region ?? "—"}</dd>
          <dt>线索来源</dt><dd>{customer.lead_source ? (SOURCE_LABEL[customer.lead_source] ?? customer.lead_source) : "—"}</dd>
        </dl>
      </div>

      {/* Log followup */}
      <div className="card">
        <h3>记录跟进</h3>
        <form onSubmit={handleFollowupSubmit} className="fu-form">
          <div className="form-row">
            <select value={fuType} onChange={(e) => setFuType(e.target.value as typeof fuType)}>
              <option value="phone">电话</option>
              <option value="wechat">微信</option>
              <option value="visit">拜访</option>
              <option value="other">其他</option>
            </select>
            <input type="datetime-local" value={fuDate} onChange={(e) => setFuDate(e.target.value)} />
          </div>
          <textarea
            placeholder="跟进内容…"
            value={fuContent}
            onChange={(e) => setFuContent(e.target.value)}
            rows={3}
          />
          {fuMsg && <p className={fuMsg === "已记录" ? "success-msg" : "error"}>{fuMsg}</p>}
          <button type="submit" className="btn-primary" disabled={fuSaving || !fuContent.trim()}>
            {fuSaving ? "保存中…" : "记录跟进"}
          </button>
        </form>
      </div>

      {/* Followup history */}
      <div className="card">
        <h3>跟进记录（{followups.length}）</h3>
        {followups.length === 0 ? (
          <p className="hint">暂无跟进记录</p>
        ) : (
          <ul className="fu-list">
            {followups.map((fu) => (
              <li key={fu.id} className="fu-item">
                <div className="fu-meta">
                  <span className="fu-type-tag">{FOLLOWUP_TYPE_LABEL[fu.type] ?? fu.type}</span>
                  <span className="fu-date">{new Date(fu.followed_at).toLocaleDateString("zh-CN")}</span>
                </div>
                <p className="fu-content">{fu.content}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Key event recording */}
      <div className="card">
        <h3>记录关键事件</h3>
        <form onSubmit={handleKeyEventSubmit} className="ke-form">
          <div className="form-row">
            <select value={keType} onChange={(e) => setKeType(e.target.value)}>
              {Object.entries(KEY_EVENT_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <input type="datetime-local" value={keDate} onChange={(e) => setKeDate(e.target.value)} />
          </div>
          {keType === "purchased_big_course" && (
            <input
              type="number"
              placeholder="合同金额（元）"
              value={keAmount}
              onChange={(e) => setKeAmount(e.target.value)}
              min="0"
            />
          )}
          {keMsg && <p className={keMsg === "已记录" ? "success-msg" : "error"}>{keMsg}</p>}
          <button
            type="submit"
            className="btn-primary"
            disabled={keSaving || (keType === "purchased_big_course" && !keAmount)}
          >
            {keSaving ? "保存中…" : "记录事件"}
          </button>
        </form>
      </div>

      <style jsx>{`
        .page { padding: 24px; max-width: 640px; }
        .page-header { margin-bottom: 20px; }
        .back-link { color: var(--color-text-secondary); font-size: 13px; text-decoration: none; display: block; margin-bottom: 6px; }
        h2 { font-size: 20px; font-weight: 600; }
        .card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); padding: 20px; margin-bottom: 16px; }
        .card h3 { font-size: 13px; font-weight: 600; color: var(--color-text-secondary); margin-bottom: 14px; text-transform: uppercase; letter-spacing: 0.05em; }
        .info-grid { display: grid; grid-template-columns: 100px 1fr; gap: 8px 12px; margin: 0; }
        dt { font-size: 13px; color: var(--color-text-secondary); }
        dd { font-size: 14px; margin: 0; display: flex; align-items: center; gap: 6px; }
        .link { color: var(--color-primary); text-decoration: none; font-size: 12px; font-family: monospace; }
        .days-badge { padding: 2px 8px; border-radius: 10px; font-size: 12px; }
        .days-fresh { background: #f6ffed; color: #52c41a; }
        .days-old { background: #fff7e6; color: #d46b08; }

        .fu-form, .ke-form { display: flex; flex-direction: column; gap: 10px; }
        .form-row { display: flex; gap: 10px; }
        select, input[type="datetime-local"], input[type="number"] {
          padding: 6px 10px; border: 1px solid var(--color-border); border-radius: var(--radius); font-size: 13px; flex: 1;
        }
        textarea { padding: 8px 10px; border: 1px solid var(--color-border); border-radius: var(--radius); font-size: 13px; resize: vertical; }
        .btn-primary { align-self: flex-start; background: var(--color-primary); color: #fff; border: none; padding: 7px 16px; border-radius: var(--radius); cursor: pointer; font-size: 13px; }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

        .fu-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
        .fu-item { border-left: 3px solid var(--color-border); padding-left: 12px; }
        .fu-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
        .fu-type-tag { background: #f0f0f0; padding: 1px 6px; border-radius: 4px; font-size: 11px; color: #595959; }
        .fu-date { font-size: 12px; color: var(--color-text-secondary); }
        .fu-content { font-size: 13px; margin: 0; }

        .hint { color: var(--color-text-secondary); font-size: 13px; }
        .error { color: #e53e3e; font-size: 13px; }
        .success-msg { color: #38a169; font-size: 13px; }
      `}</style>
    </div>
  );
}
