import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { IslandMark, IslandPoint, IslandText } from '../core/totk-island';
import { canTickByHand, isWorldLocation, isWorldManual, worldBounds, worldCategories as defaultLabels, worldMapPoint, type WorldCategory, type WorldItem, type WorldLayer, type WorldProgress } from '../core/totk-world';
import { worldSections } from '../core/totk-journal';
import { useWorldJournal } from './WorldJournalContext';
import { TotkMapArt, TotkMapCredit, TotkMapCrop, type ArtStatus } from './TotkMapArt';
import { TotkCategoryIcon } from './TotkCategoryIcon';
import { DOCKED_CARD, Icon, MapBack, MapCatDrawer, MapHud, MapScreenButton, StatusFilter, useMapOnlyView, useMatches } from './CompanionPages';
import type { MapBadgeStatus } from './mapCounts';
import { useStored } from './Recreation';
import { ObjectiveName } from './ObjectiveName';
import { islandBounds, islandMapPoint } from '../core/totk-island';
import { IslandChart } from './IslandChart';
import { ZoomPan } from './ZoomPan';
import { currentLocale, journalName, number } from './i18n';

export type WorldText = (text: IslandText) => string;
export type WorldFilter = 'all' | WorldLayer;
export const markLabels: Record<IslandMark, IslandText> = {
  unknown: ['Sem dados', 'No save data'],
  pending: ['Pendente', 'Pending'],
  found: ['Descoberto', 'Discovered'],
  done: ['Concluído', 'Complete'],
};

const chartColors = {
  surface: { base: '#26332a', land: '#3b4936', line: '#819572', label: '#ddd9b2' },
  sky: { base: '#25393f', land: '#526d68', line: '#8caeb0', label: '#e2ecd5' },
  depths: { base: '#23262b', land: '#40352f', line: '#9b765e', label: '#f2d9b4' },
};

const chartPlaces: Record<WorldLayer, string[]> = {
  surface: ['Lookout Landing', 'Rito Village', 'Goron City', 'Gerudo Town', 'Zora’s Domain', 'Hateno Village', 'Tarrey Town', 'Lurelin Village', 'Korok Forest'],
  sky: ['Great Sky Island', 'Dragonhead Island', 'North Hyrule Sky Archipelago', 'East Hebra Sky Archipelago', 'South Lanayru Sky Archipelago', 'Sokkala Sky Archipelago'],
  depths: ['Great Abandoned Central Mine', 'Construct Factory', 'Abandoned Gerudo Mine', 'Abandoned Hebra Mine', 'Abandoned Eldin Mine', 'Abandoned Lurelin Mine'],
};

const compareName = (name: string) => name.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replaceAll('’', "'");
export const matchesWorldItem = (item: WorldItem, query: string, game: 'botw' | 'totk', text: WorldText, labels = defaultLabels) =>
  compareName([item.name, journalName(game, item.name), item.detail, item.detail && journalName(game, item.detail),
    item.at && worldCoordinates(item.at), ...labels[item.category], text(labels[item.category])].filter(Boolean).join(' ')).includes(compareName(query.trim()));

export function ObjectiveNote({ item, text }: { item: WorldItem; text: WorldText }) {
  const { game, hint: objectiveHint } = useWorldJournal();
  const hint = objectiveHint(item);
  return <>
    {item.detail && <p>{journalName(game, item.detail)}</p>}
    {item.interior && <p>{text(['O ponto abre o local do templo ou santuário. O baú fica no interior.', 'The pin shows the temple or shrine location. The chest is inside.'])}</p>}
    {hint && <p>{text(hint)}</p>}
    <ObjectiveGuideLink guide={item.guide} text={text} />
  </>;
}

export function ObjectiveGuideLink({ guide, text, action }: { guide?: string; text: WorldText; action?: boolean }) {
  return guide && <a className={action ? 'action' : undefined}
    href={guide.startsWith('https://') ? guide : 'https://www.zeldadungeon.net/wiki/' + encodeURIComponent(guide.replaceAll(' ', '_'))}
    target="_blank" rel="noreferrer">{text(['Guia do objetivo', 'Objective guide'])}</a>;
}

