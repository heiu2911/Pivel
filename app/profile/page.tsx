"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";

type ProfilePost = {
  id: number;
  content: string | null;
  image_url: string | null;
  created_at: string;
  likes: number | null;
  checkpoint_id: number | null;
};

export default function PersonalProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState("Traveller");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [checkinCount, setCheckinCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;
    const loadProfile = async () => {
      setLoading(true);
      const { data: authData } = await supabase.auth.getUser();
      const currentUser = authData.user;
      if (!alive) return;
      setUser(currentUser);
      if (!currentUser) {
        setLoading(false);
        setMessage("Đăng nhập để xem trang cá nhân và các bài đăng của cậu.");
        return;
      }

      const [profileResult, avatarResult, postsResult, checkinsResult] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", currentUser.id).maybeSingle(),
        supabase.from("travelquest_profile_avatars").select("avatar_url").eq("user_id", currentUser.id).maybeSingle(),
        supabase.from("posts").select("id, content, image_url, created_at, likes, checkpoint_id").eq("user_id", currentUser.id).order("created_at", { ascending: false }),
        supabase.from("checkins").select("checkpoint_id", { count: "exact", head: true }).eq("user_id", currentUser.id),
      ]);
      if (!alive) return;
      if (profileResult.data?.display_name) setDisplayName(profileResult.data.display_name);
      if (avatarResult.data?.avatar_url) setAvatarUrl(avatarResult.data.avatar_url);
      if (!postsResult.error) setPosts((postsResult.data ?? []) as ProfilePost[]);
      if (!checkinsResult.error) setCheckinCount(checkinsResult.count ?? 0);
      if (postsResult.error) setMessage("Chưa tải được bài đăng. Hãy thử tải lại trang.");
      setLoading(false);
    };
    void loadProfile();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive && session?.user) {
        setUser(session.user);
        void loadProfile();
      }
    });
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const initials = displayName.trim().slice(0, 1).toUpperCase() || "T";
  const totalLikes = posts.reduce((sum, post) => sum + (post.likes ?? 0), 0);

  return (
    <main className="min-h-screen bg-[#f7f4e8] px-4 pb-12 text-[#183d32]">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between py-5">
          <Link href="/" className="flex items-center gap-2 text-sm font-bold text-[#245b43]"><span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#245b43] text-lg text-white">✈</span> Pivel</Link>
          <button onClick={() => router.push("/")} className="rounded-full border border-[#dce3d2] bg-white px-4 py-2 text-sm font-bold">← Về trang chủ</button>
        </header>

        <section className="overflow-hidden rounded-[2rem] border border-[#e0e5d8] bg-[#fffef9] shadow-sm">
          <div className="h-32 bg-gradient-to-r from-[#b8cbb0] via-[#e6e8d3] to-[#d4dfc8]" />
          <div className="px-5 pb-6 sm:px-8">
            <div className="-mt-14 flex flex-wrap items-end gap-4">
              <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-[#fffef9] bg-[#e4ebdc] text-4xl font-black text-[#245b43] shadow-sm">
                {avatarUrl ? <img src={avatarUrl} alt="Ảnh đại diện" className="h-full w-full object-cover" /> : initials}
              </div>
              <div className="min-w-0 flex-1 pb-1">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#81907c]">Trang cá nhân</p>
                <h1 className="mt-1 break-words text-2xl font-black">{displayName}</h1>
                <p className="mt-1 text-sm text-[#7b8977]">{user?.email ?? "Cùng lưu lại những hành trình đáng nhớ."}</p>
              </div>
              <button onClick={() => router.push("/")} className="mb-1 rounded-full bg-[#245b43] px-4 py-2.5 text-sm font-bold text-white">✦ Khám phá</button>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
              <div className="rounded-2xl bg-[#f0f3e9] p-3 text-center"><p className="text-2xl font-black">{posts.length}</p><p className="mt-1 text-xs font-semibold text-[#71816e]">Bài đăng</p></div>
              <div className="rounded-2xl bg-[#f0f3e9] p-3 text-center"><p className="text-2xl font-black">{checkinCount}</p><p className="mt-1 text-xs font-semibold text-[#71816e]">Lượt check-in</p></div>
              <div className="rounded-2xl bg-[#f0f3e9] p-3 text-center"><p className="text-2xl font-black">{totalLikes}</p><p className="mt-1 text-xs font-semibold text-[#71816e]">Lượt thích</p></div>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-4 flex items-end justify-between">
            <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#84917e]">Nhật ký hành trình</p><h2 className="mt-1 text-xl font-black">Bài đăng của tớ</h2></div>
            <span className="text-sm font-semibold text-[#71816e]">{posts.length} bài</span>
          </div>
          {!user && !loading && <div className="rounded-2xl border border-[#e0e5d8] bg-[#fffef9] p-6 text-center"><p className="font-bold">Cậu chưa đăng nhập</p><p className="mt-2 text-sm text-[#71816e]">{message}</p><button onClick={() => router.push("/")} className="mt-4 rounded-full bg-[#245b43] px-5 py-3 text-sm font-bold text-white">Đăng nhập tại trang chủ</button></div>}
          {loading && <div className="rounded-2xl bg-[#fffef9] p-8 text-center text-sm text-[#71816e]">Đang tải trang cá nhân…</div>}
          {!loading && user && posts.length === 0 && <div className="rounded-2xl border border-dashed border-[#cdd8c5] bg-[#fffef9] p-8 text-center"><div className="text-4xl">📷</div><p className="mt-3 font-bold">Chưa có bài đăng nào</p><p className="mt-1 text-sm text-[#71816e]">Chia sẻ khoảnh khắc đầu tiên trong chuyến đi của cậu nhé.</p><button onClick={() => router.push("/")} className="mt-4 rounded-full bg-[#245b43] px-5 py-3 text-sm font-bold text-white">Chia sẻ khoảnh khắc</button></div>}
          {message && user && !loading && <p className="mb-3 text-sm text-amber-700">{message}</p>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {posts.map((post) => <article key={post.id} className="overflow-hidden rounded-[1.5rem] border border-[#e0e5d8] bg-[#fffef9] shadow-sm">
              {post.image_url ? <img src={post.image_url} alt="Ảnh bài đăng" className="aspect-[4/3] w-full object-cover" /> : <div className="flex aspect-[4/3] items-center justify-center bg-[#edf1e5] text-5xl">🌿</div>}
              <div className="p-4"><p className="whitespace-pre-wrap break-words text-sm leading-6">{post.content || "📸 Khoảnh khắc của tôi"}</p><div className="mt-3 flex items-center justify-between gap-3 text-xs font-semibold text-[#81907c]"><span>♥ {post.likes ?? 0} lượt thích</span><time>{new Date(post.created_at).toLocaleDateString("vi-VN")}</time></div></div>
            </article>)}
          </div>
        </section>
      </div>
    </main>
  );
}
