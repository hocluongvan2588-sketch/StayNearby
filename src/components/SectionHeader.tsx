import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

/**
 * Shared guest-platform section header: one heading style, optional link.
 * No subtitles by default — add one only when it adds information the
 * heading does not already carry (docs/UI_PRINCIPLES.md).
 */
export function SectionHeader({
  title,
  linkHref,
  linkLabel,
}: {
  title: string;
  linkHref?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <h2 className="text-[26px] font-semibold tracking-tight text-[#17221E] sm:text-[32px]">
        {title}
      </h2>
      {linkHref && linkLabel ? (
        <Link
          href={linkHref}
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-[#164E3F] hover:underline"
        >
          {linkLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
      ) : null}
    </div>
  );
}
