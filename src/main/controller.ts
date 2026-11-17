// App logic for the main process: which folder and slot, reading and evaluating
// saves, manual ticks, snapshots. Sends AppState to the windows.
import fs from 'node:fs';
import path from 'node:path';
import { parseGameData, GameDataFile, GameDataError } from '../gamedata/parser.js';
import { autoDetectUserFolderAsync, detectInFolders, installationLabel, latestUserFolder, resolvePickedFolder, resolveUserFolders, listSlots, mostRecentSlot, readSaveStable, userFolderForExe, SlotInfo } from '../gamedata/saves.js';
import { loadNames } from '../gamedata/names.js';
import { Tracker, ChecklistFile, MappingFile, DescriptionsFile, applyDescriptions } from '../core/tracker.js';
import { regionsForArea } from '../core/areas.js';
import { evaluateLogic, Logic, LogicFile } from '../core/logic.js';
import type { AvailableEntry } from '../shared/types.js';
import { SaveWatcher } from './watcher.js';
import { LiveSource } from './live.js';
import { ChangeLog } from './changelog.js';
import { STAGE_KEY, LOCATION_KEY, areaFrom } from '../gamedata/live.js';
import { keyOf } from '../gamedata/detect.js';
import { SettingsStore } from './settings.js';
import type { Activity, AppState, ChangeRow, Summary, Toast, SlotSummary } from '../shared/types.js';
import { canonicalStage, companionProgress, extendChecklist, RUPEES, type CompanionData } from '../core/companion.js';
import { evaluateAtlas, type AtlasRule } from '../core/atlas.js';
import { locatePlayer, type AtlasPlace, type PlayerPosition } from '../core/position.js';
import type { PlayerState } from '../shared/types.js';

/** caption.sav keys: Link's position (Vector3) and facing (Float, degrees) when the game saved. */
const CAPTION_POSITION = 0x8b26618e, CAPTION_YAW = 0xaccbda17;

/** While no save folder is known, re-check the known game folders after 8 s, 30 s, then every 60 s. */
const POLL_FIRST_MS = 8_000;
const POLL_STEPS_MS = [8_000, 30_000, 60_000];

export interface ControllerPaths {
  appDir: string; // holds data/ (and local/ in development)
  userData: string;
  snapshots: string;
  version: string;
  captureGame?: (pid: number, width?: number) => Promise<string | undefined>;
  /** Tests only: don't look for a running game. */
  noLive?: boolean;
}

export class Controller {
  private tracker: Tracker;
  private names = new Map<number, string>();
  private enumNames = new Map<number, string>();
  private watcher?: SaveWatcher;
  private userDir?: string;
  private refreshId = 0;
  private companionData: CompanionData;
  private atlasItems: AtlasRule[];
  private atlasPlaces: AtlasPlace[];
  /** Link's position in the shown save (caption.sav), for when there's no live position. */
  private savePlayer?: PlayerState;
  private playerListeners = new Set<(p: PlayerState | undefined) => void>();
  private lastActivityStats?: ReturnType<typeof companionProgress>;
  private lastHeartStats?: { hearts: number | null; pieces: number | null };
  private lastSaveImage?: { key: string; value?: string };
  private lastCaptureAt = 0;
  /** last parsed save per slot, for "just collected" and the change list */
  private lastParsed = new Map<string, { mtimeMs: number; data: GameDataFile; buf: Buffer }>();
  /** the save shown last (any slot) */
  private lastShown?: { mtimeMs: number; data: GameDataFile; buf: Buffer };
  private log!: ChangeLog;
  private toastId = 1;
  private toasts: Toast[] = [];
  state: AppState;
  private listeners = new Set<(s: AppState) => void>();

