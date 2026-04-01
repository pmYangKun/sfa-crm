'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Contact } from '@/types';

interface Props {
  entityType: 'lead' | 'customer';
  entityId: string;
  contacts: Contact[];
  onUpdate: () => void;
}

export default function ContactPanel({ entityType, entityId, contacts, onUpdate }: Props) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [phone, setPhone] = useState('');
  const [wechatId, setWechatId] = useState('');
  const [isKp, setIsKp] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const path = entityType === 'lead'
        ? `/leads/${entityId}/contacts`
        : `/customers/${entityId}/contacts`;
      await api.post(path, { name, role: role || undefined, phone: phone || undefined, wechat_id: wechatId || undefined, is_key_decision_maker: isKp });
      setName(''); setRole(''); setPhone(''); setWechatId(''); setIsKp(false); setAdding(false);
      onUpdate();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = { padding: '6px 10px', border: '1px solid #d9d9d9', borderRadius: 4, fontSize: 13 };

  return (
    <div>
      {contacts.length === 0 ? <p style={{ color: '#999' }}>暂无联系人</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 13 }}>姓名</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 13 }}>职务</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 13 }}>手机</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 13 }}>微信</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 13 }}>KP</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '8px 12px', fontSize: 13 }}>{c.name}</td>
                <td style={{ padding: '8px 12px', fontSize: 13 }}>{c.role || '-'}</td>
                <td style={{ padding: '8px 12px', fontSize: 13 }}>{c.phone || '-'}</td>
                <td style={{ padding: '8px 12px', fontSize: 13 }}>{c.wechat_id || '-'}</td>
                <td style={{ padding: '8px 12px', fontSize: 13 }}>{c.is_key_decision_maker ? '是' : '否'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {adding ? (
        <div style={{ padding: 12, border: '1px solid #f0f0f0', borderRadius: 4 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input placeholder="姓名*" value={name} onChange={e => setName(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            <input placeholder="职务" value={role} onChange={e => setRole(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input placeholder="手机" value={phone} onChange={e => setPhone(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            <input placeholder="微信号" value={wechatId} onChange={e => setWechatId(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
              <input type="checkbox" checked={isKp} onChange={e => setIsKp(e.target.checked)} /> KP
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleAdd} disabled={submitting} style={{
              padding: '4px 16px', background: '#1890ff', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13,
            }}>{submitting ? '添加中...' : '确认添加'}</button>
            <button onClick={() => setAdding(false)} style={{
              padding: '4px 16px', background: '#fff', border: '1px solid #d9d9d9', borderRadius: 4, cursor: 'pointer', fontSize: 13,
            }}>取消</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={{
          padding: '4px 12px', background: '#fff', border: '1px solid #d9d9d9', borderRadius: 4, cursor: 'pointer', fontSize: 13,
        }}>+ 添加联系人</button>
      )}
    </div>
  );
}
