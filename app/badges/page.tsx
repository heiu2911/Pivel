"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { User } from "@supabase/supabase-js";

type Checkpoint = { id: number; name: string; badge: string | null; icon: string | null };
type Badge = {
  title: string;
  emoji: string;
  description: string;
  unlocked: boolean;
  progress: number;
  goal: number;
  category: string;
};

const regions = [
  { title: "Tây Bắc", emoji: "🏞️", keys: ["sa pa", "sapa", "mù cang chải", "điện biên", "lai châu", "sơn la", "yên bái", "hòa bình", "hòa bình"] },
  { title: "Đông Bắc", emoji: "⛰️", keys: ["hà giang", "cao bằng", "bắc kạn", "lạng sơn", "thái nguyên", "tuyên quang", "hạ long", "quảng ninh"] },
  { title: "Đồng bằng", emoji: "🌾", keys: ["hà nội", "ninh bình", "nam định", "thái bình", "hải phòng", "hưng yên", "bắc ninh", "hà nam"] },
  { title: "Bắc Trung Bộ", emoji: "🏯", keys: ["thanh hóa", "nghệ an", "hà tĩnh", "quảng bình", "quảng trị", "huế", "thừa thiên"] },
  { title: "Nam Trung Bộ", emoji: "🏖️", keys: ["đà nẵng", "hội an", "quảng nam", "quy nhơn", "bình định", "phú yên", "nha trang", "khánh hòa", "phan thiết", "ninh thuận"] },
  { title: "Tây Nguyên", emoji: "🌲", keys: ["đà lạt", "lâm đồng", "buôn ma thuột", "đắk lắk", "gia lai", "kon tum", "pleiku", "đắk nông"] },
  { title: "Đông Nam Bộ", emoji: "🌇", keys: ["tp. hồ chí minh", "hồ chí minh", "sài gòn", "vũng tàu", "bình dương", "đồng nai", "tây ninh", "bình phước"] },
  { title: "Nam Bộ", emoji: "🌴", keys: ["cần thơ", "an giang", "kiên giang", "phú quốc", "cà mau", "bạc liêu", "sóc trăng", "bến tre", "tiền giang", "vĩnh long", "đồng tháp", "trà vinh", "hậu giang", "long an"] },
  { title: "Tây Nam Bộ", emoji: "🛶", keys: ["chợ nổi", "cái răng", "mỹ tho", "rạch giá", "côn đảo"] },
];

const featured = [
  { title: "Hà Giang", emoji: "⛰️", keys: ["hà giang", "mã pí lèng", "đồng văn"] },
  { title: "Hạ Long", emoji: "🌊", keys: ["hạ long", "bãi cháy", "tuần châu"] },
  { title: "Hội An", emoji: "🏮", keys: ["hội an", "chùa cầu"] },
  { title: "Huế", emoji: "🏯", keys: ["huế", "đại nội", "kinh thành huế"] },
  { title: "Đà Lạt", emoji: "🌲", keys: ["đà lạt", "langbiang", "xuân hương"] },
  { title: "Hà Nội", emoji: "🏙️", keys: ["hà nội", "hồ hoàn kiếm", "văn miếu"] },
  { title: "Đà Nẵng", emoji: "🌉", keys: ["đà nẵng", "bà nà", "cầu rồng"] },
  { title: "Ninh Bình", emoji: "⛵", keys: ["ninh bình", "tràng an", "tam cốc"] },
  { title: "Phú Quốc", emoji: "🏝️", keys: ["phú quốc", "dương đông"] },
  { title: "Sa Pa", emoji: "🌄", keys: ["sa pa", "sapa", "fansipan"] },
];

function createBadge(title: string, emoji: string, description: string, progress: number, goal: number, category: string): Badge {
  return { title, emoji, description, progress: Math.min(progress, goal), goal, unlocked: progress >= goal, category };
}

