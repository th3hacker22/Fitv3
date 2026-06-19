"use client";
import { cn } from "@/utils/cn";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("skeleton-shimmer rounded-md bg-bg-elevated/20", className)} {...props} />
  );
}

export function SkeletonExerciseGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 pb-8">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="glass-card rounded-[--radius-card] overflow-hidden border border-border/50 flex flex-col h-[200px]"
        >
          <div className="aspect-[4/3] w-full skeleton-shimmer bg-bg-elevated/30" />
          <div className="p-3 flex-1 flex flex-col gap-2">
            <div className="h-4 w-11/12 rounded-md skeleton-shimmer bg-bg-elevated/35" />
            <div className="h-3.5 w-7/12 rounded-md skeleton-shimmer bg-bg-elevated/25" />
            <div className="mt-auto h-5 w-8/12 rounded-full skeleton-shimmer bg-primary/5 border border-primary/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="glass-card rounded-none p-5 border-t-2 border-t-[#ccff00]/40 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full skeleton-shimmer bg-bg-elevated/30" />
        <div className="flex flex-col gap-1.5 flex-1">
          <div className="h-4 w-1/3 rounded-md skeleton-shimmer bg-bg-elevated/35" />
          <div className="h-3 w-1/4 rounded-md skeleton-shimmer bg-bg-elevated/25" />
        </div>
      </div>
      <div className="bg-bg-elevated/40 border border-white/5 p-4 flex flex-col gap-3">
        <div className="h-4 w-1/2 rounded-md skeleton-shimmer bg-bg-elevated/35" />
        <div className="flex gap-4">
          <div className="h-3 w-12 rounded-md skeleton-shimmer bg-bg-elevated/25" />
          <div className="h-3 w-12 rounded-md skeleton-shimmer bg-bg-elevated/25" />
          <div className="h-3 w-12 rounded-md skeleton-shimmer bg-bg-elevated/25" />
        </div>
      </div>
      <div className="h-16 w-full rounded-none skeleton-shimmer bg-bg-elevated/20 border border-white/5" />
    </div>
  );
}
