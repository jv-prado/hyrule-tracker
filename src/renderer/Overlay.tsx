import { currentLocale, languages, message, percent, setLocale, t, tv, type Locale } from './i18n';
import { GameItemIcon } from './GameItemIcon';
import { useEffect, useRef, useState } from 'react';
import type { AppState, TrackedCategory, OverlayMode } from '../shared/types';
import { api } from './api';
import { categoryColor } from './icons';
import { buildCards } from './view';

/** Compact always-on-top view. Locked = click-through; unlocked = drag/resize + controls. */
export function Overlay() {
  const [state, setState] = useState<AppState | null>(null);
  const [locale, setLanguage] = useState(currentLocale);
  useEffect(() => {
    document.body.classList.add('overlay-body');
    void api.getState().then(setState);
    const off = api.onState(setState);
    const offLanguage = api.onLanguage(next => {
      if (!Object.hasOwn(languages, next)) return;
      setLocale(next as Locale);
      setLanguage(next as Locale);
    });
    return () => { off(); offLanguage(); };
  }, []);
  const s = state?.summary;
  // Numbers that just went up pulse for a few seconds.
  const bumped = useBumps(s ? { hearts: (s.hearts ?? 0) * 4 + (s.heartPiecesHeld ?? 0), tokens: s.tokens ?? 0, pct: s.doneA } : {});
  if (!state) return null;
  const o = state.overlay;
  const live = state.live;

  return (
    <div lang={locale} className={`ov ${o.locked ? 'locked' : 'unlocked'}`}>
      {!o.locked && (
        <div className="ov-controls">
          <span className="ov-drag" title={t("Drag to move")}>{t("⠿ drag")}</span>
          <select value={o.mode} onChange={e => void api.setOverlay({ mode: e.target.value as OverlayMode })}>
            <option value="counters">{t("Counters")}</option>
            <option value="remaining">{t("Remaining here")}</option>
            <option value="available">{t("Can get now")}</option>
          </select>
          <input type="range" min={0.2} max={1} step={0.05} value={o.opacity} title={t("Opacity")}
            onChange={e => void api.setOverlay({ opacity: Number(e.target.value) })} />
          <button onClick={() => void api.toggleOverlayLock()} title={`Lock (${state.hotkeys.lockOverlay})`}>{t("Lock")}</button>
        </div>
      )}
      {state.status !== 'ok' || !s ? (
        <div className="ov-msg">{state.message ? tv(state.message, state.messageValues) : t('Waiting for a save…')}</div>
      ) : (
        <>
          <div className="ov-head">
            <span className="ov-here">{t(s.area ?? 'Unknown area')}</span>
            {live.status !== 'off' && live.status !== 'unavailable' && (
              <span className={`ov-src ${live.using ? 'on' : ''}`} title={t(live.using ? 'Live from the game' : 'Using saves')}>{live.using ? t('● Live') : t('Saves')}</span>
            )}
          </div>
          <div className="ov-summary">
            <span className={bumped.has('hearts') ? 'bump' : ''} title={t('Corações')}><GameItemIcon id="heart" size={21} /> {s.hearts ?? '?'}{s.heartPiecesHeld ? <small> +{s.heartPiecesHeld}/4</small> : null}</span>
            <span className={bumped.has('tokens') ? 'bump' : ''} title={t('Skulltulas douradas')}><GameItemIcon id="gold_skulltula" size={21} /> {s.tokens ?? '?'}</span>
            <span className={`ov-pct ${bumped.has('pct') ? 'bump' : ''}`}>{percent(s.percent / 100, 1)}</span>
          </div>
          {s.claimable.length > 0 && <div className="ov-claim">{t("Claim:")}{' '}{s.claimable.map(c => t(c.reward)).join(', ')}</div>}
          {state.identify.length > 0 && <div className="ov-claim">? {state.identify.length}{t("to identify: open the tracker")}</div>}
          {o.mode === 'counters' ? <Counters cats={state.categories} /> : o.mode === 'available' ? <Available state={state} /> : <Remaining state={state} />}
        </>
      )}
      {state.toasts.slice(-2).map(toast => <div key={toast.id} className="ov-toast">{message(toast.text, toast.values)}</div>)}
    </div>
  );
}

