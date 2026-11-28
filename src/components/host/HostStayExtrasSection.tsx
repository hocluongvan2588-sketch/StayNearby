'use client';

/**
 * Host editor section — "Dịch vụ bổ sung" (Stay Extras).
 * Host declares which services they provide per stay: description, price
 * unit, deposit, lead time, provider, cancellation terms. The platform does
 * NOT collect money for these services; guests pay providers directly.
 */

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';

interface CatalogItem {
  id: string;
  key: string;
  nameEn: string;
  nameVi: string;
  allowedUnits: string[];
  enabled: boolean;
}

interface StayServiceRow {
  id: string;
  catalogId: string;
  catalogKey: string;
  nameEn: string;
  nameVi: string;
  allowedUnits: string[];
  enabled: boolean;
  priceVnd: number | null;
  priceUnit: string;
  isIncluded: boolean;
  descriptionEn: string;
  descriptionVi: string;
  conditionsEn: string;
  conditionsVi: string;
  depositVnd: number | null;
  leadTimeHours: number | null;
  providerType: 'host' | 'third_party';
  changeCancelEn: string;
  changeCancelVi: string;
  activeRequestCount: number;
}

const UNIT_LABELS: Record<string, { vi: string; en: string }> = {
  day: { vi: 'Ngày', en: 'Day' },
  week: { vi: 'Tuần', en: 'Week' },
  month: { vi: 'Tháng', en: 'Month' },
  trip: { vi: 'Chuyến', en: 'Trip' },
  visit: { vi: 'Lần', en: 'Visit' },
  quote: { vi: 'Theo yêu cầu', en: 'By quote' },
};

function InfoTip({ tipVi, tipEn, isVi }: { tipVi: string; tipEn: string; isVi: boolean }) {
  return (
    <span
      tabIndex={0}
      className="relative ml-1 inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-current text-[10px] font-bold opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
      aria-label={isVi ? tipVi : tipEn}
    >
      i
      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden w-56 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-left text-[11px] font-normal normal-case leading-snug text-white shadow-lg group-hover:block group-focus-within:block">
        {isVi ? tipVi : tipEn}
      </span>
    </span>
  );
}