  constructor(readonly paths: ControllerPaths, readonly settings: SettingsStore) {
    const read = (f: string) => JSON.parse(fs.readFileSync(path.join(paths.appDir, 'data', f), 'utf8'));
    // A detailed local checklist (built from your own guide text, never published) wins
    // over the public one; both use the same ids.
    const local = path.join(paths.appDir, 'data', 'checklist.local.json');
    let checklist = (fs.existsSync(local) ? JSON.parse(fs.readFileSync(local, 'utf8')) : read('checklist.json')) as ChecklistFile;
    try { checklist = applyDescriptions(checklist, read('descriptions.json') as DescriptionsFile); } catch (e) { console.error('descriptions', e); }
    this.companionData = read('companion.json') as CompanionData;
    const atlas = read('atlas.json') as { items: AtlasRule[]; places: AtlasPlace[] };
    this.atlasItems = atlas.items;
    this.atlasPlaces = atlas.places;
    const mapping = read('save-mapping.json') as MappingFile;
    extendChecklist(checklist, mapping, this.companionData);
    this.tracker = new Tracker(checklist, mapping, settings.data.learned);
    try { this.logic = read('logic.json') as LogicFile; } catch { this.logic = undefined; }
    this.logicRows = this.tracker.checklist.categories.flatMap(c => c.items.map(i => ({ id: i.id, key: `${c.id}#${i.number}`, chapter: i.chapter })));
    for (const f of [path.join(paths.appDir, 'local', 'names.json'), path.join(paths.userData, 'names.json')]) {
      if (fs.existsSync(f)) { const t = loadNames(f); this.names = t.keys; this.enumNames = t.enums; break; }
    }
    const o = settings.data.overlay;
    this.state = {
      status: 'loading', slots: [], slotMode: 'recent', categories: [], snapshots: [], toasts: [], devPanel: settings.data.devPanel, version: paths.version,
      areaRegions: [],
      available: [],
      canBeAdult: false,
      identify: settings.data.pendingIdentify,
      learnedCount: settings.data.learned.length,
      overlay: { visible: false, locked: o.locked, opacity: o.opacity, mode: o.mode },
      hotkeys: { ...settings.data.hotkeys, errors: [] },
      live: { status: 'off', using: false },
      changeLog: { enabled: settings.data.changeLog, dir: path.join(paths.userData, 'logs') },
      activity: this.loadActivity(),
      captureActivity: settings.data.captureActivity,
      placements: {
        chests: this.companionData.chests, fairy_thoughts: this.companionData.notes,
        scarecrow_spots: this.companionData.scarecrows, grottos: this.companionData.grottos,
      },
    };
    this.log = new ChangeLog(path.join(paths.userData, 'logs'));
    this.log.enabled = settings.data.changeLog;
    this.allRegions = [...new Set(this.tracker.checklist.categories.flatMap(c => c.items.map(i => i.chapter).filter((x): x is string => !!x)))];
  }
  private allRegions: string[];
  private logic?: LogicFile;
  private logicRows: { id: string; key: string; chapter?: string }[] = [];

  /** Attach "can get now" logic to items and build the list, current area first. */
  private applyLogic(categories: AppState['categories'], save: GameDataFile, areaRegions: string[]): { available: AvailableEntry[]; canBeAdult: boolean } {
    if (!this.logic) return { available: [], canBeAdult: false };
    let statuses;
    try { statuses = evaluateLogic(this.logic, save, this.logicRows); } catch (e) { console.error('logic', e); return { available: [], canBeAdult: false }; }
    const L = new Logic(this.logic, save);
    const here = new Set(areaRegions.map(r => L.resolveRegion(r) ?? r));
    const available: AvailableEntry[] = [];
    for (const c of categories) for (const it of c.items) {
      const s = statuses.get(it.id);
      if (!s) continue;
      it.logic = s;
      if (c.part === 'A' && !it.done && s.ages.length) {
        available.push({ id: it.id, categoryId: c.id, categoryLabel: c.label, number: it.number, name: it.name, region: s.region, ages: s.ages, night: s.night, unsure: s.unsure, here: here.has(s.region) });
      }
    }
    available.sort((a, b) => Number(b.here) - Number(a.here) || a.region.localeCompare(b.region));
    return { available, canBeAdult: L.canBeAdult() };
  }

  onState(fn: (s: AppState) => void) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private emit() { for (const fn of this.listeners) fn(this.state); }
  /** Link's position changes (live, up to twice a second), without resending the whole state. */
  onPlayer(fn: (p: PlayerState | undefined) => void) { this.playerListeners.add(fn); return () => this.playerListeners.delete(fn); }

  /** Live position while following the latest save and the game can be read; else the save's. */
  private currentPlayer(): PlayerState | undefined {
    const live = this.settings.data.pinnedSlot ? undefined : this.live?.player();
    if (live) {
      const stage = live.scene ?? this.live?.current()?.data.entries.get(STAGE_KEY)?.value;
      const p = this.locate(typeof stage === 'string' ? stage : undefined, live.pos, 'live');
      if (p) return p;
    }
    return this.savePlayer;
  }

  private locate(scene: string | undefined, pos: PlayerPosition, source: PlayerState['source']): PlayerState | undefined {
    const fix = locatePlayer(scene, pos, this.atlasPlaces);
    return fix ? { source, placeId: fix.placeId, mapId: fix.mapId, at: fix.at, world: fix.world, yaw: fix.yaw, pos: { x: pos.x, y: pos.y, z: pos.z }, scene } : undefined;
  }

  private emitPlayer() {
    const p = this.currentPlayer();
    if (JSON.stringify(p) === JSON.stringify(this.state.player)) return;
    const sourceChanged = p?.source !== this.state.player?.source;
    this.state = { ...this.state, player: p };
    for (const fn of this.playerListeners) fn(p);
    // Live ↔ save changes the connection labels too: resend the whole state (rare).
    if (sourceChanged) this.emit();
  }
  /** Update parts of the state owned by main.ts (overlay, hotkeys). */
  patch(p: Partial<AppState>) { this.state = { ...this.state, ...p }; this.emit(); }

  async start() {
    let dir = this.settings.data.saveDir;
    const saved = !!dir && resolveUserFolders(dir).length > 0;
    // Cheap first: the default install folders. The full drive search runs in the background.
    if (!saved) dir = detectInFolders([]) ?? undefined;
    await this.useFolder(dir, { manual: saved && this.settings.data.manualSaveDir });
    if (!this.userDir) void this.fullScan().then(() => this.schedulePoll());
    // Live reading is always on: it starts tracking as soon as the game is open.
    if (!this.paths.noLive) await this.startLive();
  }

