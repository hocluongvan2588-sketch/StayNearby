import { getCurrentUser } from '@/lib/auth/session';
import { getAdminConsoleData } from '@/modules/admin';
import { AdminShell } from '@/components/admin/AdminShell';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#FAF8F3] text-[#17221E]">
        {children}
      </div>
    );
  }

  const data = await getAdminConsoleData();
  const pendingApplicationsCount = data.applications.filter(
    (a) => a.status === 'submitted'
  ).length;
  const alertsCount = data.notifications.filter(
    (n) => n.recipientRole === 'admin'
  ).length;

  return (
    <AdminShell
      user={user}
      pendingApplicationsCount={pendingApplicationsCount}
      alertsCount={alertsCount}
    >
      {children}
    </AdminShell>
  );
}
