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

export default function MyReportsPage() {
  const [todayDraft, setTodayDraft] = useState<DailyReport | null>(null);
  const [history, setHistory] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    try {
      const [draft, hist] = await Promise.all([
        api.get<DailyReport>("/reports/daily/today-draft").catch(() => null),
        api.get<DailyReport[]>("/reports/daily").catch(() => []),
      ]);
      setTodayDraft(draft);
      if (draft) setEditContent(draft.content);
      setHistory(hist);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  async function handleSave() {
    if (!todayDraft) return;
    setSaving(true);
    setMsg(null);
    try {
      const updated = await api.patch<DailyReport>(`/reports/daily/${todayDraft.id}`, { content: editContent });
      setTodayDraft(updated);
      setMsg("已保存");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    if (!todayDraft) return;
    setSubmitting(true);
    setMsg(null);
    try {
      const updated = await api.post<DailyReport>(`/reports/daily/${todayDraft.id}/submit`, {});
      setTodayDraft(updated);
      setMsg("已提交");
      loadAll();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="page"><p className="hint">加载中…</p></div>;

  return (
    <div className="page">
      <div className="page-header"><h2>我的日报</h2></div>

      {/* Today's draft */}
      <div className="card">
        <h3>今日日报</h3>
        {todayDraft ? (
          <>
            <div className="report-meta">
              <span>{todayDraft.report_date}</span>
              <span className={`status-tag ${todayDraft.status}`}>
                {todayDraft.status === "draft" ? "草稿" : "已提交"}
              </span>
            </div>
            {todayDraft.status === "draft" ? (
              <>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={10}
                />
                {msg && <p className={msg.includes("失败") ? "error" : "success-msg"}>{msg}</p>}
                <div className="actions">
                  <button onClick={handleSave} disabled={saving} className="btn-secondary">
                    {saving ? "保存中…" : "保存草稿"}
                  </button>
                  <button onClick={handleSubmit} disabled={submitting} className="btn-primary">
                    {submitting ? "提交中…" : "提交日报"}
                  </button>
                </div>
              </>
            ) : (
              <pre className="report-content">{todayDraft.content}</pre>
            )}
          </>
        ) : (
          <p className="hint">今日暂无日报草稿（将于 18:00 自动生成）</p>
        )}
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="card">
          <h3>历史日报</h3>
          <ul className="report-list">
            {history.filter(r => r.id !== todayDraft?.id).map((r) => (
              <li key={r.id} className="report-item">
                <div className="report-item-header">
                  <span className="report-date">{r.report_date}</span>
                  <span className={`status-tag ${r.status}`}>
                    {r.status === "draft" ? "草稿" : "已提交"}
                  </span>
                </div>
                <pre className="report-preview">{r.content.slice(0, 120)}{r.content.length > 120 ? "…" : ""}</pre>
              </li>
            ))}
          </ul>
        </div>
      )}

      <style jsx>{`
        .page { padding: 24px; max-width: 680px; }
        .page-header { margin-bottom: 16px; }
        h2 { font-size: 18px; font-weight: 600; }
        .card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); padding: 20px; margin-bottom: 16px; }
        h3 { font-size: 13px; font-weight: 600; color: var(--color-text-secondary); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
        .report-meta { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; font-size: 13px; }
        .status-tag { padding: 1px 8px; border-radius: 10px; font-size: 12px; }
        .status-tag.draft { background: #fff7e6; color: #d46b08; }
        .status-tag.submitted { background: #f6ffed; color: #52c41a; }
        textarea {
          width: 100%; box-sizing: border-box;
          padding: 10px; border: 1px solid var(--color-border); border-radius: var(--radius);
          font-size: 13px; font-family: inherit; resize: vertical;
        }
        .actions { display: flex; gap: 10px; margin-top: 10px; }
        .btn-primary { background: var(--color-primary); color: #fff; border: none; padding: 7px 16px; border-radius: var(--radius); cursor: pointer; font-size: 13px; }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-secondary { background: var(--color-surface); border: 1px solid var(--color-border); padding: 7px 16px; border-radius: var(--radius); cursor: pointer; font-size: 13px; }
        .report-content { font-size: 13px; font-family: inherit; white-space: pre-wrap; margin: 0; }
        .report-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 12px; }
        .report-item { border-bottom: 1px solid var(--color-border); padding-bottom: 12px; }
        .report-item-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
        .report-date { font-size: 13px; font-weight: 500; }
        .report-preview { font-size: 12px; color: var(--color-text-secondary); white-space: pre-wrap; margin: 0; font-family: inherit; }
        .hint { color: var(--color-text-secondary); font-size: 13px; }
        .error { color: #e53e3e; font-size: 13px; margin-top: 6px; }
        .success-msg { color: #38a169; font-size: 13px; margin-top: 6px; }
      `}</style>
    </div>
  );
}
