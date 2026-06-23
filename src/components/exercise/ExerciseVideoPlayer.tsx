"use client";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Play, Image as ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/utils/cn";

/**
 * ExerciseVideoPlayer.
 *
 * A reusable media player for exercise demonstrations. Designed to accept
 * ANY media source (GIF, MP4, WebM, or static image) so we can later swap
 * GitHub-raw GIFs for a CDN-backed MP4 without touching call sites.
 *
 * Features:
 *  - Auto-detects media type from URL extension (`.gif` → <img>, `.mp4`/
 *    `.webm` → <video>, else → <img>).
 *  - Loop automatically (GIFs loop natively; video has `loop` attribute).
 *  - Speed control (0.5× / 1× / 1.5×) — video only, since GIFs don't
 *    support playbackRate.
 *  - Placeholder when media is missing/broken: a colored tile with the
 *    first letter of the exercise name.
 *  - Lazy load: `<img loading="lazy">` + `<video preload="none">` +
 *    IntersectionObserver to play the video only when visible.
 *  - Offline-first: uses the Cache API (via mediaCache service) to store
 *    blobs and replay them when offline. Falls back gracefully to the
 *    placeholder if both cache and network fail.
 *
 * Variants:
 *  - `detail`: large, with image/animation toggle + speed control.
 *  - `compact`: small inline (used in WorkoutSession cards).
 */

export type MediaVariant = "detail" | "compact";

export type PlaySpeed = 0.5 | 1 | 1.5;

const SPEED_OPTIONS: readonly PlaySpeed[] = [0.5, 1, 1.5];

export interface ExerciseVideoPlayerProps {
  /** Exercise name — used for the placeholder initials + alt text. */
  exerciseName: string;
  /** Static image URL (poster frame). */
  imageUrl?: string;
  /** Animated GIF URL (loops natively in <img>). */
  gifUrl?: string;
  /** Optional video URL (MP4/WebM). Preferred over gifUrl when present. */
  videoUrl?: string;
  /** Visual variant. */
  variant?: MediaVariant;
  /** Extra classes for the outer container. */
  className?: string;
}

// ── Pure helpers (exported for testing) ──

/**
 * Detect the media kind from a URL's extension.
 * - `.gif` → "gif" (rendered as <img>, loops natively)
 * - `.mp4` / `.webm` / `.mov` / `.m4v` → "video" (rendered as <video>)
 * - anything else (jpg, png, webp, empty) → "image" (static <img>)
 */
export function detectMediaKind(url: string | undefined): "gif" | "video" | "image" {
  if (!url) return "image";
  const clean = url.split("?")[0].split("#")[0].toLowerCase();
  if (clean.endsWith(".gif")) return "gif";
  if (
    clean.endsWith(".mp4") ||
    clean.endsWith(".webm") ||
    clean.endsWith(".mov") ||
    clean.endsWith(".m4v")
  ) {
    return "video";
  }
  return "image";
}

/**
 * Get the first letter of an exercise name for the placeholder.
 * Returns uppercase letter, or " "? (fallback for empty names).
 */
export function getPlaceholderInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  return trimmed[0].toUpperCase();
}

/**
 * Deterministic gradient class for the placeholder based on the name.
 * Picks from a small palette so the same exercise always gets the same color.
 */
