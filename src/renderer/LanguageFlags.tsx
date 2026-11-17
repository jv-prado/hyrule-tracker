import { languages, t, type Locale } from './i18n';

function star(cx: number, cy: number, r: number) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r * 0.4 : r;
    return `${(cx + rad * Math.cos(a)).toFixed(2)},${(cy + rad * Math.sin(a)).toFixed(2)}`;
  });
  return <polygon key={`${cx}-${cy}`} points={pts.join(' ')} fill="#fff" />;
}

const usStars = Array.from({ length: 9 }, (_, row) => Array.from({ length: row % 2 ? 5 : 6 }, (_, col) => star(
  (row % 2 ? 3.2 : 1.6) + col * 3.2, 1.4 + row * 1.35, 0.5)));

export function Flag({ locale, size = 22 }: { locale: Locale; size?: number }) {
  const h = Math.round(size * 0.7);
  return <svg className="flag" width={size} height={h} viewBox="0 0 30 21" aria-hidden="true" focusable="false">
    <defs><clipPath id={`flag-${locale}`}><rect width="30" height="21" rx="3" /></clipPath></defs>
    <g clipPath={`url(#flag-${locale})`}>
      {locale === 'en-US' && <>
        <rect width="30" height="21" fill="#fff" />
        {[0, 2, 4, 6, 8, 10, 12].map(i => <rect key={i} y={i * 21 / 13} width="30" height={21 / 13} fill="#b22234" />)}
        <rect width="12" height={21 * 7 / 13} fill="#3c3b6e" />
        <g transform="scale(1)">{usStars}</g>
      </>}
      {locale === 'pt-BR' && <>
        <rect width="30" height="21" fill="#009c3b" />
        <polygon points="15,2.2 27.2,10.5 15,18.8 2.8,10.5" fill="#ffdf00" />
        <circle cx="15" cy="10.5" r="4.6" fill="#002776" />
        <path d="M10.6 9.6q4.6-1.2 8.9 1.3" stroke="#fff" strokeWidth=".8" fill="none" />
      </>}
      {locale === 'es-ES' && <>
        <rect width="30" height="21" fill="#aa151b" />
        <rect y="5.25" width="30" height="10.5" fill="#f1bf00" />
        <rect x="6.5" y="8.4" width="3" height="4.2" rx=".8" fill="#aa151b" opacity=".85" />
      </>}
    </g>
    <rect width="30" height="21" rx="3" fill="none" stroke="rgba(0,0,0,.35)" />
  </svg>;
}

export function LanguageSwitch({ locale, onChange, labelled = false }: { locale: Locale; onChange: (locale: Locale) => void; labelled?: boolean }) {
  const codes = Object.keys(languages) as Locale[];
  const next = codes[(codes.indexOf(locale) + 1) % codes.length];
  const label = `${t('Idioma')}: ${languages[locale]} → ${languages[next]}`;
  return <button type="button" className={`language-switch${labelled ? ' labelled' : ''}`} aria-label={label} title={label} onClick={() => onChange(next)}>
    <Flag locale={locale} size={labelled ? 26 : 24} />{labelled && <span>{languages[locale]}</span>}
  </button>;
}