function BadgeTile({ badge, onSelect }: { badge: Badge; onSelect: (badge: Badge) => void }) {
  return (
    <button type="button" onClick={() => onSelect(badge)} aria-label={`Xem chi tiết huy hiệu ${badge.title}`} className={`group flex min-w-0 flex-col items-center rounded-2xl border p-3 text-center transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#4d8762] sm:p-4 ${badge.unlocked ? "border-[#dce6d2] bg-white" : "border-dashed border-[#d8ddd1] bg-[#f1f1e9]/80"}`}>
      <div className={`relative flex h-16 w-16 items-center justify-center rounded-[1.35rem] border-2 text-3xl shadow-sm sm:h-[4.5rem] sm:w-[4.5rem] sm:text-4xl ${badge.unlocked ? "border-[#d7e5c8] bg-gradient-to-br from-[#fffef6] to-[#dcebd3]" : "border-[#d9ddd1] bg-gradient-to-br from-[#f2f1e9] to-[#e3e4d9] grayscale"}`}>
        <span aria-hidden="true">{badge.emoji}</span>
        {!badge.unlocked && <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-[#879183] text-xs text-white">🔒</span>}
        {badge.unlocked && <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-[#2c684c] text-[10px] text-white">✓</span>}
      </div>
      <h3 className="mt-3 text-xs font-extrabold leading-snug text-[#234a39] sm:text-sm">{badge.title}</h3>
      <p className="mt-1 line-clamp-2 min-h-8 text-[10px] leading-4 text-[#7a8979] sm:text-[11px]">{badge.description}</p>
      <div className="mt-2 w-full">
        <div className="h-1.5 overflow-hidden rounded-full bg-[#e5e8df]">
          <div className="h-full rounded-full bg-[#4d8762] transition-all" style={{ width: `${Math.round((badge.progress / badge.goal) * 100)}%` }} />
        </div>
        <p className="mt-1 text-[10px] font-bold tabular-nums text-[#71816e]">{badge.progress}/{badge.goal}</p>
      </div>
    </button>
  );
}

function BadgeSection({ title, emoji, badges, wide = false, onSelect }: { title: string; emoji: string; badges: Badge[]; wide?: boolean; onSelect: (badge: Badge) => void }) {
  const earned = badges.filter((badge) => badge.unlocked).length;
  return (
    <section className={`rounded-[1.6rem] border border-[#e5e7dc] bg-[#fffef9]/95 p-4 shadow-[0_5px_20px_rgba(43,68,48,0.04)] sm:p-5 ${wide ? "md:col-span-2" : ""}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#edf2e8] text-lg">{emoji}</span>
          <h2 className="text-sm font-black tracking-tight text-[#234a39] sm:text-base">{title}</h2>
        </div>
        <span className="shrink-0 rounded-full bg-[#eef1e8] px-2.5 py-1 text-xs font-extrabold tabular-nums text-[#66806b]">{earned}/{badges.length}</span>
      </div>
      <div className={`grid grid-cols-2 gap-2.5 sm:grid-cols-3 ${wide ? "lg:grid-cols-5" : ""}`}>
        {badges.map((badge) => <BadgeTile key={badge.title} badge={badge} onSelect={onSelect} />)}
      </div>
    </section>
  );
}

export default function BadgesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [checkedIds, setCheckedIds] = useState<number[]>([]);
  const [postCount, setPostCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "earned" | "locked">("all");
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!active) return;
      setUser(auth.user);
      const [checkpointResult, checkinResult, postResult] = await Promise.all([
        supabase.from("checkpoints").select("id,name,badge,icon"),
        auth.user
          ? supabase.from("checkins").select("checkpoint_id").eq("user_id", auth.user.id)
          : Promise.resolve({ data: [], error: null }),
        auth.user
          ? supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", auth.user.id)
          : Promise.resolve({ count: 0, error: null }),
      ]);
      if (!active) return;
      setCheckpoints((checkpointResult.data ?? []) as Checkpoint[]);
      setCheckedIds((checkinResult.data ?? []).map((row: { checkpoint_id: number }) => row.checkpoint_id));
      setPostCount(postResult.count ?? 0);
      setLoading(false);
    };
    void load();
    const { data: listener } = supabase.auth.onAuthStateChange(() => { void load(); });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  const badges = useMemo(() => {
    const checked = checkpoints.filter((checkpoint) => checkedIds.includes(checkpoint.id));
    const names = checked.map((checkpoint) => checkpoint.name.toLocaleLowerCase("vi-VN"));
    const countMatches = (keys: string[]) => names.filter((name) => keys.some((key) => name.includes(key))).length;
    const regionBadges = regions.map((region) => createBadge(region.title, region.emoji, "Check-in tại khu vực này", countMatches(region.keys), 1, "region"));
    const destinationBadges = featured.map((place) => createBadge(place.title, place.emoji, "Khám phá địa danh nổi bật", countMatches(place.keys), 1, "destination"));
    const activityBadges = [
      createBadge("Nhà khám phá", "🎒", "Check-in tại 3 địa điểm", checkedIds.length, 3, "activity"),
      createBadge("Nhiếp ảnh gia", "📸", "Chia sẻ bài đăng đầu tiên", postCount, 1, "activity"),
      createBadge("Người kể chuyện", "📝", "Chia sẻ 5 khoảnh khắc", postCount, 5, "activity"),
      createBadge("Kết nối cộng đồng", "🤝", "Đăng 3 bài viết du lịch", postCount, 3, "activity"),
      createBadge("Travel Creator", "🌟", "Đăng 10 bài viết du lịch", postCount, 10, "activity"),
    ];
    const journeyBadges = [
      createBadge("Chuyến đi đầu tiên", "📍", "Hoàn thành check-in đầu tiên", checkedIds.length, 1, "journey"),
      createBadge("Qua đêm", "⛺", "Khám phá ít nhất 2 địa điểm", checkedIds.length, 2, "journey"),
      createBadge("Chinh phục độ cao", "🥾", "Khám phá 5 địa điểm", checkedIds.length, 5, "journey"),
      createBadge("Đi xa hơn", "🪧", "Khám phá 10 địa điểm", checkedIds.length, 10, "journey"),
      createBadge("Bước chân không mỏi", "🛫", "Khám phá 20 địa điểm", checkedIds.length, 20, "journey"),
    ];
    const specialBadges = [
      createBadge("Huyền thoại", "👑", "Mở khóa 20 huy hiệu", [...regionBadges, ...destinationBadges].filter((b) => b.unlocked).length, 20, "special"),
      createBadge("Bậc thầy khám phá", "💎", "Check-in 15 địa điểm", checkedIds.length, 15, "special"),
      createBadge("Vòng quanh Việt Nam", "🌏", "Khám phá 5 khu vực", regionBadges.filter((b) => b.unlocked).length, 5, "special"),
      createBadge("Du lịch xanh", "💚", "Check-in 3 địa điểm", checkedIds.length, 3, "special"),
      createBadge("Top đóng góp", "⭐", "Chia sẻ 10 bài viết", postCount, 10, "special"),
    ];
    const advancedBadges = [
      createBadge("Bậc thầy hành trình", "🧭", "Check-in 10 địa điểm", checkedIds.length, 10, "advanced"),
      createBadge("Chuyên gia ẩm thực", "🍜", "Khám phá 5 địa điểm", checkedIds.length, 5, "advanced"),
      createBadge("Nhiếp ảnh gia Pro", "📷", "Chia sẻ 5 bài viết", postCount, 5, "advanced"),
      createBadge("Đại sứ du lịch", "🌐", "Mở khóa 10 huy hiệu", [...regionBadges, ...destinationBadges].filter((b) => b.unlocked).length, 10, "advanced"),
      createBadge("Kết nối quốc tế", "🫶", "Khám phá 15 địa điểm", checkedIds.length, 15, "advanced"),
    ];
    const eventBadges = [
      createBadge("Lễ hội hoa", "🌸", "Khám phá Đà Lạt", countMatches(["đà lạt", "langbiang"]), 1, "event"),
      createBadge("Tết truyền thống", "🏮", "Khám phá phố cổ hoặc di tích", countMatches(["hội an", "văn miếu", "đại nội"]), 1, "event"),
      createBadge("Lễ hội miền Trung", "🐉", "Khám phá miền Trung", countMatches(["huế", "đà nẵng", "hội an", "quảng nam", "quảng bình"]), 1, "event"),
      createBadge("Lễ hội sông nước", "🛶", "Khám phá miền Tây", countMatches(["cần thơ", "chợ nổi", "cái răng", "an giang"]), 1, "event"),
      createBadge("Văn hóa bản địa", "🏕️", "Khám phá 3 địa danh", checkedIds.length, 3, "event"),
    ];
    return [
      { key: "region", title: "Huy hiệu theo khu vực", emoji: "🗺️", badges: regionBadges },
      { key: "destination", title: "Huy hiệu địa danh nổi bật", emoji: "🏞️", badges: destinationBadges },
      { key: "activity", title: "Huy hiệu UGC & hoạt động cộng đồng", emoji: "📸", badges: activityBadges },
      { key: "journey", title: "Huy hiệu hành trình", emoji: "🥾", badges: journeyBadges },
      { key: "special", title: "Huy hiệu đặc biệt", emoji: "🏅", badges: specialBadges },
      { key: "advanced", title: "Huy hiệu nâng cao", emoji: "🏆", badges: advancedBadges },
      { key: "event", title: "Huy hiệu sự kiện", emoji: "🎉", badges: eventBadges },
    ];
  }, [checkpoints, checkedIds, postCount]);

  const flatBadges = badges.flatMap((section) => section.badges);
  const earnedCount = flatBadges.filter((badge) => badge.unlocked).length;
  const visibleSections = badges.map((section) => ({
    ...section,
    badges: section.badges.filter((badge) => filter === "all" || (filter === "earned" ? badge.unlocked : !badge.unlocked)),
  })).filter((section) => section.badges.length > 0);

  return (
    <main className="min-h-screen bg-[#f4f4eb] px-3 pb-12 text-[#183d32] sm:px-5">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-3 py-5 sm:py-7">
          <Link href="/" className="flex items-center gap-2 text-sm font-black text-[#245b43]"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#245b43] text-lg text-white">✈</span><span>TravelQuest <span className="block text-[10px] font-semibold tracking-wide text-[#81907c]">KHÁM PHÁ · CHECK-IN · SƯU TẬP</span></span></Link>
          <div className="flex gap-2">
            <Link href="/profile" className="rounded-full border border-[#dce3d2] bg-white px-4 py-2.5 text-xs font-extrabold text-[#315b45] sm:text-sm">Trang cá nhân</Link>
            <Link href="/" className="rounded-full bg-[#245b43] px-4 py-2.5 text-xs font-extrabold text-white sm:text-sm">← Khám phá</Link>
          </div>
        </header>

        <section className="mb-5 overflow-hidden rounded-[1.8rem] border border-[#e1e5d9] bg-gradient-to-br from-[#fffef9] via-[#f5f6ed] to-[#e6eee0] p-5 shadow-sm sm:p-7">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#82917c]">Hồ sơ nhà khám phá</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Bộ sưu tập huy hiệu</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#71816e]">Mỗi điểm đến, câu chuyện và khoảnh khắc đều đưa cậu gần hơn tới huy hiệu tiếp theo.</p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:min-w-[320px]">
              <div className="rounded-2xl bg-white/80 p-3 text-center"><p className="text-2xl font-black">{earnedCount}</p><p className="mt-1 text-[10px] font-bold text-[#71816e] sm:text-xs">Đã mở khóa</p></div>
              <div className="rounded-2xl bg-white/80 p-3 text-center"><p className="text-2xl font-black">{flatBadges.length}</p><p className="mt-1 text-[10px] font-bold text-[#71816e] sm:text-xs">Tổng huy hiệu</p></div>
              <div className="rounded-2xl bg-white/80 p-3 text-center"><p className="text-2xl font-black">{Math.round((earnedCount / Math.max(flatBadges.length, 1)) * 100)}%</p><p className="mt-1 text-[10px] font-bold text-[#71816e] sm:text-xs">Hoàn thành</p></div>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dfe6d8] bg-white/70 p-3">
            <div className="flex items-center gap-3"><span className="text-2xl">🧭</span><div><p className="text-sm font-extrabold">{user ? "Tiến trình của cậu" : "Khám phá bộ sưu tập"}</p><p className="text-xs text-[#71816e]">{loading ? "Đang đồng bộ thành tích…" : user ? "Huy hiệu được tính từ check-in và hoạt động UGC của tài khoản." : "Đăng nhập để cá nhân hóa tiến trình mở khóa."}</p></div></div>
            {!user && <Link href="/login" className="rounded-full bg-[#245b43] px-4 py-2 text-xs font-bold text-white">Đăng nhập</Link>}
          </div>
        </section>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-black">Tất cả thành tích</h2><p className="mt-1 text-xs text-[#7b8977]">Sưu tập huy hiệu khi khám phá Việt Nam và chia sẻ hành trình.</p></div>
          <div className="flex gap-1 rounded-full border border-[#e0e5d8] bg-white p-1" aria-label="Lọc huy hiệu">
            {([{ key: "all", label: "Tất cả" }, { key: "earned", label: "Đã mở khóa" }, { key: "locked", label: "Chưa mở khóa" }] as const).map((item) => <button key={item.key} onClick={() => setFilter(item.key)} aria-pressed={filter === item.key} className={`rounded-full px-3 py-2 text-[11px] font-extrabold transition sm:px-4 sm:text-xs ${filter === item.key ? "bg-[#245b43] text-white" : "text-[#61735f] hover:bg-[#f0f3e9]"}`}>{item.label}</button>)}
          </div>
        </div>

        {loading && <div className="mb-4 rounded-2xl border border-[#e0e5d8] bg-white p-4 text-sm text-[#71816e]">Đang tải thành tích của cậu…</div>}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {visibleSections.map((section) => <BadgeSection key={section.key} title={section.title} emoji={section.emoji} badges={section.badges} wide={section.key === "region" || section.key === "destination"} onSelect={setSelectedBadge} />)}
        </div>
        {selectedBadge && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#173629]/55 p-4" role="presentation" onClick={() => setSelectedBadge(null)}><section role="dialog" aria-modal="true" aria-labelledby="badge-detail-title" className="w-full max-w-md rounded-[1.8rem] border border-[#e1e5d9] bg-[#fffef9] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-4"><div className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl border-2 text-4xl ${selectedBadge.unlocked ? "border-[#d7e5c8] bg-gradient-to-br from-[#fffef6] to-[#dcebd3]" : "border-[#d9ddd1] bg-[#e9eadf] grayscale"}`}>{selectedBadge.emoji}</div><button type="button" onClick={() => setSelectedBadge(null)} aria-label="Đóng chi tiết" className="rounded-full bg-[#edf2e8] px-3 py-2 text-sm font-black text-[#315b45]">✕</button></div><p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-[#82917c]">Chi tiết huy hiệu</p><h2 id="badge-detail-title" className="mt-1 text-2xl font-black text-[#234a39]">{selectedBadge.title}</h2><p className="mt-2 text-sm leading-6 text-[#71816e]">{selectedBadge.description}.</p><div className="mt-5 rounded-2xl border border-[#e1e5d9] bg-white p-4"><div className="flex items-center justify-between gap-3"><span className="text-sm font-extrabold">Tiến độ mở khóa</span><span className="text-sm font-black tabular-nums text-[#315b45]">{selectedBadge.progress}/{selectedBadge.goal}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e5e8df]"><div className="h-full rounded-full bg-[#4d8762] transition-all" style={{ width: `${Math.round((selectedBadge.progress / selectedBadge.goal) * 100)}%` }} /></div><p className="mt-3 text-sm font-bold text-[#315b45]">{selectedBadge.unlocked ? "✓ Đã mở khóa thành công" : `Còn ${Math.max(selectedBadge.goal - selectedBadge.progress, 0)} bước để mở khóa`}</p></div><p className="mt-3 text-xs leading-5 text-[#82917c]">Tiến độ được tính từ dữ liệu check-in và bài đăng hiện có. Ngày nhận huy hiệu sẽ hiển thị khi hệ thống lưu riêng lịch sử trao huy hiệu.</p><button type="button" onClick={() => setSelectedBadge(null)} className="mt-5 w-full rounded-full bg-[#245b43] px-4 py-3 text-sm font-extrabold text-white">Đã hiểu</button></section></div>}
        {!visibleSections.length && <div className="rounded-2xl border border-dashed border-[#cdd8c5] bg-white p-10 text-center"><p className="text-3xl">🏅</p><p className="mt-3 font-extrabold">Chưa có huy hiệu trong mục này</p><p className="mt-1 text-sm text-[#71816e]">Tiếp tục hành trình để mở khóa thành tích nhé.</p></div>}
        <footer className="mt-7 rounded-2xl border border-[#e1e5d9] bg-white/80 p-4 text-xs leading-5 text-[#71816e]">Thành tích được tính dựa trên dữ liệu check-in và bài đăng hiện có. Một số huy hiệu theo sự kiện là thành tích mô phỏng theo địa danh, chưa gắn với lịch sự kiện thời gian thực.</footer>
      </div>
    </main>
  );
}
