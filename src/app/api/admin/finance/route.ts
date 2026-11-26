import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { requireAdminPermission } from '@/modules/admin-rbac';
import {
  createOperatingExpense,
  createReconciliationRecord,
  createRefundRequest,
  exportFinanceLedgerCsv,
  getFinanceOverview,
  listHostPayouts,
  listInvoices,
  listOperatingExpenses,
  listReconciliationRecords,
  listRefundRequests,
  processRefundRequest,
  updateHostPayout,
} from '@/modules/admin-bos';

export async function GET(req: NextRequest) {
  try {
    const scope = req.nextUrl.searchParams.get('scope') ?? 'overview';

    if (scope === 'export_csv') {
      const actor = await requireAdminPermission('finance_reports', 'export');
      const csv = await exportFinanceLedgerCsv(actor);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="vietnomad-ledger-export.csv"',
        },
      });
    }

    if (scope === 'payouts') {
      await requireAdminPermission('finance_payouts', 'view');
      const payouts = await listHostPayouts({
        status: req.nextUrl.searchParams.get('status') ?? undefined,
      });
      return okJson({ payouts });
    }

    if (scope === 'refunds') {
      await requireAdminPermission('finance_refunds', 'view');
      const refunds = await listRefundRequests({
        status: req.nextUrl.searchParams.get('status') ?? undefined,
      });
      return okJson({ refunds });
    }

    if (scope === 'reconciliation') {
      await requireAdminPermission('finance_reconciliation', 'view');
      const records = await listReconciliationRecords();
      return okJson({ records });
    }

    if (scope === 'invoices') {
      await requireAdminPermission('finance_invoices', 'view');
      const invoices = await listInvoices();
      return okJson({ invoices });
    }

    if (scope === 'expenses') {
      await requireAdminPermission('finance_reports', 'view');
      const expenses = await listOperatingExpenses();
      return okJson({ expenses });
    }

    await requireAdminPermission('finance_transactions', 'view');
    const data = await getFinanceOverview({
      rangeDays: Number(req.nextUrl.searchParams.get('days') ?? '90') || 90,
      provider: req.nextUrl.searchParams.get('provider') ?? undefined,
    });
    return okJson(data);
  } catch (err) {
    return errJson(err);
  }
}

const postSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('refund'),
    bookingCodeOrId: z.string().min(2),
    refundType: z.enum([
      'cooling_off',
      'policy_cancellation',
      'wifi_mismatch',
      'dispute_settlement',
      'admin_goodwill',
    ]),
    amountVnd: z.number().min(0),
    reason: z.string().min(3).max(500),
  }),
  z.object({
    kind: z.literal('reconciliation'),
    provider: z.enum(['stripe', 'vietqr', 'bank_transfer', 'sandbox']),
    periodLabel: z.string().min(2).max(80),
    expectedVnd: z.number(),
    settledVnd: z.number(),
    note: z.string().max(500).optional(),
  }),
  z.object({
    kind: z.literal('expense'),
    category: z.enum([
      'marketing',
      'payroll',
      'infrastructure',
      'operations',
      'partner_promo',
      'other',
    ]),
    department: z.string().min(2).max(80),
    description: z.string().min(3).max(300),
    amountVnd: z.number().min(0),
    incurredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
]);

export async function POST(req: NextRequest) {
  try {
    const parsed = postSchema.safeParse(await req.json());
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid finance creation payload.');

    if (parsed.data.kind === 'refund') {
      const actor = await requireAdminPermission('finance_refunds', 'create');
      return okJson(await createRefundRequest(actor, parsed.data), 201);
    }
    if (parsed.data.kind === 'reconciliation') {
      const actor = await requireAdminPermission('finance_reconciliation', 'create');
      return okJson(await createReconciliationRecord(actor, parsed.data), 201);
    }
    const actor = await requireAdminPermission('finance_reports', 'create');
    return okJson(await createOperatingExpense(actor, parsed.data), 201);
  } catch (err) {
    return errJson(err);
  }
}

const patchSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('payout'),
    payoutId: z.string().uuid(),
    status: z.enum([
      'pending',
      'scheduled',
      'paid',
      'on_hold',
      'direct_at_checkin',
      'not_applicable',
    ]),
    payoutReference: z.string().max(120).optional(),
    adjustmentVnd: z.number().int().optional(),
    notes: z.string().max(400).optional(),
  }),
  z.object({
    kind: z.literal('refund'),
    refundId: z.string().uuid(),
    decision: z.enum(['approved', 'completed', 'rejected']),
    decisionNote: z.string().min(2).max(500),
  }),
]);

export async function PATCH(req: NextRequest) {
  try {
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid finance update payload.');

    if (parsed.data.kind === 'payout') {
      const actor = await requireAdminPermission(
        'finance_payouts',
        parsed.data.status === 'paid' ? 'approve' : 'edit'
      );
      return okJson(await updateHostPayout(actor, parsed.data.payoutId, parsed.data));
    }

    const actor = await requireAdminPermission('finance_refunds', 'approve');
    return okJson(
      await processRefundRequest(actor, parsed.data.refundId, {
        decision: parsed.data.decision,
        decisionNote: parsed.data.decisionNote,
      })
    );
  } catch (err) {
    return errJson(err);
  }
}
