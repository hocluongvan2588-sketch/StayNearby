'use client';

import { useState } from 'react';
import {
  Bell,
  CheckCircle2,
  Columns3,
  FileCheck2,
  List,
  Plus,
} from 'lucide-react';
import {
  ModalDialog,
  PageHeader,
  SavedViewToolbar,
  SideDrawer,
  StatusBadge,
  statusToTone,
} from './BosPrimitives';
import type {
  getWorkspaceNotifications,
  listAdminTasks,
  listManagementReports,
} from '@/modules/admin-bos';

type TasksData = Awaited<ReturnType<typeof listAdminTasks>>;
type NotificationsData = Awaited<ReturnType<typeof getWorkspaceNotifications>>;
type ReportsData = Awaited<ReturnType<typeof listManagementReports>>;

export function TasksCenterView({ initialData }: { initialData: TasksData }) {
  const [tasks, setTasks] = useState(initialData.tasks);
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [assignedStaffId, setAssignedStaffId] = useState<string>('');
  const [dueAt, setDueAt] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function refresh() {
    const res = await fetch('/api/admin/tasks');
    if (res.ok) {
      const data = (await res.json()) as TasksData;
      setTasks(data.tasks);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          priority,
          assignedStaffId: assignedStaffId || null,
          dueAt: dueAt || null,
        }),
      });
      if (res.ok) {
        setCreateOpen(false);
        setTitle('');
        setDescription('');
        await refresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(
    taskId: string,
    status: 'todo' | 'in_progress' | 'blocked' | 'done'
  ) {
    const res = await fetch('/api/admin/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, status }),
    });
    if (res.ok) {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
    }
  }

  const filtered = tasks.filter((t) => {
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.entityType.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const columns: Array<{ key: 'todo' | 'in_progress' | 'blocked' | 'done'; label: string }> = [
    { key: 'todo', label: 'To Do' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'blocked', label: 'Blocked' },
    { key: 'done', label: 'Done' },
  ];

  return (
    <div>
      <PageHeader
        title="Task Center"
        subtitle="Cross-department tasks linked to leads, listings, tickets, and financial reconciliations."
        actions={
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-md border border-[#E5DFD3] bg-white p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium ${
                  viewMode === 'kanban' ? 'bg-[#164E3F] text-white' : 'text-[#53635D]'
                }`}
              >
                <Columns3 className="h-3.5 w-3.5" />
                Kanban
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium ${
                  viewMode === 'table' ? 'bg-[#164E3F] text-white' : 'text-[#53635D]'
                }`}
              >
                <List className="h-3.5 w-3.5" />
                Table
              </button>
            </div>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#164E3F] px-3 text-xs font-semibold text-white hover:bg-[#0F392E]"
            >
              <Plus className="h-3.5 w-3.5" />
              New task
            </button>
          </div>
        }
      />

      <SavedViewToolbar
        moduleKey="tasks"
        currentFilters={{ priorityFilter, viewMode }}
        onApplyFilters={(f) => {
          if (typeof f.priorityFilter === 'string') setPriorityFilter(f.priorityFilter);
          if (f.viewMode === 'kanban' || f.viewMode === 'table') setViewMode(f.viewMode);
        }}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search tasks..."
        extraControls={
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="h-8 rounded-md border border-[#E5DFD3] bg-[#FAF8F3] px-2 text-xs text-[#17221E]"
          >
            <option value="all">All priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        }
      />

      {viewMode === 'kanban' ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {columns.map((col) => {
            const colTasks = filtered.filter((t) => t.status === col.key);
            return (
              <div
                key={col.key}
                className="flex flex-col rounded-lg border border-[#E5DFD3] bg-[#FAF8F3]"
              >
                <div className="flex items-center justify-between border-b border-[#E5DFD3] bg-white px-3 py-2.5 rounded-t-lg">
                  <span className="text-xs font-semibold text-[#17221E]">{col.label}</span>
                  <span className="rounded bg-[#FAF8F3] px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-[#53635D]">
                    {colTasks.length}
                  </span>
                </div>
                <div className="space-y-2 p-2.5">
                  {colTasks.length === 0 ? (
                    <div className="py-6 text-center text-[11px] text-[#53635D]">Empty</div>
                  ) : (
                    colTasks.map((t) => (
                      <div
                        key={t.id}
                        className="rounded-md border border-[#E5DFD3] bg-white p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <StatusBadge label={t.priority} tone={statusToTone(t.priority)} />
                          <span className="text-[10px] uppercase tracking-wider text-[#53635D]">
                            {t.entityType.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-[#17221E]">{t.title}</div>
                        {t.description && (
                          <p className="line-clamp-2 text-[11px] text-[#53635D]">
                            {t.description}
                          </p>
                        )}
                        <div className="flex items-center justify-between border-t border-[#E5DFD3] pt-2 text-[11px] text-[#53635D]">
                          <span>{t.assigneeName || 'Unassigned'}</span>
                          <select
                            value={t.status}
                            onChange={(e) =>
                              handleStatusChange(
                                t.id,
                                e.target.value as 'todo' | 'in_progress' | 'blocked' | 'done'
                              )
                            }
                            className="rounded border border-[#E5DFD3] bg-[#FAF8F3] px-1.5 py-0.5 text-[10px] font-medium text-[#17221E]"
                          >
                            {columns.map((c) => (
                              <option key={c.key} value={c.key}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[#E5DFD3] bg-white">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-[#E5DFD3] bg-[#FAF8F3] text-[11px] font-medium text-[#53635D]">
              <tr>
                <th className="px-4 py-2.5">Task</th>
                <th className="px-4 py-2.5">Priority</th>
                <th className="px-4 py-2.5">Entity</th>
                <th className="px-4 py-2.5">Assignee</th>
                <th className="px-4 py-2.5">Due</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DFD3]">
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-[#FAF8F3]/60">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-[#17221E]">{t.title}</div>
                    {t.description && (
                      <div className="text-[11px] text-[#53635D]">{t.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge label={t.priority} tone={statusToTone(t.priority)} />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[#53635D]">
                    {t.entityType.replace('_', ' ')}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[#17221E]">
                    {t.assigneeName || 'Unassigned'}
                  </td>
                  <td className="px-4 py-2.5 text-xs tabular-nums text-[#53635D]">
                    {t.dueAt ? t.dueAt.slice(0, 10) : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <select
                      value={t.status}
                      onChange={(e) =>
                        handleStatusChange(
                          t.id,
                          e.target.value as 'todo' | 'in_progress' | 'blocked' | 'done'
                        )
                      }
                      className="rounded border border-[#E5DFD3] bg-white px-2 py-1 text-xs text-[#17221E]"
                    >
                      {columns.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ModalDialog open={createOpen} onClose={() => setCreateOpen(false)} title="Create Task">
        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#17221E]">Title</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-9 w-full rounded-md border border-[#E5DFD3] px-3 text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#17221E]">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-[#E5DFD3] p-2.5 text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#17221E]">Priority</label>
              <select
                value={priority}
                onChange={(e) =>
                  setPriority(e.target.value as 'low' | 'medium' | 'high' | 'urgent')
                }
                className="h-9 w-full rounded-md border border-[#E5DFD3] px-2 text-xs"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#17221E]">Assignee</label>
              <select
                value={assignedStaffId}
                onChange={(e) => setAssignedStaffId(e.target.value)}
                className="h-9 w-full rounded-md border border-[#E5DFD3] px-2 text-xs"
              >
                <option value="">Unassigned</option>
                {initialData.staffOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#17221E]">Due Date</label>
            <input
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="h-9 w-full rounded-md border border-[#E5DFD3] px-3 text-xs"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="h-8 rounded-md border border-[#E5DFD3] px-3 text-xs font-medium text-[#53635D]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-8 rounded-md bg-[#164E3F] px-4 text-xs font-semibold text-white hover:bg-[#0F392E]"
            >
              {submitting ? 'Creating...' : 'Create task'}
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}

export function NotificationsCenterView({ initialData }: { initialData: NotificationsData }) {
  const [tab, setTab] = useState<'tasks' | 'bookings' | 'audit'>('tasks');

  return (
    <div>
      <PageHeader
        title="Notifications & Operational Stream"
        subtitle="Assigned tasks, SLA dispatches, and real-time operational audit events."
      />

      <div className="mb-4 flex gap-2 border-b border-[#E5DFD3]">
        <button
          type="button"
          onClick={() => setTab('tasks')}
          className={`border-b-2 px-3 py-2 text-xs font-semibold ${
            tab === 'tasks'
              ? 'border-[#164E3F] text-[#164E3F]'
              : 'border-transparent text-[#53635D]'
          }`}
        >
          Task Alerts ({initialData.taskAlerts.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('bookings')}
          className={`border-b-2 px-3 py-2 text-xs font-semibold ${
            tab === 'bookings'
              ? 'border-[#164E3F] text-[#164E3F]'
              : 'border-transparent text-[#53635D]'
          }`}
        >
          Booking & Zalo Alerts ({initialData.bookingNotifications.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('audit')}
          className={`border-b-2 px-3 py-2 text-xs font-semibold ${
            tab === 'audit'
              ? 'border-[#164E3F] text-[#164E3F]'
              : 'border-transparent text-[#53635D]'
          }`}
        >
          Recent Audit Activity ({initialData.recentAuditEvents.length})
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-[#E5DFD3] bg-white">
        {tab === 'tasks' && (
          <div className="divide-y divide-[#E5DFD3]">
            {initialData.taskAlerts.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#53635D]">No pending task alerts.</div>
            ) : (
              initialData.taskAlerts.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="text-xs font-semibold text-[#17221E]">{t.title}</div>
                    <div className="text-[11px] text-[#53635D]">
                      Entity: {t.entityType} · Due: {t.dueAt ? t.dueAt.slice(0, 10) : 'No deadline'}
                    </div>
                  </div>
                  <StatusBadge label={t.priority} tone={statusToTone(t.priority)} />
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'bookings' && (
          <div className="divide-y divide-[#E5DFD3]">
            {initialData.bookingNotifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#53635D]">
                <Bell className="mx-auto mb-2 h-5 w-5 text-[#53635D]" />
                No booking dispatches logged yet.
              </div>
            ) : (
              initialData.bookingNotifications.map((n) => (
                <div key={n.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="text-xs font-semibold text-[#17221E]">
                      [{n.bookingCode}] {n.subject}
                    </div>
                    <div className="text-[11px] text-[#53635D]">
                      {n.channel} &rarr; {n.recipientRole} ({n.recipientContact})
                    </div>
                  </div>
                  <StatusBadge label={n.status} tone={statusToTone(n.status)} />
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'audit' && (
          <div className="divide-y divide-[#E5DFD3]">
            {initialData.recentAuditEvents.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#53635D]">No audit events yet.</div>
            ) : (
              initialData.recentAuditEvents.map((a) => (
                <div key={a.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="text-xs font-medium text-[#17221E]">
                      <strong>{a.actorEmail}</strong> · {a.module} / {a.action} ({a.entityType})
                    </div>
                    <div className="text-[11px] text-[#53635D]">
                      ID: {a.entityId} {a.reason ? `· Reason: ${a.reason}` : ''}
                    </div>
                  </div>
                  <span className="text-[11px] tabular-nums text-[#53635D]">
                    {a.createdAt.slice(0, 16).replace('T', ' ')}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function ManagementReportsView({
  initialReports,
  canApprove,
}: {
  initialReports: ReportsData;
  canApprove: boolean;
}) {
  const [reports, setReports] = useState(initialReports);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<ReportsData[number] | null>(null);

  const [department, setDepartment] = useState('Operations & Supply');
  const [periodLabel, setPeriodLabel] = useState('');
  const [resultsSummary, setResultsSummary] = useState('');
  const [targetComparison, setTargetComparison] = useState('');
  const [issuesRaised, setIssuesRaised] = useState('');
  const [rootCauseAnalysis, setRootCauseAnalysis] = useState('');
  const [proposedActions, setProposedActions] = useState('');
  const [nextPlan, setNextPlan] = useState('');
  const [approvalRequest, setApprovalRequest] = useState('');

  const [reviewComment, setReviewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function refresh() {
    const res = await fetch('/api/admin/reports');
    if (res.ok) {
      const d = (await res.json()) as { reports: ReportsData };
      setReports(d.reports);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          department,
          periodLabel,
          resultsSummary,
          targetComparison,
          issuesRaised,
          rootCauseAnalysis,
          proposedActions,
          nextPlan,
          approvalRequest,
          status: 'submitted',
        }),
      });
      if (res.ok) {
        setCreateOpen(false);
        setPeriodLabel('');
        setResultsSummary('');
        await refresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReview(decision: 'approved' | 'changes_requested') {
    if (!selected || !reviewComment.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: selected.id,
          decision,
          executiveComment: reviewComment.trim(),
        }),
      });
      if (res.ok) {
        setSelected(null);
        setReviewComment('');
        await refresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Executive & Management Reports"
        subtitle="Structured departmental submissions, root-cause reviews, and Founder decision approvals."
        actions={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#164E3F] px-3 text-xs font-semibold text-white hover:bg-[#0F392E]"
          >
            <Plus className="h-3.5 w-3.5" />
            Submit report
          </button>
        }
      />

      <div className="overflow-hidden rounded-lg border border-[#E5DFD3] bg-white">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-[#E5DFD3] bg-[#FAF8F3] text-[11px] font-medium text-[#53635D]">
            <tr>
              <th className="px-4 py-2.5">Department</th>
              <th className="px-4 py-2.5">Period</th>
              <th className="px-4 py-2.5">Submitted By</th>
              <th className="px-4 py-2.5">Approval Request</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5DFD3]">
            {reports.map((r) => (
              <tr key={r.id} className="hover:bg-[#FAF8F3]/60">
                <td className="px-4 py-2.5 font-medium text-[#17221E]">{r.department}</td>
                <td className="px-4 py-2.5 text-xs text-[#53635D]">{r.periodLabel}</td>
                <td className="px-4 py-2.5 text-xs text-[#17221E]">{r.submitterName}</td>
                <td className="max-w-xs truncate px-4 py-2.5 text-xs text-[#53635D]">
                  {r.approvalRequest || '—'}
                </td>
                <td className="px-4 py-2.5">
                  <StatusBadge label={r.status} tone={statusToTone(r.status)} />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(r);
                      setReviewComment(r.executiveComment || '');
                    }}
                    className="rounded border border-[#E5DFD3] bg-white px-2.5 py-1 text-xs font-medium text-[#17221E] hover:bg-[#FAF8F3]"
                  >
                    Inspect
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SideDrawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? `${selected.department} — ${selected.periodLabel}` : ''}
        subtitle={selected ? `Submitted by ${selected.submitterName}` : ''}
      >
        {selected && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-[#164E3F]" />
              <StatusBadge label={selected.status} tone={statusToTone(selected.status)} />
            </div>

            {[
              ['Results Summary', selected.resultsSummary],
              ['Target Comparison', selected.targetComparison],
              ['Issues Raised', selected.issuesRaised],
              ['Root Cause Analysis', selected.rootCauseAnalysis],
              ['Proposed Actions', selected.proposedActions],
              ['Next Period Plan', selected.nextPlan],
              ['Decision / Budget Approval Request', selected.approvalRequest],
            ].map(([label, val]) =>
              val ? (
                <div key={label} className="rounded-md border border-[#E5DFD3] bg-[#FAF8F3] p-3">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[#53635D]">
                    {label}
                  </div>
                  <div className="leading-relaxed text-[#17221E]">{val}</div>
                </div>
              ) : null
            )}

            {canApprove && (
              <div className="space-y-2 border-t border-[#E5DFD3] pt-4">
                <label className="block font-semibold text-[#17221E]">
                  Executive Review Comment
                </label>
                <textarea
                  rows={3}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Provide executive decision or follow-up direction..."
                  className="w-full rounded-md border border-[#E5DFD3] p-2.5 text-xs"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleReview('approved')}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#164E3F] px-3 text-xs font-semibold text-white hover:bg-[#0F392E]"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Approve Report
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleReview('changes_requested')}
                    className="h-8 rounded-md border border-[#F0D1C0] bg-[#FAEDE5] px-3 text-xs font-semibold text-[#C25E28]"
                  >
                    Request Changes
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </SideDrawer>

      <ModalDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Submit Management Report"
      >
        <form onSubmit={handleCreate} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-medium">Department</label>
              <input
                required
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="h-8 w-full rounded border border-[#E5DFD3] px-2.5"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium">Period</label>
              <input
                required
                placeholder="e.g. Week 48 / Nov 2026"
                value={periodLabel}
                onChange={(e) => setPeriodLabel(e.target.value)}
                className="h-8 w-full rounded border border-[#E5DFD3] px-2.5"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block font-medium">Results Summary</label>
            <textarea
              required
              rows={2}
              value={resultsSummary}
              onChange={(e) => setResultsSummary(e.target.value)}
              className="w-full rounded border border-[#E5DFD3] p-2"
            />
          </div>
          <div>
            <label className="mb-1 block font-medium">Target vs Actual</label>
            <input
              value={targetComparison}
              onChange={(e) => setTargetComparison(e.target.value)}
              className="h-8 w-full rounded border border-[#E5DFD3] px-2.5"
            />
          </div>
          <div>
            <label className="mb-1 block font-medium">Issues & Root Cause</label>
            <textarea
              rows={2}
              value={issuesRaised}
              onChange={(e) => {
                setIssuesRaised(e.target.value);
                setRootCauseAnalysis(e.target.value);
              }}
              className="w-full rounded border border-[#E5DFD3] p-2"
            />
          </div>
          <div>
            <label className="mb-1 block font-medium">Proposed Actions & Next Plan</label>
            <textarea
              rows={2}
              value={proposedActions}
              onChange={(e) => {
                setProposedActions(e.target.value);
                setNextPlan(e.target.value);
              }}
              className="w-full rounded border border-[#E5DFD3] p-2"
            />
          </div>
          <div>
            <label className="mb-1 block font-medium">Approval Request (Optional)</label>
            <input
              value={approvalRequest}
              onChange={(e) => setApprovalRequest(e.target.value)}
              className="h-8 w-full rounded border border-[#E5DFD3] px-2.5"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="h-8 rounded border border-[#E5DFD3] px-3"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-8 rounded bg-[#164E3F] px-4 font-semibold text-white"
            >
              Submit
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
