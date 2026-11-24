import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb, dbQuery } from '@/lib/db';
import { runMigrations } from '@/lib/db/migrate';
import { runSeed, SEED_IDS } from '@/lib/db/seed-data';
import { loadSessionUserById } from '@/lib/auth/session';
import { addDaysIso, getTodayIsoInTimezone } from '@/lib/format';
import { getPublishedStayBySlug, searchPublishedStays } from '@/modules/catalog';
import {
  addHostListingPhoto,
  createHostListing,
  getHostListingDetail,
  submitHostListingForReview,
  updateHostListing,
} from '@/modules/host';
import {
  approveAdminListing,
  requestChangesAdminListing,
  restoreAdminListing,
  suspendAdminListing,
} from '@/modules/admin';
import { getBookingDetail } from '@/modules/bookings';

// Minimal valid 1x1 JPEG header + EOI so verifyImageBufferSignature passes
const TINY_VALID_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
  0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
  0x00, 0x48, 0x00, 0x00, 0xff, 0xd9,
]);

describe('Host listing lifecycle, revisions, photo guard, and Admin moderation', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = '';
    process.env.PGLITE_DATA_DIR = 'memory://';
    await runMigrations();
    await runSeed();
  });

  afterAll(async () => {
    await closeDb();
  });

  it('creates draft, blocks submit without photo, goes through changes_requested -> publish -> post-publish revision -> suspend/restore', async () => {
    const host1 = await loadSessionUserById(SEED_IDS.users.host1);
    const host2 = await loadSessionUserById(SEED_IDS.users.host2);
    const admin = await loadSessionUserById(SEED_IDS.users.admin);
    const guest = await loadSessionUserById(SEED_IDS.users.guest);

    const areasRes = await dbQuery<{ id: string }>(
      `SELECT id FROM areas WHERE slug = 'tay-ho-hanoi' LIMIT 1`
    );
    const areaId = areasRes.rows[0].id;

    // 1. Host 1 creates a new draft stay
    const created = await createHostListing(host1, {
      areaId,
      propertyType: 'studio',
      maxGuests: 2,
      bedrooms: 1,
      beds: 1,
      bathrooms: 1,
      minNights: 2,
      maxNights: 30,
      baseNightlyRateVnd: 1100000,
      cleaningFeeVnd: 150000,
      titleEn: 'Phase 2 Quiet Lakeside Studio',
      summaryEn: 'Sunny studio with dedicated oak work desk near West Lake.',
      descriptionEn:
        'A calm studio created in Phase 2 workflow tests for remote workers.',
      houseRulesEn: ['Quiet hours after 22:00'],
      hasDedicatedDesk: true,
      workspaceNotesEn: 'Ergonomic desk by window',
      checkinConditionsEn: 'Check-in after 14:00, smart keypad late arrival.',
      lateCheckinAvailable: true,
      exactAddress: '99 Tô Ngọc Vân, Tây Hồ, Hà Nội',
      checkinInstructionsEn: 'Keypad #9911',
      amenityCodes: ['kitchen', 'washer', 'dedicated_desk', 'wifi'],
    });

    expect(created.status).toBe('draft');
    expect(created.photos.length).toBe(0);

    // Must not appear in public search while draft
    expect(await getPublishedStayBySlug(created.slug)).toBeNull();

    // 2. Host 2 cannot edit or upload photos to Host 1's listing
    await expect(
      updateHostListing(host2, created.id, {
        areaId,
        propertyType: 'studio',
        maxGuests: 2,
        bedrooms: 1,
        beds: 1,
        bathrooms: 1,
        minNights: 2,
        maxNights: 30,
        baseNightlyRateVnd: 1100000,
        cleaningFeeVnd: 150000,
        titleEn: 'Hijack attempt',
        summaryEn: 'Should fail',
        descriptionEn: 'Cross-host access must be denied.',
        houseRulesEn: [],
        hasDedicatedDesk: true,
        exactAddress: 'No access',
        checkinInstructionsEn: '',
      })
    ).rejects.toThrow(/permission/i);

    await expect(
      addHostListingPhoto(host2, {
        listingId: created.id,
        mimeType: 'image/jpeg',
        buffer: TINY_VALID_JPEG,
        altTextEn: 'Unauthorized',
      })
    ).rejects.toThrow(/permission/i);

    // 3. Cannot submit for review without at least 1 photo
    await expect(submitHostListingForReview(host1, created.id)).rejects.toThrow(
      /ảnh/i
    );

    // 4. Upload valid JPEG draft photo & submit for review
    const uploaded = await addHostListingPhoto(host1, {
      listingId: created.id,
      mimeType: 'image/jpeg',
      buffer: TINY_VALID_JPEG,
      altTextEn: 'Quiet studio desk',
    });
    expect(uploaded.isDraft).toBe(true);
    expect(uploaded.isCover).toBe(true);

    const submitted = await submitHostListingForReview(host1, created.id);
    expect(submitted.status).toBe('pending_review');
    expect(submitted.latestRevision.status).toBe('pending_review');

    // 5. Admin requests changes with mandatory reason
    await expect(
      requestChangesAdminListing(admin, created.id, '   ')
    ).rejects.toThrow(/lý do/i);

    const changesReq = await requestChangesAdminListing(
      admin,
      created.id,
      'Vui lòng bổ sung mô tả giờ yên tĩnh.'
    );
    expect(changesReq.status).toBe('changes_requested');
    expect(changesReq.reviewNote).toContain('giờ yên tĩnh');

    // 6. Host updates & resubmits, Admin approves -> published
    await updateHostListing(host1, created.id, {
      areaId,
      propertyType: 'studio',
      maxGuests: 2,
      bedrooms: 1,
      beds: 1,
      bathrooms: 1,
      minNights: 2,
      maxNights: 30,
      baseNightlyRateVnd: 1150000,
      cleaningFeeVnd: 150000,
      titleEn: 'Phase 2 Quiet Lakeside Studio',
      summaryEn: 'Sunny studio with dedicated oak work desk near West Lake.',
      descriptionEn:
        'A calm studio created in Phase 2 workflow tests. Quiet hours start at 22:00.',
      houseRulesEn: ['Quiet hours after 22:00'],
      hasDedicatedDesk: true,
      workspaceNotesEn: 'Ergonomic desk by window',
      checkinConditionsEn: 'Check-in after 14:00, smart keypad late arrival.',
      lateCheckinAvailable: true,
      exactAddress: '99 Tô Ngọc Vân, Tây Hồ, Hà Nội',
      checkinInstructionsEn: 'Keypad #9911',
      amenityCodes: ['kitchen', 'washer', 'dedicated_desk', 'wifi'],
    });
    await submitHostListingForReview(host1, created.id);

    const approved = await approveAdminListing(admin, created.id, 'Đạt chuẩn');
    expect(approved.status).toBe('published');

    const hostViewApproved = await getHostListingDetail(host1, created.id);
    expect(hostViewApproved.photos[0].isDraft).toBe(false);

    const publicView = await getPublishedStayBySlug(created.slug);
    expect(publicView).not.toBeNull();
    expect(publicView?.titleEn).toBe('Phase 2 Quiet Lakeside Studio');
    expect(publicView?.baseNightlyRateVnd).toBe(1150000);
    // Private address never leaks to public view
    expect(JSON.stringify(publicView)).not.toContain('99 Tô Ngọc Vân');

    // 7. Post-publish content edits go to a new draft revision WITHOUT altering published title until approved!
    const afterPostEdit = await updateHostListing(host1, created.id, {
      areaId,
      propertyType: 'studio',
      maxGuests: 2,
      bedrooms: 1,
      beds: 1,
      bathrooms: 1,
      minNights: 2,
      maxNights: 30,
      baseNightlyRateVnd: 1150000,
      cleaningFeeVnd: 150000,
      titleEn: 'Phase 2 Revised Title Pending Approval',
      summaryEn: 'Updated summary pending moderation.',
      descriptionEn: 'Updated description pending admin approval.',
      houseRulesEn: ['Quiet hours after 22:00'],
      hasDedicatedDesk: true,
      checkinConditionsEn: 'Check-in after 14:00',
      lateCheckinAvailable: true,
      exactAddress: '99 Tô Ngọc Vân, Tây Hồ, Hà Nội',
      checkinInstructionsEn: 'Keypad #9911',
      amenityCodes: ['kitchen', 'washer', 'dedicated_desk', 'wifi'],
    });

    expect(afterPostEdit.status).toBe('published');
    expect(afterPostEdit.latestRevision.revisionNumber).toBe(2);
    expect(afterPostEdit.latestRevision.status).toBe('draft');

    // Public view still shows approved v1 title!
    const publicStillV1 = await getPublishedStayBySlug(created.slug);
    expect(publicStillV1?.titleEn).toBe('Phase 2 Quiet Lakeside Studio');

    await submitHostListingForReview(host1, created.id);
    const detailAfterSubmit = await getHostListingDetail(host1, created.id);
    expect(detailAfterSubmit.latestRevision.status).toBe('pending_review');

    await approveAdminListing(admin, created.id);
    const publicNowV2 = await getPublishedStayBySlug(created.slug);
    expect(publicNowV2?.titleEn).toBe('Phase 2 Revised Title Pending Approval');

    // 8. Admin suspends a published stay -> hidden from search, existing confirmed booking remains accessible
    const confirmedSeedBooking = await getBookingDetail(
      guest,
      SEED_IDS.bookings.confirmedSample
    );
    expect(confirmedSeedBooking.status).toBe('confirmed');

    await suspendAdminListing(
      admin,
      SEED_IDS.listings.anThuongApt,
      'Tạm ẩn kiểm tra giấy tờ định kỳ'
    );
    const searchDuringSuspend = await searchPublishedStays({ page: 1, pageSize: 20 });
    expect(
      searchDuringSuspend.items.some((s) => s.id === SEED_IDS.listings.anThuongApt)
    ).toBe(false);
    // Confirmed booking on suspended listing is STILL readable by guest!
    const confirmedWhileSuspended = await getBookingDetail(
      guest,
      SEED_IDS.bookings.confirmedSample
    );
    expect(confirmedWhileSuspended.exactAddress).toContain('32 An Thượng 4');

    // Restore listing
    await restoreAdminListing(admin, SEED_IDS.listings.anThuongApt);
    const restoredSearch = await searchPublishedStays({
      area: 'an-thuong-da-nang',
      page: 1,
      pageSize: 20,
    });
    expect(
      restoredSearch.items.some((s) => s.id === SEED_IDS.listings.anThuongApt)
    ).toBe(true);

    // Ensure non-admin cannot approve or suspend
    await expect(
      suspendAdminListing(host1, SEED_IDS.listings.anThuongApt, 'No perm')
    ).rejects.toThrow(/role/i);

    const today = getTodayIsoInTimezone('Asia/Ho_Chi_Minh');
    expect(addDaysIso(today, 1) > today).toBe(true);
  });
});
