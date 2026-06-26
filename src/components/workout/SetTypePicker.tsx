"use client";
import { useReducedMotion } from "framer-motion";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { SET_TYPES, type SetType } from "@/config/setTypes";
import { cn } from "@/utils/cn";

/**
 * SetTypePicker — bottom-sheet grid for picking one of the 11 set types.
 *
 * Replaces SetRow's tap-to-cycle behavior (up to 10 taps to reach the desired
 * type) with a single tap → grid → pick flow. All 11 types are visible at
 * once in a 3-column grid, each cell showing the badge, English label, and
 * the type's semantic color. The currently-selected type is highlighted with
 * a ring so the user can see their current selection at a glance.
 *
 * Accessibility:
 *   - Each cell is a button with aria-label + aria-pressed.
 *   - Touch targets meet WCAG 2.5.5 (min-h-11 = 44px).
 *   - Respects prefers-reduced-motion via useReducedMotion (disables the
 *     background-scale effect and the active:scale tap animation).
 */
interface SetTypePickerProps {
  /** Controlled open state. */
  open: boolean;
  /** Called with the new open state when the user dismisses the drawer. */
  onOpenChange: (open: boolean) => void;
  /** Called with the picked SetType. The drawer closes automatically after. */
  onSelect: (type: SetType) => void;
  /** Currently-selected type — highlighted with a ring. */
  currentType: SetType;
}

export default function SetTypePicker({
  open,
  onOpenChange,
  onSelect,
  currentType,
}: SetTypePickerProps) {
  const prefersReducedMotion = useReducedMotion();

  const handleSelect = (type: SetType) => {
    onSelect(type);
    onOpenChange(false);
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      shouldScaleBackground={!prefersReducedMotion}
    >
      <DrawerContent className="mx-auto max-w-md">
        <DrawerHeader className="text-left">
          <DrawerTitle className="text-base font-bold text-text-primary uppercase tracking-wider">
            Set Type
          </DrawerTitle>
          <DrawerDescription className="text-xs text-text-secondary uppercase tracking-wider">
            Pick the variant for this set
          </DrawerDescription>
        </DrawerHeader>

        <div
          className="grid grid-cols-3 gap-2 p-4 pb-8 max-h-[60vh] overflow-y-auto"
          role="listbox"
          aria-label="Set types"
        >
          {SET_TYPES.map((meta) => {
            const isActive = meta.id === currentType;
            return (
              <button
                key={meta.id}
                type="button"
                onClick={() => handleSelect(meta.id)}
                role="option"
                aria-selected={isActive}
                aria-label={`${meta.labelEn} set type`}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center gap-1.5 rounded-xl border p-3 transition-colors",
                  !prefersReducedMotion && "active:scale-95",
                  isActive
                    ? cn("border-primary ring-2 ring-primary/40", meta.chipBg)
                    : "border-border bg-bg-elevated hover:bg-bg-hover"
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-md text-xs font-black",
                    meta.chipBg,
                    meta.chipText
                  )}
                >
                  {meta.badge}
                </span>
                <span className="text-[11px] font-bold text-text-primary uppercase tracking-wider">
                  {meta.labelEn}
                </span>
              </button>
            );
          })}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
