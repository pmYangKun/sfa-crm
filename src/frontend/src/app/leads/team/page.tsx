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

const POOL_LABEL: Record<string, string> = {
  private: "私有",
  public: "公共池",
};

export default function TeamLeadsPage() {
  const [data, setData] = useState<PaginatedResponse<Lead> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("");

  // Assign modal state
  const [assigningLead, setAssigningLead] = useState<Lead | null>(null);
  const [assigneeId, setAssigneeId] = useState("");
  const [assignMsg, setAssignMsg] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  async function fetchLeads() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: "1", page_size: "50" });
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

  async function handleAssign() {
    if (!assigningLead || !assigneeId.trim()) return;
    setAssigning(true);
    setAssignMsg(null);
    try {
      await api.post(`/leads/${assigningLead.id}/assign`, { assignee_id: assigneeId.trim() });
      setAssignMsg("分配成功");
      setAssigningLead(null);
      setAssigneeId("");
      fetchLeads();
    } catch (e) {
      setAssignMsg(e instanceof Error ? e.message : "分配失败");
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>团队线索</h2>
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
                <th>大区</th>
                <th>状态</th>
                <th>所属池</th>
                <th>归属人</th>
                <th>最近跟进</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <Link href={`/leads/${lead.id}`}>{lead.company_name}</Link>
                  </td>
                  <td>{lead.region}</td>
                  <td>
                    <span className={`badge badge-${lead.stage}`}>
                      {STAGE_LABEL[lead.stage] ?? lead.stage}
                    </span>
                  </td>
                  <td>
                    <span className={`pool-tag pool-${lead.pool}`}>
                      {POOL_LABEL[lead.pool] ?? lead.pool}
                    </span>
                  </td>
                  <td>{lead.owner_id ?? "—"}</td>
                  <td>
                    {lead.last_followup_at
                      ? new Date(lead.last_followup_at).toLocaleDateString("zh-CN")
                      : "—"}
                  </td>
                  <td>
                    {lead.stage === "active" && (
                      <button
                        className="btn-assign"
                        onClick={() => { setAssigningLead(lead); setAssignMsg(null); }}
                      >
                        分配
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty">暂无线索</td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="hint">共 {data.total} 条</p>
        </>
      )}

      {/* Assign modal */}
      {assigningLead && (
        <div className="modal-overlay" onClick={() => setAssigningLead(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>分配线索</h3>
            <p className="modal-company">{assigningLead.company_name}</p>
            <label>
              受让人 ID
              <input
                type="text"
                placeholder="输入受让人用户 ID"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                autoFocus
              />
            </label>
            {assignMsg && (
              <p className={assignMsg.includes("成功") ? "success-msg" : "error"}>{assignMsg}</p>
            )}
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setAssigningLead(null)}>取消</button>
              <button
                className="btn-primary"
                disabled={assigning || !assigneeId.trim()}
                onClick={handleAssign}
              >
                {assigning ? "分配中…" : "确认分配"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .page { padding: 24px; }
        .page-header { margin-bottom: 16px; }
        h2 { font-size: 18px; font-weight: 600; }
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
        .btn-assign {
          background: #fff7e6;
          color: #d46b08;
          border-color: #ffd591;
          padding: 3px 10px;
          font-size: 12px;
        }
        .btn-primary {
          background: var(--color-primary);
          color: #fff;
          border-color: var(--color-primary);
        }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-cancel { margin-right: 8px; }
        .data-table { width: 100%; border-collapse: collapse; background: var(--color-surface); border-radius: var(--radius); overflow: hidden; }
        .data-table th, .data-table td { padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--color-border); }
        .data-table th { font-weight: 500; color: var(--color-text-secondary); font-size: 13px; }
        .data-table a { color: var(--color-primary); text-decoration: none; }
        .badge { padding: 2px 8px; border-radius: 10px; font-size: 12px; }
        .badge-active { background: #e6f4ff; color: #1677ff; }
        .badge-converted { background: #f6ffed; color: #52c41a; }
        .badge-lost { background: #fff2f0; color: #ff4d4f; }
        .pool-tag { padding: 2px 6px; border-radius: 4px; font-size: 12px; }
        .pool-private { background: #f0f0f0; color: #595959; }
        .pool-public { background: #fff7e6; color: #d46b08; }
        .empty { text-align: center; color: var(--color-text-secondary); }
        .hint { color: var(--color-text-secondary); font-size: 13px; margin-top: 8px; }
        .error { color: #e53e3e; }
        .success-msg { color: #38a169; }

        /* Modal */
        .modal-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.4);
          display: flex; align-items: center; justify-content: center;
          z-index: 100;
        }
        .modal {
          background: #fff;
          border-radius: 8px;
          padding: 24px;
          width: 360px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        }
        .modal h3 { font-size: 16px; font-weight: 600; margin-bottom: 8px; }
        .modal-company { color: var(--color-text-secondary); margin-bottom: 16px; font-size: 13px; }
        .modal label { display: block; font-size: 13px; margin-bottom: 4px; }
        .modal input { width: 100%; margin-top: 4px; margin-bottom: 12px; }
        .modal-actions { display: flex; justify-content: flex-end; margin-top: 8px; }
      `}</style>
    </div>
  );
}