export function HostStayExtrasSection({ stayId, isVi }: { stayId: string; isVi: boolean }) {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [services, setServices] = useState<StayServiceRow[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [catRes, svcRes] = await Promise.all([
        fetch('/api/service-catalog').then((r) => r.json()),
        fetch(`/api/host/services?stayId=${stayId}`).then((r) => r.json()),
      ]);
      setCatalog(catRes?.catalog ?? []);
      setServices(svcRes?.services ?? []);
    } catch {
      setError(isVi ? 'Không tải được dữ liệu.' : 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, [stayId, isVi]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const byCatalog = new Map(services.map((s) => [s.catalogId, s]));

  async function addService(cat: CatalogItem) {
    setSavingId(cat.id);
    setError('');
    try {
      const res = await fetch('/api/host/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stayId,
          catalogId: cat.id,
          enabled: true,
          priceUnit: cat.allowedUnits[0] ?? 'quote',
          isIncluded: false,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'Error');
      setExpandedId(json.data.service.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setSavingId(null);
    }
  }

  async function saveService(svc: StayServiceRow, patch: Partial<StayServiceRow>) {
    setSavingId(svc.id);
    setError('');
    try {
      const res = await fetch('/api/host/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: svc.id,
          stayId,
          catalogId: svc.catalogId,
          enabled: patch.enabled ?? svc.enabled,
          priceVnd: (patch.isIncluded ?? svc.isIncluded) ? null : (patch.priceVnd ?? svc.priceVnd),
          priceUnit: patch.priceUnit ?? svc.priceUnit,
          isIncluded: patch.isIncluded ?? svc.isIncluded,
          descriptionEn: (patch.descriptionVi ?? svc.descriptionVi) || svc.descriptionEn,
          descriptionVi: patch.descriptionVi ?? svc.descriptionVi,
          conditionsEn: (patch.conditionsVi ?? svc.conditionsVi) || svc.conditionsEn,
          conditionsVi: patch.conditionsVi ?? svc.conditionsVi,
          depositVnd: patch.depositVnd ?? svc.depositVnd,
          leadTimeHours: patch.leadTimeHours ?? svc.leadTimeHours,
          providerType: patch.providerType ?? svc.providerType,
          changeCancelEn: (patch.changeCancelVi ?? svc.changeCancelVi) || svc.changeCancelEn,
          changeCancelVi: patch.changeCancelVi ?? svc.changeCancelVi,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'Error');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setSavingId(null);
    }
  }

  async function removeService(svc: StayServiceRow) {
    if (
      !window.confirm(
        isVi
          ? 'Xóa dịch vụ này khỏi listing?'
          : 'Remove this service from the listing?'
      )
    ) {
      return;
    }
    setSavingId(svc.id);
    setError('');
    try {
      const res = await fetch(`/api/host/services/${svc.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'Error');
      setExpandedId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-stone-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        {isVi ? 'Đang tải…' : 'Loading…'}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-[#FFF8EE] px-4 py-3 text-sm leading-relaxed text-stone-600">
        {isVi
          ? 'Khách chọn dịch vụ khi đặt chỗ và thanh toán trực tiếp cho bạn hoặc đối tác. VietNomad không thu tiền dịch vụ và không tính hoa hồng trên phần này.'
          : 'Guests select services at checkout and pay you or your partner directly. VietNomad does not collect money for services and charges no commission on them.'}{' '}
        <a
          href={`/guides/${isVi ? 'cung-cap-dich-vu-bo-sung-cho-khach' : 'provide-additional-services-to-guests'}`}
          className="font-semibold text-[#FF5A1F] hover:underline"
        >
          {isVi ? 'Tìm hiểu thêm' : 'Learn more'} →
        </a>
      </p>
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="space-y-3">
        {catalog.map((cat) => {
          const svc = byCatalog.get(cat.id);
          const expanded = svc && expandedId === svc.id;
          return (
            <div key={cat.id} className="rounded-2xl border border-stone-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-stone-800">
                    {isVi ? cat.nameVi : cat.nameEn}
                  </p>
                  {!svc && (
                    <p className="text-xs text-stone-500">
                      {isVi ? 'Chưa khai báo' : 'Not declared yet'}
                    </p>
                  )}
                  {svc && (
                    <p className="text-xs text-stone-500">
                      {svc.isIncluded
                        ? isVi
                          ? 'Đã bao gồm trong giá phòng'
                          : 'Included in the room price'
                        : svc.priceVnd === null || svc.priceVnd === 0
                          ? isVi
                            ? 'Miễn phí / theo yêu cầu'
                            : 'Free / by quote'
                          : `${svc.priceVnd.toLocaleString('vi-VN')}₫ / ${
                              isVi
                                ? UNIT_LABELS[svc.priceUnit]?.vi ?? svc.priceUnit
                                : UNIT_LABELS[svc.priceUnit]?.en ?? svc.priceUnit
                            }`}
                      {!svc.enabled && ` · ${isVi ? 'Đã tắt' : 'Disabled'}`}
                      {svc.activeRequestCount > 0 &&
                        ` · ${svc.activeRequestCount} ${isVi ? 'yêu cầu đang mở' : 'active requests'}`}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!svc && (
                    <button
                      type="button"
                      onClick={() => void addService(cat)}
                      disabled={savingId === cat.id}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#FF5A1F] px-3 py-1.5 text-sm font-medium text-[#FF5A1F] transition hover:bg-[#FFF3EC] disabled:opacity-50"
                    >
                      {savingId === cat.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                      {isVi ? 'Thêm' : 'Add'}
                    </button>
                  )}
                  {svc && (
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : svc.id)}
                      className="rounded-xl border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
                    >
                      {expanded ? (isVi ? 'Đóng' : 'Close') : isVi ? 'Chỉnh sửa' : 'Edit'}
                    </button>
                  )}
                </div>
              </div>

              {svc && expanded && (
                <div className="mt-4 space-y-4 border-t border-stone-100 pt-4">
                  <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-stone-50 px-4 py-3">
                    <span className="text-sm font-medium text-stone-700">
                      {isVi ? 'Đang cung cấp dịch vụ này' : 'Currently offering this service'}
                    </span>
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-[#FF5A1F]"
                      checked={svc.enabled}
                      onChange={(e) => void saveService(svc, { enabled: e.target.checked })}
                    />
                  </label>

                  <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[#FF5A1F]"
                      checked={svc.isIncluded}
                      onChange={(e) => void saveService(svc, { isIncluded: e.target.checked })}
                    />
                    {isVi
                      ? 'Miễn phí hoặc đã bao gồm trong giá phòng'
                      : 'Free of charge or included in the room price'}
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm text-stone-700">
                      <span className="mb-1 block font-medium">
                        {isVi ? 'Giá (VND)' : 'Price (VND)'}
                        <InfoTip
                          isVi={isVi}
                          tipVi="Giá bạn tự đặt. Khách thanh toán trực tiếp cho bạn/đối tác — VietNomad không thu tiền dịch vụ."
                          tipEn="Your own price. Guests pay you or your partner directly — VietNomad never collects service money."
                        />
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        disabled={svc.isIncluded}
                        value={svc.priceVnd ?? ''}
                        placeholder="0"
                        onChange={(e) =>
                          setServices((prev) =>
                            prev.map((s) =>
                              s.id === svc.id
                                ? {
                                    ...s,
                                    priceVnd:
                                      e.target.value === '' ? null : Math.max(0, Number(e.target.value)),
                                  }
                                : s
                            )
                          )
                        }
                        onBlur={(e) => {
                          const next =
                            e.target.value === '' ? null : Math.max(0, Number(e.target.value));
                          if (next !== svc.priceVnd) void saveService(svc, { priceVnd: next });
                        }}
                        className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-[#FF5A1F] focus:outline-none disabled:bg-stone-100 disabled:text-stone-400"
                      />
                    </label>
                    <label className="block text-sm text-stone-700">
                      <span className="mb-1 block font-medium">
                        {isVi ? 'Đơn vị' : 'Unit'}
                        <InfoTip
                          isVi={isVi}
                          tipVi="Mỗi lần tính giá: theo ngày, tuần, tháng, chuyến, lần hoặc theo yêu cầu."
                          tipEn="How the price counts: per day, week, month, trip, visit, or by quote."
                        />
                      </span>
                      <select
                        value={svc.priceUnit}
                        disabled={svc.isIncluded}
                        onChange={(e) => void saveService(svc, { priceUnit: e.target.value })}
                        className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-[#FF5A1F] focus:outline-none disabled:bg-stone-100"
                      >
                        {svc.allowedUnits.map((u) => (
                          <option key={u} value={u}>
                            {isVi ? UNIT_LABELS[u]?.vi ?? u : UNIT_LABELS[u]?.en ?? u}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-sm text-stone-700">
                      <span className="mb-1 block font-medium">
                        {isVi ? 'Tiền đặt cọc (VND)' : 'Deposit (VND)'}
                        <InfoTip
                          isVi={isVi}
                          tipVi="Đặt cọc (nếu có) do bạn thu trực tiếp theo thỏa thuận với khách."
                          tipEn="Deposit (if any) is collected by you directly by agreement with the guest."
                        />
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        value={svc.depositVnd ?? ''}
                        placeholder="0"
                        onBlur={(e) => {
                          const next =
                            e.target.value === '' ? null : Math.max(0, Number(e.target.value));
                          if (next !== svc.depositVnd) void saveService(svc, { depositVnd: next });
                        }}
                        className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-[#FF5A1F] focus:outline-none"
                      />
                    </label>
                    <label className="block text-sm text-stone-700">
                      <span className="mb-1 block font-medium">
                        {isVi ? 'Thời gian đặt trước (giờ)' : 'Lead time (hours)'}
                        <InfoTip
                          isVi={isVi}
                          tipVi="Số giờ tối thiểu khách cần đặt trước để bạn kịp thu xếp."
                          tipEn="Minimum hours of advance notice you need to arrange the service."
                        />
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={720}
                        value={svc.leadTimeHours ?? ''}
                        placeholder="0"
                        onBlur={(e) => {
                          const next =
                            e.target.value === '' ? null : Math.max(0, Number(e.target.value));
                          if (next !== svc.leadTimeHours) void saveService(svc, { leadTimeHours: next });
                        }}
                        className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-[#FF5A1F] focus:outline-none"
                      />
                    </label>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm text-stone-700">
                      <span className="mb-1 block font-medium">
                        {isVi ? 'Nhà cung cấp' : 'Provider'}
                      </span>
                      <select
                        value={svc.providerType}
                        onChange={(e) =>
                          void saveService(svc, {
                            providerType: e.target.value as 'host' | 'third_party',
                          })
                        }
                        className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-[#FF5A1F] focus:outline-none"
                      >
                        <option value="host">
                          {isVi ? 'Chủ nhà tự cung cấp' : 'Provided by host'}
                        </option>
                        <option value="third_party">
                          {isVi ? 'Đối tác bên thứ ba' : 'Third-party partner'}
                        </option>
                      </select>
                    </label>
                  </div>

                  <label className="block text-sm text-stone-700">
                    <span className="mb-1 block font-medium">{isVi ? 'Mô tả' : 'Description'}</span>
                    <textarea
                      rows={3}
                      value={isVi ? svc.descriptionVi : svc.descriptionEn}
                      onChange={(e) =>
                        setServices((prev) =>
                          prev.map((s) =>
                            s.id === svc.id
                              ? {
                                  ...s,
                                  descriptionVi: isVi ? e.target.value : s.descriptionVi,
                                  descriptionEn: isVi ? s.descriptionEn : e.target.value,
                                }
                              : s
                          )
                        )
                      }
                      onBlur={(e) =>
                        void saveService(
                          svc,
                          isVi ? { descriptionVi: e.target.value } : { descriptionEn: e.target.value }
                        )
                      }
                      className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-[#FF5A1F] focus:outline-none"
                    />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm text-stone-700">
                      <span className="mb-1 block font-medium">
                        {isVi ? 'Điều kiện sử dụng' : 'Conditions'}
                      </span>
                      <textarea
                        rows={2}
                        value={isVi ? svc.conditionsVi : svc.conditionsEn}
                        onChange={(e) =>
                          setServices((prev) =>
                            prev.map((s) =>
                              s.id === svc.id
                                ? {
                                    ...s,
                                    conditionsVi: isVi ? e.target.value : s.conditionsVi,
                                    conditionsEn: isVi ? s.conditionsEn : e.target.value,
                                  }
                                : s
                            )
                          )
                        }
                        onBlur={(e) =>
                          void saveService(
                            svc,
                            isVi ? { conditionsVi: e.target.value } : { conditionsEn: e.target.value }
                          )
                        }
                        className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-[#FF5A1F] focus:outline-none"
                      />
                    </label>
                    <label className="block text-sm text-stone-700">
                      <span className="mb-1 block font-medium">
                        {isVi ? 'Điều kiện đổi/hủy' : 'Change & cancellation'}
                      </span>
                      <textarea
                        rows={2}
                        value={isVi ? svc.changeCancelVi : svc.changeCancelEn}
                        onChange={(e) =>
                          setServices((prev) =>
                            prev.map((s) =>
                              s.id === svc.id
                                ? {
                                    ...s,
                                    changeCancelVi: isVi ? e.target.value : s.changeCancelVi,
                                    changeCancelEn: isVi ? s.changeCancelEn : e.target.value,
                                  }
                                : s
                            )
                          )
                        }
                        onBlur={(e) =>
                          void saveService(
                            svc,
                            isVi ? { changeCancelVi: e.target.value } : { changeCancelEn: e.target.value }
                          )
                        }
                        className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-[#FF5A1F] focus:outline-none"
                      />
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void saveService(svc, {})}
                      disabled={savingId === svc.id}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#FF5A1F] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#F04E15] disabled:opacity-50"
                    >
                      {savingId === svc.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      {isVi ? 'Lưu' : 'Save'}
                    </button>
                    {svc.activeRequestCount === 0 && (
                      <button
                        type="button"
                        onClick={() => void removeService(svc)}
                        disabled={savingId === svc.id}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 px-4 py-2 text-sm text-stone-600 transition hover:bg-stone-50 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        {isVi ? 'Xóa' : 'Delete'}
                      </button>
                    )}
                    <span className="text-xs text-stone-400">
                      {isVi
                        ? 'Nhấn Lưu để ghi lại mọi thay đổi.'
                        : 'Press Save to persist changes.'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
