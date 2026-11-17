// Finding save folders and reading saves safely. No Electron imports.
// Saves are only ever read. A read is accepted only when the file looks complete
// (magic matches, size is stable across the read, and the parser accepts it).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseGameData, GameDataFile, MAGIC } from './parser.js';

export interface SlotInfo {
  name: string; // "slot_03"
  dir: string;
  progress: string;
  caption: string;
  mtimeMs: number; // progress.sav modified time
  savedAtMs?: number; // wall-clock time recorded by the game
}

/** A user folder holds slot_* dirs: <...>\save\<32-hex user id>\ */
export function isUserFolder(dir: string): boolean {
  try {
    return fs.readdirSync(dir).some(n => /^slot_\d+$/.test(n) && fs.existsSync(path.join(dir, n, 'progress.sav')));
  } catch { return false; }
}

/**
 * Given a game folder, a "save" folder, or a user folder, return the user folders inside.
 * Also an emulator's data folder (or any folder down to the account one): see emulatorUserFolders.
 */
export function resolveUserFolders(start: string): string[] {
  if (!fs.existsSync(start)) return [];
  if (isUserFolder(start)) return [start];
  if (/^slot_\d+$/i.test(path.basename(start)) && isUserFolder(path.dirname(start))) return [path.dirname(start)];
  const tries = [start, path.join(start, 'save'), path.join(start, 'user', 'save')];
  const out: string[] = [];
  for (const t of tries) {
    for (const n of readdir(t)) {
      const p = path.join(t, n);
      if (/^[0-9a-f]{32}$/i.test(n) && isUserFolder(p)) out.push(p);
    }
  }
  out.push(...emulatorUserFolders(start));
  return [...new Set(out)];
}

function readdir(dir: string): string[] {
  try { return fs.readdirSync(dir); } catch { return []; }
}

/** Ocarina of Time's title id: emulators keep its saves in a folder named after it. */
export const OOT_TITLE_ID = '0400486024DEC000';

/**
 * Emulators keep saves as <data>\nand\user\save\0000000000000000\<32-hex account>\<title id>\slot_*
 * (<data> is e.g. %APPDATA%\fritchii, or a portable "user" folder next to the exe). Only
 * Ocarina of Time's title folder counts: other games' saves can look alike.
 */
function emulatorUserFolders(start: string): string[] {
  const out: string[] = [];
  const saveDirs = [start, path.join(start, 'save'), path.join(start, 'nand', 'user', 'save'), path.join(start, 'user', 'nand', 'user', 'save')];
  const accountDirs = [...saveDirs, ...saveDirs.map(d => path.join(d, '0000000000000000'))];
  for (const a of accountDirs) {
    const accounts = /^[0-9a-f]{32}$/i.test(path.basename(a)) ? [a] : readdir(a).filter(n => /^[0-9a-f]{32}$/i.test(n)).map(n => path.join(a, n));
    for (const acc of accounts) {
      const title = readdir(acc).find(n => n.toUpperCase() === OOT_TITLE_ID);
      if (title && isUserFolder(path.join(acc, title))) out.push(path.join(acc, title));
    }
  }
  return out;
}

/** Emulator exes, and the data folders (under %APPDATA%) they keep saves in. Fritchii runs as lichii.exe. */
export const EMULATOR_EXES = ['fritchii.exe', 'lichii.exe'];
const EMULATOR_DIRS = ['fritchii', 'lichii', 'eden', 'orchid', 'eglantine', 'pokedinner'];
function emulatorDataDirs(appData = process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming')): string[] {
  return EMULATOR_DIRS.map(n => path.join(appData, n));
}

export const NATIVE_EXES = ['Triforce.exe', 'hookshot.exe', 'Longshot.exe', 'nx2navi.exe', 'relink-game.exe',
  'ocarina-reborn-game.exe', 'ocarina-reborn.exe', 'OcarinaReborn.exe'];
const GAME_NAMES = /zelda|ocarina|hookshot|longshot|triforce|nx2navi|relink|fritchii|lichii|eden|orchid|eglantine|pokedinner/i;
const GAME_FILES = new Set([...NATIVE_EXES, ...EMULATOR_EXES, 'ReLink.exe'].map(n => n.toLowerCase()));
const installations: Record<string, string> = {
  fritchii: 'Fritchii', lichii: 'Lichii', eden: 'Eden', orchid: 'Orchid', eglantine: 'Eglantine',
  pokedinner: 'PokeDinner', triforce: 'Triforce', longshot: 'Longshot', hookshot: 'Hookshot',
  nx2navi: 'NX2navi', 'ocarina reborn': 'Ocarina Reborn', 'ocarina-reborn': 'Ocarina Reborn',
  ocarinareborn: 'Ocarina Reborn', relink: 'ReLink', 'relink-game': 'ReLink',
};
export function installationLabel(saveDir: string): string | undefined {
  const dirs: string[] = [];
  for (let dir = saveDir; dir !== path.dirname(dir) && dirs.length < 9; dir = path.dirname(dir)) dirs.push(dir);
  for (const dir of dirs) {
    const name = installations[path.basename(dir).toLowerCase()];
    if (name) return name;
    if (/^(save|user|nand|[0-9a-f]{16,32})$/i.test(path.basename(dir))) continue;
    const game = readdir(dir).find(name => GAME_FILES.has(name.toLowerCase()));
    if (game) return installations[path.basename(game, '.exe').toLowerCase().replace(/\.exe$/, '')];
  }
}
const SEARCH_GROUPS = /^(apps?|programs?|games?|jogos|emulators?|emuladores|downloads|desktop|documents|gamesbuilds?|builds?|ports?|steamapps|common|quiverlauncher)$/i;

