/**
 * 跨端路由映射（PC ↔ 移动）
 * 详细约定见 specs/001-login-mobile-onboarding/contracts/ui-contracts.md § 13 + § 14
 *
 * 抽离原因：T004 ((authenticated)/layout.tsx) 和 T006 (m/(mobile-app)/layout.tsx)
 * 都要做跨端跳转，映射规则需要单一信源避免双向规则不对称。
 */

/** PC pathname → 移动 pathname */
export function pcToMobilePath(pathname: string): string {
  const exact: Record<string, string> = {
    '/login': '/m/login',
    '/dashboard': '/m/chat',
    '/leads': '/m/leads',
    '/leads/new': '/m/chat',
    '/leads/team': '/m/leads',
    '/customers': '/m/customers',
    '/public-pool': '/m/leads',
    '/reports': '/m/chat',
    '/reports/team': '/m/chat',
  };
  if (exact[pathname]) return exact[pathname];

  if (pathname.startsWith('/leads/')) return '/m/chat';
  if (pathname.startsWith('/customers/')) return '/m/customers';
  if (pathname.startsWith('/admin')) return '/m/me';

  return '/m/chat';
}

/** 移动 pathname → PC pathname */
export function mobileToPcPath(pathname: string): string {
  const exact: Record<string, string> = {
    '/m/login': '/login',
    '/m/chat': '/dashboard',
    '/m/leads': '/leads',
    '/m/customers': '/customers',
    '/m/followups': '/dashboard',
    '/m/me': '/dashboard',
  };
  if (exact[pathname]) return exact[pathname];
  return '/dashboard';
}
