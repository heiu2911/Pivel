import type { SVGProps } from "react";

type PivelMarkProps = SVGProps<SVGSVGElement> & { containerClassName?: string };

export default function PivelMark({ containerClassName = "", className = "h-8 w-8", ...props }: PivelMarkProps) {
  return (
    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#d9e5d7] bg-[#fffef9] text-[#075b52] ${containerClassName}`}>
      <svg viewBox="0 0 40 40" className={className} aria-hidden="true" {...props}>
        <path d="M8 34V7h11c7 0 11 4 11 10s-4 10-11 10h-4v7H8Zm7-14h4c3 0 4-1 4-3s-1-3-4-3h-4v6Z" fill="currentColor" />
        <path d="M13 15c3-7 10-9 16-7" fill="none" stroke="#ed852c" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="27" cy="8" r="3" fill="#ed852c" />
      </svg>
    </span>
  );
}
