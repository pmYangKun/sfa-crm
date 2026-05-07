'use client';

// 5 槽固定金刚区：线索 / 客户 / AI(中) / Pipeline / 我的
// "跟进" 已并入「线索」详情页，不再单独占槽
// Pipeline 全角色可见（销售看自己，经理看团队，由 page 内自动判断）
import { useRouter, usePathname } from 'next/navigation';

interface Tab {
  id: 'leads' | 'customers' | 'chat' | 'pipeline' | 'me';
  icon: string;
  label: string;
  href: string;
  raised: boolean;
}

const TABS: Tab[] = [
  { id: 'leads',     icon: '📋', label: '线索',     href: '/m/leads',             raised: false },
  { id: 'customers', icon: '🏢', label: '客户',     href: '/m/customers',         raised: false },
  { id: 'chat',      icon: '💬', label: 'AI',       href: '/m/chat',              raised: true  },
  { id: 'pipeline',  icon: '🎯', label: 'Pipeline', href: '/m/manager-pipeline',  raised: false },
  { id: 'me',        icon: '👤', label: '我的',     href: '/m/me',                raised: false },
];

export const TABBAR_HEIGHT = 64;

export default function KingKongTabbar() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <nav
      data-testid="kingkong-tabbar"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 800,
        height: TABBAR_HEIGHT,
        background: '#fff',
        borderTop: '1px solid #e8e8e8',
        boxShadow: '0 -2px 8px rgba(0,0,0,0.04)',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingBottom: 'env(safe-area-inset-bottom, 0)',
      }}
    >
      {TABS.map((t) => {
        const active =
          pathname === t.href ||
          (t.id === 'chat' && pathname.startsWith('/m/chat')) ||
          (t.id === 'pipeline' && pathname.startsWith('/m/manager-pipeline'));
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => router.push(t.href)}
            data-testid={`tab-${t.id}`}
            data-active={active ? 'true' : 'false'}
            style={{
              flex: 1,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: active ? '#1890ff' : '#8c8c8c',
              position: 'relative',
              gap: 2,
              fontFamily: 'inherit',
              fontSize: 11,
            }}
          >
            {t.raised ? (
              <div
                style={{
                  position: 'absolute',
                  top: -18,
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: active ? '#1890ff' : '#40a9ff',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                  boxShadow: '0 4px 12px rgba(24,144,255,0.4)',
                  border: '4px solid #fff',
                }}
              >
                {t.icon}
              </div>
            ) : (
              <span style={{ fontSize: 20, lineHeight: 1 }}>{t.icon}</span>
            )}
            <span
              style={{
                marginTop: t.raised ? 24 : 0,
                fontWeight: active ? 600 : 400,
              }}
            >
              {t.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
