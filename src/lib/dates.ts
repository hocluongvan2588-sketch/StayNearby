export function getTodayIsoVietnam(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value ?? '2026';
  const m = parts.find((p) => p.type === 'month')?.value ?? '11';
  const d = parts.find((p) => p.type === 'day')?.value ?? '25';
  return `${y}-${m}-${d}`;
}

export function addDaysIso(dateIso: string, days: number): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function diffNightsIso(checkInIso: string, checkOutIso: string): number {
  const start = Date.parse(`${checkInIso}T00:00:00Z`);
  const end = Date.parse(`${checkOutIso}T00:00:00Z`);
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
}

export function enumerateStayNights(checkInIso: string, checkOutIso: string): string[] {
  const nights = diffNightsIso(checkInIso, checkOutIso);
  const result: string[] = [];
  for (let i = 0; i < nights; i += 1) {
    result.push(addDaysIso(checkInIso, i));
  }
  return result;
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const dt = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(dt) && new Date(dt).toISOString().slice(0, 10) === value;
}

export function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}