  /** Game folders the last full search found: re-checked cheaply until a save appears. */
  private candidates: string[] = [];
  private scanning?: Promise<void>;
  private pollTimer?: NodeJS.Timeout;
  private pollDelay = POLL_FIRST_MS;
  private stopped = false;

  /** Search every drive (async, once at a time). Uses what it finds unless a folder is already in use. */
  private fullScan(): Promise<void> {
    this.scanning ??= (async () => {
      try {
        const { dir, candidates } = await autoDetectUserFolderAsync();
        this.candidates = candidates;
        if (dir && !this.userDir && !this.stopped) await this.useFolder(dir);
      } catch (e) { console.error('save scan', e); }
    })().finally(() => { this.scanning = undefined; });
    return this.scanning;
  }

  /** While no save folder is known: re-check the known candidates, less and less often (8 s, 30 s, then every 60 s). */
  private schedulePoll() {
    clearTimeout(this.pollTimer);
    this.pollTimer = undefined;
    if (this.userDir || this.stopped) { this.pollDelay = POLL_FIRST_MS; return; }
    this.pollTimer = setTimeout(() => {
      this.pollTimer = undefined;
      if (this.userDir || this.stopped) return;
      const found = detectInFolders(this.candidates);
      this.pollDelay = POLL_STEPS_MS.find(ms => ms > this.pollDelay) ?? POLL_STEPS_MS[POLL_STEPS_MS.length - 1];
      void (found ? this.useFolder(found) : Promise.resolve()).finally(() => this.schedulePoll());
    }, this.pollDelay);
  }

  /** "Find saves": a full search now. */
  async scanFolders() {
    await this.fullScan();
    const found = detectInFolders(this.candidates);
    if (found || !this.userDir) await this.useFolder(found ?? undefined);
    this.schedulePoll();
    return this.state;
  }

  /**
   * A folder picked by hand: the profile folder, a slot_* folder, the game folder or a folder a
   * few levels above the profile. If no save is there, keep the current folder and say so.
   */
  async pickFolder(dir: string) {
    const users = resolvePickedFolder(dir);
    if (!users.length) {
      this.patch({ message: 'No slot_* folder found in {path}. Select the game profile folder.', messageValues: { path: dir } });
      return this.state;
    }
    await this.useFolder(latestUserFolder(users)!, { manual: true });
    return this.state;
  }

  async refreshNow() {
    if (this.userDir) await this.refresh(true, true);
    else await this.scanFolders();
    if (!this.settings.data.pinnedSlot) await this.live?.refreshNow();
  }

  // ---- live (read-only) progress from the running game
  private live?: LiveSource;

  private async startLive() {
    if (this.live) return;
    this.live = new LiveSource({
      // Where the tables were found before, newest first (one per game build, e.g. Hookshot and Longshot).
      hints: [...new Set([...(this.settings.data.live.hints ?? []), this.settings.data.live.hint].filter((h): h is string => !!h))],
      onHint: h => this.settings.update(s => {
        // Keep the older single hint too (settings from before there was a list).
        const prev = [...(s.live.hints ?? []), ...(s.live.hint ? [s.live.hint] : [])];
        s.live.hints = [...new Set([h, ...prev])].slice(0, 4);
        s.live.hint = h;
      }),
      onGame: exe => this.followGame(exe),
      onChange: () => void this.refresh(true),
      onPlayer: () => this.emitPlayer(),
      onStatus: () => {
        const i = this.live?.info;
        if (i && (i.status === 'live') !== this.state.live.using) this.log.write({ kind: 'source', status: i.status, detail: i.detail });
        void this.refresh(false);
      },
    });
    this.live.watchInts = this.watchedInts();
    if (this.lastShownSave) this.live.setReference(this.lastShownSave);
    await this.live.start();
  }


  /** Ints the mapping or logic reads (other Ints, like play time, change all the time). */
  private watchedInts(): Set<number> {
    const out = new Set<number>([RUPEES, ...this.companionData.enemyCounters, ...this.atlasItems.flatMap(item => item.hex32)]);
    for (const k of this.tracker.keyToEntries.keys()) if (typeof k === 'number') out.add(k >>> 0);
    const walk = (x: unknown) => {
      if (Array.isArray(x)) return x.forEach(walk);
      if (x && typeof x === 'object') {
        const o = x as Record<string, unknown>;
        if (typeof o.name === 'string' || typeof o.key === 'string') { try { out.add(keyOf(o as { name?: string; key?: string }) >>> 0); } catch { /* not a rule */ } }
        Object.values(o).forEach(walk);
      }
    };
    walk(this.logic);
    return out;
  }
  /** Newest save read (the live source's reference). */
  private lastShownSave?: GameDataFile;

