'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Lead, Contact } from '@/types';

interface LeadDetail extends Lead {
  contacts: Contact[];
}

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<LeadDetail>(`/leads/${id}`)
      .then(setLead)
      .catch(() => router.push('/leads'))
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading) return <p>加载中...</p>;
  if (!lead) return <p>线索不存在</p>;

  const stageLabel = { active: '活跃', converted: '已转化', lost: '已流失' }[lead.stage] || lead.stage;
  const sourceLabel = { referral: '转介绍', organic: '自然流量', koc_sem: 'KOC/SEM', outbound: '外呼' }[lead.source] || lead.source;

  return (
    <div>
      <button onClick={() => router.back()} style={{
        padding: '6px 16px', background: '#fff', border: '1px solid #d9d9d9',
        borderRadius: 4, cursor: 'pointer', marginBottom: 16,
      }}>
        ← 返回
      </button>

      <div style={{ background: '#fff', padding: 24, borderRadius: 8, marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, marginBottom: 16 }}>{lead.company_name}</h1>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ color: '#999', fontSize: 13 }}>状态</div>
            <div>{stageLabel}</div>
          </div>
          <div>
            <div style={{ color: '#999', fontSize: 13 }}>大区</div>
            <div>{lead.region}</div>
          </div>
          <div>
            <div style={{ color: '#999', fontSize: 13 }}>来源</div>
            <div>{sourceLabel}</div>
          </div>
          <div>
            <div style={{ color: '#999', fontSize: 13 }}>负责人</div>
            <div>{lead.owner?.name || '公共池'}</div>
          </div>
          <div>
            <div style={{ color: '#999', fontSize: 13 }}>组织机构代码</div>
            <div>{lead.unified_code || '-'}</div>
          </div>
          <div>
            <div style={{ color: '#999', fontSize: 13 }}>创建时间</div>
            <div>{new Date(lead.created_at).toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div style={{ background: '#fff', padding: 24, borderRadius: 8 }}>
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>联系人</h2>
        {lead.contacts.length === 0 ? (
          <p style={{ color: '#999' }}>暂无联系人</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>姓名</th>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>职务</th>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>手机</th>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>微信</th>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>KP</th>
              </tr>
            </thead>
            <tbody>
              {lead.contacts.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '8px 12px' }}>{c.name}</td>
                  <td style={{ padding: '8px 12px' }}>{c.role || '-'}</td>
                  <td style={{ padding: '8px 12px' }}>{c.phone || '-'}</td>
                  <td style={{ padding: '8px 12px' }}>{c.wechat_id || '-'}</td>
                  <td style={{ padding: '8px 12px' }}>{c.is_key_decision_maker ? '是' : '否'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