/** Keys whose value went up recently (cleared after `ms`). Ignores the first render. */
function useBumps(values: Record<string, number>, ms = 4000): Set<string> {
  const prev = useRef<Record<string, number> | null>(null);
  const [bumped, setBumped] = useState<Set<string>>(new Set());
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => () => { for (const timer of timers.current) clearTimeout(timer); timers.current.clear(); }, []);
  const sig = JSON.stringify(values);
  useEffect(() => {
    const before = prev.current;
    prev.current = values;
    if (!before) return;
    const up = Object.keys(values).filter(k => before[k] !== undefined && values[k] > before[k]);
    if (!up.length) return;
    setBumped(b => new Set([...b, ...up]));
    // Each change clears only its own keys and isn't cancelled by the next change, so a quick
    // second change doesn't leave the first one pulsing. Pending timers are cleared on unmount.
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setBumped(b => new Set([...b].filter(k => !up.includes(k))));
    }, ms);
    timers.current.add(timer);
  }, [sig]);
  return bumped;
}

function Counters({ cats }: { cats: TrackedCategory[] }) {
  // Same merged cards as the main window (Hearts, Items, Equipment, Bosses...).
  const cards = buildCards(cats).filter(c => c.part === 'A');
  const bumped = useBumps(Object.fromEntries(cards.map(c => [c.id, c.done])));
  return (
    <div className="ov-list">
      {cards.map(c => (
        <div key={c.id} className={`ov-row ${c.total && c.done === c.total ? 'full' : ''} ${bumped.has(c.id) ? 'bump' : ''}`}>
          <span className="dot" style={{ background: categoryColor(c.colorCat) }} />
          <span className="ov-label">{t(c.label)}</span>
          <span className="ov-num">{c.kind === 'counter' && c.value === null ? '?' : c.done}/{c.total}</span>
        </div>
      ))}
    </div>
  );
}

function Available({ state }: { state: AppState }) {
  let last = '';
  return (
    <div className="ov-list">
      {state.available.length === 0 && <div className="ov-row muted">{t("Nothing to get right now")}</div>}
      {state.available.slice(0, 60).map(a => {
        const head = a.region !== last ? (last = a.region, <div key={'h' + a.region} className="ov-area">{a.here && '▶ '}{t(a.region)}</div>) : null;
        return [head, (
          <div key={a.id} className="ov-row">
            <span className="dot" style={{ background: categoryColor(a.categoryId) }} />
            <span className="ov-label">{a.categoryId === 'gold_skulltulas' && `#${a.number} · `}{t(a.name.replace(/^[^:]+: /, ''))}</span>
            {state.canBeAdult && a.ages.length === 1 && <span className={`age ${a.ages[0]}`}>{t(a.ages[0] === 'adult' ? 'Adulto' : 'Criança')}</span>}
            {a.night && <span className="age night">☾</span>}
          </div>
        )];
      })}
    </div>
  );
}

/** Why a row can't be got yet, in a couple of words (from its logic status). */
export function laterReason(logic: { ages: string[]; missing: string[] } | undefined): string | undefined {
  if (!logic || logic.ages.length) return undefined;
  const m = logic.missing;
  if (m.some(x => x.startsWith('Master Sword'))) return 'adult';
  const item = m.find(x => !x.startsWith('reach ') && x !== 'adult' && x !== 'child');
  if (item) return t('needs {item}').replace('{item}', t(item.replace(/([a-z])([A-Z])/g, '$1 $2')));
  if (m.includes('adult')) return 'adult';
  if (m.includes('child')) return 'child';
  return m.length ? "can't reach yet" : undefined;
}

function Remaining({ state }: { state: AppState }) {
  const regions = new Set(state.areaRegions);
  const rows = state.categories
    .filter(c => c.part !== 'C')
    .flatMap(c => c.items.filter(i => !i.done && i.chapter && regions.has(i.chapter)).map(i => ({ c, i, later: laterReason(i.logic) })))
    // What you can get now first, then the rest.
    .sort((a, b) => Number(!!a.later) - Number(!!b.later));
  const later = rows.filter(r => r.later).length;
  const now = rows.length - later;
  return (
    <div className="ov-list">
      <div className="ov-area">
        {!regions.size ? t('No checklist entries for this area') : rows.length ? (later ? `${now} ${t('to get')} · ${later} ${t('later')}` : `${rows.length} ${t('left here')}`) : ''}
      </div>
      {rows.length === 0 && regions.size > 0 && <div className="ov-row muted">{t("Nothing left here 🎉")}</div>}
      {rows.slice(0, 40).map(({ c, i, later }) => (
        <div key={i.id} className={`ov-row ${i.state === 'unmapped' ? 'unmapped' : ''} ${later ? 'later' : ''}`}>
          <span className="dot" style={{ background: categoryColor(c.id) }} />
          <span className="ov-label">{c.id === 'gold_skulltulas' && `#${i.number} · `}{t(i.name.replace(/^[^:]+: /, ''))}</span>
          {later ? <span className="ov-why" title={t(later)}>{t(later)}</span> : i.logic?.night && <span className="age night">☾</span>}
        </div>
      ))}
    </div>
  );
}
