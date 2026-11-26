'use client';

import { useState } from 'react';
import { Download, Plus } from 'lucide-react';
import {
  KpiMetric,
  ModalDialog,
  PageHeader,
  StatusBadge,
  fmtVnd,
  statusToTone,
} from './BosPrimitives';
import type {
  getFinanceOverview,
  listHostPayouts,
  listInvoices,
  listOperatingExpenses,
  listReconciliationRecords,
  listRefundRequests,
} from '@/modules/admin-bos';

type FinanceOverview = Awaited<ReturnType<typeof getFinanceOverview>>;
type PayoutsList = Awaited<ReturnType<typeof listHostPayouts>>;
type RefundsList = Awaited<ReturnType<typeof listRefundRequests>>;
type ReconList = Awaited<ReturnType<typeof listReconciliationRecords>>;
type InvoicesList = Awaited<ReturnType<typeof listInvoices>>;
type ExpensesList = Awaited<ReturnType<typeof listOperatingExpenses>>;

export function FinanceTransactionsView({ initialData }: { initialData: FinanceOverview }) {
  const [tab, setTab] = useState<'transactions' | 'ledger'>('transactions');
  const m = initialData.metrics;

  return (
    <div>
      <PageHeader
        title="Transactions & Platform Revenue"
        subtitle="Real-time separation of GMV, 12% Guest Platform Fee Revenue, Host Payable, and Contribution Profit."
        actions={
          <a
            href="/api/admin/finance?scope=export_csv"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#E5DFD3] bg-white px-3 text-xs font-medium text-[#17221E] hover:bg-[#FAF8F3]"
          >
            <Download className="h-3.5 w-3.5 text-[#53635D]" />
            Export Ledger CSV
          </a>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiMetric label="GMV (Total Stay Value)" value={fmtVnd(m.gmvVnd)} />
        <KpiMetric
          label="Net Platform Revenue"
          value={fmtVnd(m.netPlatformRevenueVnd)}
          hint={`Gross ${fmtVnd(m.grossRevenueVnd)} - Refunds ${fmtVnd(m.refundsVnd)}`}
          accent="emerald"
        />
        <KpiMetric label="Host Payable / Check-in" value={fmtVnd(m.hostPayableVnd)} />
        <KpiMetric label="Operating Expenses" value={fmtVnd(m.opexVnd)} />
        <KpiMetric
          label="Contribution Profit"
          value={fmtVnd(m.contributionProfitVnd)}
          accent={m.contributionProfitVnd >= 0 ? 'emerald' : 'terracotta'}
        />
      </div>

      <div className="mb-4 flex gap-3 border-b border-[#E5DFD3]">
        <button
          type="button"
          onClick={() => setTab('transactions')}
          className={`border-b-2 px-3 py-2 text-xs font-semibold ${
            tab === 'transactions'
              ? 'border-[#164E3F] text-[#164E3F]'
              : 'border-transparent text-[#53635D]'
          }`}
        >
          Gateway Transactions ({initialData.transactions.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('ledger')}
          className={`border-b-2 px-3 py-2 text-xs font-semibold ${
            tab === 'ledger'
              ? 'border-[#164E3F] text-[#164E3F]'
              : 'border-transparent text-[#53635D]'
          }`}
        >
          Immutable Financial Ledger ({initialData.ledgerEntries.length})
        </button>
      </div>

      {tab === 'transactions' ? (
        <div className="overflow-hidden rounded-lg border border-[#E5DFD3] bg-white">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-[#E5DFD3] bg-[#FAF8F3] text-[11px] font-medium text-[#53635D]">
              <tr>
                <th className="px-4 py-2.5">Booking</th>
                <th className="px-4 py-2.5">Provider / Method</th>
                <th className="px-4 py-2.5">External Ref</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Amount</th>
                <th className="px-4 py-2.5 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DFD3]">
              {initialData.transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-[#53635D]">
                    No payment gateway transactions recorded yet.
                  </td>
                </tr>
              ) : (
                initialData.transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-[#FAF8F3]/60">
                    <td className="px-4 py-2.5 font-semibold text-[#17221E]">{t.bookingCode}</td>
                    <td className="px-4 py-2.5 text-xs uppercase text-[#53635D]">
                      {t.provider} · {t.method}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-[#53635D]">
                      {t.externalRef || '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge label={t.status} tone={statusToTone(t.status)} />
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                      {fmtVnd(t.amountVnd)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs tabular-nums text-[#53635D]">
                      {t.createdAt.slice(0, 16).replace('T', ' ')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[#E5DFD3] bg-white">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-[#E5DFD3] bg-[#FAF8F3] text-[11px] font-medium text-[#53635D]">
              <tr>
                <th className="px-4 py-2.5">Entry Type</th>
                <th className="px-4 py-2.5">Booking</th>
                <th className="px-4 py-2.5">Description</th>
                <th className="px-4 py-2.5 text-right">Amount</th>
                <th className="px-4 py-2.5 text-right">Occurred</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DFD3]">
              {initialData.ledgerEntries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-xs text-[#53635D]">
                    Ledger will automatically populate as bookings and refunds settle.
                  </td>
                </tr>
              ) : (
                initialData.ledgerEntries.map((l) => (
                  <tr key={l.id} className="hover:bg-[#FAF8F3]/60">
                    <td className="px-4 py-2.5">
                      <StatusBadge label={l.entryType} tone={statusToTone(l.entryType)} />
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-[#17221E]">
                      {l.bookingCode || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#53635D]">{l.description}</td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                      {fmtVnd(l.amountVnd)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs tabular-nums text-[#53635D]">
                      {l.occurredAt.slice(0, 16).replace('T', ' ')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function HostPayoutsView({ initialPayouts }: { initialPayouts: PayoutsList }) {
  const [payouts, setPayouts] = useState(initialPayouts);

  async function updatePayout(
    payoutId: string,
    status: 'pending' | 'scheduled' | 'paid' | 'on_hold' | 'direct_at_checkin'
  ) {
    const ref =
      status === 'paid'
        ? window.prompt('Enter bank transfer / settlement reference:') ?? ''
        : '';
    const res = await fetch('/api/admin/finance', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'payout', payoutId, status, payoutReference: ref }),
    });
    if (res.ok) {
      setPayouts((prev) =>
        prev.map((p) =>
          p.id === payoutId ? { ...p, status, payoutReference: ref || p.payoutReference } : p
        )
      );
    }
  }

  return (
    <div>
      <PageHeader
        title="Host Payouts & Check-in Statements"
        subtitle="Track host settlement obligations (0% host commission under BookingFlow) and direct-at-checkin statements."
      />

      <div className="overflow-hidden rounded-lg border border-[#E5DFD3] bg-white">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-[#E5DFD3] bg-[#FAF8F3] text-[11px] font-medium text-[#53635D]">
            <tr>
              <th className="px-4 py-2.5">Host / Booking</th>
              <th className="px-4 py-2.5">Period / Mode</th>
              <th className="px-4 py-2.5 text-right">Gross</th>
              <th className="px-4 py-2.5 text-right">Net Payable</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5 text-right">Update</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5DFD3]">
            {payouts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-xs text-[#53635D]">
                  No host payout statements recorded yet.
                </td>
              </tr>
            ) : (
              payouts.map((p) => (
                <tr key={p.id} className="hover:bg-[#FAF8F3]/60">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-[#17221E]">{p.hostName}</div>
                    <div className="text-[11px] text-[#53635D]">
                      {p.bookingCode || 'Period statement'} {p.payoutReference ? `· Ref: ${p.payoutReference}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[#53635D]">
                    {p.periodMonth} · {p.collectionMode.replace(/_/g, ' ')}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{fmtVnd(p.grossAmountVnd)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-[#164E3F]">
                    {fmtVnd(p.netPayableVnd)}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge label={p.status} tone={statusToTone(p.status)} />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <select
                      value={p.status}
                      onChange={(e) =>
                        updatePayout(
                          p.id,
                          e.target.value as
                            | 'pending'
                            | 'scheduled'
                            | 'paid'
                            | 'on_hold'
                            | 'direct_at_checkin'
                        )
                      }
                      className="rounded border border-[#E5DFD3] bg-white px-2 py-1 text-xs"
                    >
                      <option value="direct_at_checkin">Direct at Check-in</option>
                      <option value="pending">Pending</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="paid">Paid</option>
                      <option value="on_hold">On Hold</option>
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RefundsView({ initialRefunds }: { initialRefunds: RefundsList }) {
  const [refunds, setRefunds] = useState(initialRefunds);
  const [open, setOpen] = useState(false);

  const [bookingCodeOrId, setBookingCodeOrId] = useState('');
  const [refundType, setRefundType] = useState<'policy_cancellation' | 'cooling_off' | 'wifi_mismatch' | 'dispute_settlement' | 'admin_goodwill'>('policy_cancellation');
  const [amountVnd, setAmountVnd] = useState(0);
  const [reason, setReason] = useState('');

  async function refresh() {
    const res = await fetch('/api/admin/finance?scope=refunds');
    if (res.ok) {
      const d = (await res.json()) as { refunds: RefundsList };
      setRefunds(d.refunds);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/finance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'refund',
        bookingCodeOrId,
        refundType,
        amountVnd,
        reason,
      }),
    });
    if (res.ok) {
      setOpen(false);
      setBookingCodeOrId('');
      setReason('');
      await refresh();
    }
  }

  async function processRefund(refundId: string, decision: 'approved' | 'completed' | 'rejected') {
    const decisionNote = window.prompt(`Decision note for ${decision}:`);
    if (!decisionNote?.trim()) return;
    const res = await fetch('/api/admin/finance', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'refund', refundId, decision, decisionNote }),
    });
    if (res.ok) await refresh();
  }

  return (
    <div>
      <PageHeader
        title="Refunds & Credit Notes"
        subtitle="Controlled refund approvals synchronized with booking payment status and financial ledger."
        actions={
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#164E3F] px-3 text-xs font-semibold text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            New refund request
          </button>
        }
      />

      <div className="overflow-hidden rounded-lg border border-[#E5DFD3] bg-white">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-[#E5DFD3] bg-[#FAF8F3] text-[11px] font-medium text-[#53635D]">
            <tr>
              <th className="px-4 py-2.5">Booking / Guest</th>
              <th className="px-4 py-2.5">Type & Reason</th>
              <th className="px-4 py-2.5 text-right">Amount</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5 text-right">Decision</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5DFD3]">
            {refunds.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-xs text-[#53635D]">
                  No refund requests recorded.
                </td>
              </tr>
            ) : (
              refunds.map((r) => (
                <tr key={r.id} className="hover:bg-[#FAF8F3]/60">
                  <td className="px-4 py-2.5">
                    <div className="font-semibold text-[#17221E]">{r.bookingCode}</div>
                    <div className="text-[11px] text-[#53635D]">{r.guestName}</div>
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    <div className="font-medium capitalize text-[#17221E]">
                      {r.refundType.replace('_', ' ')}
                    </div>
                    <div className="text-[#53635D]">{r.reason}</div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                    {fmtVnd(r.amountVnd)}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge label={r.status} tone={statusToTone(r.status)} />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {r.status === 'requested' || r.status === 'approved' ? (
                      <div className="inline-flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => processRefund(r.id, 'completed')}
                          className="rounded bg-[#164E3F] px-2.5 py-1 text-xs font-semibold text-white"
                        >
                          Complete Refund
                        </button>
                        <button
                          type="button"
                          onClick={() => processRefund(r.id, 'rejected')}
                          className="rounded border border-[#F4C7C3] bg-[#FDF1F0] px-2.5 py-1 text-xs font-semibold text-[#B42318]"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-[#53635D]">{r.decisionNote || 'Processed'}</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ModalDialog open={open} onClose={() => setOpen(false)} title="Create Refund Request">
        <form onSubmit={handleCreate} className="space-y-3 text-xs">
          <input
            required
            placeholder="Booking Code (e.g. VN-940218)"
            value={bookingCodeOrId}
            onChange={(e) => setBookingCodeOrId(e.target.value)}
            className="h-8 w-full rounded border border-[#E5DFD3] px-2.5"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={refundType}
              onChange={(e) =>
                setRefundType(
                  e.target.value as
                    | 'policy_cancellation'
                    | 'cooling_off'
                    | 'wifi_mismatch'
                    | 'dispute_settlement'
                    | 'admin_goodwill'
                )
              }
              className="h-8 rounded border border-[#E5DFD3] px-2"
            >
              <option value="policy_cancellation">Policy Cancellation</option>
              <option value="cooling_off">24h Cooling-Off</option>
              <option value="wifi_mismatch">Wi-Fi Mismatch</option>
              <option value="dispute_settlement">Dispute Settlement</option>
              <option value="admin_goodwill">Admin Goodwill</option>
            </select>
            <input
              required
              type="number"
              min={0}
              placeholder="Amount VND"
              value={amountVnd}
              onChange={(e) => setAmountVnd(Number(e.target.value))}
              className="h-8 rounded border border-[#E5DFD3] px-2.5"
            />
          </div>
          <textarea
            required
            rows={2}
            placeholder="Refund justification..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded border border-[#E5DFD3] p-2"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-8 rounded border border-[#E5DFD3] px-3"
            >
              Cancel
            </button>
            <button type="submit" className="h-8 rounded bg-[#164E3F] px-4 font-semibold text-white">
              Submit Request
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}

export function ReconciliationInvoicesView({
  initialRecords,
  initialInvoices,
}: {
  initialRecords: ReconList;
  initialInvoices: InvoicesList;
}) {
  const [records, setRecords] = useState(initialRecords);
  const [tab, setTab] = useState<'recon' | 'invoices'>('recon');
  const [open, setOpen] = useState(false);

  const [provider, setProvider] = useState<'stripe' | 'vietqr' | 'bank_transfer'>('vietqr');
  const [periodLabel, setPeriodLabel] = useState('2026-11');
  const [expectedVnd, setExpectedVnd] = useState(0);
  const [settledVnd, setSettledVnd] = useState(0);
  const [note, setNote] = useState('');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/finance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'reconciliation',
        provider,
        periodLabel,
        expectedVnd,
        settledVnd,
        note,
      }),
    });
    if (res.ok) {
      setOpen(false);
      const r2 = await fetch('/api/admin/finance?scope=reconciliation');
      if (r2.ok) {
        const d = (await r2.json()) as { records: ReconList };
        setRecords(d.records);
      }
    }
  }

  return (
    <div>
      <PageHeader
        title="Reconciliation & Invoices"
        subtitle="Verify payment gateway settlements against internal ledger entries and inspect generated invoices."
        actions={
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#164E3F] px-3 text-xs font-semibold text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            Log reconciliation
          </button>
        }
      />

      <div className="mb-4 flex gap-3 border-b border-[#E5DFD3]">
        <button
          type="button"
          onClick={() => setTab('recon')}
          className={`border-b-2 px-3 py-2 text-xs font-semibold ${
            tab === 'recon'
              ? 'border-[#164E3F] text-[#164E3F]'
              : 'border-transparent text-[#53635D]'
          }`}
        >
          Gateway Reconciliation ({records.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('invoices')}
          className={`border-b-2 px-3 py-2 text-xs font-semibold ${
            tab === 'invoices'
              ? 'border-[#164E3F] text-[#164E3F]'
              : 'border-transparent text-[#53635D]'
          }`}
        >
          Invoices ({initialInvoices.length})
        </button>
      </div>

      {tab === 'recon' ? (
        <div className="overflow-hidden rounded-lg border border-[#E5DFD3] bg-white">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-[#E5DFD3] bg-[#FAF8F3] text-[11px] font-medium text-[#53635D]">
              <tr>
                <th className="px-4 py-2.5">Provider / Period</th>
                <th className="px-4 py-2.5 text-right">Expected</th>
                <th className="px-4 py-2.5 text-right">Settled</th>
                <th className="px-4 py-2.5 text-right">Variance</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DFD3]">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-[#53635D]">
                    No reconciliation runs recorded yet.
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2.5 font-medium uppercase">
                      {r.provider} · {r.periodLabel}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmtVnd(r.expectedVnd)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmtVnd(r.settledVnd)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmtVnd(r.varianceVnd)}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge label={r.status} tone={statusToTone(r.status)} />
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#53635D]">{r.note || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[#E5DFD3] bg-white">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-[#E5DFD3] bg-[#FAF8F3] text-[11px] font-medium text-[#53635D]">
              <tr>
                <th className="px-4 py-2.5">Invoice #</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Booking / Customer</th>
                <th className="px-4 py-2.5 text-right">Total</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DFD3]">
              {initialInvoices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-xs text-[#53635D]">
                    Invoices are generated automatically upon booking fee settlement.
                  </td>
                </tr>
              ) : (
                initialInvoices.map((i) => (
                  <tr key={i.id}>
                    <td className="px-4 py-2.5 font-mono font-semibold text-[#17221E]">
                      {i.invoiceNumber}
                    </td>
                    <td className="px-4 py-2.5 text-xs capitalize text-[#53635D]">
                      {i.invoiceType.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      {i.bookingCode || '—'} · {i.userName || 'Guest'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                      {fmtVnd(i.totalVnd)}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge label={i.status} tone={statusToTone(i.status)} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <ModalDialog open={open} onClose={() => setOpen(false)} title="Record Gateway Reconciliation">
        <form onSubmit={handleCreate} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <select
              value={provider}
              onChange={(e) =>
                setProvider(e.target.value as 'stripe' | 'vietqr' | 'bank_transfer')
              }
              className="h-8 rounded border border-[#E5DFD3] px-2"
            >
              <option value="vietqr">VietQR</option>
              <option value="stripe">Stripe</option>
              <option value="bank_transfer">Bank Transfer</option>
            </select>
            <input
              required
              value={periodLabel}
              onChange={(e) => setPeriodLabel(e.target.value)}
              placeholder="2026-11"
              className="h-8 rounded border border-[#E5DFD3] px-2.5"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              placeholder="Expected VND"
              value={expectedVnd}
              onChange={(e) => setExpectedVnd(Number(e.target.value))}
              className="h-8 rounded border border-[#E5DFD3] px-2.5"
            />
            <input
              type="number"
              placeholder="Settled VND"
              value={settledVnd}
              onChange={(e) => setSettledVnd(Number(e.target.value))}
              className="h-8 rounded border border-[#E5DFD3] px-2.5"
            />
          </div>
          <input
            placeholder="Variance explanation / note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="h-8 w-full rounded border border-[#E5DFD3] px-2.5"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-8 rounded border border-[#E5DFD3] px-3"
            >
              Cancel
            </button>
            <button type="submit" className="h-8 rounded bg-[#164E3F] px-4 font-semibold text-white">
              Save Reconciliation
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}

export function FinancialReportsView({
  overview,
  initialExpenses,
}: {
  overview: FinanceOverview;
  initialExpenses: ExpensesList;
}) {
  const [expenses, setExpenses] = useState(initialExpenses);
  const [open, setOpen] = useState(false);

  const [category, setCategory] = useState<'marketing' | 'payroll' | 'infrastructure' | 'operations' | 'partner_promo' | 'other'>('marketing');
  const [department, setDepartment] = useState('Growth');
  const [description, setDescription] = useState('');
  const [amountVnd, setAmountVnd] = useState(0);
  const [incurredDate, setIncurredDate] = useState(new Date().toISOString().slice(0, 10));

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/finance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'expense',
        category,
        department,
        description,
        amountVnd,
        incurredDate,
      }),
    });
    if (res.ok) {
      setOpen(false);
      setDescription('');
      const r2 = await fetch('/api/admin/finance?scope=expenses');
      if (r2.ok) {
        const d = (await r2.json()) as { expenses: ExpensesList };
        setExpenses(d.expenses);
      }
    }
  }

  const totalRecordedOpex = expenses.reduce((sum, e) => sum + e.amountVnd, 0);
  const profitAfterExpenses = overview.metrics.netPlatformRevenueVnd - totalRecordedOpex;

  return (
    <div>
      <PageHeader
        title="P&L, Operating Expenses & Financial Reports"
        subtitle="Track actual net platform revenue against departmental operating costs."
        actions={
          <div className="flex gap-2">
            <a
              href="/api/admin/finance?scope=export_csv"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#E5DFD3] bg-white px-3 text-xs font-medium text-[#17221E]"
            >
              <Download className="h-3.5 w-3.5" />
              CSV Export
            </a>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#164E3F] px-3 text-xs font-semibold text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              Record expense
            </button>
          </div>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        <KpiMetric label="GMV (Booking Value)" value={fmtVnd(overview.metrics.gmvVnd)} />
        <KpiMetric
          label="Net Platform Revenue"
          value={fmtVnd(overview.metrics.netPlatformRevenueVnd)}
          accent="emerald"
        />
        <KpiMetric label="Total Operating Expenses" value={fmtVnd(totalRecordedOpex)} />
        <KpiMetric
          label="Operating Profit"
          value={fmtVnd(profitAfterExpenses)}
          accent={profitAfterExpenses >= 0 ? 'emerald' : 'terracotta'}
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-[#E5DFD3] bg-white">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-[#E5DFD3] bg-[#FAF8F3] text-[11px] font-medium text-[#53635D]">
            <tr>
              <th className="px-4 py-2.5">Date</th>
              <th className="px-4 py-2.5">Category / Dept</th>
              <th className="px-4 py-2.5">Description</th>
              <th className="px-4 py-2.5 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5DFD3]">
            {expenses.map((e) => (
              <tr key={e.id} className="hover:bg-[#FAF8F3]/60">
                <td className="px-4 py-2.5 text-xs tabular-nums text-[#53635D]">
                  {e.incurredDate}
                </td>
                <td className="px-4 py-2.5 text-xs">
                  <StatusBadge label={e.category} tone="neutral" />
                  <span className="ml-2 text-[#53635D]">{e.department}</span>
                </td>
                <td className="px-4 py-2.5 text-[#17221E]">{e.description}</td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums text-[#B42318]">
                  -{fmtVnd(e.amountVnd)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ModalDialog open={open} onClose={() => setOpen(false)} title="Record Operating Expense">
        <form onSubmit={handleCreate} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <select
              value={category}
              onChange={(e) =>
                setCategory(
                  e.target.value as
                    | 'marketing'
                    | 'payroll'
                    | 'infrastructure'
                    | 'operations'
                    | 'partner_promo'
                    | 'other'
                )
              }
              className="h-8 rounded border border-[#E5DFD3] px-2"
            >
              <option value="marketing">Marketing</option>
              <option value="infrastructure">Infrastructure</option>
              <option value="payroll">Payroll</option>
              <option value="operations">Operations</option>
              <option value="partner_promo">Partner Promo</option>
              <option value="other">Other</option>
            </select>
            <input
              required
              placeholder="Department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="h-8 rounded border border-[#E5DFD3] px-2.5"
            />
          </div>
          <input
            required
            placeholder="Expense description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="h-8 w-full rounded border border-[#E5DFD3] px-2.5"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              required
              type="number"
              min={0}
              placeholder="Amount VND"
              value={amountVnd}
              onChange={(e) => setAmountVnd(Number(e.target.value))}
              className="h-8 rounded border border-[#E5DFD3] px-2.5"
            />
            <input
              required
              type="date"
              value={incurredDate}
              onChange={(e) => setIncurredDate(e.target.value)}
              className="h-8 rounded border border-[#E5DFD3] px-2.5"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-8 rounded border border-[#E5DFD3] px-3"
            >
              Cancel
            </button>
            <button type="submit" className="h-8 rounded bg-[#164E3F] px-4 font-semibold text-white">
              Save Expense
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
