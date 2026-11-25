import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/session';
import { getServerPreferences } from '@/lib/preferences';
import { getAdminConsoleData } from '@/modules/admin';
import { AdminConsoleClient } from '@/components/AdminConsoleClient';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const [user, prefs] = await Promise.all([getCurrentUser(), getServerPreferences()]);
  const isVi = prefs.locale === 'vi';

  if (!user || user.role !== 'admin') {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <div className="space-y-4 rounded-3xl border border-[#E5DFD3] bg-white p-8 text-center lacquer-shadow">
          <span className="rounded-full bg-[#FAEDE5] px-3 py-1 text-xs font-semibold text-[#C25E28]">
            Admin & CRM Workspace
          </span>
          <h1 className="font-serif-display text-3xl font-semibold text-[#17221E]">
            {isVi ? 'Chuyển sang tài khoản Quản trị viên' : 'Switch to Admin Account'}
          </h1>
          <p className="text-sm text-[#53635D]">
            {user
              ? isVi
                ? `Bạn đang đăng nhập bằng ${user.email} (${user.role}). Vui lòng chuyển sang admin@vietnomad.demo để kiểm duyệt đơn đăng ký và xem CRM.`
                : `Signed in as ${user.email} (${user.role}). Switch to the Admin account to review Stay Applications, audit Wi-Fi, and manage CRM.`
              : isVi
                ? 'Vui lòng đăng nhập bằng tài khoản Admin để truy cập.'
                : 'Sign in as Platform Admin to continue.'}
          </p>
          <Link
            href="/login?next=/admin"
            className="inline-block rounded-xl bg-[#C25E28] px-5 py-2.5 text-sm font-semibold text-white"
          >
            {isVi ? 'Chuyển sang tài khoản Admin →' : 'Switch to Admin Account →'}
          </Link>
        </div>
      </div>
    );
  }

  const data = await getAdminConsoleData();
  return <AdminConsoleClient data={data} />;
}
