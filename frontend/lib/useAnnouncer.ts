"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Lightweight screen-reader announcer. The AppShell renders a single
 * `aria-live` region; any component can call `announce("Saved")` to push a
 * message into it. Polite by default; pass `"assertive"` for errors.
 *
 * The hook returns the current message so the live-region element can render
 * it, plus a setter so feature code can announce updates.
 */
type Politeness = "polite" | "assertive";

type Announcement = {
  message: string;
  politeness: Politeness;
  /** Token bumped on every push so identical messages still re-announce. */
  token: number;
};

let listeners: Array<(value: Announcement) => void> = [];
let current: Announcement = { message: "", politeness: "polite", token: 0 };

export function announce(message: string, politeness: Politeness = "polite") {
  current = { message, politeness, token: current.token + 1 };
  listeners.forEach((listener) => listener(current));
}

export function useAnnouncer() {
  const [value, setValue] = useState<Announcement>(current);

  useEffect(() => {
    listeners.push(setValue);
    return () => {
      listeners = listeners.filter((listener) => listener !== setValue);
    };
  }, []);

  const push = useCallback((message: string, politeness: Politeness = "polite") => {
    announce(message, politeness);
  }, []);

  return { ...value, announce: push };
}

/**
 * Trap Tab focus inside `containerRef` while `active` is true. On activation,
 * focus the first focusable element. On deactivation, return focus to the
 * element that was focused before activation.
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  active: boolean
) {
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    previouslyFocused.current = (document.activeElement as HTMLElement) ?? null;
    const container = containerRef.current;
    if (!container) return;

    const focusFirst = () => {
      const focusable = getFocusable(container);
      if (focusable[0]) focusable[0].focus();
    };
    focusFirst();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const focusable = getFocusable(container);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;

      if (event.shiftKey && activeEl === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeEl === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const target = previouslyFocused.current;
      if (target && typeof target.focus === "function") {
        target.focus();
      }
    };
  }, [active, containerRef]);
}

function getFocusable(container: HTMLElement): HTMLElement[] {
  const selector = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled]):not([type='hidden'])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",");
  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
    (el) => !el.hasAttribute("inert") && el.offsetParent !== null
  );
}
