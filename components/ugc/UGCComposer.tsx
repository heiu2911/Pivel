"use client";

import type { ChangeEvent } from "react";

type Checkpoint = {
  id: number;
  name: string;
  icon: string | null;
};

type Props = {
  profileName: string;
  content: string;
  imagePreview: string | null;
  checkpoints: Checkpoint[];
  selectedCheckpoint: number | null;
  posting: boolean;
  message?: string;
  onContentChange: (value: string) => void;
  onCheckpointChange: (value: number | null) => void;
  onSelectImage: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
  onSubmit: () => void;
};

export default function UGCComposer({
  profileName,
  content,
  imagePreview,
  checkpoints,
  selectedCheckpoint,
  posting,
  message,
  onContentChange,
  onCheckpointChange,
  onSelectImage,
  onRemoveImage,
  onSubmit,
}: Props) {
  return (
    <div className="mx-auto mb-5 max-w-xl rounded-[26px] border border-white/10 bg-white/[0.045] p-3">
      <div className="flex items-center gap-3 rounded-2xl bg-black/15 px-3 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/15">
          🧭
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold">{profileName}</p>
          <p className="text-[10px] text-white/35">Chia sẻ một moment</p>
        </div>
        <button
          type="button"
          onClick={onSubmit}
          disabled={posting || (!content.trim() && !imagePreview)}
          className="rounded-full bg-blue-500 px-4 py-2 text-xs font-bold transition hover:bg-blue-400 disabled:opacity-40"
        >
          {posting ? "..." : "Đăng"}
        </button>
      </div>

      <textarea
        value={content}
        onChange={(event) => onContentChange(event.target.value)}
        maxLength={1000}
        placeholder="Khoảnh khắc này có gì đặc biệt?"
        className="mt-3 min-h-20 w-full resize-none rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-blue-400/40"
      />

      {imagePreview ? (
        <div className="relative mt-3 overflow-hidden rounded-2xl">
          <img src={imagePreview} alt="Ảnh moment" className="max-h-72 w-full object-cover" />
          <button
            type="button"
            onClick={onRemoveImage}
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/70"
          >
            ×
          </button>
        </div>
      ) : (
        <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-white/10 bg-black/15 py-4 text-xs text-white/45 transition hover:bg-white/5 hover:text-white">
          📸 Thêm ảnh
          <input type="file" accept="image/*" onChange={onSelectImage} className="hidden" />
        </label>
      )}

      <div className="mt-3">
        <select
          value={selectedCheckpoint ?? ""}
          onChange={(event) => onCheckpointChange(event.target.value ? Number(event.target.value) : null)}
          className="w-full rounded-2xl border border-white/10 bg-[#07182a] px-3 py-2.5 text-xs text-white outline-none"
        >
          <option value="">📍 Không gắn checkpoint</option>
          {checkpoints.map((checkpoint) => (
            <option key={checkpoint.id} value={checkpoint.id}>
              {checkpoint.icon ?? "📍"} {checkpoint.name}
            </option>
          ))}
        </select>
      </div>

      {message && <p className="px-1 pt-2 text-xs text-blue-300">{message}</p>}
    </div>
  );
}
