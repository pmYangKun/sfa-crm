"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface DailyReport {
  id: string;
  owner_id: string;
  report_date: string;
  content: string;
  status: "draft" | "submitted";
  submitted_at: string | null;
  created_at: string;
}

export default function TeamReportsPage() {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expanded, setExpanded] = useState<string | null>(null);

  async function fetchReports() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<DailyReport[]>(`/reports/team?report_date=${date}`);
      setReports(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchReports(); }, [date]);

  const submitted = reports.filter(r => r.status === "submitted").length;

  return (
    <div className="page">
      <div className="page-header">
        <h2>团队日报</h2>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="date-picker"
        />
      </div>

      {loading && <p className="hint">加载中…</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && (
        <>
          <p className="summary">共 {reports.length} 人，已提交 {submitted} 人</p>
          {reports.length === 0 ? (
            <p className="hint">当日暂无日报</p>
          ) : (
            <ul className="report-list">
              {reports.map((r) => (
                <li key={r.id} className="report-item">
                  <div
                    className="report-header"
                    onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                  >
                    <div className="report-info">
                      <span className="owner-id">{r.owner_id.slice(0, 8)}…</span>
                      <span className={`status-tag ${r.status}`}>
                        {r.status === "submitted" ? "已提交" : "草稿"}
                      </span>
                      {r.submitted_at && (
                        <span className="submit-time">
                          {new Date(r.submitted_at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })} 提交
                        </span>
                      )}
                    </div>
                    <span className="expand-icon">{expanded === r.id ? "▲" : "▼"}</span>
                  </div>
                  {expanded === r.id && (
                    <pre className="report-content">{r.content}</pre>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <style jsx>{`
        .page { padding: 24px; max-width: 720px; }
        .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        h2 { font-size: 18px; font-weight: 600; }
        .date-picker { padding: 6px 10px; border: 1px solid var(--color-border); border-radius: var(--radius); font-size: 13px; }
        .summary { font-size: 13px; color: var(--color-text-secondary); margin-bottom: 12px; }
        .report-list { list-style: none; padding: 0; margin: 0; }
        .report-item { border: 1px solid var(--color-border); border-radius: var(--radius); margin-bottom: 8px; background: var(--color-surface); overflow: hidden; }
        .report-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; cursor: pointer; user-select: none; }
        .report-info { display: flex; align-items: center; gap: 10px; }
        .owner-id { font-size: 13px; font-family: monospace; color: var(--color-text-secondary); }
        .status-tag { padding: 1px 8px; border-radius: 10px; font-size: 12px; }
        .status-tag.draft { background: #fff7e6; color: #d46b08; }
        .status-tag.submitted { background: #f6ffed; color: #52c41a; }
        .submit-time { font-size: 12px; color: var(--color-text-secondary); }
        .expand-icon { font-size: 11px; color: var(--color-text-secondary); }
        .report-content { padding: 12px 16px; background: #fafafa; border-top: 1px solid var(--color-border); font-size: 13px; font-family: inherit; white-space: pre-wrap; margin: 0; }
        .hint { color: var(--color-text-secondary); font-size: 13px; }
        .error { color: #e53e3e; font-size: 13px; }
      `}</style>
    </div>
  );
}
