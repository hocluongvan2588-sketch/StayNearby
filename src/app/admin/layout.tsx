import { getCurrentUser } from '@/lib/auth/session';
import { getAdminActorContext, type AdminModuleKey } from '@/modules/admin-rbac';
import { getOverviewDashboardData, listAdminTasks, listSupportTickets } from '@/modules/admin-bos';
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

  let actor;
  try {
    actor = await getAdminActorContext(user);
  } catch {
    return (
      <div className="min-h-screen bg-[#FAF8F3] text-[#17221E]">
        {children}
      </div>
    );
  }

  const allowedModules = Object.values(actor.permissions)
    .filter((p) => p.actions.includes('view'))
    .map((p) => p.moduleKey) as AdminModuleKey[];

  const [overview, tickets, tasksData] = await Promise.all([
    allowedModules.includes('overview')
      ? getOverviewDashboardData(actor, 90)
      : Promise.resolve(null),
    allowedModules.includes('support')
      ? listSupportTickets(actor, { status: 'open' })
      : Promise.resolve([]),
    allowedModules.includes('tasks')
      ? listAdminTasks({ status: 'todo' })
      : Promise.resolve({ tasks: [], staffOptions: [] }),
  ]);

  return (
    <AdminShell
      user={user}
      roleName={actor.roleName}
      allowedModules={allowedModules}
      badges={{
        attentionCount: overview?.requiresAttention.length ?? 0,
        openTicketsCount: tickets.length,
        pendingTasksCount: tasksData.tasks.length,
      }}
    >
      {children}
    </AdminShell>
  );
}
