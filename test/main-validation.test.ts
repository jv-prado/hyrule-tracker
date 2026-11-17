import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, afterAll } from 'vitest';
import { regionsForArea } from '../src/core/areas.js';
import { readSaveStable, resolvePickedFolder } from '../src/gamedata/saves.js';
import { boundsVisible, cleanBounds, isLocale, isPlainObject, parseHotkeys, parseOverlayPatch, sanitizeUiPrefs } from '../src/main/validate.js';
import type { UiPrefs } from '../src/shared/types.js';

describe('regionsForArea', () => {
  const regions = ['Hyrule Field', 'Kokiri Forest', 'Lost Woods'];
  it('gives nothing for an area that normalizes to empty', () => {
    expect(regionsForArea('_Child', regions)).toEqual([]);
    expect(regionsForArea('Stage/123', regions)).toEqual([]);
    expect(regionsForArea('', regions)).toEqual([]);
  });
  it('ignores Object.prototype keys', () => {
    expect(regionsForArea('constructor', regions)).toEqual([]);
  });
  it('still uses aliases and prefixes', () => {
    expect(regionsForArea('HyruleField/HyruleField_Adult', regions)).toEqual(['Hyrule Field', 'Hyrule Field (near Gerudo Valley)']);
    expect(regionsForArea('KokiriForest_Child', regions)).toEqual(['Kokiri Forest']);
  });
});

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ht-validate-'));
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe('readSaveStable', () => {
  it('fails fast when the file does not exist', async () => {
    const started = Date.now();
    await expect(readSaveStable(path.join(root, 'missing.sav'), { attempts: 5, delayMs: 500 })).rejects.toMatchObject({ code: 'ENOENT' });
    expect(Date.now() - started).toBeLessThan(400);
  });
});

describe('resolvePickedFolder', () => {
  const PROFILE = '0123456789abcdef0123456789abcdef';
  const profile = path.join(root, 'Games', 'MyPort', 'user', 'save', PROFILE);
  fs.mkdirSync(path.join(profile, 'slot_00'), { recursive: true });
  fs.writeFileSync(path.join(profile, 'slot_00', 'progress.sav'), '');
  it('accepts the profile folder, a slot folder, or the game folder', () => {
    expect(resolvePickedFolder(profile)).toEqual([profile]);
    expect(resolvePickedFolder(path.join(profile, 'slot_00'))).toEqual([profile]);
    expect(resolvePickedFolder(path.join(root, 'Games', 'MyPort'))).toEqual([profile]);
  });
  it('searches a few levels down from a parent folder', () => {
    expect(resolvePickedFolder(path.join(root, 'Games', 'MyPort', 'user'))).toEqual([profile]);
    expect(resolvePickedFolder(path.join(root, 'Games'))).toEqual([profile]);
  });
  it('finds nothing in an unrelated folder', () => {
    const empty = path.join(root, 'empty');
    fs.mkdirSync(empty, { recursive: true });
    expect(resolvePickedFolder(empty)).toEqual([]);
    expect(resolvePickedFolder(path.join(root, 'nope'))).toEqual([]);
  });
});

describe('IPC validation', () => {
  const ui: UiPrefs = { hideCollected: false, hiddenCategories: [], collapsed: [], showParts: { B: true, C: false } };
  it('accepts only plain objects', () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject('x')).toBe(false);
    expect(isPlainObject(new Date())).toBe(false);
  });
  it('merges UI prefs and drops bad fields', () => {
    expect(sanitizeUiPrefs('nope', ui)).toBeNull();
    expect(sanitizeUiPrefs({ hideCollected: true, collapsed: ['a', 3], showParts: { C: true } }, ui))
      .toEqual({ hideCollected: true, hiddenCategories: [], collapsed: ['a'], showParts: { B: true, C: true } });
    expect(sanitizeUiPrefs({ hideCollected: 'yes', hiddenCategories: 'x' }, ui)).toEqual(ui);
  });
  it('checks overlay mode and clamps opacity', () => {
    expect(parseOverlayPatch({ opacity: 5, mode: 'available' })).toEqual({ opacity: 1, mode: 'available' });
    expect(parseOverlayPatch({ opacity: 0, mode: 'evil' })).toEqual({ opacity: 0.2 });
    expect(parseOverlayPatch({ opacity: NaN })).toEqual({});
    expect(parseOverlayPatch({ opacity: '0.5' })).toEqual({});
    expect(parseOverlayPatch(null)).toEqual({});
  });
  it('checks hotkeys before trimming', () => {
    expect(parseHotkeys({ toggleOverlay: ' Control+O ', lockOverlay: '' })).toEqual({ toggleOverlay: 'Control+O', lockOverlay: '' });
    expect(parseHotkeys({ toggleOverlay: 1, lockOverlay: 'x' })).toBeNull();
    expect(parseHotkeys(undefined)).toBeNull();
  });
  it('knows the app languages', () => {
    expect(isLocale('pt-BR')).toBe(true);
    expect(isLocale('fr-FR')).toBe(false);
    expect(isLocale(1)).toBe(false);
  });
});

describe('restored window bounds', () => {
  const screens = [{ x: 0, y: 0, width: 1920, height: 1040 }];
  it('rejects malformed bounds', () => {
    expect(cleanBounds(undefined)).toBeUndefined();
    expect(cleanBounds({ x: 0, y: 0, width: 'a', height: 10 })).toBeUndefined();
    expect(cleanBounds({ x: 0, y: 0, width: 10, height: 10 })).toBeUndefined();
    expect(cleanBounds({ x: 1.4, y: 2, width: 800, height: 600 })).toEqual({ x: 1, y: 2, width: 800, height: 600 });
  });
  it('keeps windows on a display and drops ones off screen', () => {
    expect(boundsVisible({ x: 100, y: 100, width: 800, height: 600 }, screens)).toBe(true);
    expect(boundsVisible({ x: 2500, y: 100, width: 800, height: 600 }, screens)).toBe(false); // monitor unplugged
    expect(boundsVisible({ x: 100, y: -590, width: 800, height: 600 }, screens)).toBe(false); // title bar above the screen
    expect(boundsVisible({ x: 1880, y: 100, width: 800, height: 600 }, screens)).toBe(false); // only 40 px visible
  });
});
