'use client';

import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  label: string;
  href: string;
  permissions?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: '数据概览', href: '/dashboard' },
  { label: '我的线索', href: '/leads' },
  { label: '公共线索库', href: '/public-pool' },
  { label: '我的客户', href: '/customers' },
  { label: '我的日报', href: '/reports' },
];

const ADMIN_ITEMS: NavItem[] = [
  { label: '组织管理', href: '/admin/org' },
  { label: '用户管理', href: '/admin/users' },
  { label: '角色权限', href: '/admin/roles' },
  { label: '系统配置', href: '/admin/config' },
  { label: '操作日志', href: '/admin/logs' },
];

const MANAGER_ITEMS: NavItem[] = [
  { label: '团队线索', href: '/leads/team' },
  { label: '团队日报', href: '/reports/team' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  if (!user) return null;

  const isAdmin = user.roles.includes('系统管理员');
  const isManager = user.roles.some(r =>
    ['战队队长', '大区总', '销售VP', '督导'].includes(r)
  );

  return (
    <aside style={{
      width: 220, background: '#001529', color: '#fff', minHeight: '100vh',
      display: 'flex', flexDirection: 'column', position: 'fixed', left: 0, top: 0,
    }}>
      <div style={{ padding: '20px 16px', borderBottom: '1px solid #ffffff20', fontSize: 18, fontWeight: 'bold' }}>
        SFA CRM
      </div>
      <nav style={{ flex: 1, padding: '8px 0' }}>
        {NAV_ITEMS.map(item => (
          <Link key={item.href} href={item.href}>
            <div style={{
              padding: '10px 24px', fontSize: 14, cursor: 'pointer',
              background: pathname === item.href ? '#1890ff' : 'transparent',
              transition: 'background 0.2s',
            }}>
              {item.label}
            </div>
          </Link>
        ))}
        {isManager && (
          <>
            <div style={{ padding: '12px 16px 6px', fontSize: 12, color: '#ffffff80' }}>团队管理</div>
            {MANAGER_ITEMS.map(item => (
              <Link key={item.href} href={item.href}>
                <div style={{
                  padding: '10px 24px', fontSize: 14, cursor: 'pointer',
                  background: pathname === item.href ? '#1890ff' : 'transparent',
                  transition: 'background 0.2s',
                }}>
                  {item.label}
                </div>
              </Link>
            ))}
          </>
        )}
        {isAdmin && (
          <>
            <div style={{ padding: '12px 16px 6px', fontSize: 12, color: '#ffffff80' }}>系统管理</div>
            {ADMIN_ITEMS.map(item => (
              <Link key={item.href} href={item.href}>
                <div style={{
                  padding: '10px 24px', fontSize: 14, cursor: 'pointer',
                  background: pathname === item.href ? '#1890ff' : 'transparent',
                  transition: 'background 0.2s',
                }}>
                  {item.label}
                </div>
              </Link>
            ))}
          </>
        )}
      </nav>
      <div style={{ padding: '16px', borderTop: '1px solid #ffffff20' }}>
        <div style={{ fontSize: 14, marginBottom: 8 }}>{user.name}</div>
        <div style={{ fontSize: 12, color: '#ffffff80', marginBottom: 12 }}>{user.roles.join(', ')}</div>
        <button
          onClick={logout}
          style={{
            width: '100%', padding: '6px 0', background: 'transparent', color: '#ff4d4f',
            border: '1px solid #ff4d4f', borderRadius: 4, cursor: 'pointer', fontSize: 14,
          }}
        >
          退出登录
        </button>
      </div>
    </aside>
  );
}
