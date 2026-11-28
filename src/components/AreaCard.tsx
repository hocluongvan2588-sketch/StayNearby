import Link from 'next/link';
import type { Locale } from '@/lib/i18n';

/**
 * Destination area (neighborhood) card — image-first, whole card links to
 * the stay search pre-filtered for that area. Shared building block for
 * Destination Pages.
 */
export function AreaCard({
  href,
  image,
  name,
  description,
  stayCount,
  locale,
}: {
  href: string;
  image?: string | null;
  name: string;
  description?: string | null;
  stayCount?: number;
  locale: Locale;
}) {
  const isVi = locale === 'vi';

  return (
    <Link
      href={href}
      className="group block rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#164E3F]"
    >
      {image ? (
        <div className="aspect-[4/3] overflow-hidden rounded-xl bg-[#F2EDE3]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt={name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        </div>
      ) : (
        <div className="aspect-[4/3] overflow-hidden rounded-xl bg-gradient-to-br from-[#F2EDE3] to-[#E7F1EC]" />
      )}

      <h3 className="mt-3 text-base font-semibold text-[#17221E] group-hover:text-[#164E3F]">
        {name}
      </h3>
      {description && (
        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-[#53635D]">
          {description}
        </p>
      )}
      {typeof stayCount === 'number' && stayCount > 0 && (
        <p className="mt-1.5 text-xs font-semibold text-[#164E3F]">
          {isVi
            ? `${stayCount} chỗ ở tại khu vực này`
            : `${stayCount} ${stayCount === 1 ? 'stay' : 'stays'} in this area`}
        </p>
      )}
    </Link>
  );
}
