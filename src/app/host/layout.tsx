import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/session';
import { getServerPreferences } from '@/lib/preferences';
import { getHostShellContext } from '@/modules/host-console';
import { HostShell } from '@/components/host/HostShell';

export const dynamic = 'force-dynamic';

export default async function HostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, prefs] = await Promise.all([
    getCurrentUser(),
    getServerPreferences(),
  ]);
  const isVi = prefs.locale === 'vi';

  if (!user || (user.role !== 'host' && user.role !== 'admin')) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF8F3] px-4 py-12">
        <div className="w-full max-w-lg space-y-4 rounded-2xl border border-[#E5DFD3] bg-white p-8 text-center">
          <div className="inline-flex items-center rounded-md border border-[#E5DFD3] bg-[#FAF8F3] px-2.5 py-1 text-xs font-semibold text-[#164E3F]">
            VietNomad Host Console
          </div>
          <h1 className="font-serif-display text-2xl font-semibold text-[#17221E]">
            {isVi ? 'Đăng nhập tài khoản chủ nhà' : 'Sign in with a Host account'}
          </h1>
          <p className="text-sm text-[#53635D]">
            {user
              ? isVi
                ? `Bạn đang đăng nhập bằng tài khoản ${user.email}. Hãy chuyển sang tài khoản chủ nhà hoặc đăng ký chỗ ở miễn phí.`
                : `You are currently signed in as ${user.email}. Switch to a host account or list a property for free.`
              : isVi
                ? 'Vui lòng đăng nhập bằng tài khoản chủ nhà để quản lý lịch, đặt phòng, tin nhắn và doanh thu.'
                : 'Sign in with a host account to manage your calendar, reservations, inbox, and earnings.'}
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link
              href="/login?next=/host"
              className="rounded-lg bg-[#164E3F] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0F392E]"
            >
              {isVi ? 'Đăng nhập Host' : 'Host sign in'}
            </Link>
            <Link
              href="/list-your-stay"
              className="rounded-lg border border-[#E5DFD3] bg-white px-5 py-2.5 text-sm font-semibold text-[#17221E] hover:bg-[#FAF8F3]"
            >
              {isVi ? 'Đăng cho thuê nhà (€0)' : 'List your stay (€0)'}
            </Link>
            <Link
              href="/"
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-[#53635D] hover:text-[#17221E]"
            >
              {isVi ? 'Về trang khách hàng' : 'Back to Guest view'}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const context = await getHostShellContext(user);
  return (
    <HostShell user={user} context={context}>
      {children}
    </HostShell>
  );
}
