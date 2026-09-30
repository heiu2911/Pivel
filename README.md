# TravelQuest

Ứng dụng khám phá địa điểm: xem bản đồ, check-in bằng GPS, tích lũy huy hiệu/XP, xây dựng hành trình và chia sẻ bài viết cùng cộng đồng.

## Yêu cầu

- Node.js 20 hoặc mới hơn
- Một project Supabase đã tạo schema/RLS cho TravelQuest
- Mapbox public token

## Cấu hình

1. Sao chép `.env.example` thành `.env.local`.
2. Điền ba biến môi trường từ Mapbox và Supabase.
3. Cài dependencies với `npm install`.
4. Chạy ứng dụng với `npm run dev`.
5. Trên máy tính, tìm địa chỉ IPv4 trong mạng LAN (Windows: `ipconfig`). Ví dụ `192.168.1.10`.
6. Nếu chỉ cần truy cập giao diện qua LAN, điện thoại cùng Wi-Fi có thể mở `http://192.168.1.10:3000` (thay bằng IPv4 thực tế của máy tính).
7. Để test GPS trên điện thoại, chạy `npm run dev:https`. Next.js 16 hỗ trợ `--experimental-https` và sẽ tạo chứng chỉ HTTPS dùng cho development. citeturn1search0
8. Điện thoại mở `https://192.168.1.10:3000`. Vì chứng chỉ dev là chứng chỉ cục bộ/tự ký, trình duyệt có thể cảnh báo chứng chỉ; nếu thiết bị không tin chứng chỉ thì dùng tunnel HTTPS có chứng chỉ công khai.
9. Với tunnel HTTPS, giữ `npm run dev` hoặc `npm run dev:https` chạy trên máy tính rồi đưa cổng `3000` qua một tunnel HTTPS có hostname công khai. Không commit token, credentials hoặc file chứng chỉ vào Git.

Lưu ý: `allowedDevOrigins` trong `next.config.ts` phải chứa hostname/IP mà điện thoại dùng để truy cập dev server. GPS của trình duyệt trên thiết bị thật cần secure context; HTTPS với chứng chỉ được thiết bị tin cậy là lựa chọn phù hợp.

Không đưa `.env.local` lên Git hoặc chia sẻ private/service-role key. Ứng dụng chỉ dùng Supabase anon key ở trình duyệt.

## Kiểm thử trước khi phát hành

- Mở bản đồ và xác nhận checkpoint hiển thị.
- Đăng ký/đăng nhập, cập nhật hồ sơ và đăng xuất.
- Cho phép vị trí trên thiết bị thật, chọn checkpoint và kiểm tra khoảng cách GPS.
- Xác nhận không thể check-in ngoài bán kính 150m; thử check-in trong bán kính.
- Tạo bài viết, bình luận, thích/bỏ thích, follow/bỏ follow và kiểm tra thông báo.
- Kiểm tra Journey, địa điểm đã lưu, thời tiết và các liên kết đặt dịch vụ.
- Kiểm tra RLS: một tài khoản không thể sửa/xóa dữ liệu riêng tư của tài khoản khác.

## Kiểm tra chất lượng

```bash
npm run lint
npm run build
```

## Triển khai Vercel

1. Đẩy source code lên GitHub/GitLab/Bitbucket, không kèm `.env.local`.
2. Import repository vào Vercel.
3. Thêm ba biến trong `.env.example` vào **Environment Variables** trên Vercel.
4. Deploy và thử lại Mapbox, Supabase Auth, GPS trên URL HTTPS. GPS yêu cầu HTTPS khi truy cập bằng thiết bị thật.
## Development

Current development branch: `feature/gps`
