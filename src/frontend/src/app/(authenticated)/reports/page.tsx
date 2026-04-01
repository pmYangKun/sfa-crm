'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { DailyReport, PaginatedResponse } from '@/types';

export default function ReportsPage() {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [draft, setDraft] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [draftContent, setDraftContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      const [reportsRes, draftRes] = await Promise.all([
        api.get<PaginatedResponse<DailyReport>>('/reports/daily?size=50'),
        api.get<DailyReport | null>('/reports/daily/today-draft'),
      ]);
      setReports(reportsRes.items);
      if (draftRes) {
        setDraft(draftRes);
        setDraftContent(draftRes.content);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleSubmit = async () => {
    if (!draft) return;
    setSubmitting(true);
    try {
      await api.post(`/reports/daily/${draft.id}/submit`, { content: draftContent });
      loadData();
    } catch (err) {
      if (err instanceof ApiError) alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p>加载中...</p>;

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>我的日报</h1>

      {draft && draft.status === 'draft' && (
        <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', padding: 24, borderRadius: 8, marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>今日草稿 ({draft.report_date})</h2>
          <textarea
            value={draftContent}
            onChange={e => setDraftContent(e.target.value)}
            rows={8}
            style={{ width: '100%', padding: 12, border: '1px solid #d9d9d9', borderRadius: 4, fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }}
          />
          <button onClick={handleSubmit} disabled={submitting} style={{
            marginTop: 12, padding: '8px 24px', background: '#1890ff', color: '#fff',
            border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14,
          }}>
            {submitting ? '提交中...' : '提交日报'}
          </button>
        </div>
      )}

      <div style={{ background: '#fff', padding: 24, borderRadius: 8 }}>
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>历史日报</h2>
        {reports.length === 0 ? <p style={{ color: '#999' }}>暂无日报</p> : (
          <div>
            {reports.map(r => (
              <div key={r.id} style={{ padding: '16px 0', borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontWeight: 500 }}>{r.report_date}</span>
                  <span style={{
                    padding: '2px 8px', borderRadius: 4, fontSize: 12,
                    background: r.status === 'submitted' ? '#f6ffed' : '#fffbe6',
                    color: r.status === 'submitted' ? '#52c41a' : '#faad14',
                  }}>
                    {r.status === 'submitted' ? '已提交' : '草稿'}
                  </span>
                </div>
                <pre style={{ fontSize: 14, whiteSpace: 'pre-wrap', color: '#555' }}>{r.content}</pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
