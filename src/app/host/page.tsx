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
            Host Partner Workspace
          </span>
          <h1 className="font-serif-display text-3xl font-semibold text-[#17221E]">
            {isVi ? 'Chuyển sang tài khoản Chủ nhà đối tác' : 'Switch to a Host Partner Account'}
          </h1>
          <p className="text-sm text-[#53635D]">
            {user
              ? isVi
                ? `Bạn đang đăng nhập bằng ${user.email} (${user.role}). Hãy chuyển sang host@vietnomad.demo hoặc direct@vietnomad.demo để quản lý phòng & ví StayDirect™.`
                : `Signed in as ${user.email} (${user.role}). Switch to a Host account or submit a Stay Application first.`
              : isVi
                ? 'Vui lòng đăng nhập bằng tài khoản Chủ nhà để truy cập Host Console.'
                : 'Sign in with a Host Partner account to manage packages, Wi-Fi tests, and wallets.'}
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link
              href="/login?next=/host"
              className="rounded-xl bg-[#164E3F] px-5 py-2.5 text-sm font-semibold text-white"
            >
              {isVi ? 'Chọn tài khoản Host (1 chạm)' : 'Switch to Host Account →'}
            </Link>
            <Link
              href="/list-your-stay"
              className="rounded-xl border border-[#E5DFD3] px-5 py-2.5 text-sm font-semibold text-[#17221E]"
            >
              {isVi ? 'Đăng ký làm Chủ nhà mới' : 'Apply to List Your Stay'}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const data = await getHostConsoleData(user);
  return <HostConsoleClient hostName={user.fullName} data={data} />;
}
