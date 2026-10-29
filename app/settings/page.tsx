"use client";

import PivelMark from "../../components/PivelMark";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function SettingsPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const signOut = async () => {
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.signOut();
    setBusy(false);
    if (error) {
      setMessage("Chưa thể đăng xuất. Cậu hãy thử lại nhé.");
      return;
    }
    router.push("/login");
    router.refresh();
  };

  return (
    <main className="min-h-screen bg-[#faf9f1] px-4 py-8 text-[#123f3a]">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 flex items-center justify-between">
          <button type="button" onClick={() => router.push("/profile")} className="rounded-full border border-[#dce3d2] bg-white px-4 py-2 text-sm font-bold">← Trang cá nhân</button>
          <span className="flex items-center gap-2 text-lg font-black text-[#075b52]"><PivelMark className="h-7 w-7" />Pivel</span>
        </header>
        <section className="overflow-hidden rounded-3xl border border-[#dce5d7] bg-[#fffef9] shadow-sm">
          <div className="bg-gradient-to-r from-[#b8cbb0] via-[#e6e8d3] to-[#d4dfc8] p-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#075b52]">Tài khoản</p>
            <h1 className="mt-2 text-2xl font-black">Cài đặt</h1>
            <p className="mt-1 text-sm text-[#526b59]">Quản lý phiên đăng nhập và tài khoản Pivel của cậu.</p>
          </div>
          <div className="space-y-4 p-5 sm:p-6">
            <div className="rounded-2xl border border-[#dce5d7] bg-[#f1f3e8] p-4">
              <h2 className="font-extrabold">🔐 Phiên đăng nhập</h2>
              <p className="mt-1 text-sm leading-6 text-[#687c70]">Nếu dùng thiết bị chung, hãy đăng xuất sau khi hoàn tất.</p>
              <button type="button" disabled={busy} onClick={() => void signOut()} className="mt-4 rounded-xl bg-[#075b52] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "Đang đăng xuất…" : "Đăng xuất tài khoản"}</button>
            </div>
            <div className="rounded-2xl border border-[#dce5d7] bg-white p-4">
              <h2 className="font-extrabold">🧭 Hồ sơ cá nhân</h2>
              <p className="mt-1 text-sm leading-6 text-[#687c70]">Cập nhật tên hiển thị và ảnh đại diện tại trang cá nhân.</p>
              <button type="button" onClick={() => router.push("/profile")} className="mt-3 rounded-xl border border-[#dce5d7] bg-[#f1f3e8] px-4 py-2.5 text-sm font-bold">Chỉnh sửa hồ sơ</button>
            </div>
            {message && <p role="status" className="rounded-xl bg-[#fff3ef] p-3 text-sm text-[#b94d3b]">{message}</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
