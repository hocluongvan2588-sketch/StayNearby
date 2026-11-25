'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  ClipboardList,
  Compass,
  ShieldCheck,
  Users,
} from 'lucide-react';

export function AdminSubNav() {
  const pathname = usePathname();
  const isListings =
    pathname === '/admin' || pathname.startsWith('/admin/listings');
  const isBookings = pathname.startsWith('/admin/bookings');
  const isCrm = pathname.startsWith('/admin/crm');
  const isOps = pathname.startsWith('/admin/ops');
  const isLocalGuides = pathname.startsWith('/admin/local-guides');

  return (
    <nav
      aria-label="Điều hướng Quản trị"
      className="flex flex-wrap items-center gap-2 pb-4 border-b border-[var(--color-hairline)]"
    >
      <Link
        href="/admin/listings"
        className={`inline-flex items-center gap-2 min-h-[44px] px-4 rounded-[12px] text-sm font-medium transition-colors ${
          isListings
            ? 'bg-[var(--color-primary)] text-white'
            : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:border-[var(--color-primary)]'
        }`}
      >
        <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>Kiểm duyệt chỗ ở</span>
      </Link>

      <Link
        href="/admin/bookings"
        className={`inline-flex items-center gap-2 min-h-[44px] px-4 rounded-[12px] text-sm font-medium transition-colors ${
          isBookings
            ? 'bg-[var(--color-primary)] text-white'
            : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:border-[var(--color-primary)]'
        }`}
      >
        <ClipboardList className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>Tra cứu & Hỗ trợ đơn</span>
      </Link>

      <Link
        href="/admin/crm"
        className={`inline-flex items-center gap-2 min-h-[44px] px-4 rounded-[12px] text-sm font-medium transition-colors ${
          isCrm
            ? 'bg-[var(--color-primary)] text-white'
            : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:border-[var(--color-primary)]'
        }`}
      >
        <Users className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>CRM & Khách hàng</span>
      </Link>

      <Link
        href="/admin/ops"
        className={`inline-flex items-center gap-2 min-h-[44px] px-4 rounded-[12px] text-sm font-medium transition-colors ${
          isOps
            ? 'bg-[var(--color-primary)] text-white'
            : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:border-[var(--color-primary)]'
        }`}
      >
        <Activity className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>Vận hành & Thông báo</span>
      </Link>

      <Link
        href="/admin/local-guides"
        className={`inline-flex items-center gap-2 min-h-[44px] px-4 rounded-[12px] text-sm font-medium transition-colors ${
          isLocalGuides
            ? 'bg-[var(--color-primary)] text-white'
            : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:border-[var(--color-primary)]'
        }`}
      >
        <Compass className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>Cẩm nang địa phương</span>
      </Link>
    </nav>
  );
}
