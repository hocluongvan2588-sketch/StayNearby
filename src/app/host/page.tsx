import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/session';
import { getServerPreferences } from '@/lib/preferences';
import { getHostConsoleData } from '@/modules/host';
import { HostConsoleClient } from '@/components/HostConsoleClient';

export const dynamic = 'force-dynamic';

export default async function HostPage() {
  const [user, prefs] = await Promise.all([getCurrentUser(), getServerPreferences()]);
  const isVi = prefs.locale === 'vi';

  if (!user || (user.role !== 'host' && user.role !== 'admin')) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <div className="space-y-4 rounded-3xl border border-[#E5DFD3] bg-white p-8 text-center lacquer-shadow">
          <span className="rounded-full bg-[#E7F1EC] px-3 py-1 text-xs font-semibold text-[#164E3F]">
            {isVi ? 'Khu vực dành cho chủ nhà' : 'Host Portal'}
          </span>
          <h1 className="font-serif-display text-3xl font-semibold text-[#17221E]">
            {isVi ? 'Đăng nhập bằng tài khoản chủ nhà' : 'Log in with a host account'}
          </h1>
          <p className="text-sm text-[#53635D]">
            {user
              ? isVi
                ? `Bạn đang đăng nhập bằng tài khoản ${user.email}. Hãy chuyển sang tài khoản chủ nhà hoặc gửi duyệt chỗ ở mới.`
                : `You are signed in as ${user.email}. Switch to a host account or submit a property for review first.`
              : isVi
                ? 'Vui lòng đăng nhập bằng tài khoản chủ nhà để quản lý phòng, lịch và bảng giá.'
                : 'Sign in with a host account to manage your listings, rates, and calendar.'}
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link
              href="/login?next=/host"
              className="rounded-xl bg-[#164E3F] px-5 py-2.5 text-sm font-semibold text-white"
            >
              {isVi ? 'Đăng nhập tài khoản chủ nhà' : 'Switch to host account'}
            </Link>
            <Link
              href="/list-your-stay"
              className="rounded-xl border border-[#E5DFD3] px-5 py-2.5 text-sm font-semibold text-[#17221E]"
            >
              {isVi ? 'Đăng cho thuê chỗ ở mới' : 'List a new property'}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const data = await getHostConsoleData(user);
  return <HostConsoleClient hostName={user.fullName} data={data} />;
}
