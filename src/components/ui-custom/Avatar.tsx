"use client";
import { useState, useEffect } from "react";
import { User } from "lucide-react";
import { cn } from "@/utils/cn";
import { getAvatar } from "@/services/avatarService";

interface AvatarProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  withRing?: boolean;
}

const SIZE_MAP = {
  sm: { container: "h-8 w-8", icon: "h-4 w-4" },
  md: { container: "h-12 w-12", icon: "h-6 w-6" },
  lg: { container: "h-16 w-16", icon: "h-8 w-8" },
  xl: { container: "h-24 w-24", icon: "h-12 w-12" },
};

/**
 * Avatar component — displays user's uploaded photo or falls back to User icon.
 * Reads from localStorage (pulse_user_avatar).
 */
export function Avatar({ size = "md", className, withRing = false }: AvatarProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const dims = SIZE_MAP[size];

  useEffect(() => {
    const updateAvatar = () => setAvatarUrl(getAvatar());
    updateAvatar();
    // Listen for storage changes (in case avatar is updated in another tab)
    window.addEventListener("storage", updateAvatar);
    // Custom event for same-tab updates
    window.addEventListener("pulse-avatar-updated", updateAvatar);
    return () => {
      window.removeEventListener("storage", updateAvatar);
      window.removeEventListener("pulse-avatar-updated", updateAvatar);
    };
  }, []);

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full",
        dims.container,
        withRing && "border-2 border-primary",
        className
      )}
      style={withRing ? { boxShadow: "0 0 20px rgba(204,255,0,0.3)" } : undefined}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt="User avatar" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-bg-elevated">
          <User className={cn("text-primary", dims.icon)} />
        </div>
      )}
    </div>
  );
}

/**
 * Trigger a custom event to notify all Avatar components of an update.
 */
export function notifyAvatarUpdated(): void {
  window.dispatchEvent(new Event("pulse-avatar-updated"));
}
