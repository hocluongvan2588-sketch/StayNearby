'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, LayoutGrid, X } from 'lucide-react';

export interface GalleryPhotoItem {
  url: string;
  label: string;
  category?: string;
}

interface StayPhotoGalleryProps {
  title: string;
  heroImage: string;
  workspacePhotoUrl: string;
  hasWorkspace?: boolean;
  galleryImages: string[];
  roomPhotos?: Array<{ url: string; label: string }>;
  locale: 'vi' | 'en';
}

export function StayPhotoGallery({
  title,
  heroImage,
  workspacePhotoUrl,
  hasWorkspace = false,
  galleryImages,
  roomPhotos = [],
  locale,
}: StayPhotoGalleryProps) {
  const isVi = locale === 'vi';
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const touchStartX = useRef<number | null>(null);

  const photos = useMemo<GalleryPhotoItem[]>(() => {
    const seen = new Set<string>();
    const items: GalleryPhotoItem[] = [];

    const addUnique = (url: string, label: string, category?: string) => {
      const clean = url?.trim();
      if (!clean || seen.has(clean)) return;
      seen.add(clean);
      items.push({ url: clean, label, category });
    };

    addUnique(heroImage, title, isVi ? 'Không gian chính' : 'Primary space');

    galleryImages.forEach((img, idx) => {
      addUnique(
        img,
        isVi ? `${title} · Không gian ${idx + 1}` : `${title} · Space ${idx + 1}`,
        isVi ? 'Nội thất & Tiện ích' : 'Living space'
      );
    });

    roomPhotos.forEach((rm) => {
      addUnique(rm.url, rm.label, isVi ? 'Phòng ngủ' : 'Room');
    });

    if (hasWorkspace && workspacePhotoUrl) {
      addUnique(
        workspacePhotoUrl,
        isVi ? 'Khu vực bàn làm việc' : 'Workspace area',
        isVi ? 'Góc làm việc' : 'Workspace'
      );
    }

    return items;
  }, [galleryImages, hasWorkspace, heroImage, isVi, roomPhotos, title, workspacePhotoUrl]);

  const total = photos.length;
  const isOpen = activeIndex !== null && total > 0;

  const close = useCallback(() => setActiveIndex(null), []);

  const showPrev = useCallback(() => {
    setActiveIndex((prev) => (prev === null ? null : (prev - 1 + total) % total));
  }, [total]);

  const showNext = useCallback(() => {
    setActiveIndex((prev) => (prev === null ? null : (prev + 1) % total));
  }, [total]);

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') showPrev();
      if (e.key === 'ArrowRight') showNext();
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [close, isOpen, showNext, showPrev]);

  useEffect(() => {
    if (activeIndex === null) return;
    const el = thumbRefs.current[activeIndex];
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeIndex]);

  if (total === 0) return null;

  const renderPhotoTile = (
    photo: GalleryPhotoItem,
    index: number,
    className: string,
    showAllButton = false
  ) => (
    <div
      key={`${photo.url}-${index}`}
      className={`group relative overflow-hidden bg-[#F2EDE3] ${className}`}
    >
      <button
        type="button"
        onClick={() => setActiveIndex(index)}
        aria-label={
          isVi
            ? `Phóng to ảnh ${index + 1} trên ${total}`
            : `Open photo ${index + 1} of ${total}`
        }
        className="block h-full w-full cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#164E3F]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt={photo.label}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />
        <div className="pointer-events-none absolute inset-0 bg-black/0 transition duration-300 group-hover:bg-black/10" />
      </button>

      {showAllButton && (
        <button
          type="button"
          onClick={() => setActiveIndex(0)}
          className="absolute bottom-3.5 right-3.5 inline-flex items-center gap-1.5 rounded-xl border border-[#17221E]/15 bg-white/95 px-3.5 py-2 text-xs font-semibold text-[#17221E] shadow-md backdrop-blur-sm transition hover:bg-white"
        >
          <LayoutGrid className="h-3.5 w-3.5 text-[#17221E]" />
          {isVi ? `Hiển thị tất cả ${total} ảnh` : `Show all ${total} photos`}
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile swipeable carousel */}
      <div className="mb-8 sm:hidden">
        <div className="relative">
          <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto rounded-2xl pb-1">
            {photos.map((photo, idx) => (
              <button
                key={`${photo.url}-mobile-${idx}`}
                type="button"
                onClick={() => setActiveIndex(idx)}
                className="relative aspect-[4/3] w-[90%] shrink-0 snap-center overflow-hidden rounded-2xl bg-[#F2EDE3] text-left"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={photo.label}
                  className="h-full w-full object-cover"
                />
                <span className="absolute bottom-2.5 right-2.5 rounded-full bg-black/65 px-2.5 py-0.5 text-[11px] font-medium text-white tabular-nums">
                  {idx + 1} / {total}
                </span>
              </button>
            ))}
          </div>
          {total > 1 && (
            <button
              type="button"
              onClick={() => setActiveIndex(0)}
              className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#E5DFD3] bg-white px-4 py-2.5 text-xs font-semibold text-[#17221E]"
            >
              <LayoutGrid className="h-3.5 w-3.5 text-[#164E3F]" />
              {isVi ? `Xem toàn bộ ${total} ảnh` : `Show all ${total} photos`}
            </button>
          )}
        </div>
      </div>

      {/* Desktop / tablet adaptive Bento grid */}
      <div className="mb-10 hidden sm:block">
        {total === 1 && (
          <div className="overflow-hidden rounded-2xl">
            {renderPhotoTile(photos[0], 0, 'h-[380px] lg:h-[460px]')}
          </div>
        )}

        {total === 2 && (
          <div className="grid grid-cols-2 gap-2 overflow-hidden rounded-2xl">
            {renderPhotoTile(photos[0], 0, 'h-[380px] lg:h-[460px]')}
            {renderPhotoTile(photos[1], 1, 'h-[380px] lg:h-[460px]', true)}
          </div>
        )}

        {total === 3 && (
          <div className="grid grid-cols-12 gap-2 overflow-hidden rounded-2xl">
            {renderPhotoTile(photos[0], 0, 'col-span-7 h-[380px] lg:h-[460px]')}
            <div className="col-span-5 grid h-[380px] grid-rows-2 gap-2 lg:h-[460px]">
              {renderPhotoTile(photos[1], 1, 'h-full')}
              {renderPhotoTile(photos[2], 2, 'h-full', true)}
            </div>
          </div>
        )}

        {total === 4 && (
          <div className="grid grid-cols-12 gap-2 overflow-hidden rounded-2xl">
            {renderPhotoTile(photos[0], 0, 'col-span-6 h-[380px] lg:h-[460px]')}
            <div className="col-span-6 grid h-[380px] grid-rows-2 gap-2 lg:h-[460px]">
              {renderPhotoTile(photos[1], 1, 'h-full')}
              <div className="grid grid-cols-2 gap-2">
                {renderPhotoTile(photos[2], 2, 'h-full')}
                {renderPhotoTile(photos[3], 3, 'h-full', true)}
              </div>
            </div>
          </div>
        )}

        {total >= 5 && (
          <div className="grid grid-cols-12 gap-2 overflow-hidden rounded-2xl">
            {renderPhotoTile(photos[0], 0, 'col-span-6 h-[400px] lg:h-[460px]')}
            <div className="col-span-6 grid h-[400px] grid-cols-2 grid-rows-2 gap-2 lg:h-[460px]">
              {renderPhotoTile(photos[1], 1, 'h-full')}
              {renderPhotoTile(photos[2], 2, 'h-full')}
              {renderPhotoTile(photos[3], 3, 'h-full')}
              {renderPhotoTile(photos[4], 4, 'h-full', true)}
            </div>
          </div>
        )}
      </div>

      {/* Fullscreen Lightbox */}
      {isOpen && activeIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={isVi ? 'Thư viện ảnh chỗ ở' : 'Stay photo gallery'}
          className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white backdrop-blur-sm"
          onClick={close}
        >
          <div
            className="flex items-center justify-between px-4 py-3.5 sm:px-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-sm">
              <span className="rounded-full bg-white/15 px-3 py-1 font-semibold tabular-nums">
                {activeIndex + 1} / {total}
              </span>
              <span className="hidden truncate font-medium text-white/90 sm:inline">
                {photos[activeIndex].label}
              </span>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label={isVi ? 'Đóng thư viện ảnh' : 'Close gallery'}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white/15 px-4 text-xs font-semibold text-white transition hover:bg-white/25"
            >
              <X className="h-4 w-4" />
              {isVi ? 'Đóng' : 'Close'}
            </button>
          </div>

          <div
            className="relative flex flex-1 items-center justify-center px-3 sm:px-16"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => {
              touchStartX.current = e.touches[0]?.clientX ?? null;
            }}
            onTouchEnd={(e) => {
              if (touchStartX.current === null) return;
              const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
              const diff = endX - touchStartX.current;
              touchStartX.current = null;
              if (Math.abs(diff) > 40) {
                if (diff > 0) showPrev();
                else showNext();
              }
            }}
          >
            {total > 1 && (
              <button
                type="button"
                onClick={showPrev}
                aria-label={isVi ? 'Ảnh trước' : 'Previous photo'}
                className="absolute left-3 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white transition hover:bg-white/20 sm:left-6"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photos[activeIndex].url}
              alt={photos[activeIndex].label}
              className="max-h-[68vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl select-none"
            />

            {total > 1 && (
              <button
                type="button"
                onClick={showNext}
                aria-label={isVi ? 'Ảnh tiếp theo' : 'Next photo'}
                className="absolute right-3 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white transition hover:bg-white/20 sm:right-6"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            )}
          </div>

          {total > 1 && (
            <div
              className="border-t border-white/10 bg-black/60 px-4 py-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto flex max-w-4xl items-center justify-start gap-2 overflow-x-auto pb-1 sm:justify-center">
                {photos.map((photo, idx) => (
                  <button
                    key={`${photo.url}-thumb-${idx}`}
                    ref={(el) => {
                      thumbRefs.current[idx] = el;
                    }}
                    type="button"
                    onClick={() => setActiveIndex(idx)}
                    aria-label={isVi ? `Chọn ảnh ${idx + 1}` : `Select photo ${idx + 1}`}
                    className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                      idx === activeIndex
                        ? 'scale-105 border-white opacity-100'
                        : 'border-transparent opacity-55 hover:opacity-90'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt={photo.label}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
