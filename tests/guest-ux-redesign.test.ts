import { describe, expect, it } from 'vitest';
import type { SessionUser } from '@/lib/auth/session';
import { ensureDbReady, dbQuery } from '@/lib/db';
import { normalizePlaceExploreGroup } from '@/lib/i18n';
import { getDestinationLocalPlaces, getStayDetailBySlug } from '@/modules/catalog';
import { getGuestInquiryThreadForStay, sendGuestInquiryToHost } from '@/modules/host-inbox';

describe('Guest UX Redesign & Schema 0009 Integration', () => {
  it('normalizes local discovery place categories across all exploration groups', () => {
    expect(normalizePlaceExploreGroup('restaurant')).toBe('food');
    expect(normalizePlaceExploreGroup('cafe_roastery')).toBe('coffee');
    expect(normalizePlaceExploreGroup('beach')).toBe('attractions');
    expect(normalizePlaceExploreGroup('experience')).toBe('experiences');
    expect(normalizePlaceExploreGroup('entertainment')).toBe('entertainment');
    expect(normalizePlaceExploreGroup('shopping')).toBe('shopping');
    expect(normalizePlaceExploreGroup('wellness')).toBe('wellness');
    expect(normalizePlaceExploreGroup('coworking')).toBe('coworking');
    expect(normalizePlaceExploreGroup('daily_essential')).toBe('essentials');
  });

  it('hydrates stay detail with nullable property specs and curated local places without inventing missing numbers', async () => {
    await ensureDbReady();
    const row = await dbQuery<{ slug: string }>(
      `SELECT s.slug
       FROM stays s
       JOIN destinations d ON d.id = s.destination_id
       WHERE d.slug = 'da-nang' AND s.status = 'live'
       ORDER BY s.featured_rank ASC
       LIMIT 1`
    );
    const slug = row.rows[0]?.slug;
    expect(slug).toBeTruthy();
    const stay = await getStayDetailBySlug(slug!);
    expect(stay).not.toBeNull();
    expect(stay?.isEntirePlace).toBe(true);
    expect(stay?.localPlaces.length).toBeGreaterThan(0);

    for (const pl of stay?.localPlaces ?? []) {
      expect(pl.imageUrl.length).toBeGreaterThan(0);
    }

    expect(stay?.bedrooms === null || typeof stay?.bedrooms === 'number').toBe(true);
    expect(stay?.bathrooms === null || typeof stay?.bathrooms === 'number').toBe(true);
    expect(stay?.areaSqm === null || typeof stay?.areaSqm === 'number').toBe(true);

    const daNangPlaces = await getDestinationLocalPlaces('da-nang');
    expect(daNangPlaces.length).toBeGreaterThanOrEqual(4);
    expect(
      daNangPlaces.some((p) => p.category === 'beach' || p.category === 'attraction')
    ).toBe(true);
    expect(
      daNangPlaces.some((p) => p.category === 'cafe_roastery' || p.category === 'cafe')
    ).toBe(true);
  });

  it('persists guest-to-host inquiry messages and reads them back from the thread', async () => {
    await ensureDbReady();
    const guestRes = await dbQuery<{
      id: string;
      email: string;
      full_name: string;
      nationality: string;
      membership_tier: 'free' | 'premium';
      vat_tax_id: string | null;
      reward_credit_vnd: number;
    }>(
      `SELECT id, email, full_name, nationality, membership_tier, vat_tax_id, reward_credit_vnd
       FROM users WHERE role = 'nomad' LIMIT 1`
    );
    const stayRes = await dbQuery<{ slug: string }>(
      `SELECT slug FROM stays WHERE status = 'live' LIMIT 1`
    );

    const g = guestRes.rows[0];
    const staySlug = stayRes.rows[0]?.slug;
    expect(g).toBeTruthy();
    expect(staySlug).toBeTruthy();

    const guestUser: SessionUser = {
      id: g.id,
      email: g.email,
      fullName: g.full_name,
      role: 'nomad',
      nationality: g.nationality,
      membershipTier: g.membership_tier,
      membershipExpiresAt: null,
      vatTaxId: g.vat_tax_id,
      rewardCreditVnd: Number(g.reward_credit_vnd ?? 0),
      preferredLocale: 'en',
      preferredCurrency: 'USD',
      phone: '',
    };

    const sent = await sendGuestInquiryToHost(
      guestUser,
      staySlug!,
      'Hi, does this apartment have an elevator and early luggage drop-off?'
    );
    expect(sent.conversationId).toBeTruthy();
    expect(sent.message.body).toContain('early luggage drop-off');

    const thread = await getGuestInquiryThreadForStay(guestUser, staySlug!);
    expect(thread.conversationId).toBe(sent.conversationId);
    expect(thread.messages.some((m) => m.body.includes('early luggage drop-off'))).toBe(true);
  });
});
