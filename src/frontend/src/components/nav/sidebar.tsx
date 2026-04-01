"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

interface NavItem {
  href: string;
  label: string;
}

const SALES_NAV: NavItem[] = [
  { href: "/leads", label: "我的线索" },
  { href: "/public-pool", label: "公共线索库" },
  { href: "/customers", label: "我的客户" },
  { href: "/reports", label: "我的日报" },
];

const MANAGER_NAV: NavItem[] = [
  { href: "/leads/team", label: "团队线索" },
  { href: "/public-pool", label: "公共线索库" },
  { href: "/customers", label: "团队客户" },
  { href: "/reports/team", label: "团队日报" },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/leads", label: "全部线索" },
  { href: "/customers", label: "全部客户" },
  { href: "/admin/org", label: "组织管理" },
  { href: "/admin/users", label: "用户管理" },
  { href: "/admin/config", label: "系统配置" },
];

export function Sidebar() {
  const { user, logout, isAdmin, isManager, loading } = useAuth();
  const pathname = usePathname();

  if (loading || !user) return null;

  const navItems = isAdmin ? ADMIN_NAV : isManager ? MANAGER_NAV : SALES_NAV;

  return (
    <aside className="sidebar">
      <div className="brand">SFA CRM</div>

      <nav className="nav">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item ${pathname === item.href || pathname.startsWith(item.href + "/") ? "active" : ""}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="user-bar">
        <div className="user-info">
          <span className="user-name">{user.name}</span>
          <span className="user-role">{user.roles[0] ?? "—"}</span>
        </div>
        <button className="logout-btn" onClick={logout}>退出</button>
      </div>

      <style jsx>{`
        .sidebar {
          width: 180px;
          min-height: 100vh;
          background: var(--color-surface);
          border-right: 1px solid var(--color-border);
          display: flex;
          flex-direction: column;
          padding: 0;
          flex-shrink: 0;
        }
        .brand {
          padding: 18px 20px;
          font-size: 15px;
          font-weight: 700;
          color: var(--color-primary);
          border-bottom: 1px solid var(--color-border);
          letter-spacing: 0.02em;
        }
        .nav {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 8px 0;
          gap: 2px;
        }
        .nav-item {
          display: block;
          padding: 9px 20px;
          font-size: 14px;
          color: var(--color-text);
          text-decoration: none;
          border-radius: 0;
          transition: background 0.1s;
        }
        .nav-item:hover { background: var(--color-bg); }
        .nav-item.active {
          background: #e6f4ff;
          color: var(--color-primary);
          font-weight: 500;
        }
        .user-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-top: 1px solid var(--color-border);
        }
        .user-info { display: flex; flex-direction: column; }
        .user-name { font-size: 13px; font-weight: 500; }
        .user-role { font-size: 11px; color: var(--color-text-secondary); }
        .logout-btn {
          background: none;
          border: none;
          font-size: 12px;
          color: var(--color-text-secondary);
          cursor: pointer;
          padding: 4px;
        }
        .logout-btn:hover { color: #e53e3e; }
      `}</style>
    </aside>
  );
}