  /** `manual`: picked by hand, so later automatic searches don't replace it. */
  async useFolder(dir: string | undefined, { manual = false } = {}) {
    const users = dir ? resolveUserFolders(dir) : [];
    if (dir && !users.length && this.userDir) {
      this.patch({ message: 'A pasta escolhida não contém um save compatível.', messageValues: undefined });
      return;
    }
    this.refreshId++;
    this.watcher?.stop();
    this.watcher = undefined;
    this.lastParsed.clear();
    this.lastShownBySlot.clear();
    this.lastShown = undefined;
    this.lastActivityStats = undefined;
    this.lastHeartStats = undefined;
    this.lastSaveImage = undefined;
    this.state.lastChanges = undefined;
    this.lastShownSave = undefined;
    this.live?.setReference(undefined);
    this.userDir = undefined;
    if (!dir) return this.fail('no-folder', 'Nenhuma partida encontrada. Abra o jogo e salve uma vez, ou selecione a pasta do jogo.');
    if (!users.length) return this.fail('no-slots', 'A pasta escolhida não contém um save compatível.');
    // If a game folder holds several profiles, use the most recently played one.
    this.userDir = latestUserFolder(users)!;
    // Found a folder: no more background searching.
    clearTimeout(this.pollTimer);
    this.pollTimer = undefined;
    this.pollDelay = POLL_FIRST_MS;
    if (this.settings.data.saveDir !== this.userDir || !!this.settings.data.manualSaveDir !== manual) this.settings.update(s => {
      if (s.saveDir !== this.userDir) s.pinnedSlot = null;
      s.saveDir = this.userDir;
      s.manualSaveDir = manual || undefined;
    });
    this.watcher = new SaveWatcher(this.userDir, () => void this.refresh(true));
    this.watcher.start();
    await this.refresh(false);
  }

  /**
   * When a game starts, follow its saves: Hookshot, Longshot, NX2navi, ReLink and Fritchii each keep their
   * own. Not while a slot is pinned (that's a choice of save), and only if it has saves.
   */
  private async followGame(exe: string | undefined) {
    // A folder picked by hand is a choice too (like a pinned slot).
    if (!exe || this.settings.data.pinnedSlot || (this.settings.data.manualSaveDir && this.userDir)) return;
    const dir = userFolderForExe(exe);
    if (!dir || path.resolve(dir).toLowerCase() === path.resolve(this.userDir ?? '').toLowerCase()) return;
    const game = path.dirname(exe).replace(/\\bin$/i, '');
    this.log.write({ kind: 'source', status: 'switched', detail: `Following the running game: ${game}` });
    this.toast("Switched to the saves of the game that's running ({game}).", 8000, { game });
    await this.useFolder(dir);
  }

  private fail(status: AppState['status'], message: string, values?: Record<string, string | number>) {
    this.state = { ...this.state, status, message, messageValues: values, saveReadError: false, slots: [], categories: [], summary: undefined, companion: undefined, atlasStatus: undefined,
      saveDir: this.userDir, sourceLabel: undefined, saveImage: undefined };
    this.emit();
  }

