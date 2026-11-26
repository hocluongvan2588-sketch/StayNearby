'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { trackClientEvent } from '@/lib/attribution';

export function PartnerPerkTrackerLink({
  partnerId,
  partnerName,
  href,
  label,
}: {
  partnerId: string;
  partnerName: string;
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      onClick={() => {
        void trackClientEvent({
          eventName: 'search',
          landingPath: href,
          utmContent: `partner_perk:${partnerId}:${partnerName}`,
        });
      }}
      className="inline-flex items-center gap-1 text-xs font-semibold text-[#164E3F] hover:underline"
    >
      {label}
      <ExternalLink className="h-3 w-3" />
    </Link>
  );
}
