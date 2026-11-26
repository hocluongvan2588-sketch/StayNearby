import crypto from 'node:crypto';
import { isValidUuid } from '@/lib/dates';
import { dbQuery, dbTransaction, toNum } from '@/lib/db';
import { AppError } from '@/lib/errors';
import {
  logAdminAudit,
  type AdminActorContext,
} from '@/modules/admin-rbac';
import { buildCsvDocument, triggerAutomationTask } from './shared';

export async function getFinanceOverview(filters?: { rangeDays?: number; provider?: string }) {
  const days = Math.min(Math.max(filters?.rangeDays ?? 90, 7), 365);

  const [kpiRes, opexRes, payoutSummaryRes, txRes, ledgerRes] = await Promise.all([
    dbQuery<{
      gmv_vnd: string | number;
      platform_revenue_vnd: string | number;
      host_payable_vnd: string | number;
      refunds_vnd: string | number;
      processing_fees_vnd: string | number;
    }>(
      `SELECT
        COALESCE(SUM(guest_total_vnd) FILTER (WHERE booking_status = 'confirmed' OR payment_status = 'paid'), 0) AS gmv_vnd,
        COALESCE(SUM(COALESCE(NULLIF(booking_fee_online_vnd, 0), service_fee_vnd)) FILTER (WHERE payment_status IN ('paid', 'partially_refunded')), 0) AS platform_revenue_vnd,
        COALESCE(SUM(COALESCE(NULLIF(pay_at_checkin_vnd, 0), wholesale_total_vnd)) FILTER (WHERE booking_status = 'confirmed'), 0) AS host_payable_vnd,
        COALESCE(SUM(refund_amount_vnd), 0) AS refunds_vnd,
        COALESCE(SUM(processing_fee_vnd), 0) AS processing_fees_vnd
       FROM bookings
       WHERE created_at >= NOW() - ($1 || ' days')::interval`,
      [String(days)]
    ),
    dbQuery<{ total_opex: string | number }>(
      `SELECT COALESCE(SUM(amount_vnd), 0) AS total_opex
       FROM operating_expenses
       WHERE incurred_date >= CURRENT_DATE - $1::integer`,
      [days]
    ),
    dbQuery<{
      pending_payouts_vnd: string | number;
      paid_payouts_vnd: string | number;
      direct_checkin_vnd: string | number;
    }>(
      `SELECT
        COALESCE(SUM(net_payable_vnd) FILTER (WHERE status IN ('pending', 'scheduled')), 0) AS pending_payouts_vnd,
        COALESCE(SUM(net_payable_vnd) FILTER (WHERE status = 'paid'), 0) AS paid_payouts_vnd,
        COALESCE(SUM(net_payable_vnd) FILTER (WHERE status = 'direct_at_checkin'), 0) AS direct_checkin_vnd
       FROM host_payouts`
    ),
    dbQuery<{
      id: string;
      booking_id: string;
      booking_code: string;
      provider: string;
      method: string;
      amount_vnd: string | number;
      currency: string;
      status: string;
      external_ref: string | null;
      paid_at: string | null;
      created_at: string;
    }>(
      `SELECT pt.*, b.booking_code
       FROM payment_transactions pt
       JOIN bookings b ON b.id = pt.booking_id
       ${filters?.provider && filters.provider !== 'all' ? 'WHERE pt.provider = $1' : ''}
       ORDER BY pt.created_at DESC
       LIMIT 150`,
      filters?.provider && filters.provider !== 'all' ? [filters.provider] : []
    ),
    dbQuery<{
      id: string;
      entry_type: string;
      booking_code: string | null;
      amount_vnd: string | number;
      currency: string;
      description: string;
      occurred_at: string;
    }>(
      `SELECT le.*, b.booking_code
       FROM ledger_entries le
       LEFT JOIN bookings b ON b.id = le.booking_id
       ORDER BY le.occurred_at DESC
       LIMIT 150`
    ),
  ]);

  const k = kpiRes.rows[0];
  const gmvVnd = toNum(k?.gmv_vnd);
  const grossRevenueVnd = toNum(k?.platform_revenue_vnd);
  const refundsVnd = toNum(k?.refunds_vnd);
  const netPlatformRevenueVnd = Math.max(0, grossRevenueVnd - refundsVnd);
  const opexVnd = toNum(opexRes.rows[0]?.total_opex);
  const processingFeesVnd = toNum(k?.processing_fees_vnd);
  const contributionProfitVnd = netPlatformRevenueVnd - opexVnd - processingFeesVnd;

  const p = payoutSummaryRes.rows[0];

  return {
    metrics: {
      gmvVnd,
      grossRevenueVnd,
      refundsVnd,
      netPlatformRevenueVnd,
      hostPayableVnd: toNum(k?.host_payable_vnd),
      opexVnd,
      processingFeesVnd,
      contributionProfitVnd,
      pendingPayoutsVnd: toNum(p?.pending_payouts_vnd),
      paidPayoutsVnd: toNum(p?.paid_payouts_vnd),
      directAtCheckinVnd: toNum(p?.direct_checkin_vnd),
    },
    transactions: txRes.rows.map((t) => ({
      id: String(t.id),
      bookingId: String(t.booking_id),
      bookingCode: String(t.booking_code),
      provider: String(t.provider),
      method: String(t.method),
      amountVnd: toNum(t.amount_vnd),
      currency: String(t.currency),
      status: String(t.status),
      externalRef: t.external_ref ? String(t.external_ref) : '',
      paidAt: t.paid_at ? new Date(String(t.paid_at)).toISOString() : null,
      createdAt: new Date(String(t.created_at)).toISOString(),
    })),
    ledgerEntries: ledgerRes.rows.map((l) => ({
      id: String(l.id),
      entryType: String(l.entry_type),
      bookingCode: l.booking_code ? String(l.booking_code) : null,
      amountVnd: toNum(l.amount_vnd),
      currency: String(l.currency),
      description: String(l.description),
      occurredAt: new Date(String(l.occurred_at)).toISOString(),
    })),
  };
}

