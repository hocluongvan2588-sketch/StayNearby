'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Check, Play, RefreshCw, RotateCcw } from 'lucide-react';
import type { ErrorCode } from '@/lib/errors';
import type { AdminOpsSnapshot } from '@/modules/ops';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { StatusBadge } from '@/components/ui/StatusBadge';

interface AdminOpsClientProps {
  initialSnapshot: AdminOpsSnapshot;
}

const OUTBOX_STATUS_VI = {
  pending: { label: 'Chờ gửi', tone: 'warning' as const },
  sent: { label: 'Đã gửi', tone: 'success' as const },
  failed: { label: 'Thất bại', tone: 'danger' as const },
};

const JOB_STATUS_VI = {
  running: { label: 'Đang chạy', tone: 'warning' as const },
  completed: { label: 'Hoàn tất', tone: 'success' as const },
  failed: { label: 'Lỗi', tone: 'danger' as const },
};

function formatUtcTimestamp(iso: string | null): string {
  if (!iso) return '—';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return `${dt.toISOString().slice(0, 19).replace('T', ' ')} UTC`;
}

export function AdminOpsClient({ initialSnapshot }: AdminOpsClientProps) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<AdminOpsSnapshot>(initialSnapshot);
  const [busy, setBusy] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<{ code?: ErrorCode; message: string } | null>(
    null
  );

  async function refreshSnapshot() {
    const res = await fetch('/api/admin/ops/status');
    const json = await res.json();
    if (res.ok && json.ok) {
      setSnapshot(json.snapshot as AdminOpsSnapshot);
    }
    router.refresh();
  }

  async function handleRunMaintenance() {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch('/api/admin/ops/run', { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError({
          code: json?.error?.code ?? 'INTERNAL_ERROR',
          message: json?.error?.message ?? 'Không thể chạy tác vụ vận hành.',
        });
        return;
      }

      const r = json.result as {
        expiry: { expiredCount: number };
        completion: { completedCount: number };
        outbox: { sentCount: number; retriedCount: number; failedCount: number };
      };
      setNotice(
        `Đã chạy chu kỳ vận hành: hết hạn ${r.expiry.expiredCount} đơn, hoàn tất ${r.completion.completedCount} đơn, gửi ${r.outbox.sentCount} thông báo (retry ${r.outbox.retriedCount}, lỗi ${r.outbox.failedCount}).`
      );
      await refreshSnapshot();
    } catch {
      setError({ code: 'INTERNAL_ERROR', message: 'Lỗi kết nối máy chủ.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleRetryOutbox(outboxId: string) {
    setRetryingId(outboxId);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/ops/outbox/${outboxId}/retry`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError({
          code: json?.error?.code ?? 'INTERNAL_ERROR',
          message: json?.error?.message ?? 'Không thể gửi lại thông báo.',
        });
        return;
      }

      setNotice('Đã xử lý gửi lại thông báo outbox.');
      await refreshSnapshot();
    } catch {
      setError({ code: 'INTERNAL_ERROR', message: 'Lỗi kết nối máy chủ.' });
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Action bar & KPI cards */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={handleRunMaintenance}
            className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-[12px] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
          >
            <Play className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>
              {busy
                ? 'Đang chạy tác vụ...'
                : 'Chạy tác vụ hết hạn, hoàn tất & gửi outbox'}
            </span>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={refreshSnapshot}
            className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-medium text-[var(--color-text)] hover:border-[var(--color-primary)]"
          >
            <RefreshCw className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Làm mới số liệu</span>
          </button>
        </div>
      </div>

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

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-xs text-[var(--color-text-muted)]">Đơn chờ quá hạn</p>
          <p className="text-2xl font-semibold text-[var(--color-text)] tabular-nums mt-1">
            {snapshot.summary.overduePendingBookingsCount}
          </p>
        </div>
        <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-xs text-[var(--color-text-muted)]">Đơn chờ hoàn tất</p>
          <p className="text-2xl font-semibold text-[var(--color-text)] tabular-nums mt-1">
            {snapshot.summary.eligibleCompletionBookingsCount}
          </p>
        </div>
        <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-xs text-[var(--color-text-muted)]">Outbox chờ gửi</p>
          <p className="text-2xl font-semibold text-[var(--color-text)] tabular-nums mt-1">
            {snapshot.summary.pendingOutboxCount}
          </p>
        </div>
        <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-xs text-[var(--color-text-muted)]">Outbox đã gửi</p>
          <p className="text-2xl font-semibold text-[var(--color-primary)] tabular-nums mt-1">
            {snapshot.summary.sentOutboxCount}
          </p>
        </div>
        <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-xs text-[var(--color-text-muted)]">Outbox lỗi (cần xử lý)</p>
          <p className="text-2xl font-semibold text-[var(--color-danger-text)] tabular-nums mt-1">
            {snapshot.summary.failedOutboxCount}
          </p>
        </div>
      </div>

      {/* Outbox queue table */}
      <section className="space-y-3">
        <h2 className="section-title">Hàng đợi thông báo (Outbox)</h2>
        <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-ivory)] text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                <th className="py-3.5 px-4">Sự kiện</th>
                <th className="py-3.5 px-4">Trạng thái</th>
                <th className="py-3.5 px-4">Lần thử</th>
                <th className="py-3.5 px-4">Thời điểm tạo / gửi</th>
                <th className="py-3.5 px-4">Lỗi gần nhất</th>
                <th className="py-3.5 px-4">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-hairline)]">
              {snapshot.outboxItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-6 px-4 text-center text-[var(--color-text-muted)]"
                  >
                    Chưa có sự kiện nào trong hàng đợi outbox.
                  </td>
                </tr>
              ) : (
                snapshot.outboxItems.map((item) => {
                  const badge = OUTBOX_STATUS_VI[item.status];
                  return (
                    <tr key={item.id} className="align-top">
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-[var(--color-text)]">
                          {item.eventType}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {item.aggregateType}: {item.aggregateId.slice(0, 8)}...
                        </p>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <StatusBadge label={badge.label} tone={badge.tone} withIcon />
                      </td>
                      <td className="py-3.5 px-4 tabular-nums whitespace-nowrap">
                        {item.attempts}/{item.maxAttempts}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[var(--color-text-muted)] tabular-nums">
                        <p>Tạo: {formatUtcTimestamp(item.createdAt)}</p>
                        {item.sentAt ? (
                          <p>Gửi: {formatUtcTimestamp(item.sentAt)}</p>
                        ) : (
                          <p>Thử tiếp: {formatUtcTimestamp(item.nextRetryAt)}</p>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[var(--color-danger-text)] max-w-[240px]">
                        {item.lastError || '—'}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {item.status !== 'sent' ? (
                          <button
                            type="button"
                            disabled={retryingId === item.id}
                            onClick={() => handleRetryOutbox(item.id)}
                            className="min-h-[40px] px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-xs font-medium inline-flex items-center gap-1.5 hover:border-[var(--color-primary)] disabled:opacity-50"
                          >
                            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>
                              {retryingId === item.id ? 'Đang gửi...' : 'Gửi lại'}
                            </span>
                          </button>
                        ) : (
                          <span className="text-xs text-[var(--color-text-muted)]">
                            Đã hoàn tất
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Job runs & System audit events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="space-y-3">
          <h2 className="section-title">Lịch sử chạy tác vụ nền</h2>
          <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-ivory)] text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                  <th className="py-3 px-4">Tác vụ</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4">Số bản ghi</th>
                  <th className="py-3 px-4">Thời điểm</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-hairline)]">
                {snapshot.jobRuns.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-5 px-4 text-center text-[var(--color-text-muted)]"
                    >
                      Chưa có lượt chạy nào.
                    </td>
                  </tr>
                ) : (
                  snapshot.jobRuns.map((run) => {
                    const badge = JOB_STATUS_VI[run.status];
                    return (
                      <tr key={run.id}>
                        <td className="py-3 px-4 font-medium">{run.jobName}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <StatusBadge label={badge.label} tone={badge.tone} />
                        </td>
                        <td className="py-3 px-4 tabular-nums">{run.processedCount}</td>
                        <td className="py-3 px-4 text-xs text-[var(--color-text-muted)] tabular-nums">
                          {formatUtcTimestamp(run.startedAt)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="section-title">Nhật ký chuyển trạng thái hệ thống / quản trị</h2>
          <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-ivory)] text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                  <th className="py-3 px-4">Mã đơn</th>
                  <th className="py-3 px-4">Chuyển đổi</th>
                  <th className="py-3 px-4">Lý do</th>
                  <th className="py-3 px-4">Thời điểm</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-hairline)]">
                {snapshot.systemEvents.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-5 px-4 text-center text-[var(--color-text-muted)]"
                    >
                      Chưa có sự kiện hệ thống nào.
                    </td>
                  </tr>
                ) : (
                  snapshot.systemEvents.map((ev) => (
                    <tr key={ev.id}>
                      <td className="py-3 px-4 font-semibold whitespace-nowrap">
                        {ev.bookingCode}
                      </td>
                      <td className="py-3 px-4 text-xs whitespace-nowrap">
                        {ev.fromStatus ?? 'mới'} → {ev.toStatus}
                      </td>
                      <td className="py-3 px-4 text-xs text-[var(--color-text-muted)]">
                        {ev.reason || '—'}
                      </td>
                      <td className="py-3 px-4 text-xs text-[var(--color-text-muted)] tabular-nums">
                        {formatUtcTimestamp(ev.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
