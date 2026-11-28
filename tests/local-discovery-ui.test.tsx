// @vitest-environment jsdom
/**
 * Local Discovery UI (DOM-level): place detail modal, explore grid dedupe,
 * honest empty states, tracking calls, and responsive (mobile sheet / desktop
 * modal) markup. Runs in jsdom — real-browser screenshots are not available in
 * this sandbox, so these assertions cover behavior + responsive class contracts.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalPlaceDetailModal } from '@/components/LocalPlaceDetailModal';
import { StayNeighborhoodExplore } from '@/components/StayNeighborhoodExplore';
import type { LocalDiscoveryPlace } from '@/modules/catalog';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: unknown; children: React.ReactNode }) => (
    <a href={typeof href === 'string' ? href : '#'} {...rest}>
      {children}
    </a>
  ),
}));

function makePlace(overrides: Partial<LocalDiscoveryPlace> = {}): LocalDiscoveryPlace {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    slug: 'test-place',
    name: 'Test Place',
    category: 'coworking',
    address: '1 Test Street',
    lat: null,
    lng: null,
    priceRange: '',
    openingHours: '',
    descriptionEn: 'Quiet desks',
    descriptionVi: 'Bàn làm việc yên tĩnh',
    imageUrl: '',
    neighborhoodNameEn: 'Son Tra',
    neighborhoodNameVi: 'Sơn Trà',
    verificationStatus: 'verified',
    website: 'https://example.com',
    isOnsite: false,
    linkSource: 'host_suggested',
    hostNote: 'Great for deep work',
    rating: null,
    reviewCount: null,
    ...overrides,
  };
}

const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('LocalPlaceDetailModal', () => {
  it('shows source label, host reason, website button — and no fake rating/price', () => {
    render(<LocalPlaceDetailModal place={makePlace()} locale="vi" onClose={() => {}} />);

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText(/Chủ nhà giới thiệu/)).toBeTruthy();
    expect(screen.getByText('Lý do chủ nhà giới thiệu')).toBeTruthy();
    expect(screen.getByText('Great for deep work')).toBeTruthy();
    expect(screen.getByText('Truy cập website')).toBeTruthy();
    // honest empties: no rating (null), no price/hours rows ('')
    expect(screen.queryByText('Mức giá tham khảo')).toBeNull();
    expect(screen.queryByText('Giờ mở cửa')).toBeNull();
    expect(screen.queryByText('4.8')).toBeNull();
  });

  it('omits website button when there is no website', () => {
    render(
      <LocalPlaceDetailModal place={makePlace({ website: '' })} locale="vi" onClose={() => {}} />
    );
    expect(screen.queryByText('Truy cập website')).toBeNull();
    expect(screen.getByText('Chỉ đường trên Google Maps')).toBeTruthy();
  });

  it('uses curated source label for VietNomad links', () => {
    render(
      <LocalPlaceDetailModal
        place={makePlace({ linkSource: 'curated', hostNote: undefined })}
        locale="vi"
        onClose={() => {}}
      />
    );
    expect(screen.getByText(/VietNomad biên tập/)).toBeTruthy();
    expect(screen.queryByText('Lý do chủ nhà giới thiệu')).toBeNull();
  });

  it('tracks place_detail_view on open and place_website_click on click', async () => {
    render(<LocalPlaceDetailModal place={makePlace()} locale="vi" onClose={() => {}} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const detailCall = fetchMock.mock.calls.find(
      (c) => String(c[1]?.body ?? '').includes('place_detail_view')
    );
    expect(detailCall).toBeTruthy();
    expect(String(detailCall![1].body)).toContain(makePlace().id);

    fireEvent.click(screen.getByText('Truy cập website'));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((c) => String(c[1]?.body ?? '').includes('place_website_click'))
      ).toBe(true)
    );
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<LocalPlaceDetailModal place={makePlace()} locale="vi" onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('responsive contract: bottom sheet on mobile, centered card on desktop, 44px touch target', () => {
    render(<LocalPlaceDetailModal place={makePlace()} locale="vi" onClose={() => {}} />);
    const dialog = screen.getByRole('dialog');
    // mobile: sheet anchored to bottom; desktop (sm:): centered modal
    expect(dialog.className).toContain('items-end');
    expect(dialog.className).toContain('sm:items-center');
    const panel = dialog.firstElementChild as HTMLElement;
    expect(panel.className).toContain('rounded-t-2xl');
    expect(panel.className).toContain('sm:rounded-2xl');
    // primary action meets minimum touch target
    const maps = screen.getByText('Chỉ đường trên Google Maps').closest('a')!;
    expect(maps.className).toContain('min-h-[44px]');
  });
});

describe('StayNeighborhoodExplore', () => {
  const base = {
    destinationSlug: 'da-nang',
    destinationName: 'Da Nang',
    neighborhoodName: 'An Thuong',
    locale: 'vi' as const,
  };

  it('deduplicates legacy coworking against linked places (punctuation-insensitive)', () => {
    const linked = makePlace({
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Enouvo Space — An Thuong',
      linkSource: 'curated',
      hostNote: undefined,
    });
    const { container } = render(
      <StayNeighborhoodExplore
        {...base}
        localPlaces={[linked]}
        nearbyCoworking={[
          { name: 'Enouvo Space An Thuong', noteEn: 'dup', noteVi: 'dup', dayPassVnd: 150000, distanceKm: 0.4, hasCallBooth: true },
          { name: 'Fresh Legacy Spot', noteEn: 'legacy only', noteVi: 'legacy only', dayPassVnd: 100000, distanceKm: 1.2, hasCallBooth: false },
        ]}
      />
    );
    const enouvoCards = screen.getAllByText(/Enouvo Space/);
    expect(enouvoCards.length).toBe(1);
    expect(screen.getByText('Fresh Legacy Spot')).toBeTruthy();
    // legacy fallback must not invent a '$$' price level
    expect(container.textContent).not.toContain('$$');
    // legacy fallback is never claimed verified
    expect(container.textContent).not.toContain('Đã xác minh');
  });

  it('filters by category tab (coworking only)', () => {
    render(
      <StayNeighborhoodExplore
        {...base}
        localPlaces={[
          makePlace({ id: '33333333-3333-4333-8333-333333333333', name: 'Noodle House', category: 'restaurant' }),
          makePlace({ id: '44444444-4444-4444-8444-444444444444', name: 'Desk Hub', category: 'coworking' }),
        ]}
        nearbyCoworking={[]}
      />
    );
    expect(screen.getByText('Noodle House')).toBeTruthy();
    const coworkingTab = screen.getAllByText('Coworking').find((el) => el.tagName === 'BUTTON');
    expect(coworkingTab).toBeTruthy();
    fireEvent.click(coworkingTab!);
    expect(screen.queryByText('Noodle House')).toBeNull();
    expect(screen.getByText('Desk Hub')).toBeTruthy();
  });

  it('opens the detail modal from a card and keeps booking state untouched (overlay only)', async () => {
    render(
      <StayNeighborhoodExplore
        {...base}
        localPlaces={[makePlace({ id: '55555555-5555-4555-8555-555555555555', name: 'Click Target' })]}
        nearbyCoworking={[]}
      />
    );
    fireEvent.click(screen.getByText('Click Target'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Click Target')).toBeTruthy();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    // modal close returns to the grid
    fireEvent.click(screen.getByLabelText('Đóng'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Click Target')).toBeTruthy();
  });
});
