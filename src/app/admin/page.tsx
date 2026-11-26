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
      <div className="flex min-h-screen items-center justify-center bg-[#FAF8F3] px-4 py-12">
        <div className="w-full max-w-lg space-y-4 rounded-2xl border border-[#E5DFD3] bg-white p-8 text-center">
          <div className="inline-flex items-center rounded-md border border-[#E5DFD3] bg-[#FAF8F3] px-2.5 py-1 text-xs font-semibold text-[#C25E28]">
            VietNomad Admin Console
          </div>
          <h1 className="font-serif-display text-2xl font-semibold text-[#17221E]">
            {isVi ? 'Đăng nhập tài khoản quản trị' : 'Sign in with an Admin account'}
          </h1>
          <p className="text-sm text-[#53635D]">
            {user
              ? isVi
                ? `Bạn đang đăng nhập bằng ${user.email}. Hãy chuyển sang tài khoản quản trị để duyệt hồ sơ và cấp huy hiệu kiểm định.`
                : `You are signed in as ${user.email}. Switch to an admin account to review applications and manage badges.`
              : isVi
                ? 'Vui lòng đăng nhập bằng tài khoản quản trị để tiếp tục.'
                : 'Sign in with an admin account to continue.'}
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link
              href="/login?next=/admin"
              className="rounded-lg bg-[#C25E28] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#a94d1e]"
            >
              {isVi ? 'Đăng nhập quản trị' : 'Admin sign in'}
            </Link>
            <Link
              href="/"
              className="rounded-lg border border-[#E5DFD3] px-4 py-2.5 text-sm font-medium text-[#17221E] hover:bg-[#FAF8F3]"
            >
              {isVi ? 'Về trang khách hàng' : 'Back to Guest view'}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const data = await getAdminConsoleData();
  return <AdminConsoleClient data={data} />;
}