  /** Re-read the active slot. `fromWatcher` = a new save was written (enables glow and toasts). */
  async refresh(fromWatcher: boolean, forceRead = false) {
    if (!this.userDir) return;
    const refreshId = ++this.refreshId;
    const slots = listSlots(this.userDir);
    if (!slots.length) return this.fail('no-slots', 'No slot_* folders with a progress.sav in {path}.', { path: this.userDir });
    const pinned = slots.some(s => s.name === this.settings.data.pinnedSlot) ? this.settings.data.pinnedSlot : null;
    const slot: SlotInfo = (pinned && slots.find(s => s.name === pinned)) || mostRecentSlot(slots);

    let read: { mtimeMs: number; data: GameDataFile; buf: Buffer };
    try {
      // Live updates refresh often; don't re-read a save that hasn't changed.
      const cached = forceRead ? undefined : this.lastParsed.get(slot.name);
      read = cached && cached.mtimeMs === slot.mtimeMs ? cached : await readSaveStable(slot.progress);
    } catch (e) {
      if (refreshId !== this.refreshId) return;
      // Keep showing the last good state; just report the problem.
      const error = (e as Error)?.message ?? String(e);
      const [msg, messageValues] = e instanceof GameDataError
        ? ["This save doesn't look like an Ocarina of Time save: {error}", { error }]
        : ["Couldn't read {slot}/progress.sav: {error}", { slot: slot.name, error }];
      this.state = { ...this.state, status: this.state.summary ? 'ok' : 'error', message: msg, messageValues, saveReadError: true };
      this.emit();
      return;
    }
    if (refreshId !== this.refreshId) return;
    const saved = { mtimeMs: read.mtimeMs, data: read.data, buf: read.buf };
    this.lastParsed.set(slot.name, saved);
    // Live data is used only when following the most recent save (it is the game's
    // current state, which a pinned older slot isn't), and only while it matches it.
    if (!pinned) { this.lastShownSave = read.data; this.live?.setReference(read.data); }
    const liveSnap = pinned ? undefined : this.live?.current();
    const cur = liveSnap ? { mtimeMs: liveSnap.atMs, data: liveSnap.data, buf: read.buf } : saved;

    // Compare with the previous state we showed. Autosaves rotate across slots, so when
    // following "most recent" the previous save is usually in a different slot.
    const prev = pinned ? this.lastShownBySlot.get(slot.name) : this.lastShown;
    const isNewSave = !!prev && cur.mtimeMs > prev.mtimeMs;
    // A save from another playthrough loses flags; don't toast, glow or ask about it.
    // (Respawning objects clear their flags again by design; they don't count.)
    const resettable = liveSnap?.resettable;
    const lost = prev ? [...prev.data.bool64].filter(k => !cur.data.bool64.has(k) && !resettable?.has(k)).length : 0;
    const samePlaythrough = isNewSave && lost <= 3;

    // Live: the current stage straight from the game; otherwise the save's caption.
    const liveStage = liveSnap?.data.entries.get(STAGE_KEY)?.value;
    const stageIsLive = typeof liveStage === 'string' && !!liveStage;
    const caption = this.readCaption(slot);
    this.savePlayer = caption.pos && caption.area ? this.locate(caption.area, caption.pos, 'save') : undefined;
    const stage = stageIsLive ? liveStage : caption.area;
    // Lake Hylia and Lon Lon Ranch are inside the Hyrule Field stage; the location list says which.
    const rawArea = stage ? areaFrom(stage, cur.data.entries.get(LOCATION_KEY)?.value) : undefined;
    const areaRegions = regionsForArea(rawArea, this.allRegions);
    // For "which one was it?", also allow the surrounding stage: the place boundaries
    // needn't match the checklist's areas exactly.
    const nearRegions = rawArea !== stage ? [...new Set([...areaRegions, ...regionsForArea(stage, this.allRegions)])] : areaRegions;

    // Where you are only says which spot you just collected when it's read live.
    if (samePlaythrough && fromWatcher) this.collectIdentifications(prev!.data, cur.data, stageIsLive ? nearRegions : undefined);
    const manual = this.manualFor(slot.name);
    const { categories, summary } = this.tracker.evaluate(cur.data, manual, samePlaythrough ? prev!.data : undefined);
    // A place inside the stage has no age of its own: take the stage's (_Child/_Adult).
    const age = rawArea !== stage ? stage?.match(/_(Adult|Child)$/)?.[0] ?? '' : '';
    summary.area = rawArea ? prettyArea(rawArea.split('/').pop()! + age) : undefined;
    const { available, canBeAdult } = this.applyLogic(categories, cur.data, areaRegions);
    summary.lastSavedMs = slot.savedAtMs ?? read.mtimeMs;
    const companion = companionProgress(this.companionData, cur.data);
    const visited = this.settings.data.visited[this.userDir] ?? [];
    const currentStage = canonicalStage(rawArea);
    if (!pinned && currentStage && !visited.includes(currentStage)) {
      visited.push(currentStage);
      this.settings.update(s => (s.visited[this.userDir!] = visited));
    }
    companion.visited = [...new Set([...companion.visited, ...visited])];
    if (forceRead) this.lastSaveImage = undefined;
    const image = this.readSaveImage(slot);

    let lastChanges = this.state.lastChanges;
    if (isNewSave) {
      const rep = this.tracker.describeChanges(prev!.data, cur.data, slot.name, this.names, this.enumNames);
      // Live refreshes often; keep the last report that actually had changes.
      if (rep.known.length || rep.unknown.length || !liveSnap) lastChanges = rep;
      if (samePlaythrough && (rep.known.length || rep.unknown.length)) {
        this.log.write({ kind: 'change', source: liveSnap ? 'live' : 'save', slot: slot.name, area: rawArea, known: rep.known, unknown: rep.unknown, unknownTotal: rep.unknown.length });
      }
      if (fromWatcher && samePlaythrough) this.makeToasts(categories, prev!.data, cur.data);
      if (fromWatcher && samePlaythrough) this.recordActivity(
        companion, summary, rep.known, liveSnap ? 'live' : 'save', liveSnap ? undefined : image,
      );
    }
    this.lastActivityStats = companion;
    this.lastHeartStats = { hearts: summary.hearts, pieces: summary.heartPiecesHeld };
    this.lastShownBySlot.set(slot.name, cur);
    if (!prev || cur.mtimeMs >= prev.mtimeMs || !liveSnap) this.lastShown = cur;

    const warning = read.data.warnings[0];
    this.state = {
      ...this.state,
      status: 'ok',
      message: warning ? 'Save format warning: {warning}' : undefined,
      messageValues: warning ? { warning } : undefined,
      saveReadError: false,
      saveDir: this.userDir,
      sourceLabel: this.state.saveDir === this.userDir ? this.state.sourceLabel : installationLabel(this.userDir),
      slots: slots.map((s): SlotSummary => ({ name: s.name, mtimeMs: s.savedAtMs ?? s.mtimeMs, area: this.readArea(s) })),
      slotMode: pinned ? 'manual' : 'recent',
      activeSlot: slot.name,
      summary, categories, lastChanges, areaRegions, available, canBeAdult,
      companion, saveImage: image, atlasStatus: evaluateAtlas(this.atlasItems, cur.data),
      identify: this.settings.data.pendingIdentify,
      learnedCount: this.settings.data.learned.length,
      snapshots: this.listSnapshots(),
      toasts: this.toasts,
      devPanel: this.settings.data.devPanel,
      live: { ...(this.live?.info ?? { status: 'off' }), using: !!liveSnap },
    };
    this.state.player = this.currentPlayer();
    this.emit();
    for (const fn of this.playerListeners) fn(this.state.player);
  }
  private lastShownBySlot = new Map<string, { mtimeMs: number; data: GameDataFile; buf: Buffer }>();

