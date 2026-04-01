'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

interface DashboardStats {
  total_leads: number;
  active_leads: number;
  converted_leads: number;
  lost_leads: number;
  public_leads: number;
  total_customers: number;
  conversion_rate: number;
}

interface TeamMember {
  user_id: string;
  name: string;
  active_leads: number;
  converted_leads: number;
  customers: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  const isManager = user?.roles.some(r =>
    ['战队队长', '大区总', '销售VP', '督导', '系统管理员'].includes(r)
  );

  useEffect(() => {
    const load = async () => {
      try {
        const [s, t] = await Promise.all([
          api.get<DashboardStats>('/dashboard/stats'),
          isManager ? api.get<TeamMember[]>('/dashboard/team-stats') : Promise.resolve([]),
        ]);
        setStats(s);
        setTeam(t);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, [isManager]);

  if (loading) return <p style={{ padding: 24 }}>加载中...</p>;

  const cardStyle = (bg: string) => ({
    padding: 24, borderRadius: 8, background: bg, color: '#fff',
    flex: 1, minWidth: 180,
  });

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>数据概览</h1>
      <p style={{ marginBottom: 24, color: '#666' }}>欢迎回来，{user?.name}！</p>

      {/* Stats cards */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 32 }}>
        <div style={cardStyle('#1890ff')}>
          <div style={{ fontSize: 14, opacity: 0.8 }}>活跃线索</div>
          <div style={{ fontSize: 32, fontWeight: 700, marginTop: 8 }}>{stats?.active_leads ?? 0}</div>
        </div>
        <div style={cardStyle('#52c41a')}>
          <div style={{ fontSize: 14, opacity: 0.8 }}>已转化</div>
          <div style={{ fontSize: 32, fontWeight: 700, marginTop: 8 }}>{stats?.converted_leads ?? 0}</div>
        </div>
        <div style={cardStyle('#faad14')}>
          <div style={{ fontSize: 14, opacity: 0.8 }}>转化率</div>
          <div style={{ fontSize: 32, fontWeight: 700, marginTop: 8 }}>{stats?.conversion_rate ?? 0}%</div>
        </div>
        <div style={cardStyle('#722ed1')}>
          <div style={{ fontSize: 14, opacity: 0.8 }}>客户总数</div>
          <div style={{ fontSize: 32, fontWeight: 700, marginTop: 8 }}>{stats?.total_customers ?? 0}</div>
        </div>
      </div>

      {/* Secondary stats */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 32 }}>
        <div style={{ ...cardStyle('#13c2c2'), flex: 'none', minWidth: 160 }}>
          <div style={{ fontSize: 14, opacity: 0.8 }}>公共池</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>{stats?.public_leads ?? 0}</div>
        </div>
        <div style={{ ...cardStyle('#ff4d4f'), flex: 'none', minWidth: 160 }}>
          <div style={{ fontSize: 14, opacity: 0.8 }}>已流失</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>{stats?.lost_leads ?? 0}</div>
        </div>
        <div style={{ ...cardStyle('#595959'), flex: 'none', minWidth: 160 }}>
          <div style={{ fontSize: 14, opacity: 0.8 }}>线索总数</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>{stats?.total_leads ?? 0}</div>
        </div>
      </div>

      {/* Team table (manager view) */}
      {isManager && team.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden' }}>
          <h2 style={{ fontSize: 18, padding: '16px 24px', margin: 0, borderBottom: '2px solid #f0f0f0' }}>
            团队业绩
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
                <th style={{ padding: '12px 24px', textAlign: 'left' }}>排名</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>销售</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>活跃线索</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>已转化</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>客户数</th>
              </tr>
            </thead>
            <tbody>
              {team.map((m, i) => (
                <tr key={m.user_id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '12px 24px', fontWeight: i < 3 ? 700 : 400 }}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                  </td>
                  <td style={{ padding: '12px 16px' }}>{m.name}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>{m.active_leads}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#52c41a' }}>
                    {m.converted_leads}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>{m.customers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
