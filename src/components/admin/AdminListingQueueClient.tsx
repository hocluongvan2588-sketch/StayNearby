'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Check, EyeOff, RotateCcw, XCircle } from 'lucide-react';
import { formatVnd } from '@/lib/format';
import type { ErrorCode } from '@/lib/errors';
import type { AdminListingQueueItem } from '@/modules/admin';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { StatusBadge } from '@/components/ui/StatusBadge';

interface AdminListingQueueClientProps {
  initialQueue: AdminListingQueueItem[];
}

const ADMIN_STATUS_VI: Record<
  string,
  { label: string; tone: 'neutral' | 'success' | 'warning' | 'danger' }
> = {
  published: { label: 'Đã công bố', tone: 'success' },
  pending_review: { label: 'Chờ duyệt', tone: 'warning' },
  changes_requested: { label: 'Yêu cầu sửa', tone: 'danger' },
  draft: { label: 'Bản nháp', tone: 'neutral' },
  suspended: { label: 'Tạm ẩn', tone: 'danger' },
};

export function AdminListingQueueClient({
  initialQueue,
}: AdminListingQueueClientProps) {
  const router = useRouter();
  const [queue, setQueue] = useState<AdminListingQueueItem[]>(initialQueue);
  const [reasonTarget, setReasonTarget] = useState<{
    listingId: string;
    title: string;
    action: 'request-changes' | 'suspend';
  } | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<{ code?: ErrorCode; message: string } | null>(
    null
  );

  async function refreshQueue() {
    const res = await fetch('/api/admin/listings');
    const json = await res.json();
    if (res.ok && json.ok) {
      setQueue(json.listings as AdminListingQueueItem[]);
    }
    router.refresh();
  }

  async function handleApprove(item: AdminListingQueueItem) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/listings/${item.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError({
          code: json?.error?.code ?? 'VALIDATION_ERROR',
          message: json?.error?.message ?? 'Không thể duyệt chỗ ở.',
        });
        return;
      }
      setNotice(`Đã duyệt và công bố chỗ ở "${item.titleEn}".`);
      await refreshQueue();
    } catch {
      setError({ code: 'INTERNAL_ERROR', message: 'Lỗi kết nối máy chủ.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore(item: AdminListingQueueItem) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/listings/${item.id}/restore`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError({
          code: json?.error?.code ?? 'VALIDATION_ERROR',
          message: json?.error?.message ?? 'Không thể khôi phục chỗ ở.',
        });
        return;
      }
      setNotice(`Đã khôi phục công bố chỗ ở "${item.titleEn}".`);
      await refreshQueue();
    } catch {
      setError({ code: 'INTERNAL_ERROR', message: 'Lỗi kết nối máy chủ.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleReasonSubmit() {
    if (!reasonTarget) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(
        `/api/admin/listings/${reasonTarget.listingId}/${reasonTarget.action}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: reasonText.trim() }),
        }
      );
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError({
          code: json?.error?.code ?? 'VALIDATION_ERROR',
          message: json?.error?.message ?? 'Thao tác thất bại.',
        });
        return;
      }
      setNotice(
        reasonTarget.action === 'request-changes'
          ? `Đã trả lại chỗ ở "${reasonTarget.title}" kèm lý do để chủ nhà chỉnh sửa.`
          : `Đã tạm ẩn chỗ ở "${reasonTarget.title}". Các đơn đã xác nhận trước đó vẫn giữ nguyên.`
      );
      setReasonTarget(null);
      setReasonText('');
      await refreshQueue();
    } catch {
      setError({ code: 'INTERNAL_ERROR', message: 'Lỗi kết nối máy chủ.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {notice && (
        <div
          role="status"
          className="rounded-[12px] border border-[#C4DCD2] bg-[var(--color-primary-soft)] p-4 text-sm text-[var(--color-primary)] flex items-center gap-2"
        >
          <Check className="w-5 h-5 shrink-0" aria-hidden="true" />
          <span>{notice}</span>
        </div>
      )}

      {error && <ErrorAlert code={error.code} message={error.message} locale="vi" />}

      {reasonTarget && (
        <div className="rounded-[12px] border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] p-5 space-y-3">
          <p className="text-sm font-semibold text-[var(--color-text)]">
            {reasonTarget.action === 'request-changes'
              ? `Nhập lý do yêu cầu chỉnh sửa cho "${reasonTarget.title}"`
              : `Nhập lý do tạm ẩn "${reasonTarget.title}"`}
          </p>
          <input
            type="text"
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            placeholder="Ví dụ: Vui lòng bổ sung ảnh rõ góc làm việc và hướng dẫn nhận phòng..."
            className="w-full min-h-[44px] px-3.5 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm"
          />
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              disabled={busy || reasonText.trim().length < 2}
              onClick={handleReasonSubmit}
              className="min-h-[44px] px-5 rounded-[12px] bg-[var(--color-danger-text)] text-white text-sm font-semibold disabled:opacity-50"
            >
              {busy ? 'Đang xử lý...' : 'Xác nhận thực hiện'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setReasonTarget(null);
                setReasonText('');
              }}
              className="min-h-[44px] px-4 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-medium"
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-ivory)] text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              <th className="py-3.5 px-4">Chỗ ở</th>
              <th className="py-3.5 px-4">Khu vực & địa chỉ</th>
              <th className="py-3.5 px-4">Chủ nhà</th>
              <th className="py-3.5 px-4">Giá cơ bản</th>
              <th className="py-3.5 px-4">Trạng thái</th>
              <th className="py-3.5 px-4">Thao tác kiểm duyệt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-hairline)]">
            {queue.map((row) => {
              const badge = ADMIN_STATUS_VI[row.status] ?? {
                label: row.status,
                tone: 'neutral' as const,
              };
              const canApprove =
                row.status === 'pending_review' ||
                row.hasPendingRevision ||
                row.status === 'changes_requested';

              return (
                <tr key={row.id} className="align-top">
                  <td className="py-4 px-4 max-w-[260px]">
                    <p className="font-semibold text-[var(--color-text)]">
                      {row.titleEn}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      {row.slug} — {row.photoCount} ảnh
                    </p>
                    {row.latestRevisionSummaryEn && (
                      <p className="text-xs text-[var(--color-text-muted)] mt-1 line-clamp-2">
                        {row.latestRevisionSummaryEn}
                      </p>
                    )}
                    {row.reviewNote && (
                      <p className="text-xs text-[var(--color-warning-text)] mt-1">
                        Ghi chú: {row.reviewNote}
                      </p>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    <p className="text-[var(--color-text)]">
                      {row.areaNameVi}, {row.cityVi}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      {row.exactAddress}
                    </p>
                  </td>
                  <td className="py-4 px-4">
                    <p className="text-[var(--color-text)]">{row.hostName}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{row.hostEmail}</p>
                  </td>
                  <td className="py-4 px-4 tabular-nums whitespace-nowrap font-medium">
                    {formatVnd(row.baseNightlyRateVnd, 'vi')}
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap space-y-1">
                    <StatusBadge label={badge.label} tone={badge.tone} withIcon />
                    {row.hasPendingRevision && row.status === 'published' && (
                      <div>
                        <StatusBadge label="Có bản sửa chờ duyệt" tone="warning" />
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex flex-wrap items-center gap-2 min-w-[240px]">
                      {canApprove && (
                        <button
                          type="button"
                          disabled={busy || row.photoCount < 1}
                          onClick={() => handleApprove(row)}
                          className="min-h-[40px] px-3 rounded-[12px] bg-[var(--color-primary)] text-white text-xs font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
                        >
                          Duyệt & Công bố
                        </button>
                      )}

                      {(row.status === 'pending_review' || row.hasPendingRevision) && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setReasonText('');
                            setReasonTarget({
                              listingId: row.id,
                              title: row.titleEn,
                              action: 'request-changes',
                            });
                          }}
                          className="min-h-[40px] px-3 rounded-[12px] border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Trả lại sửa</span>
                        </button>
                      )}

                      {row.status === 'published' && (
                        <>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setReasonText('');
                              setReasonTarget({
                                listingId: row.id,
                                title: row.titleEn,
                                action: 'suspend',
                              });
                            }}
                            className="min-h-[40px] px-3 rounded-[12px] border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] text-xs font-semibold inline-flex items-center gap-1"
                          >
                            <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Tạm ẩn</span>
                          </button>
                          <Link
                            href={`/stays/${row.slug}`}
                            className="min-h-[40px] px-3 rounded-[12px] border border-[var(--color-border)] text-xs font-medium inline-flex items-center text-[var(--color-text)]"
                          >
                            Xem tin
                          </Link>
                        </>
                      )}

                      {row.status === 'suspended' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleRestore(row)}
                          className="min-h-[40px] px-3 rounded-[12px] border border-[var(--color-primary)] text-[var(--color-primary)] text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Mở lại</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
