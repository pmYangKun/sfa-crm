'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { DailyReport, PaginatedResponse } from '@/types';

export default function TeamReportsPage() {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<PaginatedResponse<DailyReport>>('/reports/team?size=50')
      .then(res => setReports(res.items))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>加载中...</p>;

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>团队日报</h1>
      <div style={{ background: '#fff', padding: 24, borderRadius: 8 }}>
        {reports.length === 0 ? <p style={{ color: '#999' }}>暂无团队日报</p> : (
          <div>
            {reports.map(r => (
              <div key={r.id} style={{ padding: '16px 0', borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontWeight: 500 }}>{r.report_date}</span>
                  <span style={{ color: '#999', fontSize: 13 }}>用户: {r.owner_id.substring(0, 8)}...</span>
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
