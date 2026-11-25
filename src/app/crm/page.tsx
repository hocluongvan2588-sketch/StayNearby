import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Building2, ShieldCheck, Users } from 'lucide-react';
import { getQuickDemoAccount } from '@/lib/auth/demo-quick-account';
import { hasRole } from '@/lib/auth/rbac';
import { getCurrentUser } from '@/lib/auth/session';
import { PortalSwitchPrompt } from '@/components/auth/PortalSwitchPrompt';

export const dynamic = 'force-dynamic';

export default async function CrmEntryPage() {
  const user = await getCurrentUser();

  if (user && hasRole(user, 'admin')) {
    redirect('/admin/crm');
  }

  if (user && hasRole(user, 'host')) {
    return (
      <div className="container-stay py-10 max-w-3xl space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">
            Cổng CRM WorkingHome
          </p>
          <h1 className="page-title">Chọn không gian CRM phù hợp</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Bạn đang đăng nhập với tài khoản Chủ nhà ({user.displayName}). Bạn có thể mở danh sách khách hàng đặt phòng của mình ngay hoặc chuyển sang tài khoản Quản trị để mở CRM toàn hệ thống.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/host/guests"
            className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-2 hover:border-[var(--color-primary)] shadow-apple-subtle transition-colors"
          >
            <Building2 className="w-6 h-6 text-[var(--color-primary)]" aria-hidden="true" />
            <h2 className="text-base font-semibold text-[var(--color-text)]">
              CRM Khách hàng của Chủ nhà
            </h2>
            <p className="text-xs text-[var(--color-text-muted)]">
              Xem khách từng đặt chỗ ở thuộc quyền quản lý của bạn, số đêm và trạng thái đặt phòng.
            </p>
          </Link>

          <Link
            href="/login?next=/admin/crm&switch=1"
            className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-2 hover:border-[var(--color-primary)] shadow-apple-subtle transition-colors"
          >
            <ShieldCheck className="w-6 h-6 text-[var(--color-primary)]" aria-hidden="true" />
            <h2 className="text-base font-semibold text-[var(--color-text)]">
              CRM Quản trị hệ thống
            </h2>
            <p className="text-xs text-[var(--color-text-muted)]">
              Chuyển sang tài khoản Quản trị viên để quản lý toàn bộ khách hàng, chủ nhà và ghi chú CRM.
            </p>
          </Link>
        </div>

        <PortalSwitchPrompt
          title="Chuyển nhanh sang CRM Quản trị"
          message="Tài khoản hiện tại không có quyền Quản trị toàn hệ thống."
          currentEmail={user.email}
          currentRoles={user.roles}
          targetPath="/admin/crm"
          targetRoleLabel="Quản trị viên"
          quickDemoAccount={getQuickDemoAccount('admin')}
          fallbackHref="/host/guests"
          fallbackLabel="Mở CRM Khách hàng Chủ nhà"
          locale="vi"
        />
      </div>
    );
  }

  if (user) {
    return (
      <PortalSwitchPrompt
        title="CRM Quản trị & Khách hàng"
        message="Tài khoản Khách lưu trú hiện tại không có quyền truy cập CRM Quản trị hoặc CRM Chủ nhà."
        currentEmail={user.email}
        currentRoles={user.roles}
        targetPath="/admin/crm"
        targetRoleLabel="Quản trị viên"
        quickDemoAccount={getQuickDemoAccount('admin')}
        fallbackHref="/customer"
        fallbackLabel="Về cổng Khách hàng"
        locale="vi"
      />
    );
  }

  const adminDemo = getQuickDemoAccount('admin');
  const hostDemo = getQuickDemoAccount('host');

  return (
    <div className="container-stay py-10 md:py-14 max-w-3xl space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">
          Cổng CRM & Quản trị quan hệ khách hàng
        </p>
        <h1 className="page-title">Truy cập CRM Quản trị & Chủ nhà</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Đăng nhập với vai trò Quản trị viên để mở CRM toàn hệ thống (`/admin/crm`), hoặc vai trò Chủ nhà để xem khách hàng của các căn thuộc quyền quản lý (`/host/guests`).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-3 shadow-apple-subtle">
          <ShieldCheck className="w-6 h-6 text-[var(--color-primary)]" aria-hidden="true" />
          <h2 className="text-base font-semibold text-[var(--color-text)]">
            CRM Quản trị (`/admin/crm`)
          </h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            Quản lý toàn bộ Khách hàng, Chủ nhà, phân loại VIP/Follow-up, tổng GMV và ghi chú chăm sóc nội bộ.
          </p>
          <Link
            href="/login?next=/admin/crm"
            className="inline-flex items-center justify-center w-full min-h-[44px] px-4 rounded-[12px] bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)]"
          >
            Đăng nhập CRM Quản trị
            {adminDemo ? ` (${adminDemo.displayName})` : ''}
          </Link>
        </div>

        <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-3 shadow-apple-subtle">
          <Users className="w-6 h-6 text-[var(--color-primary)]" aria-hidden="true" />
          <h2 className="text-base font-semibold text-[var(--color-text)]">
            Khách hàng của Chủ nhà (`/host/guests`)
          </h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            Theo dõi khách đặt phòng cho các chỗ ở của bạn, lịch nhận/trả phòng và thông tin liên hệ sau khi xác nhận.
          </p>
          <Link
            href="/login?next=/host/guests"
            className="inline-flex items-center justify-center w-full min-h-[44px] px-4 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-medium text-[var(--color-text)] hover:border-[var(--color-primary)]"
          >
            Đăng nhập Cổng Chủ nhà
            {hostDemo ? ` (${hostDemo.displayName})` : ''}
          </Link>
        </div>
      </div>
    </div>
  );
}
