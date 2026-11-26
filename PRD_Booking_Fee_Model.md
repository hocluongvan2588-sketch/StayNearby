# PRD: Chuyển đổi mô hình Thanh toán Giữ chỗ 12%, Cam kết hoàn tiền & Tối ưu vận hành Web

**Dự án:** VietNomad Stays (`stay-nearby.vercel.app`)  
**Mục tiêu:** Chuyển từ thu tiền trọn gói sang thu **12% phí giữ chỗ & kiểm định (`Fee_online`)** qua cổng thanh toán online; phần tiền thuê phòng (`Pay_at_checkin = P_host`) khách thanh toán trực tiếp cho chủ nhà khi nhận phòng — kèm **Cam kết hoàn tiền 100% phí giữ chỗ** nếu Wi-Fi hoặc góc làm việc thực tế không khớp báo cáo kiểm định.

## 1. Core Pricing & Checkout Logic
- `P_host`: Giá gốc của chủ nhà cho gói 7 / 14 / 21 / 30 đêm (+ đêm lẻ).
- `Fee_online = Math.round(P_host * 0.12)`: Thu trực tuyến khi đặt phòng qua cổng thanh toán.
- `Pay_at_checkin = P_host`: Thanh toán trực tiếp cho chủ nhà khi check-in.
- `Total_stay = P_host + Fee_online`: Tổng giá trị trọn gói hiển thị xuyên suốt trên toàn bộ 9 loại tiền tệ.
- Trạng thái đơn: `PENDING_PAYMENT` → `RESERVED_LOCKED` → `CHECKED_IN_COMPLETED` / `REFUNDED_WIFI_MISMATCH`.

## 2. Automated Notifications & Quick Contact
- Gửi thông báo đa kênh tự động ngay khi đơn đạt `RESERVED_LOCKED`:
  - **Guest Confirmation:** Báo cáo kiểm định Wi-Fi (Download/Upload/Jitter + Speedtest proof), tóm tắt đã trả 12% & số tiền trả tại check-in, địa chỉ & hướng dẫn check-in, liên hệ WhatsApp/Zalo.
  - **Host Alert:** Thông báo đơn đã cọc 12% khóa lịch và nhắc số tiền thu trực tiếp tại check-in.
  - **Admin Internal Alert:** Cảnh báo đội vận hành xác nhận Zalo với chủ nhà trong 30 phút.
- Nút **Chat with Local Concierge (WhatsApp)** tại AI Concierge & Trang chi tiết phòng.

## 3. UI/UX Copywriting, Mobile Web & Production Cleanup
- Cập nhật Hero, 4 trust bullets, StayCard split breakdown (`Pay $X today · $Y due at check-in`), Booking Summary Widget, bảng so sánh, FAQ & Host Onboarding.
- Ẩn liên kết Demo khỏi Footer công khai; chỉ bật demo switcher khi `NEXT_PUBLIC_ENABLE_DEMO=true` hoặc tại route ẩn `/admin/demo`.

## 4. Verification Fields & iCal Calendar Sync
- Trường kiểm định trên `stays`: `wifi_download_mbps`, `wifi_upload_mbps`, `wifi_jitter_ms`, `speedtest_proof_url`, `workspace_video_url`, `verified_at`, `verification_tier` (`HOST_VERIFIED | VIETNOMAD_CERTIFIED`).
- Trường iCal trên `stay_rooms`: `ical_url`, `ical_last_synced_at`, `ical_sync_status` kèm cron `/api/cron/ical-sync` chạy định kỳ mỗi 3 giờ (`vercel.json`).
