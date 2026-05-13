"use client";

/**
 * Chromatic gradient avatar — auto-generated from username.
 * Inspired by Linear / Notion collaborator avatars.
 */

interface AvatarProps {
  username: string;
  color: string;
  size?: "sm" | "md" | "lg";
  isOnline?: boolean;
}

const sizeClasses = {
  sm: "w-6 h-6 text-[10px]",
  md: "w-8 h-8 text-[12px]",
  lg: "w-10 h-10 text-[14px]",
};

// Generate a subtle gradient pair from the avatar color
function getGradient(color: string): string {
  // Shift hue slightly for a chromatic gradient effect
  return `linear-gradient(135deg, ${color}, ${color}88)`;
}

export default function Avatar({
  username,
  color,
  size = "md",
  isOnline,
}: AvatarProps) {
  const initials = username.slice(0, 2).toUpperCase();

  return (
    <div className="relative inline-flex">
      <div
        className={`${sizeClasses[size]} rounded-full flex items-center justify-center
          font-medium text-white/90 shrink-0`}
        style={{ background: getGradient(color) }}
      >
        {initials}
      </div>
      {isOnline !== undefined && (
        <span
          className={`absolute -bottom-px -right-px w-2 h-2 rounded-full border border-[#09090B]
            ${isOnline ? "bg-nocta-success" : "bg-nocta-text-muted"}`}
        />
      )}
    </div>
  );
}
