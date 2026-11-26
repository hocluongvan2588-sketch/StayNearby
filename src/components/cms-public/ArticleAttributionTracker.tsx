'use client';

import { useEffect, useRef } from 'react';
import { trackClientEvent } from '@/lib/attribution';

export function ArticleAttributionTracker({
  eventType = 'article_view',
  contentId,
  contentSlug,
  destinationSlug,
}: {
  eventType?: 'article_view' | 'destination_view';
  contentId?: string;
  contentSlug?: string;
  destinationSlug?: string;
}) {
  const sentRef = useRef(false);

  useEffect(() => {
    if (sentRef.current) return;
    sentRef.current = true;
    void trackClientEvent({
      eventName: eventType,
      contentId,
      destinationSlug,
      dedupeKey: `${eventType}:${contentId ?? contentSlug ?? destinationSlug ?? 'page'}`,
    });
  }, [eventType, contentId, contentSlug, destinationSlug]);

  return null;
}
