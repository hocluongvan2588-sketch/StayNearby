'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowRightLeft,
  BarChart3,
  FileText,
  FolderTree,
  Image as ImageIcon,
  Plus,
  Settings,
} from 'lucide-react';

const TABS = [
  { href: '/admin/growth/content', label: 'Articles & Guides', icon: FileText, exact: true },
  { href: '/admin/growth/content/media', label: 'Media Library', icon: ImageIcon },
  { href: '/admin/growth/content/taxonomies', label: 'Categories & Tags', icon: FolderTree },
  { href: '/admin/growth/content/seo', label: 'SEO & Attribution', icon: BarChart3 },
  { href: '/admin/growth/content/redirects', label: 'Redirects (301/302)', icon: ArrowRightLeft },
  { href: '/admin/growth/content/settings', label: 'CMS & AI Settings', icon: Settings },
];

export function CmsSubNav() {
  const pathname = usePathname() ?? '/admin/growth/content';

  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[#E5DFD3] pb-3">
      <nav className="flex flex-wrap items-center gap-1.5">
        {TABS.map((tab) => {
          const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? 'bg-[#164E3F] text-white'
                  : 'bg-white text-[#53635D] border border-[#E5DFD3] hover:bg-[#FAF8F3] hover:text-[#17221E]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>

      <Link
        href="/admin/growth/content/new"
        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#164E3F] px-3.5 text-xs font-semibold text-white hover:bg-[#0F392E]"
      >
        <Plus className="h-3.5 w-3.5" />
        <span>New Article</span>
      </Link>
    </div>
  );
}
