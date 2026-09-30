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
6. Trên điện thoại cùng Wi-Fi với máy tính, mở `http://192.168.1.10:3000` (thay bằng IPv4 thực tế của máy tính).

Lưu ý: cấu hình LAN này giúp điện thoại truy cập dev server, nhưng GPS trên thiết bị thật có thể yêu cầu HTTPS. Nếu trình duyệt điện thoại không cho Location trên URL HTTP LAN, cần dùng một tunnel HTTPS như Cloudflare Tunnel hoặc ngrok.

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
