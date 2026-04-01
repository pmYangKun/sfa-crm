"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface AuditLogEntry {
  id: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  payload: string | null;
  ip: string | null;
  created_at: string;
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterEntity, setFilterEntity] = useState("");
  const [filterUser, setFilterUser] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function fetchLogs() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (filterEntity) params.set("entity_type", filterEntity);
      if (filterUser) params.set("user_id", filterUser);
      setLogs(await api.get<AuditLogEntry[]>(`/audit-logs?${params}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchLogs(); }, []);

  return (
    <div className="page">
      <div className="page-header">
        <h2>操作日志</h2>
        <button className="btn-refresh" onClick={fetchLogs}>刷新</button>
      </div>

      <div className="filters card">
        <input
          placeholder="按实体类型筛选（如 lead、customer）"
          value={filterEntity}
          onChange={e => setFilterEntity(e.target.value)}
        />
        <input
          placeholder="按用户 ID 筛选"
          value={filterUser}
          onChange={e => setFilterUser(e.target.value)}
        />
        <button className="btn-primary" onClick={fetchLogs}>查询</button>
      </div>

      {loading && <p className="hint">加载中…</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && (
        <div className="card">
          <table className="log-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>操作人</th>
                <th>操作</th>
                <th>实体类型</th>
                <th>实体 ID</th>
                <th>IP</th>
                <th>详情</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <>
                  <tr key={log.id}>
                    <td className="time">{log.created_at.slice(0, 19).replace("T", " ")}</td>
                    <td>{log.user_name ?? log.user_id ?? "—"}</td>
                    <td><code>{log.action}</code></td>
                    <td>{log.entity_type ?? "—"}</td>
                    <td className="entity-id">{log.entity_id ? log.entity_id.slice(0, 8) + "…" : "—"}</td>
                    <td>{log.ip ?? "—"}</td>
                    <td>
                      {log.payload && (
                        <button
                          className="btn-detail"
                          onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                        >
                          {expandedId === log.id ? "收起" : "展开"}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedId === log.id && log.payload && (
                    <tr key={`${log.id}-detail`}>
                      <td colSpan={7} className="payload-row">
                        <pre className="payload">{JSON.stringify(JSON.parse(log.payload), null, 2)}</pre>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={7} className="empty">暂无日志</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <style jsx>{`
        .page { padding: 24px; max-width: 1100px; }
        .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        h2 { font-size: 18px; font-weight: 600; }
        .card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); padding: 16px; margin-bottom: 12px; }
        .filters { display: flex; gap: 10px; align-items: center; }
        .filters input { flex: 1; padding: 7px 10px; border: 1px solid var(--color-border); border-radius: var(--radius); font-size: 13px; }
        .btn-primary { background: var(--color-primary); color: #fff; border: none; padding: 7px 16px; border-radius: var(--radius); cursor: pointer; font-size: 13px; white-space: nowrap; }
        .btn-refresh { background: none; border: 1px solid var(--color-border); padding: 5px 12px; border-radius: var(--radius); font-size: 12px; cursor: pointer; }
        .log-table { width: 100%; border-collapse: collapse; }
        .log-table th, .log-table td { padding: 9px 10px; text-align: left; border-bottom: 1px solid var(--color-border); font-size: 12px; }
        .log-table th { font-weight: 500; color: var(--color-text-secondary); }
        .time { white-space: nowrap; color: var(--color-text-secondary); }
        .entity-id { font-family: monospace; font-size: 11px; }
        code { font-size: 11px; background: #f5f5f5; padding: 1px 5px; border-radius: 3px; }
        .btn-detail { background: none; border: 1px solid var(--color-border); padding: 2px 8px; border-radius: var(--radius); font-size: 11px; cursor: pointer; }
        .payload-row { background: #fafafa; }
        .payload { font-size: 11px; margin: 0; padding: 8px; overflow-x: auto; }
        .empty { text-align: center; color: var(--color-text-secondary); }
        .hint { color: var(--color-text-secondary); font-size: 13px; }
        .error { color: #e53e3e; font-size: 13px; }
      `}</style>
    </div>
  );
}
