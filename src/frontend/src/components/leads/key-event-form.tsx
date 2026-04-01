'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

interface Props {
  entityType: 'lead' | 'customer';
  entityId: string;
  onCreated: () => void;
}

const EVENT_TYPES = [
  { value: 'visited_kp', label: '拜访KP' },
  { value: 'book_sent', label: '送书' },
  { value: 'attended_small_course', label: '参加小课' },
  { value: 'purchased_big_course', label: '购买大课' },
  { value: 'contact_relation_discovered', label: '发现人脉关系' },
];

export default function KeyEventForm({ entityType, entityId, onCreated }: Props) {
  const [type, setType] = useState('visited_kp');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const path = entityType === 'lead'
        ? `/leads/${entityId}/key-events`
        : `/customers/${entityId}/key-events`;
      await api.post(path, {
        type,
        occurred_at: new Date().toISOString(),
        payload: {},
      });
      onCreated();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <select value={type} onChange={e => setType(e.target.value)}
        style={{ padding: '6px 12px', border: '1px solid #d9d9d9', borderRadius: 4, fontSize: 14 }}>
        {EVENT_TYPES.map(t => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>
      <button onClick={handleSubmit} disabled={submitting} style={{
        padding: '6px 16px', background: '#722ed1', color: '#fff',
        border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14,
      }}>
        {submitting ? '记录中...' : '记录事件'}
      </button>
    </div>
  );
}
