import { LucideIcon } from "lucide-react";
import { cn } from "@/utils/cn";
import { Button } from "./Button";

interface Props {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function DataEmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-6 text-center animate-in fade-in zoom-in duration-300",
        className,
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-bg-elevated mb-4 text-text-muted">
        <Icon className="h-8 w-8" />
      </div>
      <h3 className="text-lg font-bold text-text-primary mb-1">{title}</h3>
      <p className="text-sm text-text-muted max-w-[240px] mb-6">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button onClick={onAction} variant="outline">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
