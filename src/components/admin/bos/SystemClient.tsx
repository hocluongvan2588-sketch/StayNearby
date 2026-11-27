'use client';

import { useState } from 'react';
import { Check, Plus, ShieldCheck } from 'lucide-react';
import {
  ModalDialog,
  PageHeader,
  SavedViewToolbar,
  SideDrawer,
  StatusBadge,
  statusToTone,
} from './BosPrimitives';
import type { AdminAction } from '@/modules/admin-rbac';
import type {
  listAdminAuditLogs,
  listAdminTeamMembers,
  listRolesAndPermissions,
} from '@/modules/admin-bos';
import type {
  listAutomationRules,
  listPlatformSettingsSnapshot,
} from '@/modules/platform-settings';

type TeamData = Awaited<ReturnType<typeof listAdminTeamMembers>>;
type RolesData = Awaited<ReturnType<typeof listRolesAndPermissions>>;
type AuditLogsList = Awaited<ReturnType<typeof listAdminAuditLogs>>;
type SettingsSnapshot = Awaited<ReturnType<typeof listPlatformSettingsSnapshot>>;
type RulesList = Awaited<ReturnType<typeof listAutomationRules>>;

export function TeamManagementView({ initialData }: { initialData: TeamData }) {
  const [members, setMembers] = useState(initialData.members);
  const [inviteOpen, setInviteOpen] = useState(false);

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState(initialData.roles[0]?.id ?? '');
  const [department, setDepartment] = useState('Operations');
  const [title, setTitle] = useState('Operations Specialist');
  const [errMsg, setErrMsg] = useState('');

  async function refresh() {
    const res = await fetch('/api/admin/system?scope=team');
    if (res.ok) {
      const d = (await res.json()) as TeamData;
      setMembers(d.members);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setErrMsg('');
    const res = await fetch('/api/admin/system', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'staff',
        email,
        fullName,
        password: password || undefined,
        roleId,
        department,
        title,
      }),
    });
    if (res.ok) {
      setInviteOpen(false);
      setEmail('');
      setFullName('');
      setPassword('');
      await refresh();
    } else {
      const eBody = (await res.json().catch(() => ({}))) as { message?: string };
      setErrMsg(eBody.message || 'Failed to add staff member.');
    }
  }

  async function updateMember(
    userId: string,
    patch: { roleId?: string; isActive?: boolean }
  ) {
    const res = await fetch('/api/admin/system', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'staff', userId, ...patch }),
    });
    if (res.ok) await refresh();
  }

  return (
    <div>
      <PageHeader
        title="Team & Staff Management"
        subtitle="Manage internal operators, department assignments, and dynamic RBAC role bindings."
        actions={
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#164E3F] px-3 text-xs font-semibold text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            Add / Assign Staff
          </button>
        }
      />

      <div className="overflow-hidden rounded-lg border border-[#E5DFD3] bg-white">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-[#E5DFD3] bg-[#FAF8F3] text-[11px] font-medium text-[#53635D]">
            <tr>
              <th className="px-4 py-2.5">Staff Member</th>
              <th className="px-4 py-2.5">Department / Title</th>
              <th className="px-4 py-2.5">Assigned Role</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5 text-right">Access</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5DFD3]">
            {members.map((m) => (
              <tr key={m.userId} className="hover:bg-[#FAF8F3]/60">
                <td className="px-4 py-2.5">
                  <div className="font-medium text-[#17221E]">{m.fullName}</div>
                  <div className="text-[11px] text-[#53635D]">{m.email}</div>
                </td>
                <td className="px-4 py-2.5 text-xs text-[#53635D]">
                  {m.department} · {m.title}
                </td>
                <td className="px-4 py-2.5">
                  <select
                    value={m.roleId}
                    onChange={(e) => updateMember(m.userId, { roleId: e.target.value })}
                    className="rounded border border-[#E5DFD3] bg-white px-2 py-1 text-xs"
                  >
                    {initialData.roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2.5">
                  <StatusBadge
                    label={m.isActive ? 'active' : 'inactive'}
                    tone={m.isActive ? 'emerald' : 'red'}
                  />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => updateMember(m.userId, { isActive: !m.isActive })}
                    className="rounded border border-[#E5DFD3] px-2.5 py-1 text-xs font-medium"
                  >
                    {m.isActive ? 'Deactivate' : 'Reactivate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ModalDialog open={inviteOpen} onClose={() => setInviteOpen(false)} title="Add / Assign Staff">
        <form onSubmit={handleInvite} className="space-y-3 text-xs">
          {errMsg && (
            <div className="rounded border border-[#F4C7C3] bg-[#FDF1F0] px-3 py-2 text-[#B42318]">
              {errMsg}
            </div>
          )}
          <input
            required
            type="email"
            placeholder="Work Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-8 w-full rounded border border-[#E5DFD3] px-2.5"
          />
          <input
            required
            placeholder="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="h-8 w-full rounded border border-[#E5DFD3] px-2.5"
          />
          <input
            type="password"
            placeholder="Initial Password (min 8 chars for new account)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-8 w-full rounded border border-[#E5DFD3] px-2.5"
          />
          <div className="grid grid-cols-3 gap-2">
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="h-8 rounded border border-[#E5DFD3] px-2"
            >
              {initialData.roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <input
              required
              placeholder="Department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="h-8 rounded border border-[#E5DFD3] px-2.5"
            />
            <input
              required
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-8 rounded border border-[#E5DFD3] px-2.5"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setInviteOpen(false)}
              className="h-8 rounded border border-[#E5DFD3] px-3"
            >
              Cancel
            </button>
            <button type="submit" className="h-8 rounded bg-[#164E3F] px-4 font-semibold text-white">
              Save Staff
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}

export function RolesPermissionsView({ initialData }: { initialData: RolesData }) {
  const [roles, setRoles] = useState(initialData.roles);
  const [selectedRoleId, setSelectedRoleId] = useState(initialData.roles[1]?.id ?? initialData.roles[0]?.id ?? '');
  const [createOpen, setCreateOpen] = useState(false);
  const [roleName, setRoleName] = useState('');
  const [roleDesc, setRoleDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const selectedRole = roles.find((r) => r.id === selectedRoleId);
  const isSuperAdmin = selectedRole?.slug === 'super_admin';

  function hasAction(mod: string, act: AdminAction): boolean {
    if (isSuperAdmin) return true;
    const grant = selectedRole?.permissions.find((p) => p.moduleKey === mod);
    return Boolean(grant?.actions.includes(act));
  }

  function hasPii(mod: string): boolean {
    if (isSuperAdmin) return true;
    const grant = selectedRole?.permissions.find((p) => p.moduleKey === mod);
    return Boolean(grant?.piiAccess);
  }

  function toggleAction(mod: string, act: AdminAction) {
    if (!selectedRole || isSuperAdmin) return;
    setRoles((prev) =>
      prev.map((r) => {
        if (r.id !== selectedRole.id) return r;
        const existing = r.permissions.find((p) => p.moduleKey === mod);
        if (!existing) {
          return {
            ...r,
            permissions: [
              ...r.permissions,
              { moduleKey: mod, actions: [act], piiAccess: false, dataScope: 'all' },
            ],
          };
        }
        const nextActions = existing.actions.includes(act)
          ? existing.actions.filter((a) => a !== act)
          : [...existing.actions, act];
        return {
          ...r,
          permissions: r.permissions.map((p) =>
            p.moduleKey === mod ? { ...p, actions: nextActions } : p
          ),
        };
      })
    );
  }

  function togglePii(mod: string) {
    if (!selectedRole || isSuperAdmin) return;
    setRoles((prev) =>
      prev.map((r) => {
        if (r.id !== selectedRole.id) return r;
        const existing = r.permissions.find((p) => p.moduleKey === mod);
        if (!existing) {
          return {
            ...r,
            permissions: [
              ...r.permissions,
              { moduleKey: mod, actions: ['view'], piiAccess: true, dataScope: 'all' },
            ],
          };
        }
        return {
          ...r,
          permissions: r.permissions.map((p) =>
            p.moduleKey === mod ? { ...p, piiAccess: !p.piiAccess } : p
          ),
        };
      })
    );
  }

  async function saveMatrix() {
    if (!selectedRole || isSuperAdmin) return;
    setSaving(true);
    setToast('');
    try {
      const res = await fetch('/api/admin/system', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'role_permissions',
          roleId: selectedRole.id,
          grants: selectedRole.permissions.map((p) => ({
            moduleKey: p.moduleKey,
            actions: p.actions,
            piiAccess: p.piiAccess,
            dataScope: 'all',
          })),
        }),
      });
      if (res.ok) {
        setToast(`Saved dynamic backend RBAC matrix for ${selectedRole.name}.`);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateRole(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/system', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'role', name: roleName, description: roleDesc }),
    });
    if (res.ok) {
      setCreateOpen(false);
      setRoleName('');
      setRoleDesc('');
      const r2 = await fetch('/api/admin/system?scope=roles');
      if (r2.ok) {
        const d = (await r2.json()) as RolesData;
        setRoles(d.roles);
      }
    }
  }

  return (
    <div>
      <PageHeader
        title="Roles & Dynamic RBAC Permissions"
        subtitle="Enforced directly in backend API guards (requireAdminPermission) and PII field masking."
        actions={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#164E3F] px-3 text-xs font-semibold text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            New custom role
          </button>
        }
      />

      {toast && (
        <div className="mb-3 rounded border border-[#CBE1D6] bg-[#E7F1EC] px-3 py-2 text-xs font-medium text-[#164E3F]">
          {toast}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-12">
        <div className="space-y-1.5 lg:col-span-3">
          {roles.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                setSelectedRoleId(r.id);
                setToast('');
              }}
              className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-xs ${
                r.id === selectedRoleId
                  ? 'border-[#164E3F] bg-[#E7F1EC] text-[#164E3F]'
                  : 'border-[#E5DFD3] bg-white text-[#17221E] hover:bg-[#FAF8F3]'
              }`}
            >
              <div>
                <div className="font-semibold">{r.name}</div>
                <div className="text-[10px] text-[#53635D]">
                  {r.isSystem ? 'System role' : 'Custom'} · {r.membersCount} staff
                </div>
              </div>
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-[#E5DFD3] bg-white lg:col-span-9">
          {selectedRole && (
            <>
              <div className="flex items-center justify-between border-b border-[#E5DFD3] px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-[#17221E]">{selectedRole.name}</div>
                  <div className="text-xs text-[#53635D]">{selectedRole.description}</div>
                </div>
                {!isSuperAdmin && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={saveMatrix}
                    className="inline-flex h-8 items-center gap-1 rounded bg-[#164E3F] px-3 text-xs font-semibold text-white"
                  >
                    <Check className="h-3.5 w-3.5" />
                    {saving ? 'Saving...' : 'Save Matrix'}
                  </button>
                )}
              </div>

              <div className="max-h-[65vh] overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 border-b border-[#E5DFD3] bg-[#FAF8F3] text-[11px] font-medium text-[#53635D]">
                    <tr>
                      <th className="px-3 py-2">Module</th>
                      {initialData.actions.map((a) => (
                        <th key={a} className="px-2 py-2 text-center capitalize">
                          {a}
                        </th>
                      ))}
                      <th className="px-2 py-2 text-center">PII</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5DFD3]">
                    {initialData.modules.map((mod) => (
                      <tr key={mod} className="hover:bg-[#FAF8F3]/60">
                        <td className="px-3 py-2 font-medium capitalize text-[#17221E]">
                          {mod.replace(/_/g, ' ')}
                        </td>
                        {initialData.actions.map((act) => (
                          <td key={act} className="px-2 py-2 text-center">
                            <input
                              type="checkbox"
                              disabled={isSuperAdmin}
                              checked={hasAction(mod, act)}
                              onChange={() => toggleAction(mod, act)}
                            />
                          </td>
                        ))}
                        <td className="px-2 py-2 text-center">
                          <input
                            type="checkbox"
                            disabled={isSuperAdmin}
                            checked={hasPii(mod)}
                            onChange={() => togglePii(mod)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      <ModalDialog open={createOpen} onClose={() => setCreateOpen(false)} title="Create Custom Role">
        <form onSubmit={handleCreateRole} className="space-y-3 text-xs">
          <input
            required
            placeholder="Role Name (e.g. Regional Da Nang Ops)"
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
            className="h-8 w-full rounded border border-[#E5DFD3] px-2.5"
          />
          <textarea
            rows={2}
            placeholder="Description"
            value={roleDesc}
            onChange={(e) => setRoleDesc(e.target.value)}
            className="w-full rounded border border-[#E5DFD3] p-2"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="h-8 rounded border border-[#E5DFD3] px-3"
            >
              Cancel
            </button>
            <button type="submit" className="h-8 rounded bg-[#164E3F] px-4 font-semibold text-white">
              Create Role
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}

export function AuditLogsView({ initialLogs }: { initialLogs: AuditLogsList }) {
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [selected, setSelected] = useState<AuditLogsList[number] | null>(null);

  const filtered = initialLogs.filter((l) => {
    if (moduleFilter !== 'all' && l.module !== moduleFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        l.actorEmail.toLowerCase().includes(q) ||
        l.entityId.toLowerCase().includes(q) ||
        l.reason.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const modules = Array.from(new Set(initialLogs.map((l) => l.module))).sort();

  return (
    <div>
      <PageHeader
        title="Immutable Audit Logs"
        subtitle="Forensic trail of sensitive edits, RBAC changes, financial approvals, and CSV exports."
      />

      <SavedViewToolbar
        moduleKey="audit_logs"
        currentFilters={{ moduleFilter }}
        onApplyFilters={(f) => {
          if (typeof f.moduleFilter === 'string') setModuleFilter(f.moduleFilter);
        }}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search actor email, entity ID, reason..."
        extraControls={
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="h-8 rounded-md border border-[#E5DFD3] bg-[#FAF8F3] px-2 text-xs"
          >
            <option value="all">All modules</option>
            {modules.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        }
      />

      <div className="overflow-hidden rounded-lg border border-[#E5DFD3] bg-white">
        <table className="w-full text-left text-[12px]">
          <thead className="border-b border-[#E5DFD3] bg-[#FAF8F3] text-[11px] font-medium text-[#53635D]">
            <tr>
              <th className="px-4 py-2.5">Timestamp</th>
              <th className="px-4 py-2.5">Actor</th>
              <th className="px-4 py-2.5">Module / Action</th>
              <th className="px-4 py-2.5">Entity</th>
              <th className="px-4 py-2.5">Reason</th>
              <th className="px-4 py-2.5 text-right">Diff</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5DFD3]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-xs text-[#53635D]">
                  No audit events match your filter.
                </td>
              </tr>
            ) : (
              filtered.map((a) => (
                <tr key={a.id} className="hover:bg-[#FAF8F3]/60">
                  <td className="px-4 py-2 tabular-nums text-[#53635D]">
                    {a.createdAt.slice(0, 19).replace('T', ' ')}
                  </td>
                  <td className="px-4 py-2 font-medium text-[#17221E]">{a.actorEmail}</td>
                  <td className="px-4 py-2">
                    <span className="font-medium text-[#17221E]">{a.module}</span>{' '}
                    <StatusBadge label={a.action} tone={statusToTone(a.action)} />
                  </td>
                  <td className="px-4 py-2 font-mono text-[11px] text-[#53635D]">
                    {a.entityType}:{a.entityId.slice(0, 12)}
                  </td>
                  <td className="max-w-xs truncate px-4 py-2 text-[#53635D]">{a.reason || '—'}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setSelected(a)}
                      className="rounded border border-[#E5DFD3] px-2 py-0.5 text-[11px]"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <SideDrawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? `Audit: ${selected.module} / ${selected.action}` : ''}
        subtitle={selected ? `Actor: ${selected.actorEmail}` : undefined}
      >
        {selected && (
          <div className="space-y-4 text-xs">
            <div className="rounded border border-[#E5DFD3] bg-[#FAF8F3] p-3">
              <div>
                <strong>Entity:</strong> {selected.entityType} ({selected.entityId})
              </div>
              <div>
                <strong>IP:</strong> {selected.ipAddress || 'unknown'}
              </div>
              <div>
                <strong>Reason:</strong> {selected.reason || '—'}
              </div>
            </div>
            <div>
              <div className="mb-1 font-semibold">Before JSON</div>
              <pre className="overflow-auto rounded border border-[#E5DFD3] bg-[#FAF8F3] p-3 text-[11px]">
                {JSON.stringify(selected.beforeJson, null, 2)}
              </pre>
            </div>
            <div>
              <div className="mb-1 font-semibold">After JSON</div>
              <pre className="overflow-auto rounded border border-[#E5DFD3] bg-[#FAF8F3] p-3 text-[11px]">
                {JSON.stringify(selected.afterJson, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </SideDrawer>
    </div>
  );
}

export function SystemSettingsView({
  initialSnapshot,
  initialRules,
}: {
  initialSnapshot: SettingsSnapshot;
  initialRules: RulesList;
}) {
  const [config, setConfig] = useState(initialSnapshot.config);
  const [rules, setRules] = useState(initialRules);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  async function saveFeeConfig(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setToast('');
    try {
      await Promise.all([
        fetch('/api/admin/system', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'setting',
            key: 'service_fee_rate',
            value: config.serviceFeeRate,
            reason: 'Updated guest service fee rate from BOS System Settings',
          }),
        }),
        fetch('/api/admin/system', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'setting',
            key: 'host_commission_rate',
            value: config.hostCommissionRate,
            reason: 'Updated host commission rate from BOS System Settings',
          }),
        }),
        fetch('/api/admin/system', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'setting',
            key: 'default_min_nights',
            value: config.defaultMinNights,
            reason: 'Updated platform minimum stay from BOS System Settings',
          }),
        }),
        fetch('/api/admin/system', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'setting',
            key: 'fx_rates',
            value: config.fxRates,
            reason: 'Updated platform FX rates from BOS System Settings',
          }),
        }),
      ]);
      setToast('System fee rates, minimum stay & FX history updated in PostgreSQL.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleRule(ruleId: string, current: boolean) {
    const res = await fetch('/api/admin/system', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'automation_rule', ruleId, isActive: !current }),
    });
    if (res.ok) {
      setRules((prev) =>
        prev.map((r) => (r.id === ruleId ? { ...r, isActive: !current } : r))
      );
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Settings, FX Rates & Workflow Automation"
        subtitle="DB-driven configuration (no hardcoded commission/fee constants) snapped onto new bookings."
      />

      {toast && (
        <div className="rounded border border-[#CBE1D6] bg-[#E7F1EC] px-3 py-2 text-xs font-medium text-[#164E3F]">
          {toast}
        </div>
      )}

      <form
        onSubmit={saveFeeConfig}
        className="grid gap-5 rounded-lg border border-[#E5DFD3] bg-white p-5 text-xs lg:grid-cols-2"
      >
        <div className="space-y-3">
          <div className="text-sm font-semibold text-[#17221E]">
            Marketplace Fee & Policy Rates
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[#53635D]">
                Guest Service Fee Rate (0.12 = 12%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="0.5"
                value={config.serviceFeeRate}
                onChange={(e) =>
                  setConfig({ ...config, serviceFeeRate: Number(e.target.value) })
                }
                className="h-8 w-full rounded border border-[#E5DFD3] px-2.5 tabular-nums"
              />
            </div>
            <div>
              <label className="mb-1 block text-[#53635D]">
                Host Commission Rate (0 = 0%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="0.5"
                value={config.hostCommissionRate}
                onChange={(e) =>
                  setConfig({ ...config, hostCommissionRate: Number(e.target.value) })
                }
                className="h-8 w-full rounded border border-[#E5DFD3] px-2.5 tabular-nums"
              />
            </div>
            <div>
              <label className="mb-1 block text-[#53635D]">
                Platform Minimum Stay (nights, 7–180)
              </label>
              <input
                type="number"
                step="1"
                min="7"
                max="180"
                value={config.defaultMinNights}
                onChange={(e) =>
                  setConfig({ ...config, defaultMinNights: Number(e.target.value) })
                }
                className="h-8 w-full rounded border border-[#E5DFD3] px-2.5 tabular-nums"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="h-8 rounded bg-[#164E3F] px-4 font-semibold text-white"
          >
            {saving ? 'Saving...' : 'Save Platform Rates & FX'}
          </button>
        </div>

        <div className="space-y-3">
          <div className="text-sm font-semibold text-[#17221E]">FX Reference Rates (to VND)</div>
          <div className="grid grid-cols-3 gap-2">
            {(['USD', 'EUR', 'GBP', 'SGD', 'AUD'] as const).map((cur) => (
              <div key={cur}>
                <label className="mb-1 block text-[11px] text-[#53635D]">{cur} &rarr; VND</label>
                <input
                  type="number"
                  value={config.fxRates[cur] ?? 25400}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      fxRates: { ...config.fxRates, [cur]: Number(e.target.value) },
                    })
                  }
                  className="h-8 w-full rounded border border-[#E5DFD3] px-2 tabular-nums"
                />
              </div>
            ))}
          </div>
        </div>
      </form>

      <div className="rounded-lg border border-[#E5DFD3] bg-white">
        <div className="border-b border-[#E5DFD3] px-4 py-3 text-sm font-semibold text-[#17221E]">
          Event-Driven Workflow Automation Rules
        </div>
        <div className="divide-y divide-[#E5DFD3]">
          {rules.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-4 py-3 text-xs">
              <div>
                <div className="font-semibold text-[#17221E]">{r.name}</div>
                <div className="text-[11px] text-[#53635D]">
                  Trigger: <code>{r.triggerEvent}</code> &rarr; Action: {r.actionType}
                </div>
              </div>
              <button
                type="button"
                onClick={() => toggleRule(r.id, r.isActive)}
                className={`rounded px-2.5 py-1 text-xs font-semibold ${
                  r.isActive
                    ? 'bg-[#E7F1EC] text-[#164E3F]'
                    : 'border border-[#E5DFD3] text-[#53635D]'
                }`}
              >
                {r.isActive ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-[#E5DFD3] bg-white">
        <div className="border-b border-[#E5DFD3] px-4 py-3 text-sm font-semibold text-[#17221E]">
          Historical FX Rate Ledger
        </div>
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[#E5DFD3] bg-[#FAF8F3] text-[11px] font-medium text-[#53635D]">
            <tr>
              <th className="px-4 py-2">Currency</th>
              <th className="px-4 py-2 text-right">Rate to VND</th>
              <th className="px-4 py-2">Source</th>
              <th className="px-4 py-2 text-right">Effective From</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5DFD3]">
            {initialSnapshot.fxHistory.map((h) => (
              <tr key={h.id}>
                <td className="px-4 py-2 font-semibold">{h.currencyCode}</td>
                <td className="px-4 py-2 text-right tabular-nums">{h.rateToVnd.toLocaleString()}</td>
                <td className="px-4 py-2 text-[#53635D]">{h.source}</td>
                <td className="px-4 py-2 text-right tabular-nums text-[#53635D]">
                  {h.effectiveFrom.slice(0, 16).replace('T', ' ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
