'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Customer } from '@/types';

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Customer>(`/customers/${id}`)
      .then(setCustomer)
      .catch(() => router.push('/customers'))
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading) return <p>加载中...</p>;
  if (!customer) return <p>客户不存在</p>;

  return (
    <div>
      <button onClick={() => router.back()} style={{
        padding: '6px 16px', background: '#fff', border: '1px solid #d9d9d9',
        borderRadius: 4, cursor: 'pointer', marginBottom: 16,
      }}>← 返回</button>

      <div style={{ background: '#fff', padding: 24, borderRadius: 8, marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, marginBottom: 16 }}>{customer.company_name}</h1>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ color: '#999', fontSize: 13 }}>大区</div>
            <div>{customer.region}</div>
          </div>
          <div>
            <div style={{ color: '#999', fontSize: 13 }}>来源</div>
            <div>{customer.source}</div>
          </div>
          <div>
            <div style={{ color: '#999', fontSize: 13 }}>负责人</div>
            <div>{customer.owner?.name || '-'}</div>
          </div>
          <div>
            <div style={{ color: '#999', fontSize: 13 }}>组织机构代码</div>
            <div>{customer.unified_code || '-'}</div>
          </div>
          <div>
            <div style={{ color: '#999', fontSize: 13 }}>创建时间</div>
            <div>{new Date(customer.created_at).toLocaleString()}</div>
          </div>
        </div>
      </div>

      {customer.conversion_window?.in_window && (
        <div style={{
          background: '#fffbe6', border: '1px solid #ffe58f', padding: 16,
          borderRadius: 8, marginBottom: 24,
        }}>
          <h3 style={{ fontSize: 16, marginBottom: 8 }}>转化窗口</h3>
          <p>剩余 <strong>{customer.conversion_window.days_remaining}</strong> 天</p>
          <p>大课购买：{customer.conversion_window.has_big_course ? '已购买' : '未购买'}</p>
        </div>
      )}
    </div>
  );
}
