import { getAppConfig } from '@/lib/config';
import { DEMO_ACCOUNTS } from '@/lib/db/seed-data';

export interface QuickDemoAccountInfo {
  email: string;
  password: string;
  displayName: string;
  roleLabel: string;
}

export function getQuickDemoAccount(
  target: 'guest' | 'host' | 'admin'
): QuickDemoAccountInfo | null {
  const config = getAppConfig();
  if (!config.demoMode) return null;

  if (target === 'admin') {
    return {
      email: DEMO_ACCOUNTS.admin.email,
      password: DEMO_ACCOUNTS.admin.password,
      displayName: DEMO_ACCOUNTS.admin.displayName,
      roleLabel: 'Quản trị viên',
    };
  }
  if (target === 'host') {
    return {
      email: DEMO_ACCOUNTS.host.email,
      password: DEMO_ACCOUNTS.host.password,
      displayName: DEMO_ACCOUNTS.host.displayName,
      roleLabel: 'Chủ nhà',
    };
  }
  return {
    email: DEMO_ACCOUNTS.guest.email,
    password: DEMO_ACCOUNTS.guest.password,
    displayName: DEMO_ACCOUNTS.guest.displayName,
    roleLabel: 'Khách hàng',
  };
}
