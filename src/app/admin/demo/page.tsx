import Link from 'next/link';
import { DEMO_CREDENTIALS } from '@/lib/db/seed-data';
import { LoginClient } from '@/components/AuthForms';

export const dynamic = 'force-dynamic';

export default function HiddenAdminDemoPage() {
  return (
    <div className="space-y-2 pt-6">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 text-xs text-[#53635D] sm:px-6 lg:px-8">
        <span className="rounded-full bg-[#FAEDE5] px-3 py-1 font-semibold text-[#C25E28]">
          Internal QA · Hidden Role Switcher (/admin/demo)
        </span>
        <Link href="/admin" className="font-semibold text-[#164E3F] hover:underline">
          ← Admin Operations
        </Link>
      </div>
      <LoginClient
        nextPath="/dashboard"
        demoAccounts={DEMO_CREDENTIALS.map((d) => ({
          key: d.key,
          email: d.email,
          password: d.password,
          role: d.role,
          labelEn: d.labelEn,
          labelVi: d.labelVi,
        }))}
      />
    </div>
  );
}