function configPaths(base: string, file: string, keys: string[]): string[] {
  try {
    const config = JSON.parse(fs.readFileSync(path.join(base, file), 'utf8').replace(/^\uFEFF/, ''));
    const values = [config, ...(Array.isArray(config.builds) ? config.builds : [])];
    return values.flatMap(value => keys.map(key => value?.[key]))
      .filter((value): value is string => typeof value === 'string' && path.isAbsolute(value));
  } catch { return []; }
}

function baseDirs() {
  const home = os.homedir();
  const roaming = process.env.APPDATA ?? path.join(home, 'AppData', 'Roaming');
  const local = process.env.LOCALAPPDATA ?? path.join(home, 'AppData', 'Local');
  const storage = [roaming, local, path.join(local, 'Programs'), path.join(home, 'Games')];
  return { home, roaming, local, storage };
}

/** Install folders the ports and emulators use by default, or that launcher config points to. Cheap: no directory walk. */
export function knownGameFolders(): string[] {
  const { roaming, local, storage } = baseDirs();
  const native = ['Hookshot', 'Longshot', 'Triforce', 'NX2navi', 'Ocarina Reborn', 'OcarinaReborn', 'ReLink'];
  return [...emulatorDataDirs(roaming), ...emulatorDataDirs(local),
    ...storage.flatMap(base => native.map(name => path.join(base, name))),
    ...configPaths(local, 'Ocarina Reborn/Config/settings.json', ['game_dir']),
    ...configPaths(local, 'Ocarina Reborn/Config/build-state.json', ['dest']),
    ...configPaths(local, 'LongshotLauncher/builds.json', ['folder']),
    ...configPaths(local, 'LongshotLauncher/settings.json', ['buildsFolder']),
    ...configPaths(local, 'ReLink/install.json', ['Out'])];
}

interface DirEntry { name: string; isFile(): boolean; isDirectory(): boolean }
const DRIVE_LETTERS = Array.from('CDEFGHIJKLMNOPQRSTUVWXYZ', letter => letter + ':\\');
const SCAN_LIMIT = 2500;
const scanRoots = (home: string, storage: string[], volumes: string[]) =>
  [...volumes, home, ...storage, path.join(home, 'Downloads'), path.join(home, 'Desktop'), path.join(home, 'Documents')];
/** Holds a game exe, a portable "user" folder, or a save/nand folder under a game-like name. */
const looksLikeGame = (dir: string, entries: DirEntry[]) =>
  entries.some(e => e.isFile() && GAME_FILES.has(e.name.toLowerCase())) ||
  entries.some(e => e.isDirectory() && e.name.toLowerCase() === 'user') ||
  (GAME_NAMES.test(path.basename(dir)) && entries.some(e => e.isDirectory() && /^(save|nand)$/i.test(e.name)));
/** Sub-folders worth descending into (game-like names, library groupings). */
const subdirsToScan = (entries: DirEntry[], depth: number, library: boolean) => entries.flatMap(entry => {
  if (!entry.isDirectory()) return [];
  const named = GAME_NAMES.test(entry.name);
  const grouping = SEARCH_GROUPS.test(entry.name);
  return named || grouping || (library && depth >= 2 && !entry.name.startsWith('.')) ? [{ name: entry.name, library: named || grouping }] : [];
});
const topLevel = (names: string[]) => names.filter(n => !n.startsWith('.') && !n.startsWith('$'));

