'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2, Save, ShieldCheck } from 'lucide-react';
import { usePreferences } from '@/components/PreferencesProvider';
import type { HostSettingsData } from '@/modules/host-console';

export function HostSettingsClient({
  hostEmail,
  initialSettings,
}: {
  hostEmail: string;
  initialSettings: HostSettingsData;
}) {
  const { locale } = usePreferences();
  const isVi = locale === 'vi';

  const [form, setForm] = useState<HostSettingsData>(initialSettings);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setNotice('');
    setErrorMsg('');
    try {
      const res = await fetch('/api/host/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!json.ok) {
        setErrorMsg(json.error?.message ?? 'Could not save settings.');
        return;
      }
      setNotice(isVi ? 'Đã lưu cài đặt tài khoản Chủ nhà.' : 'Host settings saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-serif-display text-2xl font-semibold text-[#17221E]">
          {isVi ? 'Cài đặt Chủ nhà & Thanh toán' : 'Host Settings & Preferences'}
        </h1>
        <p className="mt-0.5 text-xs text-[#53635D]">
          {isVi
            ? 'Thiết lập thông tin liên hệ, phương thức nhận tiền phòng 100% tại check-in và thông báo tự động.'
            : 'Manage your contact profile, check-in payment collection method, and notifications.'}
        </p>
      </div>

      {notice && (
        <div className="flex items-center gap-2 rounded-xl border border-[#164E3F]/30 bg-[#E7F1EC] px-4 py-2.5 text-xs font-medium text-[#164E3F]">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}
      {errorMsg && (
        <div className="rounded-xl border border-[#C25E28]/40 bg-[#FAEDE5] px-4 py-2.5 text-xs font-medium text-[#C25E28]">
          {errorMsg}
        </div>
      )}

      {/* Account Info */}
      <section className="space-y-4 rounded-xl border border-[#E5DFD3] bg-white p-5 text-xs">
        <h2 className="text-sm font-semibold text-[#17221E]">
          {isVi ? 'Thông tin liên hệ Chủ nhà' : 'Host Contact Details'}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block font-semibold text-[#17221E]">
              {isVi ? 'Tên hiển thị / Cơ sở' : 'Display / Brand name'}
            </label>
            <input
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 outline-none focus:border-[#164E3F]"
            />
          </div>
          <div>
            <label className="mb-1 block font-semibold text-[#17221E]">Email</label>
            <input
              value={hostEmail}
              disabled
              className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-[#53635D]"
            />
          </div>
          <div>
            <label className="mb-1 block font-semibold text-[#17221E]">
              {isVi ? 'Số điện thoại liên hệ' : 'Contact phone'}
            </label>
            <input
              value={form.contactPhone}
              onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
              placeholder="+84 90..."
              className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 outline-none focus:border-[#164E3F]"
            />
          </div>
          <div>
            <label className="mb-1 block font-semibold text-[#17221E]">
              {isVi ? 'WhatsApp / Zalo hỗ trợ khách' : 'WhatsApp / Zalo handle'}
            </label>
            <input
              value={form.whatsappNumber}
              onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })}
              placeholder="+84 90..."
              className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 outline-none focus:border-[#164E3F]"
            />
          </div>
        </div>
      </section>

      {/* Check-in Collection Bank/QR Reference */}
      <section className="space-y-4 rounded-xl border border-[#E5DFD3] bg-white p-5 text-xs">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#164E3F]" />
          <h2 className="text-sm font-semibold text-[#17221E]">
            {isVi
              ? 'Thông tin thu tiền phòng tại chỗ (100% giá phòng)'
              : 'Direct Check-in Payment Details (100% Host Rate)'}
          </h2>
        </div>
        <p className="text-[#53635D]">
          {isVi
            ? 'VietNomad Stays thu 0% hoa hồng từ chủ nhà. Khách trả trực tiếp cho bạn bằng chuyển khoản VietQR, tiền mặt hoặc thẻ khi nhận phòng.'
            : 'VietNomad Stays charges 0% host commission. Guests pay your full room rate directly upon check-in via bank transfer, QR, card, or cash.'}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block font-semibold text-[#17221E]">
              {isVi ? 'Ngân hàng nhận chuyển khoản' : 'Preferred bank'}
            </label>
            <input
              value={form.bankName}
              onChange={(e) => setForm({ ...form, bankName: e.target.value })}
              placeholder="Vietcombank / Techcombank / ACB"
              className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 outline-none focus:border-[#164E3F]"
            />
          </div>
          <div>
            <label className="mb-1 block font-semibold text-[#17221E]">
              {isVi ? 'Số tài khoản' : 'Account number'}
            </label>
            <input
              value={form.bankAccountNumber}
              onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })}
              className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 outline-none focus:border-[#164E3F]"
            />
          </div>
          <div>
            <label className="mb-1 block font-semibold text-[#17221E]">
              {isVi ? 'Tên chủ tài khoản' : 'Account holder name'}
            </label>
            <input
              value={form.bankAccountName}
              onChange={(e) => setForm({ ...form, bankAccountName: e.target.value })}
              className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 outline-none focus:border-[#164E3F]"
            />
          </div>
          <div>
            <label className="mb-1 block font-semibold text-[#17221E]">
              Zalo Handle
            </label>
            <input
              value={form.zaloHandle}
              onChange={(e) => setForm({ ...form, zaloHandle: e.target.value })}
              className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 outline-none focus:border-[#164E3F]"
            />
          </div>
        </div>
      </section>

      {/* Notifications & Sync */}
      <section className="space-y-3 rounded-xl border border-[#E5DFD3] bg-white p-5 text-xs">
        <h2 className="text-sm font-semibold text-[#17221E]">
          {isVi ? 'Thông báo & Đồng bộ tự động' : 'Notifications & Automation'}
        </h2>
        <div className="space-y-2">
          <label className="flex items-center gap-2 font-medium text-[#17221E]">
            <input
              type="checkbox"
              checked={form.notifyEmail}
              onChange={(e) => setForm({ ...form, notifyEmail: e.target.checked })}
            />
            {isVi
              ? 'Nhận email khi có đơn đặt phòng mới hoặc yêu cầu chờ duyệt'
              : 'Email alerts for new bookings & pending requests'}
          </label>
          <label className="flex items-center gap-2 font-medium text-[#17221E]">
            <input
              type="checkbox"
              checked={form.notifyInApp}
              onChange={(e) => setForm({ ...form, notifyInApp: e.target.checked })}
            />
            {isVi ? 'Thông báo ngay trong Host Console' : 'In-app console notifications'}
          </label>
          <label className="flex items-center gap-2 font-medium text-[#17221E]">
            <input
              type="checkbox"
              checked={form.autoIcalSync}
              onChange={(e) => setForm({ ...form, autoIcalSync: e.target.checked })}
            />
            {isVi ? 'Tự động đồng bộ lịch iCal định kỳ' : 'Enable periodic iCal background sync'}
          </label>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-[#164E3F] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#0F392E] disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isVi ? 'Lưu cài đặt' : 'Save settings'}
        </button>
      </div>
    </form>
  );
}
