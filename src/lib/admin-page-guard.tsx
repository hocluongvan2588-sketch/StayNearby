import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/session';
import {
  assertAdminActorHasPermission,
  getAdminActorContext,
  type AdminAction,
  type AdminActorContext,
  type AdminModuleKey,
} from '@/modules/admin-rbac';

export async function requireAdminPageAccess(
  moduleKey: AdminModuleKey,
  action: AdminAction = 'view'
): Promise<
  | { allowed: true; actor: AdminActorContext }
  | { allowed: false; reason: 'unauthenticated' | 'forbidden'; email?: string }
> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return {
      allowed: false,
      reason: 'unauthenticated',
      email: user?.email,
    };
  }
  const actor = await getAdminActorContext(user);
  try {
    assertAdminActorHasPermission(actor, moduleKey, action);
    return { allowed: true, actor };
  } catch {
    return {
      allowed: false,
      reason: 'forbidden',
      email: user.email,
    };
  }
}

export function AdminAccessWall({
  reason,
  email,
}: {
  reason: 'unauthenticated' | 'forbidden';
  email?: string;
}) {
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-[#E5DFD3] bg-white p-7 text-center">
        <div className="inline-flex items-center rounded border border-[#E5DFD3] bg-[#FAF8F3] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[#C25E28]">
          VietNomad BOS
        </div>
        <h1 className="mt-3 text-lg font-semibold text-[#17221E]">
          {reason === 'forbidden'
            ? 'Insufficient module permission'
            : 'Administrator sign-in required'}
        </h1>
        <p className="mt-2 text-xs leading-relaxed text-[#53635D]">
          {reason === 'forbidden'
            ? `Your role does not grant access to this module (${email ?? 'staff'}). Contact your Super Admin if you need permissions updated.`
            : email
              ? `Signed in as ${email}. Please switch to an internal administrator account.`
              : 'Sign in with your VietNomad BOS team account to continue.'}
        </p>
        <div className="mt-5 flex justify-center gap-2">
          {reason === 'unauthenticated' ? (
            <Link
              href="/login?next=/admin"
              className="rounded-lg bg-[#164E3F] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0F392E]"
            >
              Sign in to BOS
            </Link>
          ) : (
            <Link
              href="/admin"
              className="rounded-lg bg-[#164E3F] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0F392E]"
            >
              Back to Overview
            </Link>
          )}
          <Link
            href="/"
            className="rounded-lg border border-[#E5DFD3] px-4 py-2 text-xs font-medium text-[#17221E] hover:bg-[#FAF8F3]"
          >
            Guest Platform
          </Link>
        </div>
      </div>
    </div>
  );
}