  private get activityPath() { return path.join(this.paths.userData, 'activity.json'); }
  async captureGame(width?: number) {
    const pid = this.live?.gamePid;
    return pid ? this.paths.captureGame?.(pid, width) : undefined;
  }
  setCaptureActivity(on: boolean) {
    this.settings.update(s => (s.captureActivity = on));
    this.patch({ captureActivity: on });
  }
  private loadActivity(): Activity[] {
    try { const value = JSON.parse(fs.readFileSync(this.activityPath, 'utf8')); return Array.isArray(value) ? value : []; }
    catch { return []; }
  }

  private readSaveImage(slot: SlotInfo): string | undefined {
    const key = `${slot.caption}|${slot.mtimeMs}|${slot.savedAtMs}`;
    if (key === this.lastSaveImage?.key) return this.lastSaveImage.value;
    let value: string | undefined;
    try {
      const caption = parseGameData(fs.readFileSync(slot.caption));
      const data = caption.entries.get(0x63696a32)?.value;
      if (data && typeof data === 'object' && 'bytes' in data && data.bytes.startsWith('ffd8ff') && data.bytes.length < 200_000)
        value = 'data:image/jpeg;base64,' + Buffer.from(data.bytes, 'hex').toString('base64');
    } catch { /* some slots have no photo */ }
    this.lastSaveImage = { key, value };
    return value;
  }

  private recordActivity(current: NonNullable<AppState['companion']>, summary: Summary, changes: ChangeRow[], source: Activity['source'], screenshot?: string) {
    if (!this.settings.data.changeLog || !this.lastActivityStats || !this.lastHeartStats) return;
    const delta = (next: number | null, prev: number | null) => next === null || prev === null ? 0 : Math.max(0, next - prev);
    const enemies = delta(current.enemies, this.lastActivityStats.enemies);
    const rupees = delta(current.rupees, this.lastActivityStats.rupees);
    const hearts = delta(summary.hearts, this.lastHeartStats.hearts);
    const pieces = delta(summary.heartPiecesHeld, this.lastHeartStats.pieces);
    const entries = [...new Set(changes.filter(row => !row.entries?.every(label => label === 'Summary')).flatMap(row => row.entries ?? []))];
    if (!entries.length && !enemies && !rupees && !hearts && !pieces) return;
    const prior = this.state.activity ?? [];
    const event: Activity = { ms: Date.now(), source, area: summary.area, entries, hearts, pieces, enemies, rupees, screenshot };
    const activity = [event, ...prior].slice(0, 500).map((row, i) => i < 16 ? row : { ...row, screenshot: undefined });
    this.state.activity = activity;
    this.persistActivity(activity);
    if (!screenshot && source === 'live' && this.settings.data.captureActivity && (entries.length || hearts || pieces) &&
        event.ms - this.lastCaptureAt > 1200) {
      this.lastCaptureAt = event.ms;
      void this.captureGame(400).then(image => {
        const current = this.state.activity ?? [];
        if (!image || !current.includes(event)) return;
        const next = current.map(row => row === event ? { ...row, screenshot: image } : row);
        this.patch({ activity: next });
        this.persistActivity(next);
      });
    }
  }

  private persistActivity(activity: Activity[]) {
    try {
      fs.mkdirSync(this.paths.userData, { recursive: true });
      fs.writeFileSync(this.activityPath + '.tmp', JSON.stringify(activity));
      fs.renameSync(this.activityPath + '.tmp', this.activityPath);
    } catch (e) { console.error('activity', e); }
  }

  private makeToasts(categories: AppState['categories'], before: GameDataFile, after: GameDataFile) {
    for (const c of categories) {
      const items = c.items.filter(i => i.justCollected);
      if (items.length === 1) this.toast('Collected {item}', 6000, { item: items[0].name });
      if (items.length > 1) this.toast('+{count} · {category}', 6000, { count: items.length, category: c.label });
    }
    // Tokens have no per-Skulltula mapping yet, so toast on the counter too.
    const tok = (g: GameDataFile) => this.tracker.evaluate(g).summary.tokens ?? 0;
    const total = tok(after);
    const count = total - tok(before);
    if (count > 0) this.toast('+{count} · Gold Skulltulas ({total} total)', 6000, { count, total });
  }

