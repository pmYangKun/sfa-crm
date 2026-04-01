'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface RoleItem {
  id: string; name: string; description: string | null; is_system: boolean;
  permissions: { id: string; code: string; name: string }[];
}

export default function RolesManagePage() {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<RoleItem[]>('/roles')
      .then(setRoles)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>加载中...</p>;

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>角色权限</h1>
      <div style={{ display: 'grid', gap: 16 }}>
        {roles.map(role => (
          <div key={role.id} style={{ background: '#fff', padding: 24, borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ fontSize: 18 }}>
                {role.name}
                {role.is_system && <span style={{ fontSize: 12, color: '#999', marginLeft: 8 }}>系统内置</span>}
              </h3>
            </div>
            {role.description && <p style={{ color: '#666', marginBottom: 12 }}>{role.description}</p>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {role.permissions.map(p => (
                <span key={p.id} style={{
                  padding: '2px 10px', background: '#f0f5ff', color: '#1890ff',
                  borderRadius: 4, fontSize: 12,
                }}>
                  {p.name} ({p.code})
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
