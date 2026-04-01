'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Lead, PaginatedResponse } from '@/types';

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchLeads = async (p: number, q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), size: '20' });
      if (q) params.set('search', q);
      const res = await api.get<PaginatedResponse<Lead>>(`/leads?${params}`);
      setLeads(res.items);
      setTotal(res.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLeads(page, search); }, [page]);

  const handleSearch = () => { setPage(1); fetchLeads(1, search); };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24 }}>我的线索</h1>
        <Link href="/leads/new">
          <button style={{
            padding: '8px 16px', background: '#1890ff', color: '#fff',
            border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14,
          }}>
            新建线索
          </button>
        </Link>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <input
          placeholder="搜索公司名..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          style={{ padding: '6px 12px', border: '1px solid #d9d9d9', borderRadius: 4, width: 240 }}
        />
        <button onClick={handleSearch} style={{
          padding: '6px 16px', background: '#fff', border: '1px solid #d9d9d9',
          borderRadius: 4, cursor: 'pointer',
        }}>
          搜索
        </button>
      </div>

      {loading ? (
        <p>加载中...</p>
      ) : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>公司名称</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>大区</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>来源</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>状态</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>负责人</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>最后跟进</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <Link href={`/leads/${lead.id}`} style={{ color: '#1890ff' }}>
                      {lead.company_name}
                    </Link>
                  </td>
                  <td style={{ padding: '12px 16px' }}>{lead.region}</td>
                  <td style={{ padding: '12px 16px' }}>{lead.source}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 12,
                      background: lead.stage === 'active' ? '#e6f7ff' : lead.stage === 'converted' ? '#f6ffed' : '#fff1f0',
                      color: lead.stage === 'active' ? '#1890ff' : lead.stage === 'converted' ? '#52c41a' : '#ff4d4f',
                    }}>
                      {lead.stage === 'active' ? '活跃' : lead.stage === 'converted' ? '已转化' : '已流失'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>{lead.owner?.name || '公共池'}</td>
                  <td style={{ padding: '12px 16px', color: '#999' }}>
                    {lead.last_followup_at ? new Date(lead.last_followup_at).toLocaleDateString() : '-'}
                  </td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#999' }}>暂无线索</td></tr>
              )}
            </tbody>
          </table>
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#999' }}>共 {total} 条</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                style={{ padding: '4px 12px', border: '1px solid #d9d9d9', borderRadius: 4, cursor: page > 1 ? 'pointer' : 'not-allowed' }}>
                上一页
              </button>
              <span style={{ padding: '4px 8px' }}>第 {page} 页</span>
              <button disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)}
                style={{ padding: '4px 12px', border: '1px solid #d9d9d9', borderRadius: 4, cursor: page * 20 < total ? 'pointer' : 'not-allowed' }}>
                下一页
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