export async function listHostPayouts(filters?: { status?: string }) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filters?.status && filters.status !== 'all') {
    params.push(filters.status);
    conditions.push(`hp.status = $${params.length}`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const res = await dbQuery<{
    id: string;
    host_id: string;
    host_name: string;
    booking_id: string | null;
    booking_code: string | null;
    period_month: string;
    collection_mode: string;
    gross_amount_vnd: string | number;
    commission_vnd: string | number;
    adjustment_vnd: string | number;
    net_payable_vnd: string | number;
    status: string;
    payout_reference: string;
    due_date: string | null;
    paid_at: string | null;
    notes: string;
    created_at: string;
  }>(
    `SELECT hp.*, u.full_name AS host_name, b.booking_code
     FROM host_payouts hp
     JOIN users u ON u.id = hp.host_id
     LEFT JOIN bookings b ON b.id = hp.booking_id
     ${where}
     ORDER BY hp.created_at DESC LIMIT 200`,
    params
  );

  return res.rows.map((p) => ({
    id: String(p.id),
    hostId: String(p.host_id),
    hostName: String(p.host_name),
    bookingId: p.booking_id ? String(p.booking_id) : null,
    bookingCode: p.booking_code ? String(p.booking_code) : null,
    periodMonth: String(p.period_month),
    collectionMode: String(p.collection_mode),
    grossAmountVnd: toNum(p.gross_amount_vnd),
    commissionVnd: toNum(p.commission_vnd),
    adjustmentVnd: toNum(p.adjustment_vnd),
    netPayableVnd: toNum(p.net_payable_vnd),
    status: String(p.status),
    payoutReference: String(p.payout_reference ?? ''),
    dueDate: p.due_date ? String(p.due_date).slice(0, 10) : null,
    paidAt: p.paid_at ? new Date(String(p.paid_at)).toISOString() : null,
    notes: String(p.notes ?? ''),
    createdAt: new Date(String(p.created_at)).toISOString(),
  }));
}

export async function updateHostPayout(
  actor: AdminActorContext,
  payoutId: string,
  input: {
    status: 'pending' | 'scheduled' | 'paid' | 'on_hold' | 'direct_at_checkin' | 'not_applicable';
    payoutReference?: string;
    adjustmentVnd?: number;
    notes?: string;
  }
) {
  if (!isValidUuid(payoutId)) throw new AppError('VALIDATION_ERROR', 'Invalid payout ID.');

  return dbTransaction(async (tx) => {
    const curRes = await tx.query<{
      id: string;
      booking_id: string | null;
      gross_amount_vnd: string | number;
      commission_vnd: string | number;
      adjustment_vnd: string | number;
      status: string;
    }>('SELECT * FROM host_payouts WHERE id = $1 FOR UPDATE', [payoutId]);
    const cur = curRes.rows[0];
    if (!cur) throw new AppError('NOT_FOUND', 'Host payout record not found.');

    const nextAdj =
      input.adjustmentVnd !== undefined ? Math.round(input.adjustmentVnd) : toNum(cur.adjustment_vnd);
    const nextNet = toNum(cur.gross_amount_vnd) - toNum(cur.commission_vnd) + nextAdj;

    await tx.query(
      `UPDATE host_payouts
       SET status = $1,
           payout_reference = COALESCE($2, payout_reference),
           adjustment_vnd = $3,
           net_payable_vnd = $4,
           notes = COALESCE($5, notes),
           paid_at = CASE WHEN $1 = 'paid' THEN COALESCE(paid_at, NOW()) ELSE paid_at END,
           updated_at = NOW()
       WHERE id = $6`,
      [
        input.status,
        input.payoutReference?.trim() ?? null,
        nextAdj,
        nextNet,
        input.notes?.trim() ?? null,
        payoutId,
      ]
    );

    if (cur.booking_id) {
      await tx.query(`UPDATE bookings SET payout_status = $1 WHERE id = $2`, [
        input.status,
        cur.booking_id,
      ]);
    }

    await logAdminAudit(
      {
        actor,
        module: 'finance_payouts',
        action: input.status === 'paid' ? 'approve' : 'edit',
        entityType: 'host_payout',
        entityId: payoutId,
        before: { status: cur.status, adjustmentVnd: cur.adjustment_vnd },
        after: { ...input, netPayableVnd: nextNet },
        reason: input.notes ?? '',
      },
      tx
    );

    return { ok: true, netPayableVnd: nextNet };
  });
}

export async function listRefundRequests(filters?: { status?: string }) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filters?.status && filters.status !== 'all') {
    params.push(filters.status);
    conditions.push(`rr.status = $${params.length}`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const res = await dbQuery<{
    id: string;
    booking_id: string;
    booking_code: string;
    guest_name: string;
    refund_type: string;
    amount_vnd: string | number;
    reason: string;
    status: string;
    decision_note: string;
    processed_at: string | null;
    created_at: string;
  }>(
    `SELECT rr.*, b.booking_code, g.full_name AS guest_name
     FROM refund_requests rr
     JOIN bookings b ON b.id = rr.booking_id
     JOIN users g ON g.id = b.guest_id
     ${where}
     ORDER BY rr.created_at DESC`,
    params
  );

  return res.rows.map((r) => ({
    id: String(r.id),
    bookingId: String(r.booking_id),
    bookingCode: String(r.booking_code),
    guestName: String(r.guest_name),
    refundType: String(r.refund_type),
    amountVnd: toNum(r.amount_vnd),
    reason: String(r.reason),
    status: String(r.status),
    decisionNote: String(r.decision_note ?? ''),
    processedAt: r.processed_at ? new Date(String(r.processed_at)).toISOString() : null,
    createdAt: new Date(String(r.created_at)).toISOString(),
  }));
}

export async function createRefundRequest(
  actor: AdminActorContext,
  input: {
    bookingCodeOrId: string;
    refundType:
      | 'cooling_off'
      | 'policy_cancellation'
      | 'wifi_mismatch'
      | 'dispute_settlement'
      | 'admin_goodwill';
    amountVnd: number;
    reason: string;
  }
) {
  const bRes = await dbQuery<{ id: string; booking_code: string }>(
    isValidUuid(input.bookingCodeOrId)
      ? 'SELECT id, booking_code FROM bookings WHERE id = $1'
      : 'SELECT id, booking_code FROM bookings WHERE UPPER(booking_code) = UPPER($1)',
    [input.bookingCodeOrId.trim()]
  );
  const booking = bRes.rows[0];
  if (!booking) throw new AppError('NOT_FOUND', 'Booking not found.');

  const id = crypto.randomUUID();
  await dbQuery(
    `INSERT INTO refund_requests (
      id, booking_id, requested_by, refund_type, amount_vnd, reason, status
    ) VALUES ($1,$2,$3,$4,$5,$6,'requested')`,
    [id, booking.id, actor.user.id, input.refundType, Math.max(0, Math.round(input.amountVnd)), input.reason.trim()]
  );

  await dbQuery(`UPDATE bookings SET refund_status = 'requested' WHERE id = $1`, [booking.id]);

  await triggerAutomationTask({
    ruleKey: 'auto_task_refund_request',
    title: `Review refund request for ${booking.booking_code}`,
    description: `${input.refundType} · ${Math.round(input.amountVnd).toLocaleString()} VND — ${input.reason}`,
    entityType: 'refund',
    entityId: id,
    createdBy: actor.user.id,
    fallbackPriority: 'urgent',
    fallbackDueHours: 12,
  });

  await logAdminAudit({
    actor,
    module: 'finance_refunds',
    action: 'create',
    entityType: 'refund_request',
    entityId: id,
    after: { bookingCode: booking.booking_code, amountVnd: input.amountVnd, refundType: input.refundType },
    reason: input.reason,
  });

  return { id };
}

export async function processRefundRequest(
  actor: AdminActorContext,
  refundId: string,
  input: {
    decision: 'approved' | 'completed' | 'rejected';
    decisionNote: string;
  }
) {
  if (!isValidUuid(refundId)) throw new AppError('VALIDATION_ERROR', 'Invalid refund ID.');

  return dbTransaction(async (tx) => {
    const curRes = await tx.query<{
      id: string;
      booking_id: string;
      amount_vnd: string | number;
      status: string;
    }>('SELECT id, booking_id, amount_vnd, status FROM refund_requests WHERE id = $1 FOR UPDATE', [
      refundId,
    ]);
    const cur = curRes.rows[0];
    if (!cur) throw new AppError('NOT_FOUND', 'Refund request not found.');

    await tx.query(
      `UPDATE refund_requests
       SET status = $1,
           decision_note = $2,
           approved_by = $3,
           processed_at = CASE WHEN $1 IN ('completed', 'rejected') THEN NOW() ELSE processed_at END,
           updated_at = NOW()
       WHERE id = $4`,
      [input.decision, input.decisionNote.trim(), actor.user.id, refundId]
    );

    if (input.decision === 'completed') {
      const amt = toNum(cur.amount_vnd);
      await tx.query(
        `UPDATE bookings
         SET refund_status = 'completed',
             payment_status = 'refunded',
             refund_amount_vnd = refund_amount_vnd + $1
         WHERE id = $2`,
        [amt, cur.booking_id]
      );
      await tx.query(
        `INSERT INTO ledger_entries (id, entry_type, booking_id, amount_vnd, description, recorded_by)
         VALUES ($1, 'refund', $2, $3, $4, $5)`,
        [
          crypto.randomUUID(),
          cur.booking_id,
          -Math.abs(amt),
          `Refund completed: ${input.decisionNote.trim()}`,
          actor.user.id,
        ]
      );
    } else if (input.decision === 'rejected') {
      await tx.query(`UPDATE bookings SET refund_status = 'rejected' WHERE id = $1`, [
        cur.booking_id,
      ]);
    } else {
      await tx.query(`UPDATE bookings SET refund_status = 'approved' WHERE id = $1`, [
        cur.booking_id,
      ]);
    }

    await logAdminAudit(
      {
        actor,
        module: 'finance_refunds',
        action: 'approve',
        entityType: 'refund_request',
        entityId: refundId,
        before: { status: cur.status },
        after: input,
        reason: input.decisionNote,
      },
      tx
    );

    return { ok: true };
  });
}

export async function listReconciliationRecords() {
  const res = await dbQuery<{
    id: string;
    provider: string;
    period_label: string;
    expected_vnd: string | number;
    settled_vnd: string | number;
    variance_vnd: string | number;
    status: string;
    note: string;
    reconciled_at: string | null;
    created_at: string;
  }>(`SELECT * FROM reconciliation_records ORDER BY created_at DESC LIMIT 100`);

  return res.rows.map((r) => ({
    id: String(r.id),
    provider: String(r.provider),
    periodLabel: String(r.period_label),
    expectedVnd: toNum(r.expected_vnd),
    settledVnd: toNum(r.settled_vnd),
    varianceVnd: toNum(r.variance_vnd),
    status: String(r.status),
    note: String(r.note ?? ''),
    reconciledAt: r.reconciled_at ? new Date(String(r.reconciled_at)).toISOString() : null,
    createdAt: new Date(String(r.created_at)).toISOString(),
  }));
}

export async function createReconciliationRecord(
  actor: AdminActorContext,
  input: {
    provider: 'stripe' | 'vietqr' | 'bank_transfer' | 'sandbox';
    periodLabel: string;
    expectedVnd: number;
    settledVnd: number;
    note?: string;
  }
) {
  const id = crypto.randomUUID();
  const expected = Math.round(input.expectedVnd);
  const settled = Math.round(input.settledVnd);
  const variance = settled - expected;
  const status = variance === 0 ? 'matched' : 'discrepancy';

  await dbQuery(
    `INSERT INTO reconciliation_records (
      id, provider, period_label, expected_vnd, settled_vnd, variance_vnd, status, note, reconciled_by, reconciled_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`,
    [
      id,
      input.provider,
      input.periodLabel.trim(),
      expected,
      settled,
      variance,
      status,
      input.note?.trim() ?? '',
      actor.user.id,
    ]
  );

  await logAdminAudit({
    actor,
    module: 'finance_reconciliation',
    action: 'create',
    entityType: 'reconciliation_record',
    entityId: id,
    after: { ...input, variance, status },
  });

  return { id, variance, status };
}

export async function listInvoices() {
  const res = await dbQuery<{
    id: string;
    invoice_number: string;
    invoice_type: string;
    booking_code: string | null;
    user_name: string | null;
    subtotal_vnd: string | number;
    tax_vnd: string | number;
    total_vnd: string | number;
    currency: string;
    status: string;
    issued_at: string;
  }>(
    `SELECT inv.*, b.booking_code, u.full_name AS user_name
     FROM invoices inv
     LEFT JOIN bookings b ON b.id = inv.booking_id
     LEFT JOIN users u ON u.id = inv.user_id
     ORDER BY inv.issued_at DESC LIMIT 150`
  );

  return res.rows.map((i) => ({
    id: String(i.id),
    invoiceNumber: String(i.invoice_number),
    invoiceType: String(i.invoice_type),
    bookingCode: i.booking_code ? String(i.booking_code) : null,
    userName: i.user_name ? String(i.user_name) : null,
    subtotalVnd: toNum(i.subtotal_vnd),
    taxVnd: toNum(i.tax_vnd),
    totalVnd: toNum(i.total_vnd),
    currency: String(i.currency),
    status: String(i.status),
    issuedAt: new Date(String(i.issued_at)).toISOString(),
  }));
}

export async function listOperatingExpenses() {
  const res = await dbQuery<{
    id: string;
    category: string;
    department: string;
    description: string;
    amount_vnd: string | number;
    incurred_date: string;
    recorder_name: string | null;
    created_at: string;
  }>(
    `SELECT oe.*, u.full_name AS recorder_name
     FROM operating_expenses oe
     LEFT JOIN users u ON u.id = oe.recorded_by
     ORDER BY oe.incurred_date DESC, oe.created_at DESC`
  );

  return res.rows.map((e) => ({
    id: String(e.id),
    category: String(e.category),
    department: String(e.department),
    description: String(e.description),
    amountVnd: toNum(e.amount_vnd),
    incurredDate: String(e.incurred_date).slice(0, 10),
    recorderName: e.recorder_name ? String(e.recorder_name) : 'Finance',
    createdAt: new Date(String(e.created_at)).toISOString(),
  }));
}

export async function createOperatingExpense(
  actor: AdminActorContext,
  input: {
    category: 'marketing' | 'payroll' | 'infrastructure' | 'operations' | 'partner_promo' | 'other';
    department: string;
    description: string;
    amountVnd: number;
    incurredDate: string;
  }
) {
  const id = crypto.randomUUID();
  const amount = Math.max(0, Math.round(input.amountVnd));

  await dbQuery(
    `INSERT INTO operating_expenses (id, category, department, description, amount_vnd, incurred_date, recorded_by)
     VALUES ($1,$2,$3,$4,$5,$6::date,$7)`,
    [
      id,
      input.category,
      input.department.trim(),
      input.description.trim(),
      amount,
      input.incurredDate,
      actor.user.id,
    ]
  );

  await logAdminAudit({
    actor,
    module: 'finance_reports',
    action: 'create',
    entityType: 'operating_expense',
    entityId: id,
    after: { ...input, amount },
  });

  return { id };
}

export async function exportFinanceLedgerCsv(actor: AdminActorContext): Promise<string> {
  const res = await dbQuery<{
    id: string;
    entry_type: string;
    booking_code: string | null;
    amount_vnd: string | number;
    currency: string;
    description: string;
    occurred_at: string;
  }>(
    `SELECT le.id, le.entry_type, b.booking_code, le.amount_vnd, le.currency, le.description, le.occurred_at
     FROM ledger_entries le
     LEFT JOIN bookings b ON b.id = le.booking_id
     ORDER BY le.occurred_at DESC
     LIMIT 1000`
  );

  await logAdminAudit({
    actor,
    module: 'finance_reports',
    action: 'export',
    entityType: 'ledger_entries',
    entityId: 'csv_export',
    after: { exportedRows: res.rows.length },
  });

  return buildCsvDocument(
    ['Ledger ID', 'Entry Type', 'Booking Code', 'Amount VND', 'Currency', 'Description', 'Occurred At'],
    res.rows.map((r) => [
      r.id,
      r.entry_type,
      r.booking_code ?? '',
      r.amount_vnd,
      r.currency,
      r.description,
      new Date(String(r.occurred_at)).toISOString(),
    ])
  );
}
