"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Lead, PaginatedResponse } from "@/types";

const SOURCE_LABEL: Record<string, string> = {
  referral: "转介绍",
  organic: "自然流量",
  koc_sem: "KOC/SEM",
  outbound: "外呼",
};

export default function PublicPoolPage() {
  const [data, setData] = useState<PaginatedResponse<Lead> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("");
  const [claiming, setClaiming] = useState<string | null>(null);
  const [claimMsg, setClaimMsg] = useState<string | null>(null);

  async function fetchPool() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ pool: "public", stage: "active", page: "1", page_size: "20" });
      if (search) params.set("search", search);
      if (region) params.set("region", region);
      const result = await api.get<PaginatedResponse<Lead>>(`/leads?${params}`);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPool();
  }, [region]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchPool();
  }

  async function handleClaim(leadId: string) {
    setClaiming(leadId);
    setClaimMsg(null);
    try {
      await api.post(`/leads/${leadId}/claim`, {});
      setClaimMsg("抢占成功！");
      fetchPool();
    } catch (e) {
      setClaimMsg(e instanceof Error ? e.message : "抢占失败");
    } finally {
      setClaiming(null);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>公共线索库</h2>
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
        <input
          type="text"
          placeholder="大区筛选…"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="region-input"
        />
      </div>

      {claimMsg && (
        <p className={claimMsg.includes("成功") ? "success-msg" : "error"}>{claimMsg}</p>
      )}

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
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((lead) => (
                <tr key={lead.id}>
                  <td>{lead.company_name}</td>
                  <td>{lead.unified_code ?? "—"}</td>
                  <td>{lead.region}</td>
                  <td>{SOURCE_LABEL[lead.source] ?? lead.source}</td>
                  <td>{new Date(lead.created_at).toLocaleDateString("zh-CN")}</td>
                  <td>
                    <button
                      className="btn-claim"
                      disabled={claiming === lead.id}
                      onClick={() => handleClaim(lead.id)}
                    >
                      {claiming === lead.id ? "抢占中…" : "抢占"}
                    </button>
                  </td>
                </tr>
              ))}
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">公共池暂无线索</td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="hint">共 {data.total} 条</p>
        </>
      )}

      <style jsx>{`
        .page { padding: 24px; }
        .page-header { margin-bottom: 16px; }
        h2 { font-size: 18px; font-weight: 600; }
        .filters { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
        .search-form { display: flex; gap: 8px; }
        input[type="text"], .region-input {
          padding: 6px 10px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          width: 180px;
        }
        button {
          padding: 6px 12px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          background: var(--color-surface);
          cursor: pointer;
        }
        .btn-claim {
          background: var(--color-primary);
          color: #fff;
          border-color: var(--color-primary);
          padding: 4px 12px;
          font-size: 13px;
        }
        .btn-claim:disabled { opacity: 0.6; cursor: not-allowed; }
        .data-table { width: 100%; border-collapse: collapse; background: var(--color-surface); border-radius: var(--radius); overflow: hidden; }
        .data-table th, .data-table td { padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--color-border); }
        .data-table th { font-weight: 500; color: var(--color-text-secondary); font-size: 13px; }
        .empty { text-align: center; color: var(--color-text-secondary); }
        .hint { color: var(--color-text-secondary); font-size: 13px; margin-top: 8px; }
        .error { color: #e53e3e; margin-bottom: 12px; }
        .success-msg { color: #38a169; margin-bottom: 12px; }
      `}</style>
    </div>
  );
}
