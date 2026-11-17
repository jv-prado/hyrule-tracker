import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { companionProgress, extendChecklist, type CompanionData } from '../src/core/companion.js';
import { evaluateAtlas } from '../src/core/atlas.js';
import { Tracker } from '../src/core/tracker.js';
import { murmur3 } from '../src/gamedata/murmur3.js';
import type { GameDataFile, Value } from '../src/gamedata/parser.js';
import { Controller } from '../src/main/controller.js';
import { SettingsStore } from '../src/main/settings.js';

const load = (file: string) => JSON.parse(readFileSync(new URL('../data/' + file, import.meta.url), 'utf8'));
const data: CompanionData = load('companion.json');
const save: GameDataFile = { version: 0x2d80eb, dataStart: 0, size: 0, entries: new Map(), bool64: new Set(), warnings: [] };
function entry(key: number | string, value: Value) {
  const hash = typeof key === 'number' ? key : murmur3(key);
  save.entries.set(hash, { hash, value, type: typeof value === 'boolean' ? 'Bool' : 'Int', recordOffset: 0 });
}

describe('expanded remake coverage', () => {
  it('includes the fixed save inventories and identifies located flags', () => {
    expect([data.statues.length, data.rematches.length, data.chests.length, data.notes.length, data.scarecrows.length]).toEqual([84, 25, 206, 23, 16]);
    expect(data.rematches.every(r => r.actor && r.completed)).toBe(true);
    expect(new Set(data.chests.map(chest => chest.hash)).size).toBe(206);
    expect(data.chests.filter(chest => chest.stage).length).toBeGreaterThanOrEqual(190);
  });

  it('reads quest, enemy rematch, treasure and fairy milestones from the same save', () => {
    const checklist = load('checklist.json');
    const map = load('save-mapping.json');
    extendChecklist(checklist, map, data);
    const tracker = new Tracker(checklist, map);
    entry('Step_SubEvent_GetMelodySun', murmur3('Complete'));
    const g = data.rematches.find(r => r.actor === 'Enemy_DungeonBoss_Gohma')!;
    entry(g.completed!, true);
    entry(g.timeKeys.find(k => k.field === murmur3('BestTimeFrame'))!.key, 1234);
    entry(data.chests[0].hash, true);
    entry(data.notes[0].hash, true);
    const result = tracker.evaluate(save);
    const category = (id: string) => result.categories.find(c => c.id === id)!;
    expect(category('side_quests').total).toBe(7);
    expect(category('side_quests').items.at(-1)?.done).toBe(true);
    expect(category('rematches').done).toBe(1);
    expect(category('chests').done).toBe(1);
    expect(category('fairy_thoughts').done).toBe(1);
    expect(companionProgress(data, save).rematches.find(r => r.id.endsWith(g.actor!))?.frames).toBe(1234);
  });

  it('separates verified, missing and unknown map markers', () => {
    const local: GameDataFile = { ...save, entries: new Map(), bool64: new Set([5n]) };
    expect(evaluateAtlas([
      { id: 'collected', hex32: [], hex64: ['0x5'] },
      { id: 'pending', hex32: [], hex64: ['0x6'] },
      { id: 'unmapped', hex32: [7], hex64: [] },
    ], local)).toEqual({ collected: 'done', pending: 'todo', unmapped: 'unknown' });
  });

  it('keeps the Great Fairy quest open until all six fountains are visited', () => {
    const checklist = load('checklist.json');
    const map = load('save-mapping.json');
    extendChecklist(checklist, map, data);
    const tracker = new Tracker(checklist, map);
    const key = murmur3('Step_Meet_GreatFairy');
    const blessing = murmur3('IsGet.Item_DinFire');
    const local: GameDataFile = { ...save, entries: new Map([
      [key, { hash: key, type: 'Enum', value: murmur3('GoToHyruleCastle'), recordOffset: 0 }],
      [blessing, { hash: blessing, type: 'Bool', value: true, recordOffset: 0 }],
    ]) };
    const { categories } = tracker.evaluate(local);
    const quest = (s: GameDataFile) => tracker.evaluate(s).categories.find(c => c.id === 'side_quests')?.items.find(i => i.id === 'side_quests.to_the_great_fairy')?.done;
    expect(quest(local)).toBe(false);
    expect(categories.find(c => c.id === 'great_fairies')).toMatchObject({ done: 1, total: 6 });
    for (const flag of ['IsGet.Item_FairyBless_MP', 'IsGet.Item_FaroreWind', 'IsGet.Item_FairyBless_MPDouble', 'IsGet.Item_NayruLove', 'IsGet.Item_FairyBless_DefenseDouble']) {
      const k = murmur3(flag);
      local.entries.set(k, { hash: k, type: 'Bool', value: true, recordOffset: 0 });
    }
    expect(tracker.evaluate(local).categories.find(c => c.id === 'great_fairies')).toMatchObject({ done: 6, total: 6 });
    expect(quest(local)).toBe(true);
  });

  it('counts sold masks independently of the full quest completion flag', () => {
    const key = murmur3('Step_SubEvent_MaskSalesman');
    const local: GameDataFile = { ...save, entries: new Map() };
    for (const [step, sold] of [['Step01_Hint', 0], ['Step02', 1], ['Step03_Hint', 1], ['Step05', 2], ['Step07', 3], ['Step08', 4], ['Complete', 4]] as const) {
      local.entries.set(key, { hash: key, type: 'Enum', value: murmur3(step), recordOffset: 0 });
      expect(companionProgress(data, local)).toMatchObject({ maskSales: sold });
    }
    local.entries.clear();
    expect(companionProgress(data, local)).toMatchObject({ maskSales: null });
    const mask = murmur3('IsGet.Armor_Child_Mask_Skull');
    local.entries.set(mask, { hash: mask, type: 'Bool', value: true, recordOffset: 0 });
    expect(companionProgress(data, local)).toMatchObject({ maskSales: 1 });
  });

  it('reads minigame victories and keeps unobservable prizes available for manual tracking', () => {
    const checklist = load('checklist.json');
    const map = load('save-mapping.json');
    extendChecklist(checklist, map, data);
    const tracker = new Tracker(checklist, map);
    const local: GameDataFile = { ...save, entries: new Map() };
    for (const [name, value] of [
      ['MiniGame_BombchuBowling_ClearFirstTime', true],
      ['MiniGame_BombchuBowling_ClearSecondTime', false],
      ['MiniGame_HorsebackArchery_BestScore', 900],
      ['MiniGame_HorseBackArchery_Get_Quiver', false],
      ['GraveYard_DiggingHoleTour_Drop_HeartPiece', true],
      ['MiniGame_DampeRace_ClearCount', 1],
      ['UnderTheGrave_DampeRace_HeartGeted', false],
    ] as const) {
      const hash = murmur3(name);
      local.entries.set(hash, { hash, value, type: typeof value === 'boolean' ? 'Bool' : 'Int', recordOffset: 0 });
    }
    const results = tracker.evaluate(local).categories.find(c => c.id === 'minigames')!.items;
    const state = (id: string) => results.find(i => i.id === 'minigames.' + id)?.state;
    expect(state('bowling_first')).toBe('yes');
    expect(state('bowling_second')).toBe('no');
    expect(state('archery_750')).toBe('yes');
    expect(state('archery_1400')).toBe('no');
    expect(state('dampe_dig')).toBe('yes');
    expect(state('dampe_race_win')).toBe('yes');
    expect(state('dampe_race')).toBe('no');
    expect(state('shooting_child_expert')).toBe('unmapped');
    expect(companionProgress(data, local).minigameScores.archery_750).toBe(900);
  });

  it('refreshes the selected save even when its disk timestamp is unchanged', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hyrule-refresh-'));
    const slot = join(dir, 'slot_00');
    mkdirSync(slot);
    const progress = join(slot, 'progress.sav');
    const stamp = new Date('2026-11-16T20:00:00Z');
    const writeHearts = (hearts: number) => {
      const data = Buffer.alloc(0x38);
      data.writeUInt32LE(0x01020304, 0);
      data.writeUInt32LE(0x002d80eb, 4);
      data.writeUInt32LE(data.length, 8);
      data.writeUInt32LE(2, 0x2c); // Int section
      data.writeUInt32LE(murmur3('PlayerStatus.MaxLife'), 0x30);
      data.writeUInt32LE(hearts * 4, 0x34);
      writeFileSync(progress, data);
      utimesSync(progress, stamp, stamp);
    };
    const settings = new SettingsStore(join(dir, 'settings.json'));
    settings.data.saveDir = dir;
    const appDir = fileURLToPath(new URL('..', import.meta.url));
    const controller = new Controller({ appDir, userData: dir, snapshots: join(dir, 'snapshots'), version: 'test', noLive: true }, settings);
    try {
      writeHearts(7);
      await controller.start();
      expect(controller.state.summary?.hearts).toBe(7);
      const sideQuests = controller.state.categories.find(c => c.id === 'side_quests')?.items;
      expect(sideQuests).toHaveLength(7);
      expect(sideQuests?.every(i => i.where)).toBe(true);
      writeHearts(8);
      await controller.refresh(false);
      expect(controller.state.summary?.hearts).toBe(7);
      await controller.refreshNow();
      expect(controller.state.summary?.hearts).toBe(8);
      expect(controller.state.saveReadError).toBe(false);
      controller.stop(); // Exercise the forced reads without a concurrent save watcher.
      writeFileSync(progress, Buffer.alloc(0x38));
      await controller.refreshNow();
      expect(controller.state.summary?.hearts).toBe(8);
      expect(controller.state.saveReadError).toBe(true);
      writeHearts(9);
      await controller.refreshNow();
      expect(controller.state.summary?.hearts).toBe(9);
      expect(controller.state.saveReadError).toBe(false);
    } finally {
      controller.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('Big Poes', () => {
  it('reads the Poe Collector points and marks every field spot once all ten are sold', () => {
    const checklist = load('checklist.json');
    const map = load('save-mapping.json');
    extendChecklist(checklist, map, data);
    const tracker = new Tracker(checklist, map);
    // Tester save: all ten sold, HyruleField_Defeat_BigPoe_* flags false.
    const coupons = murmur3('GhostShop_CouponNum');
    const local: GameDataFile = { ...save, entries: new Map([[coupons, { hash: coupons, type: 'Int', value: 1000, recordOffset: 0 }]]) };
    for (let i = 1; i <= 10; i++) {
      const k = murmur3('HyruleField_Defeat_BigPoe_' + String(i).padStart(2, '0'));
      local.entries.set(k, { hash: k, type: 'Bool', value: false, recordOffset: 0 });
    }
    const { categories } = tracker.evaluate(local);
    expect(categories.find(c => c.id === 'big_poes')).toMatchObject({ done: 10, total: 10 });
    expect(categories.find(c => c.id === 'big_poe_spots')).toMatchObject({ done: 10, total: 10 });
  });
});
