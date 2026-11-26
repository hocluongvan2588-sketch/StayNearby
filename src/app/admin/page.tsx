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
            {isVi ? 'Khu vực kiểm duyệt' : 'Admin Portal'}
          </span>
          <h1 className="font-serif-display text-3xl font-semibold text-[#17221E]">
            {isVi ? 'Đăng nhập bằng tài khoản quản trị' : 'Log in with an admin account'}
          </h1>
          <p className="text-sm text-[#53635D]">
            {user
              ? isVi
                ? `Bạn đang đăng nhập bằng ${user.email}. Hãy chuyển sang tài khoản quản trị để duyệt hồ sơ chỗ ở mới và kiểm tra tốc độ Wi-Fi.`
                : `You are signed in as ${user.email}. Switch to an admin account to review property applications and Wi-Fi checks.`
              : isVi
                ? 'Vui lòng đăng nhập bằng tài khoản quản trị để tiếp tục.'
                : 'Sign in with an admin account to continue.'}
          </p>
          <Link
            href="/login?next=/admin"
            className="inline-block rounded-xl bg-[#C25E28] px-5 py-2.5 text-sm font-semibold text-white"
          >
            {isVi ? 'Chuyển sang tài khoản quản trị' : 'Switch to admin account'}
          </Link>
        </div>
      </div>
    );
  }

  const data = await getAdminConsoleData();
  return <AdminConsoleClient data={data} />;
}
