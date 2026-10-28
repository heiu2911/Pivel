"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Mode = "login" | "register" | "reset" | "update";

function authErrorMessage(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login") || normalized.includes("invalid credentials")) {
    return "Email hoặc mật khẩu không đúng.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Email chưa được xác nhận. Hãy kiểm tra hộp thư trước khi đăng nhập.";
  }
  if (normalized.includes("user already registered")) {
    return "Email này đã có tài khoản. Cậu hãy đăng nhập nhé.";
  }
  if (normalized.includes("password should be at least")) {
    return "Mật khẩu cần có ít nhất 6 ký tự.";
  }
  if (normalized.includes("rate limit") || normalized.includes("too many requests")) {
    return "Cậu thao tác quá nhanh. Hãy đợi một chút rồi thử lại.";
  }
  return "Chưa thể hoàn tất yêu cầu. Cậu kiểm tra thông tin và thử lại nhé.";
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "update") {
      setMode("update");
      setMessage("Hãy nhập mật khẩu mới cho tài khoản của cậu.");
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const cleanEmail = email.trim();
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (error) setMessage(authErrorMessage(error.message));
        else { router.replace("/"); router.refresh(); }
      } else if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({ email: cleanEmail, password, options: { emailRedirectTo: window.location.origin + "/login" } });
        if (error) setMessage(authErrorMessage(error.message));
        else if (data.session) { router.replace("/"); router.refresh(); }
        else { setMessage("Đăng ký thành công! Hãy kiểm tra email để xác nhận tài khoản."); setMode("login"); setPassword(""); }
      } else if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo: window.location.origin + "/login?mode=update" });
        setMessage(error ? "Chưa thể gửi email đặt lại mật khẩu. Hãy thử lại sau." : "Nếu email đã đăng ký, liên kết đặt lại mật khẩu sẽ được gửi tới hộp thư.");
      } else {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) setMessage("Chưa thể cập nhật mật khẩu. Hãy mở lại liên kết khôi phục mới nhất và thử lại.");
        else {
          setMode("login");
          setPassword("");
          setMessage("Mật khẩu đã được cập nhật. Cậu có thể đăng nhập bằng mật khẩu mới.");
          window.history.replaceState({}, "", "/login");
        }
      }
    } catch { setMessage("Đã xảy ra lỗi kết nối. Cậu thử lại nhé."); }
    finally { setBusy(false); }
  }

  async function googleLogin() {
    setBusy(true); setMessage("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin + "/login" } });
      if (error) setMessage("Đăng nhập Google chưa khả dụng. Cậu kiểm tra cấu hình OAuth rồi thử lại nhé.");
    } catch { setMessage("Không thể kết nối Google lúc này."); }
    finally { setBusy(false); }
  }

  const title = mode === "login" ? "Chào mừng trở lại" : mode === "register" ? "Tạo tài khoản Pivel" : mode === "reset" ? "Đặt lại mật khẩu" : "Tạo mật khẩu mới";
  const description = mode === "login" ? "Đăng nhập để tiếp tục hành trình của mình." : mode === "register" ? "Tham gia cộng đồng và lưu giữ kỷ niệm." : mode === "reset" ? "Nhập email để nhận hướng dẫn khôi phục mật khẩu." : "Chọn mật khẩu mới để tiếp tục sử dụng tài khoản.";
  const passwordLabel = mode === "update" ? "Mật khẩu mới" : "Mật khẩu";

  return <main className="flex min-h-screen items-center justify-center bg-[#faf9f1] px-4 py-10 text-[#123f3a]">
    <div className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-[#e0e5d8] bg-[#fffef9] shadow-xl md:grid-cols-2">
      <section className="flex min-h-64 flex-col justify-between bg-[#245b43] p-8 text-white sm:p-10 md:min-h-[580px]">
        <Link href="/" className="text-xl font-black">Pivel<span className="text-[#d9e7b5]">.</span></Link>
        <div className="my-10"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#d9e7b5]">Travel · Explore · Remember</p><h1 className="mt-4 text-4xl font-black leading-tight sm:text-5xl">Mỗi hành trình đều có câu chuyện.</h1><p className="mt-5 max-w-sm text-sm leading-7 text-white/80">Khám phá địa điểm mới, lưu giữ kỷ niệm và kết nối với cộng đồng yêu du lịch.</p></div>
        <p className="text-xs text-white/60">Khám phá theo cách của riêng cậu.</p>
      </section>
      <section className="p-6 sm:p-10 md:p-12">
        <Link href="/" className="text-sm font-bold text-[#71816e]">← Về trang khám phá</Link>
        <div className="mt-8"><p className="text-xs font-black uppercase tracking-[0.18em] text-[#84917e]">Tài khoản của cậu</p><h2 className="mt-2 text-3xl font-black">{title}</h2><p className="mt-2 text-sm leading-6 text-[#71816e]">{description}</p></div>
        <form onSubmit={submit} className="mt-7 space-y-5">
          {mode !== "update" && <div><label htmlFor="login-email" className="mb-2 block text-sm font-bold">Email</label><input id="login-email" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="w-full rounded-xl border border-[#dce3d2] bg-white px-4 py-3.5 text-sm outline-none focus:border-[#4f8068] focus:ring-4 focus:ring-[#4f8068]/10" /></div>}
          {mode !== "reset" && <div><div className="mb-2 flex items-center justify-between gap-3"><label htmlFor="login-password" className="text-sm font-bold">{passwordLabel}</label><div className="flex items-center gap-3">{mode === "login" && <button type="button" onClick={() => {setMode("reset");setMessage("");}} className="text-xs font-bold text-[#b76a31]">Quên mật khẩu?</button>}{mode !== "reset" && <button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} aria-pressed={showPassword} className="text-xs font-bold text-[#71816e] underline underline-offset-2">{showPassword ? "Ẩn" : "Hiện"}</button>}</div></div><input id="login-password" type={showPassword ? "text" : "password"} required minLength={6} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Ít nhất 6 ký tự" className="w-full rounded-xl border border-[#dce3d2] bg-white px-4 py-3.5 text-sm outline-none focus:border-[#4f8068] focus:ring-4 focus:ring-[#4f8068]/10" /></div>}
          {message && <p role="status" aria-live="polite" className="rounded-xl border border-[#dce3d2] bg-[#f0f3e9] p-3 text-sm leading-6 text-[#075b52]">{message}</p>}
          <button type="submit" disabled={busy} className="w-full rounded-xl bg-[#245b43] px-4 py-3.5 text-sm font-black text-white hover:bg-[#1d4936] disabled:opacity-60">{busy ? "Đang xử lý…" : mode === "login" ? "Đăng nhập" : mode === "register" ? "Đăng ký" : mode === "reset" ? "Gửi liên kết khôi phục" : "Lưu mật khẩu mới"}</button>
        </form>
        {mode !== "reset" && mode !== "update" && <><div className="my-6 flex items-center gap-3 text-xs font-semibold text-[#9aa393]"><span className="h-px flex-1 bg-[#e3e7dd]" />OR<span className="h-px flex-1 bg-[#e3e7dd]" /></div><button type="button" disabled={busy} onClick={() => void googleLogin()} className="flex w-full items-center justify-center gap-3 rounded-xl border border-[#dce3d2] bg-white px-4 py-3 text-sm font-bold hover:bg-[#f5f7f0] disabled:opacity-60"><span className="font-black">G</span> Continue with Google</button></>}
        {mode !== "update" && <p className="mt-7 text-center text-sm text-[#71816e]">{mode === "login" ? "Chưa có tài khoản?" : mode === "register" ? "Đã có tài khoản?" : "Nhớ lại mật khẩu?"}{" "}<button type="button" onClick={() => {setMode(mode === "login" ? "register" : "login");setMessage("");setPassword("");}} className="font-black text-[#245b43]">{mode === "login" ? "Đăng ký" : "Đăng nhập"}</button></p>}
        {(mode === "reset" || mode === "update") && <button type="button" onClick={() => {setMode("login");setMessage("");setPassword("");}} className="mt-3 w-full text-center text-xs font-bold text-[#71816e]">Quay lại đăng nhập</button>}
      </section>
    </div>
  </main>;
}
