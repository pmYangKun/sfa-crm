'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { Lead, PaginatedResponse } from '@/types';

export default function TeamLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [salesId, setSalesId] = useState('');

  const fetchLeads = async (p: number) => {
    setLoading(true);
    try {
      const res = await api.get<PaginatedResponse<Lead>>(`/leads?page=${p}&size=20`);
      setLeads(res.items);
      setTotal(res.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLeads(page); }, [page]);

  const handleAssign = async (leadId: string) => {
    if (!salesId.trim()) { alert('请输入销售ID'); return; }
    try {
      await api.post(`/leads/${leadId}/assign`, { sales_id: salesId });
      setAssigningId(null);
      setSalesId('');
      fetchLeads(page);
    } catch (err) {
      if (err instanceof ApiError) alert(err.message);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>团队线索</h1>
      {loading ? <p>加载中...</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left' }}>公司名称</th>
              <th style={{ padding: '12px 16px', textAlign: 'left' }}>大区</th>
              <th style={{ padding: '12px 16px', textAlign: 'left' }}>负责人</th>
              <th style={{ padding: '12px 16px', textAlign: 'left' }}>池</th>
              <th style={{ padding: '12px 16px', textAlign: 'left' }}>最后跟进</th>
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
                <td style={{ padding: '12px 16px' }}>{lead.owner?.name || '-'}</td>
                <td style={{ padding: '12px 16px' }}>{lead.pool === 'public' ? '公共' : '私有'}</td>
                <td style={{ padding: '12px 16px', color: '#999' }}>
                  {lead.last_followup_at ? new Date(lead.last_followup_at).toLocaleDateString() : '-'}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  {assigningId === lead.id ? (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <input placeholder="销售ID" value={salesId} onChange={e => setSalesId(e.target.value)}
                        style={{ width: 120, padding: '4px 8px', border: '1px solid #d9d9d9', borderRadius: 4, fontSize: 13 }} />
                      <button onClick={() => handleAssign(lead.id)} style={{
                        padding: '4px 8px', background: '#1890ff', color: '#fff',
                        border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13,
                      }}>确认</button>
                      <button onClick={() => setAssigningId(null)} style={{
                        padding: '4px 8px', background: '#fff', border: '1px solid #d9d9d9',
                        borderRadius: 4, cursor: 'pointer', fontSize: 13,
                      }}>取消</button>
                    </div>
                  ) : (
                    <button onClick={() => setAssigningId(lead.id)} style={{
                      padding: '4px 12px', background: '#1890ff', color: '#fff',
                      border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13,
                    }}>分配</button>
                  )}
                </td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#999' }}>暂无线索</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
