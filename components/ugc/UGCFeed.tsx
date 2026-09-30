"use client";

import UGCMomentCard, { type UGCMoment } from "./UGCMomentCard";

type Props = {
  posts: UGCMoment[];
  profileName: string;
  currentUserId?: string | null;
  feedMode: "all" | "following";
  likedPostIds: number[];
  savedPostIds: number[];
  commentCounts: Record<number, number>;
  loading?: boolean;
  onLike: (post: UGCMoment) => void;
  onSave: (postId: number) => void;
  onOpenCheckpoint?: (post: UGCMoment) => void;
  onEdit?: (post: UGCMoment) => void;
  onDelete?: (postId: number) => void;
  onComment?: (post: UGCMoment) => void;
  formatTime: (value: string) => string;
};

export default function UGCFeed({
  posts,
  profileName,
  currentUserId,
  feedMode,
  likedPostIds,
  savedPostIds,
  commentCounts,
  loading,
  onLike,
  onSave,
  onOpenCheckpoint,
  onEdit,
  onDelete,
  onComment,
  formatTime,
}: Props) {
  if (loading) {
    return <div className="py-12 text-center text-sm text-white/40">Đang tải moments...</div>;
  }

  if (!posts.length) {
    return (
      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] px-6 py-12 text-center">
        <div className="text-5xl">📸</div>
        <h3 className="mt-4 font-bold">
          {feedMode === "following" ? "Chưa có moment từ người bạn theo dõi" : "Chưa có moment nào"}
        </h3>
        <p className="mt-2 text-sm text-white/40">
          Chia sẻ một khoảnh khắc nhỏ trong chuyến đi của cậu.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      {posts.map((post) => (
        <UGCMomentCard
          key={post.id}
          post={post}
          isMine={post.user_id === currentUserId}
          isLiked={likedPostIds.includes(post.id)}
          isSaved={savedPostIds.includes(post.id)}
          profileName={profileName}
          commentsCount={commentCounts[post.id] ?? 0}
          onLike={() => onLike(post)}
          onSave={() => onSave(post.id)}
          onOpenCheckpoint={() => onOpenCheckpoint?.(post)}
          onEdit={() => onEdit?.(post)}
          onDelete={() => onDelete?.(post.id)}
          onComment={() => onComment?.(post)}
          formatTime={formatTime}
        />
      ))}
    </div>
  );
}
