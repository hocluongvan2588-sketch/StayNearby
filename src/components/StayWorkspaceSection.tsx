'use client';

import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Laptop,
  Monitor,
  ShieldCheck,
  Star,
  Wifi,
} from 'lucide-react';
import type { Locale } from '@/lib/i18n';
import { wifiStatusLabel, type WifiStatus } from '@/lib/wifi-status';

export function StayWorkspaceSection({
  hasWorkspace,
  hasErgonomicChair,
  hasExternalMonitor,
  hasCallBooth,
  wifiHasService,
  wifiDownloadMbps,
  wifiUploadMbps,
  wifiPingMs,
  wifiJitterMs,
  wifiTestedAt,
  wifiTesterNote,
  wifiStatus,
  isWifiVerified,
  isWorkReady,
  verifiedAt,
  speedtestProofUrl,
  workspaceVideoUrl,
  workspaceSummary,
  workspacePhotoUrl,
  // Guest-rated Wi-Fi quality — separate from host-declared figures.
  wifiGuestAvgRating,
  wifiGuestReviewCount,
  wifiGuestRecentBookingCount,
  wifiVerifiedByGuests,
  locale,
}: {
  hasWorkspace: boolean;
  hasErgonomicChair: boolean;
  hasExternalMonitor: boolean;
  hasCallBooth: boolean;
  // NULL = chưa cập nhật — nothing is assumed or defaulted (Phase A).
  wifiHasService: boolean | null;
  wifiDownloadMbps: number | null;
  wifiUploadMbps: number | null;
  wifiPingMs: number | null;
  wifiJitterMs: number | null;
  wifiTestedAt: string | null;
  wifiTesterNote: string | null;
  wifiStatus: WifiStatus;
  isWifiVerified: boolean;
  isWorkReady: boolean;
  verifiedAt: string;
  speedtestProofUrl: string | null;
  workspaceVideoUrl: string | null;
  workspaceSummary: string;
  workspacePhotoUrl: string;
  wifiGuestAvgRating: number | null;
  wifiGuestReviewCount: number;
  wifiGuestRecentBookingCount: number;
  wifiVerifiedByGuests: boolean;
  locale: Locale;
}) {
  const isVi = locale === 'vi';
  const [showTechnical, setShowTechnical] = useState(false);
  const hasWifiSpeed =
    wifiDownloadMbps !== null || wifiUploadMbps !== null || wifiPingMs !== null;

  const hasAnyRelevantData =
    hasWorkspace ||
    hasErgonomicChair ||
    hasExternalMonitor ||
    hasCallBooth ||
    wifiHasService === true ||
    hasWifiSpeed ||
    isWifiVerified ||
    isWorkReady ||
    wifiGuestReviewCount > 0 ||
    wifiVerifiedByGuests;

  if (!hasAnyRelevantData) return null;

  const highlights: Array<{ icon: React.ReactNode; label: string }> = [];
  if (wifiDownloadMbps !== null && wifiDownloadMbps > 0) {
    highlights.push({
      icon: <Wifi className="h-5 w-5 shrink-0 text-[#164E3F] stroke-[1.75]" />,
      label: isWifiVerified
        ? isVi
          ? `Wi-Fi ${wifiDownloadMbps} Mbps (đã kiểm định thực tế)`
          : `${wifiDownloadMbps} Mbps Wi-Fi (Independently verified)`
        : isVi
          ? `Wi-Fi ${wifiDownloadMbps} Mbps (do chủ nhà cung cấp)`
          : `${wifiDownloadMbps} Mbps Wi-Fi (Host reported)`,
    });
  }
  if (hasWorkspace) {
    const deskText = hasErgonomicChair
      ? isVi
        ? 'Bàn làm việc riêng và ghế công thái học'
        : 'Dedicated desk and ergonomic chair'
      : isVi
        ? 'Không gian làm việc riêng trong phòng'
        : 'Dedicated workspace';
    highlights.push({
      icon: <Laptop className="h-5 w-5 shrink-0 text-[#17221E] stroke-[1.75]" />,
      label: deskText,
    });
  }
  if (hasExternalMonitor) {
    highlights.push({
      icon: <Monitor className="h-5 w-5 shrink-0 text-[#17221E] stroke-[1.75]" />,
      label: isVi ? 'Trang bị sẵn màn hình ngoài' : 'External monitor included',
    });
  }

  return (
    <section className="py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[22px] font-semibold tracking-tight text-[#17221E]">
          {isVi ? 'Không gian làm việc & Internet' : 'Workspace & Internet'}
        </h2>
        {(isWifiVerified || isWorkReady || wifiVerifiedByGuests) && (
          <span className="flex flex-wrap items-center gap-2">
            {(isWifiVerified || isWorkReady) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#E7F1EC] px-2.5 py-1 text-xs font-medium text-[#164E3F]">
                <ShieldCheck className="h-3.5 w-3.5" />
                {isWifiVerified && isWorkReady
                  ? 'Wi-Fi Verified · Work-Ready'
                  : isWifiVerified
                    ? 'Wi-Fi Verified'
                    : 'Work-Ready'}
              </span>
            )}
            {wifiVerifiedByGuests && (
              <span
                title={
                  isVi
                    ? 'Từ ≥5 khách đã hoàn thành kỳ lưu trú · điểm TB ≥4.5/5 · trong 90 ngày gần nhất · không khiếu nại Wi-Fi nghiêm trọng'
                    : 'From ≥5 guests with completed stays · avg ≥4.5/5 · within the last 90 days · no severe open Wi-Fi complaints'
                }
                className="inline-flex items-center gap-1 rounded-full bg-[#FBF3E2] px-2.5 py-1 text-xs font-medium text-[#8A5A12]"
              >
                <Star className="h-3.5 w-3.5" fill="#A67C2E" />
                {isVi
                  ? 'Wi-Fi được khách lưu trú xác nhận'
                  : 'Wi-Fi Verified by Guests'}
              </span>
            )}
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 space-y-4">
          {workspaceSummary && (
            <p className="text-[15px] leading-relaxed text-[#53635D]">{workspaceSummary}</p>
          )}

          <ul className="space-y-3">
            {highlights.map((item) => (
              <li key={item.label} className="flex items-center gap-3 text-[15px] text-[#17221E]">
                {item.icon}
                <span>{item.label}</span>
              </li>
            ))}
          </ul>

          {/* Guest-rated Internet quality — strictly separate from the
              host-declared figures above; a review is NOT a Mbps verification. */}
          {wifiGuestReviewCount > 0 && (
            <div className="rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#17221E]">
                <Star className="h-4 w-4 text-[#A67C2E]" fill="#A67C2E" />
                <span>
                  {isVi
                    ? 'Chất lượng Internet theo khách lưu trú'
                    : 'Internet quality rated by guests'}
                </span>
                <span className="font-bold">
                  {wifiGuestAvgRating !== null ? `${wifiGuestAvgRating.toFixed(1)}/5` : '—'}
                </span>
                <span className="text-xs font-normal text-[#53635D]">
                  {wifiGuestReviewCount}{' '}
                  {isVi ? 'lượt đánh giá' : 'ratings'}
                  {wifiGuestRecentBookingCount > 0
                    ? ` · ${wifiGuestRecentBookingCount} ${isVi ? 'trong 90 ngày gần nhất' : 'in the last 90 days'}`
                    : ''}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-[#53635D]">
                {isVi
                  ? 'Điểm số từ trải nghiệm thực tế của khách đã hoàn thành kỳ lưu trú (tốc độ · ổn định · phù hợp làm việc từ xa). Khác với thông số do chủ nhà khai báo ở trên — đánh giá của khách không phải là kiểm chứng số Mbps.'
                  : 'Scores from the real experience of guests who completed their stay (speed · stability · fit for remote work). These are separate from the host-declared figures above — guest ratings do not verify Mbps numbers.'}
              </p>
            </div>
          )}

          {(hasWifiSpeed || speedtestProofUrl || workspaceVideoUrl || wifiTesterNote) && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowTechnical((v) => !v)}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#164E3F] underline underline-offset-4 hover:text-[#0F392E]"
              >
                <span>
                  {showTechnical
                    ? isVi
                      ? 'Ẩn chi tiết kỹ thuật'
                      : 'Hide technical details'
                    : isVi
                      ? 'Xem chi tiết kiểm tra tốc độ & kết nối'
                      : 'View technical speed & setup details'}
                </span>
                {showTechnical ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              {showTechnical && (
                <div className="mt-4 space-y-2.5 border-l-2 border-[#E5DFD3] pl-4 text-sm text-[#53635D]">
                  {hasWifiSpeed && (
                    <p>
                      <span className="font-medium text-[#17221E]">
                        {isVi ? 'Thông số mạng:' : 'Network metrics:'}
                      </span>{' '}
                      {wifiDownloadMbps !== null
                        ? `${wifiDownloadMbps} Mbps ${isVi ? 'tải xuống' : 'download'}`
                        : ''}
                      {wifiUploadMbps !== null
                        ? `${wifiDownloadMbps !== null ? ' · ' : ''}${wifiUploadMbps} Mbps ${isVi ? 'tải lên' : 'upload'}`
                        : ''}
                      {wifiPingMs !== null ? ` · ${wifiPingMs} ms ping` : ''}
                      {wifiJitterMs !== null ? ` · ${wifiJitterMs} ms jitter` : ''}
                    </p>
                  )}

                  {wifiTesterNote && <p>{wifiTesterNote}</p>}

                  <p className="text-xs">
                    {isWifiVerified
                      ? isVi
                        ? `Đã VietNomad xác minh ngày ${verifiedAt.slice(0, 10)}.`
                        : `Verified by VietNomad on ${verifiedAt.slice(0, 10)}.`
                      : `${wifiStatusLabel(wifiStatus, isVi)}${
                          wifiTestedAt
                            ? isVi
                              ? ` · cập nhật ngày ${wifiTestedAt.slice(0, 10)}`
                              : ` · updated ${wifiTestedAt.slice(0, 10)}`
                            : ''
                        }`}
                  </p>

                  {(speedtestProofUrl || workspaceVideoUrl) && (
                    <div className="flex flex-wrap gap-4 pt-1">
                      {speedtestProofUrl && (
                        <a
                          href={speedtestProofUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#164E3F] hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          {isVi ? 'Xem kết quả speedtest' : 'View speedtest record'}
                        </a>
                      )}
                      {workspaceVideoUrl && (
                        <a
                          href={workspaceVideoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#164E3F] hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          {isVi ? 'Xem chi tiết bàn làm việc' : 'View workspace walkthrough'}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {hasWorkspace && workspacePhotoUrl && (
          <div className="w-full shrink-0 overflow-hidden rounded-xl border border-[#E5DFD3] bg-[#F2EDE3] sm:w-52">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={workspacePhotoUrl}
              alt={isVi ? 'Góc làm việc' : 'Workspace photo'}
              className="aspect-[4/3] w-full object-cover"
            />
          </div>
        )}
      </div>
    </section>
  );
}