export function worldCoordinates([x, z]: IslandPoint) {
  return Math.round(x) + ', ' + Math.round(-z);
}

function pinAt(at: IslandPoint, project: (point: IslandPoint) => IslandPoint): CSSProperties {
  const [left, top] = project(at);
  return { left: left + '%', top: top + '%' };
}

function WorldChart({ layer }: { layer: WorldLayer }) {
  const { game, items: worldItems } = useWorldJournal();
  const locale = currentLocale();
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    const colors = chartColors[layer];
    const size = 950;
    ctx.fillStyle = colors.base;
    ctx.fillRect(0, 0, size, size);
    const locations = worldItems.filter(item => item.layer === layer && item.at && ['location', 'shrine', 'lightroot'].includes(item.category));
    for (const item of locations) {
      const [x, y] = worldMapPoint(item.at!);
      const radius = layer === 'sky' ? 22 : 39;
      const glow = ctx.createRadialGradient(x * 9.5, y * 9.5, 0, x * 9.5, y * 9.5, radius);
      glow.addColorStop(0, colors.land);
      glow.addColorStop(1, colors.land + '00');
      ctx.fillStyle = glow;
      ctx.fillRect(x * 9.5 - radius, y * 9.5 - radius, radius * 2, radius * 2);
    }
    ctx.strokeStyle = colors.line + '69';
    ctx.fillStyle = colors.label;
    ctx.lineWidth = 1;
    ctx.font = '22px sans-serif';
    for (let x = -5000; x <= 5000; x += 1000) {
      const [left] = worldMapPoint([x, 0]);
      ctx.beginPath();
      ctx.moveTo(left * 9.5, 34);
      ctx.lineTo(left * 9.5, size);
      ctx.stroke();
      if (x % 2000 === 0) ctx.fillText(String(x), left * 9.5 + 4, 29);
    }
    for (let z = -4000; z <= 4000; z += 1000) {
      const [, top] = worldMapPoint([0, z]);
      ctx.beginPath();
      ctx.moveTo(45, top * 9.5);
      ctx.lineTo(size, top * 9.5);
      ctx.stroke();
      if (z % 2000 === 0) ctx.fillText(String(-z), 4, top * 9.5 - 3);
    }
    ctx.font = 'bold 27px sans-serif';
    ctx.textAlign = 'center';
    for (const name of chartPlaces[layer]) {
      const place = locations.find(item => compareName(item.name) === compareName(name));
      if (!place?.at) continue;
      const [x, y] = worldMapPoint(place.at);
      ctx.strokeStyle = colors.base;
      ctx.lineWidth = 5;
      const label = journalName(game, name, locale);
      ctx.strokeText(label, x * 9.5, y * 9.5 - 12, 208);
      ctx.fillText(label, x * 9.5, y * 9.5 - 12, 208);
    }
    ctx.textAlign = 'start';
  }, [game, layer, locale, worldItems]);
  return <canvas className="island-chart" ref={canvas} width={950} height={950} aria-hidden="true" />;
}

const defaultCategories: Record<WorldLayer, WorldCategory> = { sky: 'shrine', surface: 'shrine', depths: 'lightroot' };
const rate = (done: number, total: number) => total ? Math.floor(done / total * 100) : 0;
// A close crop of the surface map around each Skyview Tower stands in for a photo of the region.

