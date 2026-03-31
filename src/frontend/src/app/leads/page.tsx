"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Lead, PaginatedResponse } from "@/types";

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

export default function LeadsPage() {
  const [data, setData] = useState<PaginatedResponse<Lead> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("");

  async function fetchLeads() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: "1", page_size: "20" });
      if (search) params.set("search", search);
      if (stage) params.set("stage", stage);
      const result = await api.get<PaginatedResponse<Lead>>(`/leads?${params}`);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLeads();
  }, [stage]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchLeads();
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>我的线索</h2>
        <Link href="/leads/new" className="btn-primary">
          + 录入线索
        </Link>
      </div>

      <div className="filters">
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            placeholder="搜索公司名…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit">搜索</button>
        </form>
        <select value={stage} onChange={(e) => setStage(e.target.value)}>
          <option value="">全部状态</option>
          <option value="active">跟进中</option>
          <option value="converted">已转化</option>
          <option value="lost">已流失</option>
        </select>
      </div>

      {loading && <p className="hint">加载中…</p>}
      {error && <p className="error">{error}</p>}

      {data && (
        <>
          <table className="data-table">
            <thead>
              <tr>
                <th>公司名称</th>
                <th>统一代码</th>
                <th>大区</th>
                <th>来源</th>
                <th>状态</th>
                <th>最近跟进</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <Link href={`/leads/${lead.id}`}>{lead.company_name}</Link>
                  </td>
                  <td>{lead.unified_code ?? "—"}</td>
                  <td>{lead.region}</td>
                  <td>{SOURCE_LABEL[lead.source] ?? lead.source}</td>
                  <td>
                    <span className={`badge badge-${lead.stage}`}>
                      {STAGE_LABEL[lead.stage] ?? lead.stage}
                    </span>
                  </td>
                  <td>
                    {lead.last_followup_at
                      ? new Date(lead.last_followup_at).toLocaleDateString("zh-CN")
                      : "—"}
                  </td>
                </tr>
              ))}
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">暂无线索</td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="hint">共 {data.total} 条</p>
        </>
      )}

      <style jsx>{`
        .page { padding: 24px; }
        .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        h2 { font-size: 18px; font-weight: 600; }
        .btn-primary {
          background: var(--color-primary);
          color: #fff;
          padding: 8px 16px;
          border-radius: var(--radius);
          text-decoration: none;
          font-size: 14px;
        }
        .filters { display: flex; gap: 12px; margin-bottom: 16px; }
        .search-form { display: flex; gap: 8px; }
        input[type="text"] {
          padding: 6px 10px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          width: 200px;
        }
        button, select {
          padding: 6px 12px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          background: var(--color-surface);
          cursor: pointer;
        }
        .data-table { width: 100%; border-collapse: collapse; background: var(--color-surface); border-radius: var(--radius); overflow: hidden; }
        .data-table th, .data-table td { padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--color-border); }
        .data-table th { font-weight: 500; color: var(--color-text-secondary); font-size: 13px; }
        .data-table a { color: var(--color-primary); text-decoration: none; }
        .badge { padding: 2px 8px; border-radius: 10px; font-size: 12px; }
        .badge-active { background: #e6f4ff; color: #1677ff; }
        .badge-converted { background: #f6ffed; color: #52c41a; }
        .badge-lost { background: #fff2f0; color: #ff4d4f; }
        .empty { text-align: center; color: var(--color-text-secondary); }
        .hint { color: var(--color-text-secondary); font-size: 13px; margin-top: 8px; }
        .error { color: #e53e3e; }
      `}</style>
    </div>
  );
}
