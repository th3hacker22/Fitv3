import * as React from "react";
import { cn } from "@/utils/cn";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      icon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "relative inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
          "disabled:opacity-50 disabled:pointer-events-none",
          "motion-safe:active:scale-[0.97]",
          
          // Variants
          variant === "primary" &&
            "bg-gradient-to-br from-primary to-primary-hover text-primary-text shadow-[0_0_20px_rgba(204,255,0,0.25)] hover:shadow-[0_0_24px_rgba(204,255,0,0.4)] border-none",
          
          variant === "outline" &&
            "bg-transparent border border-border-active text-primary hover:bg-primary-dim hover:border-primary",
          
          variant === "ghost" &&
            "bg-transparent text-text-primary hover:bg-bg-surface-hover hover:text-text-primary border border-transparent",
            
          variant === "danger" &&
            "bg-danger/10 text-danger hover:bg-danger/20 border border-danger/20",

          // Sizes
          size === "sm" && "h-9 px-3 text-xs min-w-[36px]",
          size === "md" && "h-11 px-5 text-sm min-w-[44px]",
          size === "lg" && "h-14 px-8 text-base min-w-[44px]",
          size === "icon" && "h-11 w-11 p-0 flex-shrink-0",

          className
        )}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
        {!loading && icon && <span className="shrink-0">{icon}</span>}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