export function TotkWorldMap({ text, progress, mapTarget, manual, entries: supplied, island = false, onChecklist, onGuide, onScope, onMark, markingDisabled }: {
  text: WorldText;
  progress?: WorldProgress;
  mapTarget?: WorldItem;
  manual: string[];
  entries?: WorldItem[];
  island?: boolean;
  onChecklist: (item: WorldItem) => void;
  onGuide?: (id: string) => void;
  onScope: (island: boolean) => void;
  /** Tick or untick by hand, as the Ocarina map panel does. */
  onMark?: (id: string, checked: boolean) => void;
  markingDisabled?: boolean;
}) {
  const { game, mapped, byId: worldById, layers: worldLayers, categories: worldCategories, regions: worldRegions } = useWorldJournal();
  const entries = supplied ?? mapped;
  const regionArt = useMemo(() => new Map(worldRegions.map(area => [area.id, worldById.get(area.id)?.at])), [worldRegions, worldById]);
  const view = useRef<HTMLDivElement>(null);
  const [mapOnly, toggleMapOnly] = useMapOnlyView(view);
  const panelBelow = useMatches('(max-width: 760px)') && !mapOnly;
  // Shared with the Ocarina map: closing the panel there or here keeps it closed on both.
  const [panelOpen, setPanelOpen] = useStored('map.panel', true);
  const [cardId, setCardId] = useState<string | undefined>(mapTarget?.id);
  const docked = useMatches(DOCKED_CARD);
  const [hudOpen, setHudOpen] = useState(false);
  const [follow, setFollow] = useState(false);
  const [limit, setLimit] = useState(60);
  const toMapPoint = island ? islandMapPoint : worldMapPoint;
  const [pickedLayer, setPickedLayer] = useState<WorldLayer>();
  // One category at a time, as on the Ocarina map. 'all' draws every pin on the layer.
  const [filter, setFilter] = useState<WorldCategory | 'all'>(() => mapTarget?.category ?? defaultCategories[mapTarget?.layer ?? progress?.player?.layer ?? 'surface']);
  const [show, setShow] = useState<MapBadgeStatus>('all');
  const [catsOpen, setCatsOpen] = useStored(game === 'botw' ? 'botw.map.cats' : 'map.cats', true);
  const [selectedId, setSelectedId] = useState(mapTarget?.id);
  const [focusPoint, setFocusPoint] = useState(() => mapTarget?.at && toMapPoint(mapTarget.at));
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState(() => island ? '' : mapTarget?.region ?? '');
  const [hideDone, setHideDone] = useState(false);
  const [artStatus, setArtStatus] = useState<ArtStatus>('loading');
  const layer = island ? 'sky' : pickedLayer ?? mapTarget?.layer ?? progress?.player?.layer ?? 'surface';
  const regionPoint = useMemo(() => {
    const tower = worldById.get(region)?.at;
    return tower && worldMapPoint(tower);
  }, [region, worldById]);
  const layerItems = useMemo(() => entries.filter(item => item.at && item.layer === layer && (!region || item.region === region)), [entries, layer, region]);
  const kinds = useMemo(() => new Set(entries.filter(item => item.at && item.layer === layer).map(item => item.category)), [entries, layer]);
  const searching = search.trim().length > 0;
  const marks = progress?.marks;
  const isDone = (item: WorldItem) => manual.includes(item.id) || marks?.[item.id] === 'done';
  // The category alone, before the status: the drawer counts all, remaining and collected from it.
  const scoped = useMemo(() => layerItems.filter(item => filter === 'all' || item.category === filter), [layerItems, filter]);
  const scopedLeft = scoped.filter(item => !isDone(item)).length;
  // Each region's name on the world map, with what the menu is showing there, as the Ocarina map does.
  const regionNodes = useMemo(() => worldRegions.flatMap(area => {
    const at = worldById.get(area.id)?.at;
    if (!at) return [];
    const items = entries.filter(item => item.at && item.layer === layer && item.region === area.id && (filter === 'all' || item.category === filter));
    const finished = items.filter(item => manual.includes(item.id) || marks?.[item.id] === 'done').length;
    const count = show === 'done' ? finished : show === 'todo' ? items.length - finished : items.length;
    return [{ id: area.id, name: area.name, at, count: items.length && (show === 'all' || count) ? count : undefined,
      countText: show === 'all' ? number(finished) + '/' + number(items.length) : number(count) }];
  }), [entries, layer, filter, show, marks, manual, worldById, worldRegions]);
  const pins = useMemo(() => {
    const shown = (searching ? layerItems.filter(item => matchesWorldItem(item, search, game, text, worldCategories)) : scoped).filter(item => {
      const finished = manual.includes(item.id) || marks?.[item.id] === 'done';
      return item.id === cardId || (show === 'all' || (show === 'done') === finished) && (!hideDone || !finished);
    });
    // The pin with its card open stays on the map whatever the filters say, so a picked item can always be seen.
    const picked = cardId && !shown.some(item => item.id === cardId) ? layerItems.find(item => item.id === cardId) : undefined;
    return picked ? [...shown, picked] : shown;
  }, [layerItems, scoped, searching, search, show, hideDone, marks, manual, cardId, worldCategories, game, text]);
  const selected = pins.find(item => item.id === selectedId);
  const listed = pins.slice(0, limit);
  const player = progress?.player?.layer === layer ? progress.player : undefined;
  const playerPoint = useMemo(() => player?.at && toMapPoint(player.at), [player?.at, toMapPoint]);
  const bounds = island ? islandBounds : worldBounds;
  const done = (item: WorldItem) => manual.includes(item.id) || marks?.[item.id] === 'done';
  // Completion counts what the save or a hand tick can finish, on every layer of the region. Places to visit are only markers.
  const rates = useMemo(() => {
    const byRegion = new Map<string, { done: number; total: number }>();
    for (const item of entries) {
      if (!item.region || isWorldLocation(item)) continue;
      const entry = byRegion.get(item.region) ?? { done: 0, total: 0 };
      entry.total++;
      if (manual.includes(item.id) || marks?.[item.id] === 'done') entry.done++;
      byRegion.set(item.region, entry);
    }
    return byRegion;
  }, [entries, marks, manual]);
  const overall = [...rates.values()].reduce((sum, r) => ({ done: sum.done + r.done, total: sum.total + r.total }), { done: 0, total: 0 });
  const inRegion = !island && region !== '';
  const regionName = journalName(game, worldRegions.find(area => area.id === region)?.name ?? '');
  const openRegion = (id: string) => { setRegion(id); setSelectedId(undefined); setFocusPoint(undefined); setFollow(false); setSearch(''); setLimit(60); };
  const pickLayer = (level: WorldLayer) => {
    setPickedLayer(level); setFilter(defaultCategories[level]); setSelectedId(undefined); setFocusPoint(undefined); setSearch(''); setLimit(60);
  };

  // Escape closes the pin card, as on the Ocarina map.
  useEffect(() => {
    if (!cardId) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setCardId(undefined); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [cardId]);
  // A row picked in the panel: the map centers on its pin and selects it, opening its card, as the Ocarina panel does.
  const selectPin = (item: WorldItem, center: boolean) => {
    setSelectedId(item.id);
    setPanelOpen(true);
    if (center && item.at) {
      setFollow(false);
      setFocusPoint(toMapPoint(item.at));
      setCardId(item.id);
    }
  };

  const panelTitle = text(inRegion ? ['Conclusão da área', 'Area completion'] : ['Progresso de conclusão', 'Completion progress']);
  const selection = selected && <div className="result-detail world-selection" aria-live="polite">
    <h3 className="world-name"><TotkCategoryIcon category={selected.category} seeds={selected.seeds} />{journalName(game, selected.name)}</h3>
    <p>{text(worldCategories[selected.category])} · {worldCoordinates(selected.at!)}</p>
    <ObjectiveNote item={selected} text={text} />
    {selected.seeds === 2 && <p>{text(['Rende duas sementes.', 'Awards two seeds.'])}</p>}
    <p>{text(isWorldLocation(selected) ? ['Localização', 'Location'] : isWorldManual(selected) && !done(selected)
      ? ['Marcação manual', 'Manual tracking'] : markLabels[done(selected) ? 'done' : marks?.[selected.id] ?? 'unknown'])}</p>
    <div className="result-actions">
      {onMark && canTickByHand(selected, marks?.[selected.id] === 'done') && <button className="small-btn" type="button" disabled={markingDisabled}
        onClick={() => onMark(selected.id, !done(selected))}>{text(done(selected) ? ['Desmarcar', 'Uncheck'] : ['Concluí', 'Done'])}</button>}
      <button className="small-btn" type="button" onClick={() => selectPin(selected, true)}>{text(['Centralizar', 'Center marker'])}</button>
      <button className="small-btn" type="button" onClick={() => onChecklist(selected)}>{text(['Ver na checklist', 'Open checklist'])}</button>
      {onGuide && selected.category === 'shrine' && <button className="small-btn" type="button" onClick={() => onGuide(selected.id)}>
        {text(['Passo a passo', 'Walkthrough'])}</button>}
    </div>
  </div>;
  // Same menu as the Ocarina map: closed, a button on the left; open, the status and the categories. A click filters, the next one clears.
  const drawer = <MapCatDrawer open={catsOpen} onOpen={setCatsOpen}
    icon={filter !== 'all' && <TotkCategoryIcon category={filter} fallback />} name={filter !== 'all' ? text(worldCategories[filter]) : undefined}>
    <StatusFilter show={show} onShow={id => { setShow(id); setSelectedId(undefined); }} total={scoped.length} left={scopedLeft} />
    <hr className="map-cats-rule" />
    <div className="side-counters">
      <button type="button" aria-pressed={filter === 'all'} onClick={() => { setFilter('all'); setSelectedId(undefined); setSearch(''); setLimit(60); }}>
        <span className="counter-icon"><Icon name="map" size={18} /></span><span>{text(['Todos os itens', 'All items'])}</span>
        <b>{layerItems.filter(done).length}/{layerItems.length}</b></button>
      {worldSections.flatMap(group => group.categories.filter(kind => kinds.has(kind)).flatMap(kind => {
      const items = layerItems.filter(item => item.category === kind);
      if (!items.length && filter !== kind) return [];
      return [<button type="button" key={kind} aria-pressed={filter === kind} onClick={() => {
        setFilter(filter === kind ? 'all' : kind); setSelectedId(undefined); setSearch(''); setLimit(60);
      }}><span className="counter-icon"><TotkCategoryIcon category={kind} fallback /></span>
        <span>{text(worldCategories[kind])}</span><b>{items.filter(done).length}/{items.length}</b></button>];
    }))}</div>
  </MapCatDrawer>;
  const regionScore = (score: { done: number; total: number } | undefined) => score && <div className="side-score totk-region-score">
    <span>{text(['Conclusão', 'Completion'])} <small>{score.done}/{score.total}</small></span><strong>{rate(score.done, score.total)}%</strong>
  </div>;
  const side = panelOpen ? <aside className="map-side" aria-label={panelTitle}>
    <div className="map-side-head">
      <button className="map-side-collapse" type="button" aria-expanded="true" onClick={() => setPanelOpen(false)}
        aria-label={text(['Recolher painel', 'Collapse panel'])} title={text(['Recolher painel', 'Collapse panel'])}><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4.1 2.2 7.9 6 4.1 9.8" /></svg></button>
      <b>{panelTitle}</b>
    </div>
    {!inRegion && !island ? <div className="map-side-body">
      <div className="side-score"><span className="side-region">{text(['Hyrule', 'Hyrule'])}</span></div>
      {regionScore(overall)}
      {selection}
      <p className="side-sub">{text(['Taxa de conclusão por região', 'Completion by region'])}</p>
      <div className="region-rates">{worldRegions.map(area => {
        const score = rates.get(area.id);
        const art = regionArt.get(area.id);
        const value = score ? rate(score.done, score.total) : 0;
        return <button key={area.id} type="button" className="region-rate totk-region-rate" onClick={() => openRegion(area.id)}>
          {art && <TotkMapCrop layer="surface" at={art} />}
          <span className="rate-name">{journalName(game, area.name)}</span><b>{value}%</b>
          <span className="rate-track"><i style={{ width: `${value}%` }} /></span>
        </button>;
      })}</div>
    </div> : <div className="map-side-body">
      <div className="side-score"><span className="side-region">{regionName || text(['Grande Ilha Celeste', 'Great Sky Island'])}</span></div>
      {regionScore(inRegion ? rates.get(region) : { done: layerItems.filter(done).length, total: layerItems.length })}
      <div className="side-list-head"><h3>{text(['Coletáveis', 'Collectibles'])}</h3><small>{pins.length}</small>
        <label><input type="checkbox" checked={hideDone} onChange={event => setHideDone(event.target.checked)} />{text(['Só pendentes', 'Only remaining'])}</label>
      </div>
      <input className="totk-map-search" type="search" aria-label={text(['Buscar no mapa', 'Search map'])}
        placeholder={text(['Buscar no mapa', 'Search map'])} value={search} onChange={event => { setSearch(event.target.value); setLimit(60); }} />
      {/* A pin picked on the map can sit past the rows shown; its details then stay above the list. */}
      {selected && !listed.some(item => item.id === selected.id) && selection}
      <div className="result-list">{listed.map(item => <Fragment key={item.id}>
        <button type="button" aria-pressed={selected?.id === item.id} aria-expanded={selected?.id === item.id}
          onClick={() => { if (selected?.id === item.id) { setSelectedId(undefined); setCardId(undefined); } else selectPin(item, true); }}>
          <span className={done(item) ? 'story-dot done' : 'story-dot'} aria-hidden="true" /><span>
            <ObjectiveName done={done(item)}>{journalName(game, item.name)}</ObjectiveName><small>{text(worldCategories[item.category])}</small></span>
        </button>
        {selected?.id === item.id && selection}
      </Fragment>)}</div>
      {pins.length > limit && <button type="button" className="small-btn" onClick={() => setLimit(limit + 60)}>{text(['Mostrar mais', 'Show more'])}</button>}
      {!pins.length && <p className="quiet">{text(['Nenhum item para este filtro.', 'No items match this filter.'])}</p>}
    </div>}
  </aside> : <button type="button" className="map-panel-show action" aria-expanded="false" onClick={() => setPanelOpen(true)}>
    <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M7.9 2.2 4.1 6l3.8 3.8" /></svg>{panelTitle}</button>;
  // A pin opens a card beside it on the map, as on the Ocarina region maps. Phones and touch screens dock it to the map's edge.
  // Near the top it starts below the map's options bar, which floats over the map.
  const cardItem = pins.find(item => item.id === cardId);
  const card = cardItem?.at && (() => {
    const [left, top] = toMapPoint(cardItem.at);
    const x = left / 100, y = top / 100;
    // The open panel covers the map's right side, so the card turns to the left sooner.
    const toLeft = x > (panelOpen && !panelBelow ? 0.35 : 0.5);
    const state = isWorldLocation(cardItem) ? undefined : done(cardItem) ? 'done' : marks?.[cardItem.id] === 'found' ? 'found' : 'pending';
    return <div role="dialog" aria-label={journalName(game, cardItem.name)} className={docked ? `marker-card docked ${y > 0.5 ? 'docked-top' : 'docked-bottom'}` : 'marker-card'}
      style={docked ? (y > 0.5 ? { top: 8 } : { bottom: 8 }) : {
        transformOrigin: `${toLeft ? 'right' : 'left'} ${y > 0.5 ? 'bottom' : 'top'}`,
        ...(toLeft ? { right: `calc(${(1 - x) * 100}% + 16px)` } : { left: `calc(${x * 100}% + 16px)` }),
        ...(y > 0.5 ? { bottom: `max(8px, calc(${(1 - y) * 100}% - 40px))` } : { top: `max(72px, calc(${y * 100}% - 40px))` }),
      }}>
      <div className="marker-card-head">
        <span className="marker-kind"><TotkCategoryIcon category={cardItem.category} seeds={cardItem.seeds} />{text(worldCategories[cardItem.category])}</span>
        <button type="button" className="marker-close" aria-label={text(['Fechar', 'Close'])} onClick={() => setCardId(undefined)}>×</button>
      </div>
      <h3><ObjectiveName done={state === 'done'}>{journalName(game, cardItem.name)}</ObjectiveName></h3>
      <small className={`marker-status ${state === 'done' ? 'done' : state ? 'todo' : 'unknown'}`} aria-live="polite">
        {text(state ? markLabels[state] : ['Localização', 'Location'])}</small>
      <ObjectiveNote item={cardItem} text={text} />
      <div className="result-actions">
        {onMark && canTickByHand(cardItem, marks?.[cardItem.id] === 'done') && <button type="button" className="action" disabled={markingDisabled}
          onClick={() => onMark(cardItem.id, !done(cardItem))}>{text(done(cardItem) ? ['Desmarcar', 'Uncheck'] : ['Concluí', 'Done'])}</button>}
        <button type="button" className="small-btn" onClick={() => onChecklist(cardItem)}>{text(['Ver na checklist', 'Open checklist'])}</button>
        {onGuide && cardItem.category === 'shrine' && <button type="button" className="small-btn" onClick={() => onGuide(cardItem.id)}>
          {text(['Passo a passo', 'Walkthrough'])}</button>}
      </div>
    </div>;
  })();
  const overlay = <>
    <MapHud open={hudOpen} onToggle={() => setHudOpen(!hudOpen)}
      where={<>{inRegion && <MapBack onBack={() => openRegion('')} />}<label className="map-region"><span>{text(['Região', 'Region'])}</span>
        <select value={island ? '__island' : region} onChange={event => {
          if (island || event.target.value === '__island') { onScope(!island); return; }
          openRegion(event.target.value);
        }}>
          <option value="">{text(['Mapa de Hyrule', 'Hyrule map'])}</option>
          {game === 'totk' && <option value="__island">{text(['Grande Ilha Celeste', 'Great Sky Island'])}</option>}
          {!island && worldRegions.map(area => <option value={area.id} key={area.id}>{journalName(game, area.name)}</option>)}
        </select></label>
        {game === 'totk' && !island && <label className="map-region map-floor"><span>{text(['Camada', 'Layer'])}</span>
          <select value={layer} onChange={event => pickLayer(event.target.value as WorldLayer)}>
            {Object.entries(worldLayers).map(([level, name]) => <option key={level} value={level}>{text(name)}</option>)}
          </select></label>}</>}
      how={<div className="map-hud-modes">
        <label className="map-switch"><input type="checkbox" checked={follow} disabled={!player} onChange={event => setFollow(event.target.checked)} />
          <span>{text(['Seguir Link', 'Follow Link'])}</span></label>
      </div>} />
    {!panelBelow && drawer}
    {!panelBelow && side}
    {docked && card}
  </>;
  return <div ref={view} className={mapOnly ? 'map-view map-only' : 'map-view'} data-layer={layer}>
    {player && <p className="map-note">{text(['O ponto dourado indica a posição do último save.', 'The gold pin marks your last saved position.'])}</p>}
    <div className={panelOpen ? 'map-stage' : 'map-stage no-panel'}><section className="map-main">
      <ZoomPan key={layer + ':' + region} ratio={(bounds.east - bounds.west) / (bounds.south - bounds.north)}
        focus={follow ? playerPoint : focusPoint ?? regionPoint} overlay={overlay}
        controls={<MapScreenButton on={mapOnly} toggle={toggleMapOnly} />}>
        <TotkMapArt layer={layer} bounds={bounds} baseLevel={island ? 5 : 2}
          fallback={island ? <IslandChart /> : <WorldChart layer={layer} />} onStatus={setArtStatus} />
        {island && (filter === 'all' || filter === 'shrine') && <IslandChart route />}
        {player && <span className="island-player" style={pinAt(player.at, toMapPoint)} role="img"
          aria-label={text(['Posição no último save', 'Position in the last save'])} />}
        {pins.map(item => <button key={item.id} type="button" className="world-pin" style={pinAt(item.at!, toMapPoint)}
          data-mark={done(item) ? 'done' : marks?.[item.id] ?? 'unknown'} data-kind={item.category} aria-label={journalName(game, item.name)}
          aria-pressed={cardId === item.id} title={journalName(game, item.name)} tabIndex={pins.length > 28 && cardId !== item.id ? -1 : undefined}
          onClick={() => setCardId(cardId === item.id ? undefined : item.id)}><TotkCategoryIcon category={item.category} seeds={item.seeds} /></button>)}
        {!inRegion && !island && regionNodes.map(node => {
          const name = journalName(game, node.name);
          const label = [name, node.count != null && node.countText].filter(Boolean).join(' · ');
          return <button key={node.id} type="button" className="map-node totk-map-node" style={pinAt(node.at, worldMapPoint)}
            title={label} aria-label={label} onClick={() => openRegion(node.id)}>
            <span className="map-node-name">{name}</span>
            {node.count != null && <span className="map-counts" aria-hidden="true"><span className="map-count">
              {filter !== 'all' && <TotkCategoryIcon category={filter} />}<b>{node.countText}</b></span></span>}
          </button>;
        })}
        {!docked && card}
      </ZoomPan>
      {panelBelow && drawer}
      {panelBelow && side}
    </section></div>
    <TotkMapCredit status={artStatus} text={text} />
  </div>;
}
