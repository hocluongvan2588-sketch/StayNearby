'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Mail,
  Phone,
  Save,
  Search,
  UserCheck,
  Users,
} from 'lucide-react';
import { formatVnd } from '@/lib/format';
import type {
  AdminCrmContact,
  AdminCrmDashboard,
  CrmStage,
} from '@/modules/crm';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ErrorAlert } from '@/components/ui/ErrorAlert';

const CRM_STAGE_META: Record<
  CrmStage,
  { label: string; tone: 'neutral' | 'success' | 'warning' | 'danger' }
> = {
  new: { label: 'Mới tiếp nhận', tone: 'neutral' },
  active: { label: 'Đang hoạt động', tone: 'success' },
  vip: { label: 'Khách hàng VIP', tone: 'success' },
  follow_up: { label: 'Cần theo dõi', tone: 'warning' },
  archived: { label: 'Lưu trữ', tone: 'neutral' },
};

const ROLE_LABELS_VI: Record<string, string> = {
  guest: 'Khách hàng',
  host: 'Chủ nhà',
  admin: 'Quản trị viên',
};

interface AdminCrmClientProps {
  initialDashboard: AdminCrmDashboard;
}

export function AdminCrmClient({ initialDashboard }: AdminCrmClientProps) {
  const [contacts, setContacts] = useState<AdminCrmContact[]>(
    initialDashboard.contacts
  );
  const [summary, setSummary] = useState(initialDashboard.summary);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'guest' | 'host' | 'admin'>('all');
  const [stageFilter, setStageFilter] = useState<'all' | CrmStage>('all');

  const [draftStages, setDraftStages] = useState<Record<string, CrmStage>>(() =>
    Object.fromEntries(initialDashboard.contacts.map((c) => [c.id, c.crmStage]))
  );
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialDashboard.contacts.map((c) => [c.id, c.crmNote]))
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filteredContacts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return contacts.filter((c) => {
      if (roleFilter !== 'all' && !c.roles.includes(roleFilter)) return false;
      if (stageFilter !== 'all' && c.crmStage !== stageFilter) return false;
      if (q) {
        const hay = [
          c.displayName,
          c.email,
          c.phone ?? '',
          c.crmNote,
          c.lastStayTitle ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [contacts, searchQuery, roleFilter, stageFilter]);

  async function handleSaveCrm(contactId: string) {
    const stage = draftStages[contactId] ?? 'new';
    const note = draftNotes[contactId] ?? '';

    setSavingId(contactId);
    setSavedId(null);
    setError(null);

    try {
      const res = await fetch(`/api/admin/crm/${contactId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crmStage: stage, crmNote: note }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? 'Không thể lưu thông tin CRM.');
        return;
      }

      const updated: AdminCrmContact = json.contact;
      setContacts((prev) => {
        const next = prev.map((c) => (c.id === contactId ? updated : c));
        setSummary((s) => ({
          ...s,
          vipOrFollowUpCount: next.filter(
            (c) => c.crmStage === 'vip' || c.crmStage === 'follow_up'
          ).length,
        }));
        return next;
      });
      setDraftStages((prev) => ({ ...prev, [contactId]: updated.crmStage }));
      setDraftNotes((prev) => ({ ...prev, [contactId]: updated.crmNote }));
      setSavedId(contactId);
    } catch {
      setError('Không thể kết nối máy chủ để cập nhật CRM.');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-1 shadow-apple-subtle">
          <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-1.5">
            <Users className="w-4 h-4 text-[var(--color-primary)]" aria-hidden="true" />
            <span>Tổng hồ sơ CRM</span>
          </p>
          <p className="text-2xl font-semibold text-[var(--color-text)] tabular-nums">
            {summary.totalContacts}
          </p>
        </div>

        <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-1 shadow-apple-subtle">
          <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-[var(--color-primary)]" aria-hidden="true" />
            <span>Khách hàng / Chủ nhà</span>
          </p>
          <p className="text-2xl font-semibold text-[var(--color-text)] tabular-nums">
            {summary.guestsCount} / {summary.hostsCount}
          </p>
        </div>

        <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-1 shadow-apple-subtle">
          <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-[var(--color-primary)]" aria-hidden="true" />
            <span>VIP & Cần theo dõi</span>
          </p>
          <p className="text-2xl font-semibold text-[var(--color-text)] tabular-nums">
            {summary.vipOrFollowUpCount}
          </p>
        </div>

        <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-1 shadow-apple-subtle">
          <p className="text-xs text-[var(--color-text-muted)]">
            Tổng chi tiêu xác nhận (GMV)
          </p>
          <p className="text-2xl font-semibold text-[var(--color-primary)] tabular-nums">
            {formatVnd(summary.confirmedGmvVnd, 'vi')}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-ivory)] p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
        <div className="md:col-span-5 space-y-1">
          <label
            htmlFor="crm-search"
            className="block text-xs font-medium text-[var(--color-text-muted)]"
          >
            Tìm kiếm khách hàng / chủ nhà
          </label>
          <div className="relative">
            <Search
              className="w-4 h-4 text-[var(--color-text-muted)] absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              id="crm-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tên, email, số điện thoại, ghi chú CRM..."
              className="w-full min-h-[44px] pl-9 pr-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm"
            />
          </div>
        </div>

        <div className="md:col-span-3 space-y-1">
          <label
            htmlFor="crm-role-filter"
            className="block text-xs font-medium text-[var(--color-text-muted)]"
          >
            Vai trò hệ thống
          </label>
          <select
            id="crm-role-filter"
            value={roleFilter}
            onChange={(e) =>
              setRoleFilter(
                e.target.value as 'all' | 'guest' | 'host' | 'admin'
              )
            }
            className="w-full min-h-[44px] px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm"
          >
            <option value="all">Tất cả vai trò</option>
            <option value="guest">Khách hàng (Guest)</option>
            <option value="host">Chủ nhà (Host)</option>
            <option value="admin">Quản trị viên (Admin)</option>
          </select>
        </div>

        <div className="md:col-span-4 space-y-1">
          <label
            htmlFor="crm-stage-filter"
            className="block text-xs font-medium text-[var(--color-text-muted)]"
          >
            Phân loại chăm sóc (CRM)
          </label>
          <select
            id="crm-stage-filter"
            value={stageFilter}
            onChange={(e) =>
              setStageFilter(e.target.value as 'all' | CrmStage)
            }
            className="w-full min-h-[44px] px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm"
          >
            <option value="all">Tất cả trạng thái CRM</option>
            <option value="follow_up">Cần theo dõi</option>
            <option value="vip">Khách hàng VIP</option>
            <option value="active">Đang hoạt động</option>
            <option value="new">Mới tiếp nhận</option>
            <option value="archived">Lưu trữ</option>
          </select>
        </div>
      </div>

      {error && <ErrorAlert code="INTERNAL_ERROR" message={error} locale="vi" />}

      {filteredContacts.length === 0 ? (
        <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-ivory)] p-8 text-center text-sm text-[var(--color-text-muted)]">
          Không có hồ sơ CRM nào khớp với bộ lọc hiện tại.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredContacts.map((contact) => {
            const stageMeta = CRM_STAGE_META[contact.crmStage];
            const isSaving = savingId === contact.id;
            const isSaved = savedId === contact.id;

            return (
              <article
                key={contact.id}
                className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-apple-subtle p-5 space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-[var(--color-text)]">
                        {contact.displayName}
                      </h2>
                      <StatusBadge
                        label={stageMeta.label}
                        tone={stageMeta.tone}
                        withIcon
                      />
                      {contact.roles.map((r) => (
                        <span
                          key={r}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border border-[var(--color-border)] bg-[var(--color-surface-ivory)] text-[var(--color-text)]"
                        >
                          {ROLE_LABELS_VI[r] ?? r}
                        </span>
                      ))}
                      {contact.isDemo && (
                        <StatusBadge label="Tài khoản mẫu" tone="neutral" />
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--color-text-muted)]">
                      <span className="inline-flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{contact.email}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{contact.phone || 'Chưa cập nhật SĐT'}</span>
                      </span>
                      <span>
                        Ngôn ngữ mặc định:{' '}
                        <strong>
                          {contact.preferredLocale === 'vi'
                            ? 'Tiếng Việt'
                            : 'Tiếng Anh'}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <Link
                    href="/admin/bookings"
                    className="inline-flex items-center min-h-[40px] px-3.5 rounded-[12px] border border-[var(--color-border)] text-xs font-medium text-[var(--color-text)] hover:border-[var(--color-primary)]"
                  >
                    Xem toàn bộ đơn đặt phòng
                  </Link>
                </div>

                {/* Activity summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="rounded-[12px] border border-[var(--color-hairline)] bg-[var(--color-surface-ivory)] p-3.5 space-y-1">
                    <p className="font-semibold text-[var(--color-text)]">
                      Hoạt động Khách hàng
                    </p>
                    <p className="text-[var(--color-text-muted)] tabular-nums">
                      Tổng đơn đã gửi: <strong>{contact.guestBookingsCount}</strong> ·
                      Chờ phản hồi: <strong>{contact.guestPendingCount}</strong> ·
                      Xác nhận/Hoàn tất:{' '}
                      <strong>{contact.guestConfirmedOrCompletedCount}</strong>
                    </p>
                    <p className="text-[var(--color-text)] tabular-nums">
                      Tổng chi tiêu xác nhận:{' '}
                      <strong>{formatVnd(contact.guestTotalSpentVnd, 'vi')}</strong>
                    </p>
                    {contact.lastStayTitle && (
                      <p className="text-[var(--color-text-muted)] truncate">
                        Chỗ ở gần nhất: {contact.lastStayTitle}
                      </p>
                    )}
                  </div>

                  <div className="rounded-[12px] border border-[var(--color-hairline)] bg-[var(--color-surface-ivory)] p-3.5 space-y-1">
                    <p className="font-semibold text-[var(--color-text)]">
                      Hoạt động Chủ nhà
                    </p>
                    {contact.roles.includes('host') ? (
                      <>
                        <p className="text-[var(--color-text-muted)] tabular-nums">
                          Số chỗ ở quản lý:{' '}
                          <strong>{contact.hostListingsCount}</strong> (Đang công bố:{' '}
                          <strong>{contact.hostPublishedListingsCount}</strong>)
                        </p>
                        <p className="text-[var(--color-text)] tabular-nums">
                          Đơn nhận được: <strong>{contact.hostBookingsCount}</strong> ·
                          Doanh thu xác nhận:{' '}
                          <strong>{formatVnd(contact.hostRevenueVnd, 'vi')}</strong>
                        </p>
                      </>
                    ) : (
                      <p className="text-[var(--color-text-muted)]">
                        Tài khoản chưa kích hoạt vai trò Chủ nhà.
                      </p>
                    )}
                  </div>
                </div>

                {/* Inline CRM Editor */}
                <div className="pt-3 border-t border-[var(--color-hairline)] grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-3 space-y-1">
                    <label
                      htmlFor={`stage-${contact.id}`}
                      className="block text-xs font-medium text-[var(--color-text-muted)]"
                    >
                      Trạng thái CRM
                    </label>
                    <select
                      id={`stage-${contact.id}`}
                      value={draftStages[contact.id] ?? contact.crmStage}
                      onChange={(e) =>
                        setDraftStages((prev) => ({
                          ...prev,
                          [contact.id]: e.target.value as CrmStage,
                        }))
                      }
                      className="w-full min-h-[44px] px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm"
                    >
                      <option value="new">Mới tiếp nhận</option>
                      <option value="active">Đang hoạt động</option>
                      <option value="vip">Khách hàng VIP</option>
                      <option value="follow_up">Cần theo dõi</option>
                      <option value="archived">Lưu trữ</option>
                    </select>
                  </div>

                  <div className="md:col-span-6 space-y-1">
                    <label
                      htmlFor={`note-${contact.id}`}
                      className="block text-xs font-medium text-[var(--color-text-muted)]"
                    >
                      Ghi chú chăm sóc khách hàng (chỉ Quản trị viên xem)
                    </label>
                    <input
                      id={`note-${contact.id}`}
                      type="text"
                      value={draftNotes[contact.id] ?? contact.crmNote}
                      onChange={(e) =>
                        setDraftNotes((prev) => ({
                          ...prev,
                          [contact.id]: e.target.value,
                        }))
                      }
                      placeholder="Nhập nhu cầu, lịch sử hỗ trợ, ưu tiên chỗ ở..."
                      className="w-full min-h-[44px] px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm"
                    />
                  </div>

                  <div className="md:col-span-3 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleSaveCrm(contact.id)}
                      className="w-full md:w-auto inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 rounded-[12px] bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
                    >
                      <Save className="w-4 h-4" aria-hidden="true" />
                      <span>{isSaving ? 'Đang lưu...' : 'Lưu CRM'}</span>
                    </button>
                  </div>
                </div>

                {isSaved && (
                  <p className="text-xs font-medium text-[var(--color-primary)] inline-flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                    <span>Đã cập nhật hồ sơ CRM.</span>
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
