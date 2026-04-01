'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { AuditLogEntry, PaginatedResponse } from '@/types';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const loadLogs = async (p: number) => {
    setLoading(true);
    try {
      const res = await api.get<PaginatedResponse<AuditLogEntry>>(`/audit-logs?page=${p}&size=20`);
      setLogs(res.items);
      setTotal(res.total);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadLogs(page); }, [page]);

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>操作日志</h1>
      <div style={{ background: '#fff', borderRadius: 8 }}>
        {loading ? <p style={{ padding: 24 }}>加载中...</p> : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>操作</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>对象类型</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>对象ID</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>IP</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>时间</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>{log.action}</td>
                    <td style={{ padding: '12px 16px' }}>{log.entity_type || '-'}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12 }}>{log.entity_id ? log.entity_id.substring(0, 8) + '...' : '-'}</td>
                    <td style={{ padding: '12px 16px', color: '#999' }}>{log.ip || '-'}</td>
                    <td style={{ padding: '12px 16px', color: '#999' }}>{new Date(log.created_at).toLocaleString()}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#999' }}>暂无操作日志</td></tr>
                )}
              </tbody>
            </table>
            <div style={{ padding: 16, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#999' }}>共 {total} 条</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: '4px 12px', border: '1px solid #d9d9d9', borderRadius: 4 }}>上一页</button>
                <span style={{ padding: '4px 8px' }}>第 {page} 页</span>
                <button disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)} style={{ padding: '4px 12px', border: '1px solid #d9d9d9', borderRadius: 4 }}>下一页</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
