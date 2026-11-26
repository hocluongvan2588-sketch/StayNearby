# PRD: Chuyển đổi mô hình Thanh toán Giữ chỗ 12% & Thống nhất BookingFlow

**Dự án:** VietNomad Stays (`stay-nearby.vercel.app`)  
**Mục tiêu:** Thống nhất 100% danh sách chỗ ở trên **BookingFlow**: thu **12% phí giữ chỗ (`Fee_online`)** qua cổng thanh toán online để khóa phòng; phần tiền thuê phòng (`Pay_at_checkin = P_host`) khách thanh toán trực tiếp cho chủ nhà khi nhận phòng (0% hoa hồng chủ nhà). Miễn phí hoàn toàn cho chủ nhà đăng chỗ ở (`€0`), tự khai tiện nghi và tùy chọn gắn badge `Wi-Fi Verified` / `Work-Ready`.

## 1. Core Pricing & Checkout Logic (Unified BookingFlow: `P_host + 12%`)
- `P_host`: 100% giá thuê gốc (net) của chủ nhà cho gói 7 / 14 / 21 / 30 đêm (+ đêm lẻ). Chủ nhà nhận đủ 100% khoản này (0% hoa hồng).
- `Fee_online = Math.round(P_host * 0.12)`: Phí dịch vụ giữ chỗ 12% (bắt buộc thanh toán trực tuyến qua cổng thanh toán VietQR hoặc Stripe để giữ phòng và mở khóa địa chỉ thật).
- `Pay_at_checkin = P_host`: Khách thanh toán trực tiếp 100% giá thuê gốc cho chủ nhà khi check-in.
- `Total_stay = P_host + Fee_online`: Tổng giá trị trọn gói hiển thị xuyên suốt trên toàn bộ 9 loại tiền tệ.
- Trạng thái đơn: `PENDING_PAYMENT` → `RESERVED_LOCKED` → `CHECKED_IN_COMPLETED` / `REFUNDED_WIFI_MISMATCH`.

## 2. Free Host Onboarding, Self-Declared Amenities & Optional Badges
- Gỡ bỏ phí đăng ký `€39` và bỏ rào cản bắt buộc kiểm định Wi-Fi / bàn làm việc / bếp / máy giặt khi đăng phòng.
- Gỡ bỏ kênh `StayDirect` (chuyển hướng ngoài & phí 1% ví quảng cáo); toàn bộ 10 chỗ ở mẫu hoạt động thống nhất trên BookingFlow.
- Chủ nhà tự khai: tốc độ Wi-Fi ước tính, bàn làm việc (`has_workspace`), ghế công thái học (`has_ergonomic_chair`), màn hình rời (`has_external_monitor`), bếp (`full | kitchenette | shared | none`), giặt sấy (`in_unit | building | service | none`).
- Badge tùy chọn do Admin bật/tắt (`is_wifi_verified`, `is_work_ready`) cùng tier `SELF_DECLARED | HOST_VERIFIED | VIETNOMAD_CERTIFIED` và bộ lọc tương ứng trên trang tìm kiếm.

## 3. Automated Notifications & iCal Calendar Sync
- Gửi thông báo đa kênh tự động ngay khi đơn đạt `RESERVED_LOCKED`: Guest Confirmation, Host Alert, và Admin Internal Alert.
- Nút **Ask on WhatsApp** tại Smart Stay Finder & Trang chi tiết phòng.
- Trường iCal trên `stay_rooms`: `ical_url`, `ical_last_synced_at`, `ical_sync_status` kèm cron `/api/cron/ical-sync`.
