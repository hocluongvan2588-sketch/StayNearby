'use client';

import { useState } from 'react';
import { getUserMessages } from '@/lib/i18n/messages';
import { useUserPreferences } from '@/components/i18n/UserPreferencesProvider';
import type { PublicPhoto } from '@/modules/catalog';
import { FallbackImage } from '@/components/ui/FallbackImage';

interface StayGalleryProps {
  photos: PublicPhoto[];
  stayTitle: string;
}

export function StayGallery({ photos, stayTitle }: StayGalleryProps) {
  const { preferences } = useUserPreferences();
  const locale = preferences.locale;
  const t = getUserMessages(locale);

  const [activeIdx, setActiveIdx] = useState(0);
  const current = photos[activeIdx] ?? null;

  if (photos.length === 0) {
    return (
      <FallbackImage
        src={null}
        alt={stayTitle}
        fallbackLabel={t.stayDetail.noPhotosYet}
      />
    );
  }

  const currentAlt = current
    ? locale === 'vi'
      ? current.altTextVi
      : current.altTextEn
    : stayTitle;

  return (
    <div className="space-y-3">
      <FallbackImage src={current?.url} alt={currentAlt} />

      {photos.length > 1 && (
        <div
          className="flex items-center gap-3 overflow-x-auto pb-1"
          role="region"
          aria-label="Stay photo thumbnails"
        >
          {photos.map((photo, idx) => {
            const alt = locale === 'vi' ? photo.altTextVi : photo.altTextEn;
            return (
              <button
                key={photo.id}
                type="button"
                onClick={() => setActiveIdx(idx)}
                aria-label={`${t.stayDetail.viewPhotoPrefix} ${idx + 1}: ${alt}`}
                aria-pressed={idx === activeIdx}
                className={`shrink-0 w-24 rounded-[12px] overflow-hidden border-2 transition-colors ${
                  idx === activeIdx
                    ? 'border-[var(--color-primary)]'
                    : 'border-[var(--color-border)] opacity-80 hover:opacity-100'
                }`}
              >
                <div className="aspect-[4/3] w-full bg-[var(--color-surface-muted)]">
                  <img
                    src={photo.url}
                    alt={alt}
                    className="w-full h-full object-cover block"
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
