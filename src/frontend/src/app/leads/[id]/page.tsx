"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Lead, Contact, FollowUp } from "@/types";

interface LeadDetail extends Lead {
  contacts?: Contact[];
}

const STAGE_LABEL: Record<string, string> = {
  active: "跟进中",
  converted: "已转化",
  lost: "已流失",
};

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

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [lead, setLead] = useState<LeadDetail | null>(null);
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
      const [leadData, fuData] = await Promise.all([
        api.get<LeadDetail>(`/leads/${id}`),
        api.get<FollowUp[]>(`/leads/${id}/followups`).catch(() => []),
      ]);
      setLead(leadData);
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
      await api.post(`/leads/${id}/followups`, {
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
      await api.post(`/leads/${id}/key-events`, body);
      setKeMsg("已记录");
      setKeAmount("");
    } catch (e) {
      setKeMsg(e instanceof Error ? e.message : "记录失败");
    } finally {
      setKeSaving(false);
    }
  }

  if (loading) return <div className="page"><p>加载中…</p></div>;
  if (error) return <div className="page"><p className="error">{error}</p></div>;
  if (!lead) return null;

  return (
    <div className="page">
      <button className="back-btn" onClick={() => router.back()}>← 返回</button>

      {/* Basic info */}
      <div className="card">
        <div className="card-header">
          <h2>{lead.company_name}</h2>
          <span className={`badge badge-${lead.stage}`}>
            {STAGE_LABEL[lead.stage] ?? lead.stage}
          </span>
        </div>
        <dl className="info-grid">
          <dt>统一代码</dt><dd>{lead.unified_code ?? "—"}</dd>
          <dt>大区</dt><dd>{lead.region}</dd>
          <dt>来源</dt><dd>{SOURCE_LABEL[lead.source] ?? lead.source}</dd>
          <dt>线索池</dt><dd>{lead.pool === "private" ? "私有" : "公共"}</dd>
          <dt>录入时间</dt><dd>{new Date(lead.created_at).toLocaleDateString("zh-CN")}</dd>
          <dt>最近跟进</dt>
          <dd>{lead.last_followup_at ? new Date(lead.last_followup_at).toLocaleDateString("zh-CN") : "—"}</dd>
        </dl>
      </div>

      {/* Contacts */}
      {lead.contacts && lead.contacts.length > 0 && (
        <div className="card">
          <h3>联系人</h3>
          <table className="data-table">
            <thead>
              <tr><th>姓名</th><th>职务</th><th>微信</th><th>电话</th><th>决策人</th></tr>
            </thead>
            <tbody>
              {lead.contacts.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.role ?? "—"}</td>
                  <td>{c.wechat_id ?? "—"}</td>
                  <td>{c.phone ?? "—"}</td>
                  <td>{c.is_key_decision_maker ? "✓" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Log followup (only active leads) */}
      {lead.stage === "active" && (
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
      )}

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

      {/* Key event recording (T066) */}
      {lead.stage === "active" && (
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
      )}

      <style jsx>{`
        .page { padding: 24px; max-width: 720px; }
        .back-btn { background: none; border: none; color: var(--color-primary); cursor: pointer; font-size: 14px; padding: 0; margin-bottom: 16px; }
        .card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); padding: 20px; margin-bottom: 16px; }
        .card-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
        h2 { font-size: 18px; font-weight: 600; }
        h3 { font-size: 14px; font-weight: 600; color: var(--color-text-secondary); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
        .badge { padding: 2px 8px; border-radius: 10px; font-size: 12px; }
        .badge-active { background: #e6f4ff; color: #1677ff; }
        .badge-converted { background: #f6ffed; color: #52c41a; }
        .badge-lost { background: #fff2f0; color: #ff4d4f; }
        .info-grid { display: grid; grid-template-columns: 100px 1fr; gap: 8px 0; margin: 0; }
        dt { color: var(--color-text-secondary); font-size: 13px; }
        dd { font-size: 14px; margin: 0; }
        .data-table { width: 100%; border-collapse: collapse; }
        .data-table th, .data-table td { padding: 8px 10px; text-align: left; border-bottom: 1px solid var(--color-border); font-size: 13px; }
        .data-table th { color: var(--color-text-secondary); font-weight: 500; }

        /* Forms */
        .fu-form, .ke-form { display: flex; flex-direction: column; gap: 10px; }
        .form-row { display: flex; gap: 10px; }
        select, input[type="datetime-local"], input[type="number"] {
          padding: 6px 10px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          font-size: 13px;
          flex: 1;
        }
        textarea { padding: 8px 10px; border: 1px solid var(--color-border); border-radius: var(--radius); font-size: 13px; resize: vertical; }
        .btn-primary { align-self: flex-start; background: var(--color-primary); color: #fff; border: none; padding: 7px 16px; border-radius: var(--radius); cursor: pointer; font-size: 13px; }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

        /* Followup list */
        .fu-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
        .fu-item { border-left: 3px solid var(--color-border); padding-left: 12px; }
        .fu-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
        .fu-type-tag { background: #f0f0f0; padding: 1px 6px; border-radius: 4px; font-size: 11px; color: #595959; }
        .fu-date { font-size: 12px; color: var(--color-text-secondary); }
        .fu-content { font-size: 13px; margin: 0; color: var(--color-text); }

        .hint { color: var(--color-text-secondary); font-size: 13px; }
        .error { color: #e53e3e; font-size: 13px; }
        .success-msg { color: #38a169; font-size: 13px; }
      `}</style>
    </div>
  );
}
