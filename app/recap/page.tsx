"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

type RecapPost = {
  id: number;
  content: string | null;
  image_url: string | null;
  created_at: string;
  likes: number | null;
};

export default function JourneyRecapPage() {
  const [posts, setPosts] = useState<RecapPost[]>([]);
  const [displayName, setDisplayName] = useState("Traveller");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("Những khoảnh khắc đáng nhớ");
  const [style, setStyle] = useState<"journal" | "gallery">("journal");

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!active) return;
      if (!auth.user) {
        setError("Cậu cần đăng nhập để tạo nhật ký hành trình.");
        setLoading(false);
        return;
      }
      const [profile, postsResult] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", auth.user.id).maybeSingle(),
        supabase.from("posts").select("id, content, image_url, created_at, likes").eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(24),
      ]);
      if (!active) return;
      if (profile.data?.display_name) setDisplayName(profile.data.display_name);
      if (postsResult.error) setError("Chưa tải được bài đăng. Hãy thử tải lại trang.");
      else setPosts((postsResult.data ?? []) as RecapPost[]);
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, []);

  const dateRange = useMemo(() => {
    if (!posts.length) return "";
    const dates = posts.map((post) => new Date(post.created_at).getTime()).filter(Number.isFinite);
    if (!dates.length) return "";
    const oldest = new Date(Math.min(...dates)).toLocaleDateString("vi-VN");
    const newest = new Date(Math.max(...dates)).toLocaleDateString("vi-VN");
    return oldest === newest ? oldest : oldest + " — " + newest;
  }, [posts]);

  return (
    <main className="min-h-screen bg-[#faf9f1] px-4 pb-12 text-[#123f3a]">
      <div className="mx-auto max-w-4xl">
        <header className="flex items-center justify-between gap-3 py-5">
          <Link href="/profile" className="text-sm font-bold text-[#245b43]">← Trang cá nhân</Link>
          <button onClick={() => window.print()} className="rounded-full bg-[#245b43] px-4 py-2.5 text-sm font-bold text-white print:hidden">In / lưu PDF</button>
        </header>

        <section className="mb-5 rounded-3xl border border-[#e0e5d8] bg-[#fffef9] p-5 sm:p-7 print:hidden">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#84917e]">Pivel · Journey recap</p>
          <h1 className="mt-2 text-2xl font-black">Tạo nhật ký hành trình</h1>
          <p className="mt-2 text-sm leading-6 text-[#71816e]">Tổng hợp tối đa 24 bài đăng gần đây thành một trang kỷ niệm. Cậu có thể in hoặc chọn “Save as PDF” trong hộp thoại in của trình duyệt.</p>
          <label className="mt-4 block text-xs font-bold text-[#71816e]">Tiêu đề nhật ký</label>
          <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={70} className="mt-2 w-full rounded-xl border border-[#dce3d2] bg-white px-3 py-3 text-sm outline-none focus:border-[#245b43]" />
          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Kiểu nhật ký">
            <button onClick={() => setStyle("journal")} aria-pressed={style === "journal"} className={`rounded-full px-4 py-2 text-sm font-bold ${style === "journal" ? "bg-[#245b43] text-white" : "border border-[#dce3d2] bg-white"}`}>Nhật ký</button>
            <button onClick={() => setStyle("gallery")} aria-pressed={style === "gallery"} className={`rounded-full px-4 py-2 text-sm font-bold ${style === "gallery" ? "bg-[#245b43] text-white" : "border border-[#dce3d2] bg-white"}`}>Bộ sưu tập ảnh</button>
          </div>
        </section>

        {loading && <div className="rounded-2xl bg-[#fffef9] p-8 text-center text-sm text-[#71816e]">Đang tạo nhật ký…</div>}
        {!loading && error && <div className="rounded-2xl border border-[#e0e5d8] bg-[#fffef9] p-8 text-center"><p className="font-bold">{error}</p><Link href="/" className="mt-4 inline-block rounded-full bg-[#245b43] px-5 py-3 text-sm font-bold text-white">Về trang chủ</Link></div>}
        {!loading && !error && (
          <article className="recap-paper overflow-hidden rounded-[2rem] border border-[#e0e5d8] bg-[#fffef9] shadow-sm">
            <div className="bg-gradient-to-br from-[#245b43] via-[#4f7959] to-[#b8cbb0] px-6 py-12 text-white sm:px-10 sm:py-16">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/75">Pivel · Travel memories</p>
              <h2 className="mt-4 max-w-2xl break-words text-3xl font-black sm:text-5xl">{title.trim() || "Những khoảnh khắc đáng nhớ"}</h2>
              <p className="mt-4 text-sm font-semibold text-white/90">Tạo bởi {displayName}</p>
              {dateRange && <p className="mt-1 text-sm text-white/80">{dateRange}</p>}
              <div className="mt-7 flex gap-5 text-sm"><span>{posts.length} bài đăng</span><span>{posts.filter((post) => post.image_url).length} khoảnh khắc có ảnh</span></div>
            </div>
            {posts.length === 0 ? (
              <div className="p-10 text-center"><p className="text-4xl">🌿</p><h3 className="mt-3 font-black">Chưa có kỷ niệm để tổng hợp</h3><p className="mt-2 text-sm text-[#71816e]">Hãy đăng một bài viết hoặc chia sẻ ảnh hành trình trước nhé.</p><Link href="/" className="mt-4 inline-block rounded-full bg-[#245b43] px-5 py-3 text-sm font-bold text-white print:hidden">Tạo bài đăng</Link></div>
            ) : (
              <div className={style === "gallery" ? "grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 sm:gap-4 sm:p-6" : "grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:gap-6 sm:p-8"}>
                {posts.map((post, index) => (
                  <section key={post.id} className={`overflow-hidden rounded-2xl border border-[#e0e5d8] bg-white ${style === "gallery" ? "" : "break-inside-avoid"}`}>
                    {post.image_url ? <img src={post.image_url} alt="Khoảnh khắc hành trình" className={style === "gallery" ? "aspect-square w-full object-cover" : "aspect-[4/3] w-full object-cover"} /> : <div className={`flex items-center justify-center bg-[#edf1e5] text-4xl ${style === "gallery" ? "aspect-square" : "aspect-[4/3]"}`}>🌿</div>}
                    <div className={style === "gallery" ? "p-3" : "p-4"}>
                      {style === "journal" && <p className="mb-2 text-xs font-black uppercase tracking-widest text-[#8a9a82]">Kỷ niệm {posts.length - index}</p>}
                      <p className={`whitespace-pre-wrap break-words text-sm leading-6 ${style === "gallery" ? "line-clamp-3" : ""}`}>{post.content || "📸 Một khoảnh khắc đáng nhớ"}</p>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-[#81907c]"><time>{new Date(post.created_at).toLocaleDateString("vi-VN")}</time><span>♥ {post.likes ?? 0}</span></div>
                    </div>
                  </section>
                ))}
              </div>
            )}
            <footer className="border-t border-[#e0e5d8] px-6 py-5 text-center text-xs font-semibold text-[#81907c]">Mỗi hành trình đều xứng đáng được lưu giữ · Pivel</footer>
          </article>
        )}
      </div>
      <style jsx global>{`
        @media print {
          body { background: white !important; }
          main { background: white !important; padding: 0 !important; }
          .recap-paper { border: 0 !important; border-radius: 0 !important; box-shadow: none !important; }
          @page { margin: 12mm; }
        }
      `}</style>
    </main>
  );
}
