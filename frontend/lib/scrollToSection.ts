/**
 * Scroll to in-page dashboard sections with sticky-header offset and highlight pulse.
 */

const HIGHLIGHT_MS = 1800;
const DEFAULT_MAX_ATTEMPTS = 10;
const DEFAULT_ATTEMPT_DELAY_MS = 120;

export function getScrollOffset(extra = 0): number {
  if (typeof document === "undefined") return 72;
  const root = document.documentElement;
  const nav = document.querySelector<HTMLElement>(".app-navbar");
  const measuredHeader = nav?.getBoundingClientRect().height;
  const cssHeader = parseFloat(getComputedStyle(root).getPropertyValue("--header-height"));
  const header =
    (measuredHeader && measuredHeader > 0 ? measuredHeader : null) ?? (Number.isFinite(cssHeader) && cssHeader > 0 ? cssHeader : 56);
  const scrollExtra = parseFloat(getComputedStyle(root).getPropertyValue("--scroll-offset-extra")) || 20;
  return header + scrollExtra + extra;
}

export function highlightScrollTarget(el: HTMLElement): void {
  el.classList.remove("scroll-target-highlight");
  void el.offsetWidth;
  el.classList.add("scroll-target-highlight");
  window.setTimeout(() => {
    el.classList.remove("scroll-target-highlight");
  }, HIGHLIGHT_MS);
}

export function scrollToElement(el: HTMLElement, options?: { highlight?: boolean; extraOffset?: number }): void {
  const offset = getScrollOffset(options?.extraOffset ?? 0);
  const prevMargin = el.style.scrollMarginTop;
  el.style.scrollMarginTop = `${offset}px`;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  if (prevMargin) {
    el.style.scrollMarginTop = prevMargin;
  } else {
    el.style.removeProperty("scroll-margin-top");
  }
  if (options?.highlight !== false) {
    window.setTimeout(() => highlightScrollTarget(el), 320);
  }
}

export function scrollToSectionById(
  id: string,
  options?: {
    highlight?: boolean;
    extraOffset?: number;
    maxAttempts?: number;
    attemptDelay?: number;
  },
): boolean {
  const normalized = id.startsWith("#") ? id.slice(1) : id;
  if (!normalized) return false;

  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const attemptDelay = options?.attemptDelay ?? DEFAULT_ATTEMPT_DELAY_MS;

  const tryScroll = (attempt: number): boolean => {
    const el = document.getElementById(normalized);
    if (el) {
      scrollToElement(el, options);
      return true;
    }
    if (attempt >= maxAttempts) return false;
    window.setTimeout(() => {
      tryScroll(attempt + 1);
    }, attemptDelay);
    return false;
  };

  return tryScroll(0);
}

export function scrollFromLocationHash(options?: { highlight?: boolean; maxAttempts?: number }): boolean {
  if (typeof window === "undefined") return false;
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return false;
  return scrollToSectionById(hash, {
    highlight: options?.highlight,
    maxAttempts: options?.maxAttempts ?? 15,
    attemptDelay: 150,
  });
}
