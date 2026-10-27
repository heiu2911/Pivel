import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Đăng nhập hoặc đăng ký | Pivel",
  description:
    "Đăng nhập, tạo tài khoản hoặc khôi phục mật khẩu để lưu giữ hành trình du lịch của bạn trên Pivel.",
};

export default function LoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