export function getPlaceholderGradient(name: string): string {
  const palette = [
    "from-primary/30 to-primary/10",
    "from-blue-500/30 to-blue-500/10",
    "from-purple-500/30 to-purple-500/10",
    "from-pink-500/30 to-pink-500/10",
    "from-teal-500/30 to-teal-500/10",
    "from-orange-500/30 to-orange-500/10",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return palette[hash % palette.length];
}

// ── Component ──

export default function ExerciseVideoPlayer({
  exerciseName,
  imageUrl,
  gifUrl,
  videoUrl,
  variant = "detail",
  className,
}: ExerciseVideoPlayerProps) {
  const isCompact = variant === "compact";

  // Mode: "image" (static) or "animation" (gif/video). Defaults to animation
  // when an animation source exists, else static image.
  const animationUrl = videoUrl || gifUrl;
  const hasAnimation = Boolean(animationUrl);
  const [mode, setMode] = useState<"image" | "animation">(
    hasAnimation ? "animation" : "image"
  );

  // The URL currently being displayed + its media kind.
  const activeUrl = mode === "animation" ? animationUrl : imageUrl;
  const mediaKind = detectMediaKind(activeUrl);

  // Error state — when the media fails to load, show the placeholder.
  const [hasError, setHasError] = useState(false);

  // Offline-first: object URL from the Cache API (null while loading).
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isloadingFromCache, setIsLoadingFromCache] = useState(false);

  // Speed control (video only).
  const [speed, setSpeed] = useState<PlaySpeed>(1);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Reset error + blob state when the active URL changes.
  useEffect(() => {
    setHasError(false);
    setBlobUrl(null);
  }, [activeUrl]);

  // ── Cache API: try to load the media from cache (offline-first) ──
  // We only attempt this for the animation source (the thing users replay
  // often). Static images are left to the browser's HTTP cache which is
  // already good enough.
  useEffect(() => {
    if (!activeUrl || mediaKind === "image") return;
    let cancelled = false;

    (async () => {
      // Dynamic import keeps the Cache API code out of the main bundle for
      // browsers that don't need it, and avoids circular imports.
      const { fetchMediaWithCache, responseToObjectUrl } = await import(
        "@/services/mediaCache"
      );
      setIsLoadingFromCache(true);
      const response = await fetchMediaWithCache(activeUrl);
      if (cancelled) return;
      const objUrl = await responseToObjectUrl(response);
      if (cancelled) return;
      if (objUrl) setBlobUrl(objUrl);
      setIsLoadingFromCache(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [activeUrl, mediaKind]);

  // Revoke object URLs on unmount/URL change to avoid memory leaks.
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  // Apply speed changes to the video element.
  useEffect(() => {
    if (videoRef.current && mediaKind === "video") {
      videoRef.current.playbackRate = speed;
    }
  }, [speed, mediaKind, blobUrl]);

  // ── Lazy video playback via IntersectionObserver ──
  // Play when visible, pause when scrolled away. Saves CPU/battery on long
  // workout-session pages with many cards.
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (mediaKind !== "video") return;
    if (typeof IntersectionObserver === "undefined") return;
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const video = videoRef.current;
          if (!video) continue;
          if (entry.isIntersecting) {
            void video.play().catch(() => {
              /* autoplay can fail if not muted; we don't force it */
            });
          } else {
            video.pause();
          }
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [mediaKind, blobUrl]);

  // The effective src: prefer the blob URL (offline cache hit) over the raw
  // network URL.
  const effectiveSrc = blobUrl ?? activeUrl;

  const showPlaceholder = !activeUrl || hasError;
  const showSpeedControl = mediaKind === "video" && mode === "animation" && !isCompact;

  const handleToggle = useCallback(() => {
    setMode((m) => (m === "animation" ? "image" : "animation"));
  }, []);

  const placeholderInitial = useMemo(() => getPlaceholderInitial(exerciseName), [exerciseName]);
  const gradient = useMemo(() => getPlaceholderGradient(exerciseName), [exerciseName]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden bg-bg-elevated",
        isCompact ? "aspect-square" : "aspect-video",
        className
      )}
    >
      {/* ── Placeholder (missing or broken media) ── */}
      {showPlaceholder && (
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center bg-gradient-to-br",
            gradient
          )}
          aria-label={exerciseName}
        >
          <span
            className={cn(
              "font-black text-text-primary/80 select-none",
              isCompact ? "text-4xl" : "text-7xl"
            )}
          >
            {placeholderInitial}
          </span>
        </div>
      )}

      {/* ── Loading spinner (cache lookup in progress) ── */}
      {!showPlaceholder && isloadingFromCache && !blobUrl && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg-elevated/50 backdrop-blur-sm z-10">
          <Loader2 className="h-6 w-6 animate-spin text-text-secondary" aria-hidden="true" />
        </div>
      )}

      {/* ── Media element ── */}
      {!showPlaceholder && effectiveSrc && mediaKind === "video" && (
        <video
          ref={videoRef}
          src={effectiveSrc}
          className="relative h-full w-full object-contain"
          loop
          muted
          playsInline
          autoPlay
          preload="none"
          aria-label={`${exerciseName} demonstration video`}
          onError={() => setHasError(true)}
        />
      )}

      {!showPlaceholder && effectiveSrc && (mediaKind === "gif" || mediaKind === "image") && (
        <img
          src={effectiveSrc}
          alt={`${exerciseName} demonstration`}
          loading="lazy"
          className="relative h-full w-full object-contain"
          onError={() => setHasError(true)}
        />
      )}

      {/* ── Image / Animation toggle (detail variant only, when both sources exist) ── */}
      {variant === "detail" && hasAnimation && imageUrl && !showPlaceholder && (
        <button
          type="button"
          onClick={handleToggle}
          className="absolute bottom-4 start-4 flex items-center gap-2 rounded-xl bg-bg/90 px-4 py-2 text-xs font-semibold text-text-primary backdrop-blur-sm transition-colors hover:bg-bg border border-border/50"
          aria-label={mode === "animation" ? "Switch to static image" : "Switch to animation"}
        >
          {mode === "animation" ? (
            <>
              <ImageIcon className="h-4 w-4" aria-hidden="true" />
              <span>Image</span>
            </>
          ) : (
            <>
              <Play className="h-4 w-4 fill-primary text-primary" aria-hidden="true" />
              <span>Animation</span>
            </>
          )}
        </button>
      )}

      {/* ── Compact toggle (smaller, no label) ── */}
      {isCompact && hasAnimation && imageUrl && !showPlaceholder && (
        <button
          type="button"
          onClick={handleToggle}
          className="absolute bottom-2 start-2 flex items-center gap-1.5 rounded-lg bg-bg/80 px-2.5 py-1.5 text-xs font-semibold text-text-primary backdrop-blur-sm tracking-wider uppercase border border-border/50"
          aria-label={mode === "animation" ? "Switch to image" : "Switch to animation"}
        >
          {mode === "animation" ? (
            "Image"
          ) : (
            <>
              <Play className="h-3 w-3 fill-primary text-primary" aria-hidden="true" /> Anim
            </>
          )}
        </button>
      )}

      {/* ── Speed control (video only, detail variant) ── */}
      {showSpeedControl && (
        <div className="absolute top-4 end-4 flex items-center gap-1 rounded-xl bg-bg/90 p-1 backdrop-blur-sm border border-border/50">
          {SPEED_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              aria-label={`Playback speed ${s}×`}
              aria-pressed={speed === s}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-bold transition-colors",
                speed === s
                  ? "bg-primary text-primary-text"
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              {s}×
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