  /** Area string from caption.sav, e.g. "Market/Market_Child". */
  private readRawArea(slot: SlotInfo): string | undefined {
    return this.readCaption(slot).area;
  }

  /** caption.sav: the area ("ZoraFountain/ZoraFountain_Child") and Link's position and facing when saved. */
  private readCaption(slot: SlotInfo): { area?: string; pos?: PlayerPosition } {
    try {
      const cap = parseGameData(fs.readFileSync(slot.caption));
      const strs = [...cap.entries.values()].filter(e => e.type === 'String64' && typeof e.value === 'string').map(e => e.value as string);
      const v = cap.entries.get(CAPTION_POSITION)?.value as { x?: unknown; y?: unknown; z?: unknown } | undefined;
      const yaw = cap.entries.get(CAPTION_YAW)?.value;
      const pos = v && typeof v === 'object' && [v.x, v.y, v.z].every(n => typeof n === 'number' && Number.isFinite(n))
        ? { x: v.x as number, y: v.y as number, z: v.z as number, yaw: typeof yaw === 'number' && Number.isFinite(yaw) ? yaw : 0 } : undefined;
      return { area: strs.find(s => s.includes('/')) ?? strs[0], pos };
    } catch { return {}; }
  }

  private readArea(slot: SlotInfo): string | undefined {
    const raw = this.readRawArea(slot);
    return raw ? prettyArea(raw.split('/').pop()!) : undefined;
  }

  // ---- "which one was this?"
  /** New pool flags in this save: learn the obvious ones, queue questions for the rest. */
  private collectIdentifications(before: GameDataFile, after: GameDataFile, here?: string[]) {
    const { ask, auto } = this.tracker.identifications(before, after, here);
    if (!ask.length && !auto.length) return;
    const at = new Date().toISOString();
    this.settings.update(s => {
      for (const g of auto) s.learned.push({ ...g, at });
      for (const q of ask) if (!s.pendingIdentify.some(p => p.id === q.id)) s.pendingIdentify.push({ ...q, at });
    });
    if (auto.length) this.tracker.setLearned(this.settings.data.learned);
    for (const g of auto) this.log.write({ kind: 'identify', how: g.area ? 'auto-area' : 'auto-group', items: g.items, flags: g.flags, area: g.area });
    for (const g of auto) {
      if (!g.area || g.items.length !== 1) continue;
      const d = this.tracker.describe(g.items[0]);
      this.toast('Recognised {category} #{number} in {area}. You can undo it in the item details.', 8000, {
        category: d.category, number: d.number, area: g.area,
      });
    }
    for (const q of ask) this.toast('Identify the items collected in {area}.', 10000, { area: q.area });
  }

  async answerIdentify(reqId: string, itemIds: string[]) {
    const q = this.settings.data.pendingIdentify.find(p => p.id === reqId);
    if (!q || itemIds.length !== q.pick) return;
    this.settings.update(s => {
      s.learned.push({ flags: q.flags, items: itemIds, at: new Date().toISOString() });
      s.pendingIdentify = s.pendingIdentify.filter(p => p.id !== reqId);
      // Other open questions about the same group may now have fewer candidates.
      for (const p of s.pendingIdentify) {
        p.candidates = p.candidates.filter(c => !itemIds.includes(c.id));
        if (p.others) p.others = p.others.filter(c => !itemIds.includes(c.id));
      }
    });
    this.tracker.setLearned(this.settings.data.learned);
    this.log.write({ kind: 'identify', how: 'answer', items: itemIds, flags: q.flags, area: q.area });
    await this.refresh(false);
  }

  async skipIdentify(reqId: string) {
    const q = this.settings.data.pendingIdentify.find(p => p.id === reqId);
    if (q) this.log.write({ kind: 'identify', how: 'skip', items: [], flags: q.flags, area: q.area });
    this.settings.update(s => (s.pendingIdentify = s.pendingIdentify.filter(p => p.id !== reqId)));
    await this.refresh(false);
  }

  /** Undo an answer that included this row (its flags go back into the group). */
  async forgetIdentification(itemId: string) {
    for (const g of this.settings.data.learned) if (g.items.includes(itemId)) this.log.write({ kind: 'identify', how: 'undo', items: g.items, flags: g.flags, area: g.area });
    this.settings.update(s => (s.learned = s.learned.filter(g => !g.items.includes(itemId))));
    this.tracker.setLearned(this.settings.data.learned);
    await this.refresh(false);
  }

