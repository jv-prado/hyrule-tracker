// Cheap checks for what the windows send over IPC, and for restored window bounds.
// No Electron imports, so it can be tested directly.
import type { OverlayMode, UiPrefs } from '../shared/types.js';

export const LOCALES = ['pt-BR', 'en-US', 'es-ES'] as const;
export type MainLocale = (typeof LOCALES)[number];
export const isLocale = (x: unknown): x is MainLocale => typeof x === 'string' && (LOCALES as readonly string[]).includes(x);

export const OVERLAY_MODES: readonly OverlayMode[] = ['counters', 'remaining', 'available'];

/** A plain {} object (not null, an array, a class instance...). */
export function isPlainObject(x: unknown): x is Record<string, unknown> {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  const proto = Object.getPrototypeOf(x);
  return proto === Object.prototype || proto === null;
}

const strings = (x: unknown) => Array.isArray(x) ? x.filter((v): v is string => typeof v === 'string') : undefined;

/** UI preferences from the window, merged over the current ones; null if it isn't an object. */
export function sanitizeUiPrefs(x: unknown, current: UiPrefs): UiPrefs | null {
  if (!isPlainObject(x)) return null;
  const out: UiPrefs = { ...current, ...x } as UiPrefs;
  if (typeof x.hideCollected !== 'boolean') out.hideCollected = current.hideCollected;
  out.hiddenCategories = strings(x.hiddenCategories) ?? current.hiddenCategories;
  out.collapsed = strings(x.collapsed) ?? current.collapsed;
  const parts = isPlainObject(x.showParts) ? x.showParts : undefined;
  out.showParts = {
    B: typeof parts?.B === 'boolean' ? parts.B : current.showParts.B,
    C: typeof parts?.C === 'boolean' ? parts.C : current.showParts.C,
  };
  return out;
}

/** Overlay changes: a known mode, an opacity clamped to 0.2–1. Unknown or bad fields are dropped. */
export function parseOverlayPatch(x: unknown): { opacity?: number; mode?: OverlayMode } {
  if (!isPlainObject(x)) return {};
  const out: { opacity?: number; mode?: OverlayMode } = {};
  if (typeof x.opacity === 'number' && Number.isFinite(x.opacity)) out.opacity = Math.min(1, Math.max(0.2, x.opacity));
  if (typeof x.mode === 'string' && (OVERLAY_MODES as readonly string[]).includes(x.mode)) out.mode = x.mode as OverlayMode;
  return out;
}

/** Hotkeys from the window: trimmed strings (at most 100 characters), or null if malformed. */
export function parseHotkeys(x: unknown): { toggleOverlay: string; lockOverlay: string } | null {
  if (!isPlainObject(x) || typeof x.toggleOverlay !== 'string' || typeof x.lockOverlay !== 'string') return null;
  const toggleOverlay = x.toggleOverlay.trim(), lockOverlay = x.lockOverlay.trim();
  if (toggleOverlay.length > 100 || lockOverlay.length > 100) return null;
  return { toggleOverlay, lockOverlay };
}

export const isString = (x: unknown, max = 500): x is string => typeof x === 'string' && x.length <= max;
export const isStringArray = (x: unknown, max = 200): x is string[] => Array.isArray(x) && x.length <= max && x.every(v => isString(v));

export interface Rect { x: number; y: number; width: number; height: number }

/** Saved window bounds that are sane numbers, or undefined. */
export function cleanBounds(b: unknown): Rect | undefined {
  if (!isPlainObject(b)) return undefined;
  const { x, y, width, height } = b;
  const ok = [x, y, width, height].every(v => typeof v === 'number' && Number.isFinite(v));
  if (!ok || (width as number) < 50 || (height as number) < 50) return undefined;
  return { x: Math.round(x as number), y: Math.round(y as number), width: Math.round(width as number), height: Math.round(height as number) };
}

/**
 * Whether a window at these bounds would be reachable: enough of it (at least `min` px each
 * way, including its title area) overlaps the work area of a connected display.
 */
export function boundsVisible(b: Rect, workAreas: Rect[], min = 80): boolean {
  return workAreas.some(wa => {
    const w = Math.min(b.x + b.width, wa.x + wa.width) - Math.max(b.x, wa.x);
    const h = Math.min(b.y + b.height, wa.y + wa.height) - Math.max(b.y, wa.y);
    const topVisible = b.y >= wa.y - 10 && b.y < wa.y + wa.height - 20;
    return w >= Math.min(min, b.width) && h >= Math.min(min, b.height) && topVisible;
  });
}
