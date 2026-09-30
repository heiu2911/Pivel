"use client";

export type UGCMoment = {
  id: number;
  user_id: string | null;
  content: string;
  likes: number;
  created_at: string;
  image_url: string | null;
  checkpoint?: {
    id: number;
    name: string;
    icon: string | null;
    latitude?: number;
    longitude?: number;
  } | null;
};

type Props = {
  post: UGCMoment;
  isMine: boolean;
  isLiked: boolean;
  isSaved: boolean;
  profileName: string;
  commentsCount: number;
  onLike: () => void;
  onSave: () => void;
  onOpenCheckpoint?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onComment?: () => void;
  formatTime: (value: string) => string;
};

export default function UGCMomentCard({
  post,
  isMine,
  isLiked,
  isSaved,
  profileName,
  commentsCount,
  onLike,
  onSave,
  onOpenCheckpoint,
  onEdit,
  onDelete,
  onComment,
  formatTime,
}: Props) {
  return (
    <article className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.045] shadow-2xl shadow-black/20">
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-lg">
            🧭
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">
              {isMine ? profileName : "Traveller"}
            </p>
            <p className="text-[11px] text-white/35">{formatTime(post.created_at)}</p>
          </div>
        </div>

        {isMine && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={onEdit} className="text-[11px] text-white/35 hover:text-white">
              Sửa
            </button>
            <button type="button" onClick={onDelete} className="text-[11px] text-white/35 hover:text-red-300">
              Xóa
            </button>
          </div>
        )}
      </div>

      {post.image_url ? (
        <div className="aspect-[4/5] overflow-hidden bg-black/20">
          <img
            src={post.image_url}
            alt="Khoảnh khắc TravelQuest"
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="flex aspect-[4/5] items-center justify-center bg-gradient-to-br from-blue-950 via-slate-900 to-indigo-950 text-7xl">
          📸
        </div>
      )}

      <div className="px-4 pb-5 pt-3">
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={onLike}
            className={`text-sm transition ${isLiked ? "text-red-300" : "text-white/60 hover:text-white"}`}
          >
            {isLiked ? "♥" : "♡"} {post.likes}
          </button>
          <button type="button" onClick={onComment} className="text-sm text-white/60 hover:text-white">
            ◯ {commentsCount}
          </button>
          <button
            type="button"
            onClick={onSave}
            className={`ml-auto text-sm transition ${isSaved ? "text-yellow-300" : "text-white/40 hover:text-white"}`}
          >
            {isSaved ? "🔖" : "☆"}
          </button>
        </div>

        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-white/80">
          {post.content}
        </p>

        {post.checkpoint && (
          <button
            type="button"
            onClick={onOpenCheckpoint}
            className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-blue-400/10 bg-blue-500/[0.06] p-3 text-left transition hover:bg-blue-500/10"
          >
            <span className="text-xl">{post.checkpoint.icon ?? "📍"}</span>
            <span className="min-w-0">
              <span className="block text-[9px] font-bold uppercase tracking-[0.16em] text-blue-300/80">
                Checkpoint
              </span>
              <span className="mt-0.5 block truncate text-xs font-semibold">
                {post.checkpoint.name}
              </span>
            </span>
            <span className="ml-auto text-white/25">›</span>
          </button>
        )}
      </div>
    </article>
  );
}
