'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { Lead, PaginatedResponse } from '@/types';

export default function PublicPoolPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  const fetchLeads = async (p: number) => {
    setLoading(true);
    try {
      const res = await api.get<PaginatedResponse<Lead>>(`/leads?pool=public&page=${p}&size=20`);
      setLeads(res.items);
      setTotal(res.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLeads(page); }, [page]);

  const handleClaim = async (leadId: string) => {
    setClaiming(leadId);
    try {
      await api.post(`/leads/${leadId}/claim`);
      fetchLeads(page);
    } catch (err) {
      if (err instanceof ApiError) {
        alert(err.message);
      }
    } finally {
      setClaiming(null);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>公共线索库</h1>
      {loading ? <p>加载中...</p> : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>公司名称</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>大区</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>来源</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>创建时间</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <Link href={`/leads/${lead.id}`} style={{ color: '#1890ff' }}>{lead.company_name}</Link>
                  </td>
                  <td style={{ padding: '12px 16px' }}>{lead.region}</td>
                  <td style={{ padding: '12px 16px' }}>{lead.source}</td>
                  <td style={{ padding: '12px 16px', color: '#999' }}>{new Date(lead.created_at).toLocaleDateString()}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <button
                      onClick={() => handleClaim(lead.id)}
                      disabled={claiming === lead.id}
                      style={{
                        padding: '4px 12px', background: '#52c41a', color: '#fff',
                        border: 'none', borderRadius: 4, cursor: claiming === lead.id ? 'not-allowed' : 'pointer',
                        fontSize: 13,
                      }}
                    >
                      {claiming === lead.id ? '抢占中...' : '抢占'}
                    </button>
                  </td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#999' }}>公共池暂无线索</td></tr>
              )}
            </tbody>
          </table>
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between' }}>
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
  );
}