/** Look in launcher config, standard data directories and shallow game-library layouts (synchronous; CLI). */
export function candidateGameFolders(): string[] {
  const { home, storage } = baseDirs();
  const volumes = process.platform === 'win32' ? DRIVE_LETTERS.filter(root => fs.existsSync(root)) : [];
  const found = new Set(knownGameFolders());
  const inspected = new Set<string>();
  function scan(dir: string, depth: number, library: boolean) {
    const key = dir.toLowerCase();
    if (inspected.has(key) || inspected.size >= SCAN_LIMIT) return;
    inspected.add(key);
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    if (looksLikeGame(dir, entries)) found.add(dir);
    if (!depth) return;
    for (const sub of subdirsToScan(entries, depth, library)) scan(path.join(dir, sub.name), depth - 1, sub.library);
  }
  for (const root of scanRoots(home, storage, volumes)) scan(root, 4, SEARCH_GROUPS.test(path.basename(root)));
  // Ports can choose the installation folder's name freely. Check top-level folders on
  // secondary drives for recognizable binaries or a portable user/save layout.
  for (const root of volumes.filter(dir => !/^c:/i.test(dir))) {
    for (const name of topLevel(readdir(root))) scan(path.join(root, name), 1, false);
  }
  return [...found];
}

/** The same search as candidateGameFolders without blocking the main process (fs.promises). */
export async function candidateGameFoldersAsync(): Promise<string[]> {
  const { home, storage } = baseDirs();
  const exists = (p: string) => fs.promises.access(p).then(() => true, () => false);
  const volumes = process.platform === 'win32'
    ? (await Promise.all(DRIVE_LETTERS.map(async root => (await exists(root)) ? root : null))).filter((r): r is string => !!r)
    : [];
  const found = new Set(knownGameFolders());
  const inspected = new Set<string>();
  async function scan(dir: string, depth: number, library: boolean): Promise<void> {
    const key = dir.toLowerCase();
    if (inspected.has(key) || inspected.size >= SCAN_LIMIT) return;
    inspected.add(key);
    let entries: fs.Dirent[];
    try { entries = await fs.promises.readdir(dir, { withFileTypes: true }); } catch { return; }
    if (looksLikeGame(dir, entries)) found.add(dir);
    if (!depth) return;
    for (const sub of subdirsToScan(entries, depth, library)) await scan(path.join(dir, sub.name), depth - 1, sub.library);
  }
  for (const root of scanRoots(home, storage, volumes)) await scan(root, 4, SEARCH_GROUPS.test(path.basename(root)));
  for (const root of volumes.filter(dir => !/^c:/i.test(dir))) {
    let names: string[] = [];
    try { names = await fs.promises.readdir(root); } catch { /* drive not ready */ }
    for (const name of topLevel(names)) await scan(path.join(root, name), 1, false);
  }
  return [...found];
}

/**
 * A folder the user picked by hand: the profile folder, a slot_* folder, the game or
 * emulator folder, or any folder up to a few levels above a profile folder. Returns the
 * profile folders found (empty if none).
 */
export function resolvePickedFolder(dir: string, maxDepth = 2): string[] {
  const direct = resolveUserFolders(dir);
  if (direct.length) return direct;
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  let level = [dir];
  let visited = 0;
  for (let depth = 0; depth < maxDepth && level.length && !out.length; depth++) {
    const next: string[] = [];
    for (const d of level) {
      let entries: fs.Dirent[];
      try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { continue; }
      for (const e of entries) {
        if (!e.isDirectory() || e.name.startsWith('.') || e.name.startsWith('$') || /^slot_\d+$/i.test(e.name)) continue;
        if (++visited > 200) return [...new Set(out)];
        const p = path.join(d, e.name);
        // Each folder may itself be a game, save or profile folder (resolveUserFolders knows the layouts).
        const found = resolveUserFolders(p);
        if (found.length) out.push(...found);
        else next.push(p);
      }
    }
    level = next;
  }
  return [...new Set(out)];
}

/**
 * The save folder of the install a running game exe belongs to (exe at the top of the
 * game folder or in bin\), the most recently played profile if there are several. For an
 * emulator: its portable "user" folder next to the exe, or its data folder.
 */
export function userFolderForExe(exe: string, appData?: string): string | null {
  let dir = path.dirname(exe);
  if (path.basename(dir).toLowerCase() === 'bin') dir = path.dirname(dir);
  const image = path.basename(exe).toLowerCase();
  const priority = /fritchii/i.test(exe) ? 'fritchii' : /lichii/i.test(exe) ? 'lichii' : undefined;
  const emulatorRoots = emulatorDataDirs(appData);
  const portable = latestUserFolder(resolveUserFolders(dir));
  if (portable) return portable;
  if (EMULATOR_EXES.includes(image)) {
    const preferred = emulatorRoots.find(root => path.basename(root) === priority);
    return (preferred && latestUserFolder(resolveUserFolders(preferred))) ||
      latestUserFolder(emulatorRoots.flatMap(resolveUserFolders));
  }
  const roaming = appData ?? process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming');
  const brand = /longshot/i.test(exe) ? 'Longshot' : /ocarina[ -]?reborn/i.test(exe) ? 'Ocarina Reborn' :
    /hookshot/i.test(dir) ? 'Hookshot' : undefined;
  return brand ? latestUserFolder(resolveUserFolders(path.join(roaming, brand))) : null;
}

