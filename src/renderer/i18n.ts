/// <reference types="vite/client" />
import entries from './strings.txt?raw';
import catalogEntries from './catalog-strings.json';

export const languages = { 'en-US': 'English', 'pt-BR': 'Português', 'es-ES': 'Español' } as const;
export type Locale = keyof typeof languages;
const storage = 'hyrule-tracker.locale';
function initial(): Locale {
  try {
    const saved = localStorage.getItem(storage);
    if (saved && Object.hasOwn(languages, saved)) return saved as Locale;
  } catch { /* browser storage unavailable */ }
  return 'en-US';
}
let locale = initial();
const translations = new Map(entries.trim().split('\n').map(row => {
  const [source, pt, en, es] = row.trim().split('|');
  return [source, { 'pt-BR': pt, 'en-US': en, 'es-ES': es }] as const;
}));
const catalog: Record<string, string[]> = catalogEntries;
/** A translation found in the dictionaries or by one of the structured patterns, or undefined. */
function lookup(source: string): string | undefined {
  const direct = translations.get(source)?.[locale];
  if (direct) return direct;
  if (locale !== 'en-US') {
    const labels = Object.hasOwn(catalog, source) ? catalog[source] : undefined;
    const translated = labels?.[locale === 'pt-BR' ? 0 : 1];
    if (translated) return translated;
    const age = /^(.+) \((child|adult)\)$/.exec(source);
    if (age) return `${t(age[1])} (${t(age[2])})`;
    const floor = /^(B)?(\d+)F$/.exec(source);
    if (floor) return t(floor[1] ? '{n} basement' : '{n} floor').replace('{n}', floor[2]);
  }
  const tokens = /^(\d+) Gold Skulltula tokens?$/.exec(source);
  if (tokens) return plural(Number(tokens[1]), '{n} Gold Skulltula token', '{n} Gold Skulltula tokens');
  const numbered = /^(Pensamento de fada|Chamado de Pierre|Entrada de gruta|Pedra falante|Rupees prateadas) (\d+)$/.exec(source);
  if (numbered) return `${t(numbered[1])} ${numbered[2]}`;
  return undefined;
}
export function t(source: string): string {
  const found = lookup(source);
  if (found !== undefined) return found;
  // "Area: spot" headings: translated only when both halves are known, never as a half-translated mix.
  const heading = source.indexOf(': ');
  if (heading > 0 && !/[.!?]$/.test(source)) {
    const head = lookup(source.slice(0, heading));
    const body = lookup(source.slice(heading + 2));
    if (head !== undefined && body !== undefined) return `${head}: ${body}`;
  }
  return source;
}
export const currentLocale = () => locale;
export function setLocale(next: Locale) {
  locale = next;
  document.documentElement.lang = next;
  try { localStorage.setItem(storage, next); } catch { /* browser storage unavailable */ }
}
export const number = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
export function message(source: string, values: Record<string, string | number> = {}) {
  return t(source).replace(/\{(\w+)\}/g, (placeholder, key: string) => {
    const value = Object.hasOwn(values, key) ? values[key] : undefined;
    return typeof value === 'number' ? number(value) : value === undefined ? placeholder : t(value);
  });
}
export const date = (value: number) => new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(value);
export const hour = (value: number) => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(value);
/** 0.42 -> "42%" / "42 %" as the locale writes it. */
export const percent = (fraction: number, digits = 0) => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: digits }).format(fraction);
export const day = (value: number | Date) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(value);
/** Picks the singular or plural key for `count` (Intl.PluralRules) and fills {n} and the other values. */
export function plural(count: number, one: string, other: string, values: Record<string, string | number> = {}) {
  const key = new Intl.PluralRules(locale).select(count) === 'one' ? one : other;
  return message(key, { n: count, ...values });
}
/** t() for plain text, message() when the main process sent values to fill in. */
export const tv = (source: string, values?: Record<string, string | number>) => (values ? message(source, values) : t(source));
