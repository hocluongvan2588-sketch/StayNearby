'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calendar, Home, Inbox, Plus } from 'lucide-react';

export function HostSubNav() {
  const pathname = usePathname();

  const items = [
    { href: '/host', label: 'Chỗ ở của tôi', icon: Home, exact: true },
    { href: '/host/requests', label: 'Yêu cầu đặt phòng', icon: Inbox, exact: false },
    { href: '/host/calendar', label: 'Lịch & Giá theo ngày', icon: Calendar, exact: false },
    { href: '/host/listings/new', label: 'Đăng chỗ ở mới', icon: Plus, exact: true },
  ];

  return (
    <nav
      aria-label="Điều hướng cổng Chủ nhà"
      className="flex flex-wrap items-center gap-2 pb-4 border-b border-[var(--color-hairline)]"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`inline-flex items-center gap-2 min-h-[44px] px-4 rounded-[12px] text-sm font-medium transition-colors ${
              active
                ? 'bg-[var(--color-primary)] text-white'
                : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:border-[var(--color-primary)]'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
