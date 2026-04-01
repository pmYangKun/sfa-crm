'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';

interface ContactInput {
  name: string;
  role: string;
  is_key_decision_maker: boolean;
  phone: string;
  wechat_id: string;
}

export default function NewLeadPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState('');
  const [unifiedCode, setUnifiedCode] = useState('');
  const [region, setRegion] = useState('华北');
  const [source, setSource] = useState('referral');
  const [contacts, setContacts] = useState<ContactInput[]>([
    { name: '', role: '', is_key_decision_maker: false, phone: '', wechat_id: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState('');

  const addContact = () => {
    setContacts([...contacts, { name: '', role: '', is_key_decision_maker: false, phone: '', wechat_id: '' }]);
  };

  const updateContact = (idx: number, field: keyof ContactInput, value: string | boolean) => {
    const updated = [...contacts];
    (updated[idx] as unknown as Record<string, unknown>)[field] = value;
    setContacts(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setWarning(null);
    setSubmitting(true);
    try {
      const body = {
        company_name: companyName,
        unified_code: unifiedCode || undefined,
        region,
        source,
        contacts: contacts.filter(c => c.name.trim()),
      };
      const res = await api.post<Record<string, unknown>>('/leads', body);
      if (res.code === 'LEAD_DUPLICATE_WARNING') {
        setWarning(res.message as string);
      }
      router.push('/leads');
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = err.detail as Record<string, unknown> | undefined;
        setError(detail?.message as string || err.message);
      } else {
        setError('创建失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9',
    borderRadius: 4, fontSize: 14, boxSizing: 'border-box' as const,
  };
  const labelStyle = { display: 'block', marginBottom: 4, fontSize: 14, fontWeight: 500 as const };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>新建线索</h1>
      <form onSubmit={handleSubmit} style={{ background: '#fff', padding: 24, borderRadius: 8 }}>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>公司名称 *</label>
          <input value={companyName} onChange={e => setCompanyName(e.target.value)} required style={inputStyle} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>组织机构代码</label>
          <input value={unifiedCode} onChange={e => setUnifiedCode(e.target.value)} style={inputStyle} placeholder="选填" />
        </div>
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>大区 *</label>
            <select value={region} onChange={e => setRegion(e.target.value)} style={inputStyle}>
              <option value="华北">华北</option>
              <option value="华南">华南</option>
              <option value="华东">华东</option>
              <option value="华中">华中</option>
              <option value="西南">西南</option>
              <option value="西北">西北</option>
              <option value="东北">东北</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>来源 *</label>
            <select value={source} onChange={e => setSource(e.target.value)} style={inputStyle}>
              <option value="referral">转介绍</option>
              <option value="organic">自然流量</option>
              <option value="koc_sem">KOC/SEM</option>
              <option value="outbound">外呼</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={labelStyle}>联系人</label>
            <button type="button" onClick={addContact} style={{
              padding: '4px 12px', background: '#fff', border: '1px solid #d9d9d9',
              borderRadius: 4, cursor: 'pointer', fontSize: 13,
            }}>
              + 添加联系人
            </button>
          </div>
          {contacts.map((c, i) => (
            <div key={i} style={{ padding: 12, border: '1px solid #f0f0f0', borderRadius: 4, marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input placeholder="姓名" value={c.name} onChange={e => updateContact(i, 'name', e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                <input placeholder="职务" value={c.role} onChange={e => updateContact(i, 'role', e.target.value)} style={{ ...inputStyle, flex: 1 }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input placeholder="手机" value={c.phone} onChange={e => updateContact(i, 'phone', e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                <input placeholder="微信号" value={c.wechat_id} onChange={e => updateContact(i, 'wechat_id', e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, whiteSpace: 'nowrap' }}>
                  <input type="checkbox" checked={c.is_key_decision_maker} onChange={e => updateContact(i, 'is_key_decision_maker', e.target.checked)} />
                  KP
                </label>
              </div>
            </div>
          ))}
        </div>

        {error && <p style={{ color: '#ff4d4f', marginBottom: 16 }}>{error}</p>}
        {warning && <p style={{ color: '#faad14', marginBottom: 16 }}>{warning}</p>}

        <button type="submit" disabled={submitting} style={{
          width: '100%', padding: '10px 0', background: '#1890ff', color: '#fff',
          border: 'none', borderRadius: 4, fontSize: 16, cursor: submitting ? 'not-allowed' : 'pointer',
        }}>
          {submitting ? '提交中...' : '创建线索'}
        </button>
      </form>
    </div>
  );
}
