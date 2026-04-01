"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";

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

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<CustomerDetail>(`/customers/${id}`)
      .then(setCustomer)
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="hint">加载中…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!customer) return null;

  const conversionDate = new Date(customer.created_at).toLocaleDateString("zh-CN");
  const isLongTerm = customer.days_since_conversion > 90;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Link href="/customers" className="back-link">← 客户列表</Link>
          <h2>{customer.company_name}</h2>
        </div>
      </div>

      <div className="card">
        <h3>基本信息</h3>
        <dl className="info-grid">
          <dt>公司名称</dt><dd>{customer.company_name}</dd>
          <dt>统一代码</dt><dd>{customer.unified_code ?? "—"}</dd>
          <dt>大区</dt><dd>{customer.region}</dd>
          <dt>来源渠道</dt><dd>{SOURCE_LABEL[customer.source] ?? customer.source}</dd>
          <dt>转化时间</dt><dd>{conversionDate}</dd>
          <dt>转化天数</dt>
          <dd>
            <span className={`days-badge ${isLongTerm ? "days-old" : "days-fresh"}`}>
              {customer.days_since_conversion} 天
            </span>
            {isLongTerm && <span className="long-term-hint">（超过 90 天）</span>}
          </dd>
        </dl>
      </div>

      <div className="card">
        <h3>来源线索</h3>
        <dl className="info-grid">
          <dt>线索 ID</dt>
          <dd>
            <Link href={`/leads/${customer.lead_id}`} className="link">
              {customer.lead_id}
            </Link>
          </dd>
          <dt>线索大区</dt><dd>{customer.lead_region ?? "—"}</dd>
          <dt>线索来源</dt><dd>{customer.lead_source ? (SOURCE_LABEL[customer.lead_source] ?? customer.lead_source) : "—"}</dd>
        </dl>
      </div>

      <style jsx>{`
        .page { padding: 24px; max-width: 640px; }
        .page-header { margin-bottom: 20px; }
        .back-link { color: var(--color-text-secondary); font-size: 13px; text-decoration: none; display: block; margin-bottom: 6px; }
        h2 { font-size: 20px; font-weight: 600; }
        .card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          padding: 20px;
          margin-bottom: 16px;
        }
        .card h3 { font-size: 14px; font-weight: 600; color: var(--color-text-secondary); margin-bottom: 14px; text-transform: uppercase; letter-spacing: 0.05em; }
        .info-grid { display: grid; grid-template-columns: 100px 1fr; gap: 8px 12px; margin: 0; }
        dt { font-size: 13px; color: var(--color-text-secondary); display: flex; align-items: center; }
        dd { font-size: 14px; margin: 0; display: flex; align-items: center; gap: 6px; }
        .link { color: var(--color-primary); text-decoration: none; font-size: 12px; font-family: monospace; }
        .days-badge { padding: 2px 8px; border-radius: 10px; font-size: 12px; }
        .days-fresh { background: #f6ffed; color: #52c41a; }
        .days-old { background: #fff7e6; color: #d46b08; }
        .long-term-hint { font-size: 12px; color: var(--color-text-secondary); }
        .hint { padding: 24px; color: var(--color-text-secondary); }
        .error { padding: 24px; color: #e53e3e; }
      `}</style>
    </div>
  );
}
