import type { TrackerApi } from '../preload/preload';
import { currentLocale, date } from './i18n';

declare global {
  interface Window { tracker: TrackerApi }
}
export const api = window.tracker;

export function timeAgo(ms: number | undefined, now = Date.now()): string {
  if (!ms) return '—';
  const s = Math.max(0, Math.round((now - ms) / 1000));
  const relative = new Intl.RelativeTimeFormat(currentLocale(), { numeric: 'auto', style: 'short' });
  if (s < 10) return relative.format(0, 'second');
  if (s < 60) return relative.format(-s, 'second');
  const m = Math.round(s / 60);
  if (m < 60) return relative.format(-m, 'minute');
  const h = Math.round(m / 60);
  if (h < 24) return relative.format(-h, 'hour');
  return date(ms);
}
