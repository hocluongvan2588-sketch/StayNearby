'use client';

import { useState } from 'react';
import { UserCheck } from 'lucide-react';

interface DemoCustomerLoginButtonProps {
  email: string;
  password: string;
  label: string;
  loadingLabel: string;
  targetPath?: string;
}

export function DemoCustomerLoginButton({
  email,
  password,
  label,
  loadingLabel,
  targetPath = '/customer',
}: DemoCustomerLoginButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleDemoLogin() {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        window.location.assign(targetPath);
        return;
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={handleDemoLogin}
      className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-[12px] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
    >
      <UserCheck className="w-4 h-4" aria-hidden="true" />
      <span>{loading ? loadingLabel : label}</span>
    </button>
  );
}
