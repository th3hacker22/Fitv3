"use client";
/**
 * Compatibility shim that exposes the same <Link>, useNavigate, useParams API
 * the original TanStack Router used, but backed by our in-memory client router.
 * This lets us port the pages with minimal edits.
 */
import React from "react";
import { useRouter, type RouteName } from "@/router";

interface LinkProps {
  to: string;
  params?: Record<string, string>;
  className?: string;
  children?: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
  "aria-label"?: string;
}

const PATH_TO_ROUTE: Record<string, RouteName> = {
  "/": "home",
  "/exercises": "exercises",
  "/exercises/$exerciseId": "exercise-detail",
  "/workout/$sessionId": "workout",
  "/stats": "stats",
  "/body": "body",
  "/profile": "profile",
  "/settings": "settings",
  "/auth": "auth",
  "/nutrition": "nutrition",
  "/feed": "feed",
  "/builder": "builder",
  "/wizard": "wizard",
  "/generator/result": "generator-result",
  "/challenges": "challenges",
  "/challenges/$challengeId": "challenge-detail",
  "/calendar": "calendar",
  "/goals": "goals",
};

export function Link({ to, params, className, children, onClick, ...rest }: LinkProps) {
  const navigate = useRouter((s) => s.navigate);
  const route = PATH_TO_ROUTE[to] ?? "home";

  // Build a real href by substituting $param placeholders so ctrl+click /
  // "open in new tab" works. Without this the href was literally
  // "/exercises/$exerciseId" — broken for all non-left-click navigation.
  let href = to;
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      href = href.replace(`$${key}`, encodeURIComponent(value));
    }
  }

  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        // Allow modifier-key clicks (new tab, new window) to proceed natively.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        onClick?.(e);
        navigate(route, params);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}

export function useNavigate() {
  const navigate = useRouter((s) => s.navigate);
  const back = useRouter((s) => s.back);
  return React.useCallback(
    (opts: { to: string; params?: Record<string, string> }) => {
      const route = PATH_TO_ROUTE[opts.to] ?? "home";
      navigate(route, opts.params);
    },
    [navigate]
  );
}

export function useParams(_opts?: { from?: string }): Record<string, string> {
  return useRouter((s) => s.params);
}

export function useLocation() {
  const route = useRouter((s) => s.route);
  const params = useRouter((s) => s.params);
  return { pathname: route, params };
}
