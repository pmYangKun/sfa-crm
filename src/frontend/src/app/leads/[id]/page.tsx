"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Lead, Contact } from "@/types";

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

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await api.get<LeadDetail>(`/leads/${id}`);
        setLead(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "加载失败");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) return <div className="page"><p>加载中…</p></div>;
  if (error) return <div className="page"><p className="error">{error}</p></div>;
  if (!lead) return null;

  return (
    <div className="page">
      <button className="back-btn" onClick={() => router.back()}>← 返回</button>

      <div className="card">
        <div className="card-header">
          <h2>{lead.company_name}</h2>
          <span className={`badge badge-${lead.stage}`}>
            {STAGE_LABEL[lead.stage] ?? lead.stage}
          </span>
        </div>

        <dl className="info-grid">
          <dt>统一代码</dt>
          <dd>{lead.unified_code ?? "—"}</dd>

          <dt>大区</dt>
          <dd>{lead.region}</dd>

          <dt>来源</dt>
          <dd>{SOURCE_LABEL[lead.source] ?? lead.source}</dd>

          <dt>线索池</dt>
          <dd>{lead.pool === "private" ? "私有" : "公共"}</dd>

          <dt>录入时间</dt>
          <dd>{new Date(lead.created_at).toLocaleDateString("zh-CN")}</dd>

          <dt>最近跟进</dt>
          <dd>
            {lead.last_followup_at
              ? new Date(lead.last_followup_at).toLocaleDateString("zh-CN")
              : "—"}
          </dd>
        </dl>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>联系人</h3>
        {lead.contacts && lead.contacts.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>姓名</th>
                <th>职务</th>
                <th>微信</th>
                <th>电话</th>
                <th>关键决策人</th>
              </tr>
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
        ) : (
          <p className="hint">暂无联系人</p>
        )}
      </div>

      <style jsx>{`
        .page { padding: 24px; max-width: 720px; }
        .back-btn {
          background: none;
          border: none;
          color: var(--color-primary);
          cursor: pointer;
          font-size: 14px;
          padding: 0;
          margin-bottom: 16px;
        }
        .card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          padding: 20px;
        }
        .card-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
        h2 { font-size: 18px; font-weight: 600; }
        h3 { font-size: 15px; font-weight: 500; margin-bottom: 12px; }
        .badge { padding: 2px 8px; border-radius: 10px; font-size: 12px; }
        .badge-active { background: #e6f4ff; color: #1677ff; }
        .badge-converted { background: #f6ffed; color: #52c41a; }
        .badge-lost { background: #fff2f0; color: #ff4d4f; }
        .info-grid {
          display: grid;
          grid-template-columns: 120px 1fr;
          gap: 10px 0;
        }
        dt { color: var(--color-text-secondary); font-size: 13px; }
        dd { font-size: 14px; }
        .data-table { width: 100%; border-collapse: collapse; }
        .data-table th, .data-table td { padding: 8px 12px; text-align: left; border-bottom: 1px solid var(--color-border); font-size: 13px; }
        .data-table th { color: var(--color-text-secondary); font-weight: 500; }
        .hint { color: var(--color-text-secondary); font-size: 13px; }
        .error { color: #e53e3e; }
      `}</style>
    </div>
  );
}
