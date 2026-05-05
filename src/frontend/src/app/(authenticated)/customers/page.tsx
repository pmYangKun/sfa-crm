'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { Customer, PaginatedResponse } from '@/types';

export default function CustomersPage() {
  const pathname = usePathname();
  const isMobile = pathname?.startsWith('/m/');
  const detailPrefix = isMobile ? '/m/customers' : '/customers';
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchCustomers = async (p: number, q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), size: '20' });
      if (q) params.set('search', q);
      const res = await api.get<PaginatedResponse<Customer>>(`/customers?${params}`);
      setCustomers(res.items);
      setTotal(res.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCustomers(page, search); }, [page]);

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>我的客户</h1>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <input placeholder="搜索公司名..." value={search} onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchCustomers(1, search)}
          style={{ padding: '6px 12px', border: '1px solid #d9d9d9', borderRadius: 4, width: 240 }} />
        <button onClick={() => { setPage(1); fetchCustomers(1, search); }}
          style={{ padding: '6px 16px', background: '#fff', border: '1px solid #d9d9d9', borderRadius: 4, cursor: 'pointer' }}>
          搜索
        </button>
      </div>
      {loading ? <p>加载中...</p> : isMobile ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {customers.map((c) => (
              <Link
                key={c.id}
                href={`${detailPrefix}/${c.id}`}
                style={{
                  display: 'block',
                  background: '#fff',
                  border: '1px solid #f0f0f0',
                  borderRadius: 10,
                  padding: '14px 14px 12px',
                  textDecoration: 'none',
                  color: 'inherit',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#1890ff', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.company_name}
                  </div>
                  {c.conversion_window?.in_window && (
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: '#fff7e6', color: '#fa8c16', flexShrink: 0 }}>
                      剩 {c.conversion_window.days_remaining}d
                    </span>
                  )}
                </div>
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: 12, color: '#595959' }}>
                  <span>📍 {c.region}</span>
                  <span>🏷️ {c.source}</span>
                  <span>👤 {c.owner?.name || '-'}</span>
                </div>
                <div style={{ marginTop: 6, fontSize: 11, color: '#999' }}>
                  创建：{new Date(c.created_at).toLocaleDateString()}
                </div>
              </Link>
            ))}
            {customers.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center', color: '#999', background: '#fff', borderRadius: 8 }}>暂无客户</div>
            )}
          </div>
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#999' }}>共 {total} 条</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: '4px 12px', border: '1px solid #d9d9d9', borderRadius: 4 }}>上一页</button>
              <span style={{ padding: '4px 8px' }}>第 {page} 页</span>
              <button disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)} style={{ padding: '4px 12px', border: '1px solid #d9d9d9', borderRadius: 4 }}>下一页</button>
            </div>
          </div>
        </>
      ) : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>公司名称</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>大区</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>来源</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>负责人</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>转化窗口</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <Link href={`${detailPrefix}/${c.id}`} style={{ color: '#1890ff' }}>{c.company_name}</Link>
                  </td>
                  <td style={{ padding: '12px 16px' }}>{c.region}</td>
                  <td style={{ padding: '12px 16px' }}>{c.source}</td>
                  <td style={{ padding: '12px 16px' }}>{c.owner?.name || '-'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    {c.conversion_window?.in_window ? (
                      <span style={{ color: '#faad14' }}>剩余 {c.conversion_window.days_remaining} 天</span>
                    ) : (
                      <span style={{ color: '#999' }}>已关闭</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#999' }}>{new Date(c.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#999' }}>暂无客户</td></tr>
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
