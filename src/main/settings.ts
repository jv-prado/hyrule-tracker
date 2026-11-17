// Settings live in <userData>/settings.json. Written atomically (temp file + rename).
import fs from 'node:fs';
import path from 'node:path';
import type { UiPrefs, IdentifyRequest, OverlayMode } from '../shared/types.js';
import type { LearnedGroup } from '../core/pools.js';

export interface OverlaySettings {
  bounds?: { x: number; y: number; width: number; height: number };
  opacity: number;
  locked: boolean;
  mode: OverlayMode;
}

export interface Settings {
  saveDir?: string;
  /** The save folder was picked by hand: don't replace it with an automatic scan. */
  manualSaveDir?: boolean;
  /** Language last chosen in the app (for the few texts main shows itself, like dialogs). */
  locale?: 'pt-BR' | 'en-US' | 'es-ES';
  /** null = follow the most recently saved slot */
  pinnedSlot: string | null;
  /** manual ticks: "<userDir>|<slot>" -> item id -> true */
  manual: Record<string, Record<string, boolean>>;
  ui: UiPrefs;
  devPanel: boolean;
  mainBounds?: { x: number; y: number; width: number; height: number };
  overlay: OverlaySettings;
  hotkeys: { toggleOverlay: string; lockOverlay: string };
  /** Answers to "which one was this?": flags -> checklist rows. Game facts, so not per slot. */
  learned: LearnedGroup[];
  /** Questions not answered yet (kept across restarts) */
  pendingIdentify: IdentifyRequest[];
  /**
   * Live reading (always on while a Hookshot, Longshot, NX2navi, ReLink or Fritchii game runs; read-only).
   * hint = last table address, hints = the last few.
   */
  live: { hint?: string; hints?: string[] };
  /** Keep a local log of every tracked change (logs/changes-YYYY-MM.jsonl). */
  changeLog: boolean;
  captureActivity: boolean;
  visited: Record<string, string[]>;
}

export const DEFAULTS: Settings = {
  pinnedSlot: null,
  manual: {},
  ui: { hideCollected: false, hiddenCategories: [], collapsed: [], showParts: { B: true, C: false } },
  devPanel: false,
  overlay: { opacity: 0.85, locked: true, mode: 'counters' },
  hotkeys: { toggleOverlay: 'Control+Shift+O', lockOverlay: 'Control+Shift+L' },
  learned: [],
  pendingIdentify: [],
  live: {},
  changeLog: true,
  captureActivity: true,
  visited: {},
};

/**
 * Older versions used ids like "gold_skulltulas.055_<description>"; they are
 * now "gold_skulltulas.055". Rewrites hand ticks, identified spots and open questions.
 * Returns true if anything changed.
 */
export function migrateIds(s: Settings): boolean {
  const re = /^(gold_skulltulas|heart_pieces)\.(\d{3})_.+$/;
  const fix = (id: string) => id.replace(re, '$1.$2');
  let changed = false;
  for (const [slot, ticks] of Object.entries(s.manual ?? {})) {
    const next: Record<string, boolean> = {};
    for (const [id, v] of Object.entries(ticks)) { const n = fix(id); if (n !== id) changed = true; next[n] = v; }
    s.manual[slot] = next;
  }
  for (const g of s.learned ?? []) g.items = g.items.map(id => { const n = fix(id); if (n !== id) changed = true; return n; });
  for (const q of s.pendingIdentify ?? []) for (const c of q.candidates) { const n = fix(c.id); if (n !== c.id) { changed = true; c.id = n; } }
  return changed;
}

export class SettingsStore {
  data: Settings;
  constructor(private file: string) {
    this.data = structuredClone(DEFAULTS);
    try {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      this.data = { ...this.data, ...raw, ui: { ...DEFAULTS.ui, ...raw.ui }, overlay: { ...DEFAULTS.overlay, ...raw.overlay }, hotkeys: { ...DEFAULTS.hotkeys, ...raw.hotkeys }, live: { ...DEFAULTS.live, ...raw.live } };
      if (migrateIds(this.data)) this.save();
    } catch { /* first run or unreadable: use defaults */ }
  }
  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }
  update(fn: (s: Settings) => void) { fn(this.data); this.save(); }
}