  /** Development: write answered spots into data/save-mapping.json as confirmed entries. */
  exportLearned(): string {
    const file = path.join(this.paths.appDir, 'data', 'save-mapping.json');
    const m = JSON.parse(fs.readFileSync(file, 'utf8')) as MappingFile;
    let n = 0;
    for (const g of this.settings.data.learned) {
      if (g.items.length !== 1) continue; // only exact answers
      const id = g.items[0];
      m.entries[id] = g.area
        ? { label: m.entries[id]?.label ?? id, detect: { b64: g.flags[0] }, confidence: 'likely', evidence: `Recognised in the tracker from the area (${g.area})${g.at ? ` on ${g.at.slice(0, 10)}` : ''}: collecting it set 64-bit flag ${g.flags[0]}` }
        : { label: m.entries[id]?.label ?? id, detect: { b64: g.flags[0] }, confidence: 'confirmed', evidence: `Identified in the tracker${g.at ? ` on ${g.at.slice(0, 10)}` : ''}: collecting it set 64-bit flag ${g.flags[0]}` };
      n++;
    }
    fs.writeFileSync(file, JSON.stringify(m, null, 2) + '\n');
    return `Wrote ${n} identified spot${n === 1 ? '' : 's'} into data/save-mapping.json`;
  }

  private toast(text: string, ms: number, values: Record<string, string | number>) {
    const t = { id: this.toastId++, text, values };
    this.toasts = [...this.toasts, t].slice(-5);
    setTimeout(() => { this.toasts = this.toasts.filter(x => x.id !== t.id); this.state = { ...this.state, toasts: this.toasts }; this.emit(); }, ms);
  }

  // ---- user actions
  async pinSlot(name: string | null) {
    this.settings.update(s => (s.pinnedSlot = name));
    await this.refresh(false);
  }

  private manualKey(slot: string) { return `${this.userDir}|${this.settings.data.pinnedSlot ? slot : '@recent'}`; }
  private manualFor(slot: string) { return this.settings.data.manual[this.manualKey(slot)] ?? {}; }

  async toggleManual(itemId: string) {
    const slot = this.state.activeSlot;
    if (!slot) return;
    this.settings.update(s => {
      const k = this.manualKey(slot);
      const m = (s.manual[k] ??= {});
      if (m[itemId]) delete m[itemId]; else m[itemId] = true;
    });
    this.log.write({ kind: 'manual', item: itemId, ticked: !!this.manualFor(slot)[itemId], slot });
    await this.refresh(false);
  }

  setChangeLog(on: boolean) {
    this.settings.update(s => (s.changeLog = on));
    this.log.enabled = on;
    this.state = { ...this.state, changeLog: { ...this.state.changeLog, enabled: on } };
    this.emit();
  }

  /** Folder holding the change logs (created if missing). */
  logDir() { fs.mkdirSync(this.log.dir, { recursive: true }); return this.log.dir; }

  setDevPanel(on: boolean) {
    this.settings.update(s => (s.devPanel = on));
    this.state = { ...this.state, devPanel: on };
    this.emit();
  }

  // ---- snapshots (development aid for mapping)
  private listSnapshots() {
    try {
      return fs.readdirSync(this.paths.snapshots).filter(f => f.endsWith('.sav')).sort().reverse().slice(0, 30)
        .map(file => ({ file, label: file.replace(/\.sav$/, '') }));
    } catch { return []; }
  }

  async takeSnapshot(label: string) {
    const slot = this.state.activeSlot;
    const cur = slot && this.lastParsed.get(slot);
    if (!slot || !cur || !this.userDir) return;
    // Re-read so the snapshot is exactly what is on disk now.
    const info = listSlots(this.userDir).find(s => s.name === slot);
    if (!info) {
      // The slot vanished (deleted, or the game is rewriting it): report it, don't throw.
      this.patch({ message: '{slot} is no longer in the save folder.', messageValues: { slot } });
      return;
    }
    let read: { buf: Buffer; data: GameDataFile };
    try { read = await readSaveStable(info.progress); } catch (e) {
      this.patch({ message: "Couldn't read {slot}/progress.sav: {error}", messageValues: { slot, error: (e as Error)?.message ?? String(e) } });
      return;
    }
    const { buf, data } = read;
    fs.mkdirSync(this.paths.snapshots, { recursive: true });
    const prevFile = this.listSnapshots()[0]?.file;
    const d = new Date();
    const p2 = (n: number) => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
    const safe = (label || 'snap').replace(/[^\w.-]+/g, '-').slice(0, 60);
    const file = `${stamp}-${slot}-${safe}.sav`;
    fs.writeFileSync(path.join(this.paths.snapshots, file), buf);
    let snapshotDiff = this.state.snapshotDiff;
    if (prevFile) {
      const prev = parseGameData(fs.readFileSync(path.join(this.paths.snapshots, prevFile)));
      const rep = this.tracker.describeChanges(prev, data, slot, this.names, this.enumNames);
      snapshotDiff = { from: prevFile, to: file, rows: [...rep.known, ...rep.unknown] };
    }
    this.state = { ...this.state, snapshots: this.listSnapshots(), snapshotDiff };
    this.emit();
  }

  stop() { this.stopped = true; clearTimeout(this.pollTimer); this.watcher?.stop(); this.live?.stop(); }
}


/** "Market_Child" -> "Market (child)", "HyruleField_Adult" -> "Hyrule Field (adult)" */
export function prettyArea(s: string): string {
  const m = s.match(/^(.*?)(?:_(Adult|Child))?$/)!;
  const base = m[1].replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
  return m[2] ? `${base} (${m[2].toLowerCase()})` : base;
}
