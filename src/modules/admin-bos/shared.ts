import crypto from 'node:crypto';
import { dbQuery } from '@/lib/db';

export function escapeCsvCell(val: unknown): string {
  let str = val === null || val === undefined ? '' : String(val);
  // Protect Excel / Google Sheets against CSV formula injection
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsvDocument(headers: string[], rows: unknown[][]): string {
  const head = headers.map((h) => escapeCsvCell(h)).join(',');
  const body = rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(',')).join('\n');
  return `\uFEFF${head}\n${body}`;
}

export async function triggerAutomationTask(params: {
  ruleKey: string;
  title: string;
  description: string;
  entityType:
    | 'general'
    | 'host_lead'
    | 'host'
    | 'guest'
    | 'stay'
    | 'booking'
    | 'ticket'
    | 'payout'
    | 'refund';
  entityId: string;
  assignedStaffId?: string | null;
  createdBy?: string | null;
  fallbackPriority?: 'low' | 'medium' | 'high' | 'urgent';
  fallbackDueHours?: number;
}): Promise<string | null> {
  const ruleRes = await dbQuery<{
    is_active: boolean;
    action_config: { defaultPriority?: string; dueHours?: number } | null;
  }>('SELECT is_active, action_config FROM automation_rules WHERE rule_key = $1', [params.ruleKey]);

  const rule = ruleRes.rows[0];
  if (rule && !rule.is_active) {
    return null;
  }

  const priorityRaw = rule?.action_config?.defaultPriority ?? params.fallbackPriority ?? 'medium';
  const priority = ['low', 'medium', 'high', 'urgent'].includes(priorityRaw)
    ? priorityRaw
    : 'medium';
  const dueHours = Number(rule?.action_config?.dueHours ?? params.fallbackDueHours ?? 24);
  const id = crypto.randomUUID();

  await dbQuery(
    `INSERT INTO admin_tasks (
      id, title, description, status, priority, assigned_staff_id, created_by,
      due_at, entity_type, entity_id, auto_rule_key
    ) VALUES (
      $1, $2, $3, 'todo', $4, $5, $6,
      NOW() + ($7 || ' hours')::interval, $8, $9, $10
    )`,
    [
      id,
      params.title,
      params.description,
      priority,
      params.assignedStaffId ?? null,
      params.createdBy ?? null,
      String(dueHours),
      params.entityType,
      params.entityId,
      params.ruleKey,
    ]
  );

  return id;
}
