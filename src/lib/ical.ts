import crypto from 'node:crypto';
import { addDaysIso, enumerateStayNights, getTodayIsoVietnam, isValidIsoDate } from './dates';
import { dbQuery, dbTransaction, toNum } from './db';
import { AppError } from './errors';

export interface IcalBlockedRange {
  startIso: string;
  endIso: string;
  summary: string;
}

function parseIcalDateToken(raw: string): string | null {
  const clean = raw.trim().replace(/^.*:/, '');
  const match = clean.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!match) return null;
  const iso = `${match[1]}-${match[2]}-${match[3]}`;
  return isValidIsoDate(iso) ? iso : null;
}

export function parseIcalBlockedDates(icsText: string): {
  ranges: IcalBlockedRange[];
  blockedDates: string[];
} {
  // Unfold RFC 5545 folded lines
  const unfolded = icsText.replace(/\r?\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);

  const ranges: IcalBlockedRange[] = [];
  const dateSet = new Set<string>();
  const today = getTodayIsoVietnam();
  const maxHorizon = addDaysIso(today, 365);

  let inEvent = false;
  let dtStart: string | null = null;
  let dtEnd: string | null = null;
  let summary = 'External Calendar Block';

  for (const line of lines) {
    if (line.startsWith('BEGIN:VEVENT')) {
      inEvent = true;
      dtStart = null;
      dtEnd = null;
      summary = 'External Calendar Block';
      continue;
    }

    if (line.startsWith('END:VEVENT')) {
      if (inEvent && dtStart) {
        const effectiveEnd = dtEnd && dtEnd > dtStart ? dtEnd : addDaysIso(dtStart, 1);
        ranges.push({ startIso: dtStart, endIso: effectiveEnd, summary });
        const nights = enumerateStayNights(dtStart, effectiveEnd);
        for (const night of nights) {
          if (night >= today && night <= maxHorizon) {
            dateSet.add(night);
          }
        }
      }
      inEvent = false;
      continue;
    }

    if (!inEvent) continue;
    if (line.startsWith('DTSTART')) {
      dtStart = parseIcalDateToken(line);
    } else if (line.startsWith('DTEND')) {
      dtEnd = parseIcalDateToken(line);
    } else if (line.startsWith('SUMMARY:')) {
      summary = line.slice('SUMMARY:'.length).trim() || summary;
    }
  }

  return {
    ranges,
    blockedDates: Array.from(dateSet).sort(),
  };
}

export async function syncRoomIcalFeed(
  roomId: string,
  overrideUrl?: string
): Promise<{
  roomId: string;
  icalUrl: string;
  blockedDatesCount: number;
  blockedDates: string[];
  syncedAt: string;
}> {
  const roomRes = await dbQuery<{
    id: string;
    units_total: number;
    ical_url: string | null;
  }>('SELECT id, units_total, ical_url FROM stay_rooms WHERE id = $1', [roomId]);
  const room = roomRes.rows[0];
  if (!room) throw new AppError('NOT_FOUND', 'Room not found.');

  const targetUrl = (overrideUrl ?? room.ical_url ?? '').trim();
  if (!targetUrl || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) {
    throw new AppError('VALIDATION_ERROR', 'Valid http(s) iCal (.ics) feed URL required.');
  }

  let icsBody = '';
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: { Accept: 'text/calendar, text/plain' },
    });
    clearTimeout(timer);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    icsBody = await res.text();
  } catch (err) {
    await dbQuery(
      `UPDATE stay_rooms SET ical_sync_status = $1, ical_last_synced_at = NOW() WHERE id = $2`,
      [`error: ${err instanceof Error ? err.message : 'fetch failed'}`, roomId]
    );
    throw new AppError(
      'UNAVAILABLE',
      `Failed to fetch iCal feed from ${targetUrl}: ${err instanceof Error ? err.message : 'network error'}`,
      502
    );
  }

  const parsed = parseIcalBlockedDates(icsBody);
  const unitsTotal = toNum(room.units_total, 1);
  const syncedAt = new Date().toISOString();

  await dbTransaction(async (tx) => {
    for (const dateIso of parsed.blockedDates) {
      await tx.query(
        `INSERT INTO room_night_locks (id, room_id, stay_date, booked_units, blocked_units)
         VALUES ($1, $2, $3::date, 0, $4)
         ON CONFLICT (room_id, stay_date)
         DO UPDATE SET blocked_units = GREATEST(room_night_locks.blocked_units, GREATEST(0, $4 - room_night_locks.booked_units))`,
        [crypto.randomUUID(), roomId, dateIso, unitsTotal]
      );
    }

    await tx.query(
      `UPDATE stay_rooms
       SET ical_url = $1,
           ical_last_synced_at = NOW(),
           ical_sync_status = $2
       WHERE id = $3`,
      [targetUrl, `synced (${parsed.blockedDates.length} dates locked)`, roomId]
    );
  });

  return {
    roomId,
    icalUrl: targetUrl,
    blockedDatesCount: parsed.blockedDates.length,
    blockedDates: parsed.blockedDates,
    syncedAt,
  };
}

export async function syncAllRegisteredIcals() {
  const res = await dbQuery<{ id: string; ical_url: string }>(
    `SELECT id, ical_url FROM stay_rooms WHERE ical_url IS NOT NULL AND TRIM(ical_url) <> ''`
  );

  const results: Array<{ roomId: string; status: string; blockedDatesCount?: number }> = [];
  for (const row of res.rows) {
    try {
      const synced = await syncRoomIcalFeed(row.id, row.ical_url);
      results.push({
        roomId: row.id,
        status: 'ok',
        blockedDatesCount: synced.blockedDatesCount,
      });
    } catch (err) {
      results.push({
        roomId: row.id,
        status: err instanceof Error ? err.message : 'error',
      });
    }
  }
  return results;
}
