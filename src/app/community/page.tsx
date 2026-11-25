import { getCurrentUser } from '@/lib/auth/session';
import { dbQuery } from '@/lib/db';
import { getCommunityAndMarketplaceData } from '@/modules/catalog';
import { CommunityClient } from '@/components/CommunityClient';

export const dynamic = 'force-dynamic';

export default async function CommunityPage() {
  const [user, data] = await Promise.all([
    getCurrentUser(),
    getCommunityAndMarketplaceData(),
  ]);

  let rsvpEventIds: string[] = [];
  if (user) {
    const r = await dbQuery<{ event_id: string }>(
      'SELECT event_id FROM event_rsvps WHERE user_id = $1',
      [user.id]
    );
    rsvpEventIds = r.rows.map((x) => x.event_id);
  }

  return (
    <CommunityClient
      user={user}
      events={data.events}
      marketplace={data.marketplaceItems}
      rsvpEventIds={rsvpEventIds}
    />
  );
}
