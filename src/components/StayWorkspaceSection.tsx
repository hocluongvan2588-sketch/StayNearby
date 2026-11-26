'use client';

import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Laptop,
  Monitor,
  ShieldCheck,
  Wifi,
} from 'lucide-react';
import type { Locale } from '@/lib/i18n';

export function StayWorkspaceSection({
  hasWorkspace,
  hasErgonomicChair,
  hasExternalMonitor,
  hasCallBooth,
  wifiDownloadMbps,
  wifiUploadMbps,
  wifiJitterMs,
  wifiTestedAt,
  wifiTesterNote,
  isWifiVerified,
  isWorkReady,
  verifiedAt,
  speedtestProofUrl,
  workspaceVideoUrl,
  workspaceSummary,
  workspacePhotoUrl,
  locale,
}: {
  hasWorkspace: boolean;
  hasErgonomicChair: boolean;
  hasExternalMonitor: boolean;
  hasCallBooth: boolean;
  wifiDownloadMbps: number;
  wifiUploadMbps: number;
  wifiJitterMs: number;
  wifiTestedAt: string;
  wifiTesterNote: string;
  isWifiVerified: boolean;
  isWorkReady: boolean;
  verifiedAt: string;
  speedtestProofUrl: string | null;
  workspaceVideoUrl: string | null;
  workspaceSummary: string;
  workspacePhotoUrl: string;
  locale: Locale;
}) {
  const isVi = locale === 'vi';
  const [showTechnical, setShowTechnical] = useState(false);

  const hasAnyRelevantData =
    hasWorkspace ||
    hasErgonomicChair ||
    hasExternalMonitor ||
    hasCallBooth ||
    wifiDownloadMbps > 0 ||
    isWifiVerified ||
    isWorkReady;

  if (!hasAnyRelevantData) return null;

  const highlights: Array<{ icon: React.ReactNode; label: string }> = [];
  if (wifiDownloadMbps > 0) {
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

          {(wifiDownloadMbps > 0 || speedtestProofUrl || workspaceVideoUrl || wifiTesterNote) && (
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
                  {wifiDownloadMbps > 0 && (
                    <p>
                      <span className="font-medium text-[#17221E]">
                        {isVi ? 'Thông số mạng:' : 'Network metrics:'}
                      </span>{' '}
                      {wifiDownloadMbps} Mbps {isVi ? 'tải xuống' : 'download'}
                      {wifiUploadMbps > 0
                        ? ` · ${wifiUploadMbps} Mbps ${isVi ? 'tải lên' : 'upload'}`
                        : ''}
                      {wifiJitterMs > 0 ? ` · ${wifiJitterMs} ms jitter` : ''}
                    </p>
                  )}

                  {wifiTesterNote && <p>{wifiTesterNote}</p>}

                  <p className="text-xs">
                    {isWifiVerified
                      ? isVi
                        ? `Đã kiểm định ngày ${verifiedAt.slice(0, 10)}.`
                        : `Independently tested on ${verifiedAt.slice(0, 10)}.`
                      : isVi
                        ? `Thông tin cập nhật bởi chủ nhà ngày ${wifiTestedAt.slice(0, 10)}.`
                        : `Host-reported specification, updated ${wifiTestedAt.slice(0, 10)}.`}
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
