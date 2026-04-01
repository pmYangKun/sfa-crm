"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Customer, PaginatedResponse } from "@/types";

const SOURCE_LABEL: Record<string, string> = {
  referral: "转介绍",
  organic: "自然流量",
  koc_sem: "KOC/SEM",
  outbound: "外呼",
};

export default function CustomersPage() {
  const [data, setData] = useState<PaginatedResponse<Customer> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("");

  async function fetchCustomers() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: "1", page_size: "20" });
      if (search) params.set("search", search);
      if (region) params.set("region", region);
      const result = await api.get<PaginatedResponse<Customer>>(`/customers?${params}`);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCustomers();
  }, [region]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchCustomers();
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>我的客户</h2>
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
                <th>转化时间</th>
                <th>转化天数</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/customers/${c.id}`}>{c.company_name}</Link>
                  </td>
                  <td>{c.unified_code ?? "—"}</td>
                  <td>{c.region}</td>
                  <td>{SOURCE_LABEL[c.source] ?? c.source}</td>
                  <td>{new Date(c.created_at).toLocaleDateString("zh-CN")}</td>
                  <td>
                    <span className={`days-badge ${c.days_since_conversion > 90 ? "days-old" : "days-fresh"}`}>
                      {c.days_since_conversion} 天
                    </span>
                  </td>
                </tr>
              ))}
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">暂无客户</td>
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
        .data-table { width: 100%; border-collapse: collapse; background: var(--color-surface); border-radius: var(--radius); overflow: hidden; }
        .data-table th, .data-table td { padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--color-border); }
        .data-table th { font-weight: 500; color: var(--color-text-secondary); font-size: 13px; }
        .data-table a { color: var(--color-primary); text-decoration: none; }
        .days-badge { padding: 2px 8px; border-radius: 10px; font-size: 12px; }
        .days-fresh { background: #f6ffed; color: #52c41a; }
        .days-old { background: #fff7e6; color: #d46b08; }
        .empty { text-align: center; color: var(--color-text-secondary); }
        .hint { color: var(--color-text-secondary); font-size: 13px; margin-top: 8px; }
        .error { color: #e53e3e; }
      `}</style>
    </div>
  );
}