/** The save folder with the most recent save across every install found. */
export function autoDetectUserFolder(): string | null {
  const all = candidateGameFolders().flatMap(g => resolveUserFolders(g));
  return latestUserFolder(all);
}

/**
 * Full search across drives without blocking (run once at start and when asked). Returns
 * the best save folder and the game folders found, for cheap re-checks later.
 */
export async function autoDetectUserFolderAsync(): Promise<{ dir: string | null; candidates: string[] }> {
  const candidates = await candidateGameFoldersAsync();
  return { dir: latestUserFolder(candidates.flatMap(g => resolveUserFolders(g))), candidates };
}

/** Cheap re-check: only these folders and the default install locations, no drive walk. */
export function detectInFolders(candidates: string[]): string | null {
  return latestUserFolder([...new Set([...candidates, ...knownGameFolders()])].flatMap(g => resolveUserFolders(g)));
}

export function latestUserFolder(folders: string[]): string | null {
  return [...new Set(folders)].map(dir => {
    const slot = mostRecentSlot(listSlots(dir));
    return { dir, time: slot?.savedAtMs ?? slot?.mtimeMs ?? 0 };
  }).sort((a, b) => b.time - a.time)[0]?.dir ?? null;
}

export function listSlots(userDir: string): SlotInfo[] {
  let names: string[] = [];
  try { names = fs.readdirSync(userDir).filter(n => /^slot_\d+$/.test(n)).sort(); } catch { return []; }
  const out: SlotInfo[] = [];
  for (const name of names) {
    const dir = path.join(userDir, name);
    const progress = path.join(dir, 'progress.sav');
    try {
      const st = fs.statSync(progress);
      const caption = path.join(dir, 'caption.sav');
      out.push({ name, dir, progress, caption, mtimeMs: st.mtimeMs, savedAtMs: readSaveTime(caption) });
    } catch { /* slot without progress.sav */ }
  }
  return out;
}

export const mostRecentSlot = (slots: SlotInfo[]) => [...slots].sort((a, b) =>
  (b.savedAtMs ?? b.mtimeMs) - (a.savedAtMs ?? a.mtimeMs) || b.mtimeMs - a.mtimeMs || a.name.localeCompare(b.name))[0];

const TIME_FIELDS = [0x9811a3f7, 0xdfd840d3, 0xbd46f485, 0x23f3d75e, 0x27853bf7, 0x5ee50bed];

export function readSaveTime(caption: string): number | undefined {
  try {
    // Only the caption's record table is needed, not the embedded screenshot.
    const table = Buffer.alloc(0x2a0);
    const fd = fs.openSync(caption, 'r');
    let count: number;
    try { count = fs.readSync(fd, table, 0, table.length, 0); } finally { fs.closeSync(fd); }
    if (count !== table.length || table.readUInt32LE(0) !== MAGIC || table.readUInt32LE(8) !== table.length) return;
    const values = new Map<number, number>();
    for (let i = 0x28; i < table.length; i += 8) values.set(table.readUInt32LE(i), table.readUInt32LE(i + 4));
    const [year, month, day, hour, minute, sec = 0] = TIME_FIELDS.map(k => values.get(k));
    if (year === undefined || month === undefined || day === undefined || hour === undefined || minute === undefined) return;
    const date = new Date(year, month - 1, day, hour, minute, sec);
    if (year >= 1980 && year <= 2107 && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day &&
        date.getHours() === hour && date.getMinutes() === minute && date.getSeconds() === sec) return date.getTime();
  } catch { /* legacy or currently being saved */ }
}

export class IncompleteSaveError extends Error {}

/**
 * Read a save without risking a half-written file: read it into memory, check the
 * size didn't change while reading, check the magic, and parse. Retries a few times.
 */
export async function readSaveStable(file: string, { attempts = 5, delayMs = 300 } = {}): Promise<{ buf: Buffer; data: GameDataFile; mtimeMs: number }> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const before = fs.statSync(file);
      const buf = fs.readFileSync(file); // read-only: fs.readFileSync opens with flag 'r'
      const after = fs.statSync(file);
      if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || buf.length !== after.size)
        throw new IncompleteSaveError('File changed while reading');
      if (buf.length < 0x28 || buf.readUInt32LE(0) !== MAGIC) throw new IncompleteSaveError('Bad magic (file may be mid-write)');
      return { buf, data: parseGameData(buf), mtimeMs: after.mtimeMs };
    } catch (e) {
      // Missing file or folder: retrying won't bring it back, fail right away.
      const code = (e as NodeJS.ErrnoException)?.code;
      if (code === 'ENOENT' || code === 'ENOTDIR' || code === 'EISDIR') throw e;
      lastErr = e;
      if (i < attempts - 1) await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}
