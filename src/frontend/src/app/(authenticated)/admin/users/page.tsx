'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PaginatedResponse } from '@/types';

interface UserItem {
  id: string; name: string; login: string; org_node_id: string;
  is_active: boolean; roles: string[]; created_at: string;
}

export default function UsersManagePage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadUsers = async () => {
    try {
      const res = await api.get<PaginatedResponse<UserItem>>('/users?size=100');
      setUsers(res.items);
      setTotal(res.total);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadUsers(); }, []);

  if (loading) return <p>加载中...</p>;

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>用户管理</h1>
      <div style={{ background: '#fff', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left' }}>姓名</th>
              <th style={{ padding: '12px 16px', textAlign: 'left' }}>账号</th>
              <th style={{ padding: '12px 16px', textAlign: 'left' }}>角色</th>
              <th style={{ padding: '12px 16px', textAlign: 'left' }}>状态</th>
              <th style={{ padding: '12px 16px', textAlign: 'left' }}>创建时间</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '12px 16px' }}>{u.name}</td>
                <td style={{ padding: '12px 16px' }}>{u.login}</td>
                <td style={{ padding: '12px 16px' }}>{u.roles.join(', ') || '-'}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ color: u.is_active ? '#52c41a' : '#ff4d4f' }}>
                    {u.is_active ? '活跃' : '已停用'}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', color: '#999' }}>{new Date(u.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: 16, color: '#999' }}>共 {total} 个用户</div>
      </div>
    </div>
  );
}
