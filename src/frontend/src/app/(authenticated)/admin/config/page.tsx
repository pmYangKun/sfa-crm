'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { SystemConfigItem } from '@/types';

export default function ConfigPage() {
  const [configs, setConfigs] = useState<SystemConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const loadConfig = async () => {
    try {
      const data = await api.get<SystemConfigItem[]>('/config');
      setConfigs(data);
      const map: Record<string, string> = {};
      data.forEach(c => { map[c.key] = c.value; });
      setEditing(map);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadConfig(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch('/config', { items: editing });
      loadConfig();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  if (loading) return <p>加载中...</p>;

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>系统配置</h1>
      <div style={{ background: '#fff', padding: 24, borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left' }}>配置项</th>
              <th style={{ padding: '12px 16px', textAlign: 'left' }}>说明</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', width: 200 }}>值</th>
            </tr>
          </thead>
          <tbody>
            {configs.map(c => (
              <tr key={c.key} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>{c.key}</td>
                <td style={{ padding: '12px 16px', color: '#666' }}>{c.description || '-'}</td>
                <td style={{ padding: '12px 16px' }}>
                  <input
                    value={editing[c.key] || ''}
                    onChange={e => setEditing({ ...editing, [c.key]: e.target.value })}
                    style={{ width: '100%', padding: '4px 8px', border: '1px solid #d9d9d9', borderRadius: 4 }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <button onClick={handleSave} disabled={saving} style={{
            padding: '8px 24px', background: '#1890ff', color: '#fff',
            border: 'none', borderRadius: 4, cursor: 'pointer',
          }}>
            {saving ? '保存中...' : '保存配置'}
          </button>
        </div>
      </div>
    </div>
  );
}
