import { cn } from "@/utils/cn";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("skeleton-shimmer rounded-md", className)}
      {...props}
    />
  );
}

export function SkeletonExerciseGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-32 skeleton-shimmer rounded-xl" />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return <div className="h-24 skeleton-shimmer rounded-xl" />;
}
