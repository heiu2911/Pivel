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
4. Chạy ứng dụng với `npm run dev` và mở `http://localhost:3000`.
5. Trên máy tính, tìm địa chỉ IPv4 trong mạng LAN (Windows: `ipconfig`). Ví dụ `192.168.1.10`.
6. Nếu chỉ cần truy cập giao diện qua LAN, điện thoại cùng Wi-Fi có thể mở `http://192.168.1.10:3000` (thay bằng IPv4 thực tế của máy tính).
7. Để test GPS trên điện thoại, cách khuyến nghị là chạy `npm run dev` trên máy tính rồi mở một **HTTPS tunnel** tới cổng `3000`.
8. Cài `cloudflared` trên Windows, sau đó mở terminal thứ nhất và chạy `npm run dev`.
9. Mở terminal thứ hai và chạy `npm run tunnel`. Cloudflare Quick Tunnel sẽ tạo một URL `https://<ngẫu-nhiên>.trycloudflare.com` trỏ về `http://localhost:3000`. Quick Tunnels dành cho development/testing và không cần tài khoản Cloudflare. citeturn0search0turn0search1
10. Mở **URL HTTPS mà `cloudflared` in ra** trên điện thoại. Không dùng `http://192.168.0.103:3000` để test GPS.
11. `next.config.ts` đã cho phép `*.trycloudflare.com` trong `allowedDevOrigins`, nên hostname tunnel ngẫu nhiên vẫn có thể tải tài nguyên dev của Next.js. Next.js hỗ trợ wildcard trong `allowedDevOrigins`. citeturn1search0

Lưu ý: Quick Tunnel là URL tạm thời và thay đổi khi chạy lại. Không commit token, credentials hoặc file chứng chỉ vào Git.

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


## Import địa danh từ tài liệu du lịch

Repository includes `supabase/seed-destinations.sql`, which adds 69 destinations and Vietnamese descriptions based on the document **“CÁC ĐIỂM DL CỦA NB VÀ QN”**.

1. Open your project's **Supabase Dashboard → SQL Editor**.
2. Run `supabase/add-destination-details.sql` first. It adds the five detail columns used by the destination detail modal and backfills details that can be safely extracted from existing descriptions.
3. Open `supabase/seed-destinations.sql` and copy its contents into SQL Editor if you have not imported the destinations yet.
4. Review the approximate coordinates, then run the seed script. Existing checkpoint rows are preserved and destination names already present are skipped.
5. Refresh TravelQuest. Select a destination and press **“Xem chi tiết”** to see **Lịch sử hình thành**, **Kiến trúc – cảnh quan**, **Điểm đặc trưng nhất là**, **Fun fact**, and **Slogan**.

**Important:** run the migration before using this version of the app, because it selects the five new columns. The migration does not change RLS policies. Some legacy descriptions may not contain all five labeled sections; those fields remain blank and the UI displays an “đang được cập nhật” message rather than inventing facts. Review approximate coordinates before relying on the 150 m GPS check-in radius.
