'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  ImagePlus,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  User,
} from 'lucide-react';
import { formatBookingStatusLabel, formatVndExact } from '@/lib/i18n';
import { usePreferences } from '@/components/PreferencesProvider';
import type {
  HostInboxPayload,
  InboxConversationItem,
  InboxMessageItem,
} from '@/modules/host-inbox';

export function HostMessagesClient({
  initialInbox,
  initialSelectedId,
  initialMessages,
}: {
  initialInbox: HostInboxPayload;
  initialSelectedId: string | null;
  initialMessages: InboxMessageItem[];
}) {
  const { locale } = usePreferences();
  const isVi = locale === 'vi';

  const [inbox, setInbox] = useState<HostInboxPayload>(initialInbox);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [messages, setMessages] = useState<InboxMessageItem[]>(initialMessages);
  const [filterMode, setFilterMode] = useState<'all' | 'unread'>('all');
  const [search, setSearch] = useState('');

  const [draftText, setDraftText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [newTplTitle, setNewTplTitle] = useState('');
  const [newTplBody, setNewTplBody] = useState('');
  const [mobilePane, setMobilePane] = useState<'list' | 'thread'>(
    initialSelectedId ? 'thread' : 'list'
  );

  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const selectedConv: InboxConversationItem | null =
    inbox.conversations.find((c) => c.id === selectedId) ?? null;

  async function refreshList(nextFilter = filterMode, nextSearch = search) {
    const sp = new URLSearchParams();
    sp.set('filter', nextFilter);
    if (nextSearch.trim()) sp.set('q', nextSearch.trim());
    const res = await fetch(`/api/host/messages?${sp.toString()}`);
    const json = await res.json();
    if (json.ok) {
      setInbox({
        totalUnread: json.totalUnread ?? 0,
        conversations: json.conversations ?? [],
        quickReplies: json.quickReplies ?? [],
      });
    }
  }

  async function openConversation(id: string) {
    setSelectedId(id);
    setMobilePane('thread');
    setLoadingThread(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/host/messages/${id}`);
      const json = await res.json();
      if (!json.ok) {
        setErrorMsg(json.error?.message ?? 'Could not load thread.');
        return;
      }
      setMessages(json.messages ?? []);
      setInbox((prev) => ({
        ...prev,
        conversations: prev.conversations.map((c) =>
          c.id === id ? { ...c, unreadCount: 0 } : c
        ),
      }));
    } finally {
      setLoadingThread(false);
    }
  }

  async function handleSend() {
    if (!selectedId || (!draftText.trim() && !imageUrl)) return;
    setSending(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/host/messages/${selectedId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: draftText.trim(),
          imageUrl: imageUrl || undefined,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setErrorMsg(json.error?.message ?? 'Could not send message.');
        return;
      }
      setMessages((prev) => [...prev, json.message]);
      setDraftText('');
      setImageUrl('');
      await refreshList();
    } finally {
      setSending(false);
    }
  }

  async function handleUploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setErrorMsg('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (selectedId) fd.append('conversationId', selectedId);
      const res = await fetch('/api/host/messages/upload', {
        method: 'POST',
        body: fd,
      });
      const json = await res.json();
      if (!json.ok) {
        setErrorMsg(json.error?.message ?? 'Upload failed.');
        return;
      }
      if (json.uploaded?.url) {
        setImageUrl(json.uploaded.url);
      }
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleAddQuickReply() {
    if (!newTplTitle.trim() || !newTplBody.trim()) return;
    const res = await fetch('/api/host/quick-replies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTplTitle.trim(),
        body: newTplBody.trim(),
      }),
    });
    const json = await res.json();
    if (json.ok && json.quickReply) {
      setInbox((prev) => ({
        ...prev,
        quickReplies: [
          ...prev.quickReplies,
          { ...json.quickReply, sortOrder: 10 },
        ],
      }));
      setNewTplTitle('');
      setNewTplBody('');
    }
  }

  async function handleDeleteQuickReply(id: string) {
    const res = await fetch('/api/host/quick-replies', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const json = await res.json();
    if (json.ok) {
      setInbox((prev) => ({
        ...prev,
        quickReplies: prev.quickReplies.filter((q) => q.id !== id),
      }));
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-serif-display text-2xl font-semibold text-[#17221E]">
          {isVi ? 'Tin nhắn khách hàng' : 'Messages'}
        </h1>
        <p className="text-xs text-[#53635D]">
          {isVi
            ? 'Trao đổi trực tiếp với khách, gửi ảnh hướng dẫn check-in và dùng mẫu trả lời nhanh.'
            : 'Respond to guest inquiries, share check-in photos, and insert quick replies.'}
        </p>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-[#C25E28]/40 bg-[#FAEDE5] px-4 py-2 text-xs font-medium text-[#C25E28]">
          {errorMsg}
        </div>
      )}

      <div className="grid min-h-[600px] overflow-hidden rounded-xl border border-[#E5DFD3] bg-white lg:grid-cols-12">
        {/* Column 1: Conversations List */}
        <aside
          className={`flex flex-col border-r border-[#E5DFD3] lg:col-span-3 ${
            mobilePane === 'list' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          <div className="space-y-2 border-b border-[#E5DFD3] p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#53635D]" />
              <input
                value={search}
                onChange={(e) => {
                  const v = e.target.value;
                  setSearch(v);
                  refreshList(filterMode, v);
                }}
                placeholder={isVi ? 'Tìm khách hoặc mã đơn...' : 'Search guest or booking...'}
                className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] py-1.5 pl-8 pr-2.5 text-xs outline-none focus:border-[#164E3F]"
              />
            </div>
            <div className="flex gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => {
                  setFilterMode('all');
                  refreshList('all', search);
                }}
                className={`rounded-md px-2.5 py-1 font-medium ${
                  filterMode === 'all'
                    ? 'bg-[#164E3F] text-white'
                    : 'bg-[#FAF8F3] text-[#53635D]'
                }`}
              >
                {isVi ? 'Tất cả' : 'All'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterMode('unread');
                  refreshList('unread', search);
                }}
                className={`rounded-md px-2.5 py-1 font-medium ${
                  filterMode === 'unread'
                    ? 'bg-[#164E3F] text-white'
                    : 'bg-[#FAF8F3] text-[#53635D]'
                }`}
              >
                {isVi ? 'Chưa đọc' : 'Unread'}
              </button>
            </div>
          </div>

          <div className="flex-1 divide-y divide-[#E5DFD3] overflow-y-auto">
            {inbox.conversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#53635D]">
                <MessageSquare className="mx-auto mb-2 h-7 w-7 text-[#53635D]/70" strokeWidth={1.5} />
                {isVi ? 'Chưa có cuộc hội thoại nào.' : 'No conversations found.'}
              </div>
            ) : (
              inbox.conversations.map((c) => {
                const active = c.id === selectedId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => openConversation(c.id)}
                    className={`w-full px-3.5 py-3 text-left transition ${
                      active ? 'bg-[#E7F1EC]/65' : 'hover:bg-[#FAF8F3]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold text-[#17221E]">
                        {c.guestName}
                      </span>
                      {c.unreadCount > 0 && (
                        <span className="rounded-full bg-[#C25E28] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-[11px] font-medium text-[#164E3F]">
                      {c.bookingCode ?? (isVi ? c.stayTitleVi : c.stayTitleEn)}
                    </div>
                    <div className="mt-1 truncate text-[11px] text-[#53635D]">
                      {c.lastMessagePreview || (isVi ? 'Bắt đầu trò chuyện' : 'No messages yet')}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Column 2: Active Message Thread */}
        <section
          className={`flex flex-col lg:col-span-6 ${
            mobilePane === 'thread' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {!selectedConv ? (
            <div className="flex flex-1 flex-col items-center justify-center p-10 text-center">
              <MessageSquare className="h-9 w-9 text-[#53635D]/70" strokeWidth={1.5} />
              <p className="mt-3 text-sm font-medium text-[#17221E]">
                {isVi ? 'Chọn một hội thoại để xem tin nhắn' : 'Select a conversation'}
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-[#E5DFD3] px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setMobilePane('list')}
                    className="rounded-lg border border-[#E5DFD3] p-1.5 lg:hidden"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div>
                    <div className="text-sm font-semibold text-[#17221E]">
                      {selectedConv.guestName}
                    </div>
                    <div className="text-[11px] text-[#53635D]">
                      {isVi ? selectedConv.stayTitleVi : selectedConv.stayTitleEn}
                      {selectedConv.bookingCode ? ` · ${selectedConv.bookingCode}` : ''}
                    </div>
                  </div>
                </div>
                {loadingThread && <Loader2 className="h-4 w-4 animate-spin text-[#164E3F]" />}
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto bg-[#FAF8F3]/60 p-4">
                {messages.length === 0 ? (
                  <p className="py-8 text-center text-xs text-[#53635D]">
                    {isVi ? 'Chưa có tin nhắn nào trong hội thoại này.' : 'No messages in this thread yet.'}
                  </p>
                ) : (
                  messages.map((m) => {
                    const isHost = m.senderRole === 'host' || m.senderRole === 'admin';
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isHost ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[82%] rounded-xl px-3.5 py-2.5 text-xs ${
                            isHost
                              ? 'bg-[#164E3F] text-white'
                              : 'border border-[#E5DFD3] bg-white text-[#17221E]'
                          }`}
                        >
                          <div className="mb-1 text-[10px] opacity-75">
                            {m.senderName} · {m.createdAt.slice(11, 16)}
                          </div>
                          {m.body && <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>}
                          {m.imageUrl && (
                            <img
                              src={m.imageUrl}
                              alt="Attachment"
                              className="mt-2 max-h-52 rounded-lg border border-black/10 object-cover"
                            />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {showTemplates && (
                <div className="space-y-2 border-t border-[#E5DFD3] bg-[#FAF8F3] p-3 text-xs">
                  <div className="flex items-center justify-between font-semibold text-[#17221E]">
                    <span>{isVi ? 'Mẫu trả lời nhanh' : 'Quick reply templates'}</span>
                    <button
                      type="button"
                      onClick={() => setShowTemplates(false)}
                      className="text-[11px] text-[#53635D]"
                    >
                      {isVi ? 'Đóng' : 'Close'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {inbox.quickReplies.map((qr) => (
                      <div
                        key={qr.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#E5DFD3] bg-white px-2.5 py-1"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setDraftText(qr.body);
                            setShowTemplates(false);
                          }}
                          className="font-medium text-[#164E3F] hover:underline"
                        >
                          {qr.title}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteQuickReply(qr.id)}
                          className="text-[#53635D] hover:text-[#C25E28]"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-1.5 pt-1 sm:grid-cols-3">
                    <input
                      value={newTplTitle}
                      onChange={(e) => setNewTplTitle(e.target.value)}
                      placeholder={isVi ? 'Tên mẫu...' : 'Template title...'}
                      className="rounded border border-[#E5DFD3] bg-white px-2 py-1"
                    />
                    <input
                      value={newTplBody}
                      onChange={(e) => setNewTplBody(e.target.value)}
                      placeholder={isVi ? 'Nội dung mẫu...' : 'Template message...'}
                      className="rounded border border-[#E5DFD3] bg-white px-2 py-1"
                    />
                    <button
                      type="button"
                      onClick={handleAddQuickReply}
                      className="inline-flex items-center justify-center gap-1 rounded bg-[#164E3F] px-2 py-1 font-semibold text-white"
                    >
                      <Plus className="h-3 w-3" />
                      {isVi ? 'Lưu mẫu' : 'Add template'}
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2 border-t border-[#E5DFD3] bg-white p-3">
                {imageUrl && (
                  <div className="flex items-center justify-between rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-1.5 text-xs">
                    <span className="truncate text-[#164E3F]">{imageUrl}</span>
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="text-[#C25E28]"
                    >
                      ×
                    </button>
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTemplates((v) => !v)}
                    title={isVi ? 'Mẫu tin nhắn nhanh' : 'Quick replies'}
                    className="rounded-lg border border-[#E5DFD3] p-2 text-[#53635D] hover:bg-[#FAF8F3] hover:text-[#164E3F]"
                  >
                    <Sparkles className="h-4 w-4" />
                  </button>
                  <label
                    title={isVi ? 'Đính kèm ảnh' : 'Attach image'}
                    className="cursor-pointer rounded-lg border border-[#E5DFD3] p-2 text-[#53635D] hover:bg-[#FAF8F3] hover:text-[#164E3F]"
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ImagePlus className="h-4 w-4" />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadImage}
                      className="hidden"
                    />
                  </label>
                  <textarea
                    rows={2}
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    placeholder={isVi ? 'Nhập tin nhắn gửi khách...' : 'Write a message...'}
                    className="flex-1 resize-none rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-xs outline-none focus:border-[#164E3F]"
                  />
                  <button
                    type="button"
                    disabled={sending || (!draftText.trim() && !imageUrl)}
                    onClick={handleSend}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#164E3F] px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-[#0F392E] disabled:opacity-60"
                  >
                    {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    {isVi ? 'Gửi' : 'Send'}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        {/* Column 3: Linked Guest & Booking Details */}
        <aside className="hidden border-l border-[#E5DFD3] bg-[#FAF8F3]/40 p-4 text-xs lg:col-span-3 lg:block">
          {!selectedConv ? (
            <p className="text-[#53635D]">
              {isVi
                ? 'Thông tin khách & đơn đặt phòng sẽ hiển thị tại đây.'
                : 'Guest and booking context appears here.'}
            </p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5 rounded-xl border border-[#E5DFD3] bg-white p-3.5">
                <div className="flex items-center gap-1.5 font-semibold text-[#17221E]">
                  <User className="h-3.5 w-3.5 text-[#164E3F]" />
                  {selectedConv.guestName}
                </div>
                <div className="text-[#53635D]">{selectedConv.guestEmail}</div>
                {selectedConv.guestPhone && (
                  <div className="text-[#53635D]">{selectedConv.guestPhone}</div>
                )}
              </div>

              {selectedConv.bookingCode && (
                <div className="space-y-2 rounded-xl border border-[#E5DFD3] bg-white p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-[#164E3F]">
                      {selectedConv.bookingCode}
                    </span>
                    {selectedConv.bookingStatus && (
                      <span className="rounded border border-[#E5DFD3] bg-[#FAF8F3] px-1.5 py-0.5 text-[10px] font-semibold">
                        {formatBookingStatusLabel(selectedConv.bookingStatus, locale)}
                      </span>
                    )}
                  </div>
                  <div className="font-medium text-[#17221E]">
                    {isVi ? selectedConv.stayTitleVi : selectedConv.stayTitleEn}
                  </div>
                  <div className="flex items-center gap-1.5 text-[#53635D]">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      {selectedConv.checkIn} → {selectedConv.checkOut} ({selectedConv.nights}n)
                    </span>
                  </div>
                  {selectedConv.payAtCheckinVnd > 0 && (
                    <div className="border-t border-[#E5DFD3] pt-2">
                      <div className="text-[#53635D]">
                        {isVi ? 'Host nhận tại chỗ (100%):' : 'Host payout (100%):'}
                      </div>
                      <div className="font-semibold text-[#164E3F]">
                        {formatVndExact(selectedConv.payAtCheckinVnd)}
                      </div>
                    </div>
                  )}
                  <Link
                    href="/host/reservations"
                    className="mt-1 inline-block font-semibold text-[#164E3F] hover:underline"
                  >
                    {isVi ? 'Mở quản lý đặt phòng →' : 'Go to Reservations →'}
                  </Link>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
