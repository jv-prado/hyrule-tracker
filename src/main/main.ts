// Electron entry point.
import { app, BrowserWindow, ipcMain, dialog, shell, Menu, globalShortcut, screen, desktopCapturer } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { Controller } from './controller.js';
import type { OverlayMode, UpdateState } from '../shared/types.js';
import { createUpdater } from './updater.js';
import { SettingsStore } from './settings.js';
import { boundsVisible, cleanBounds, isLocale, isString, isStringArray, parseHotkeys, parseOverlayPatch, sanitizeUiPrefs, type MainLocale, type Rect } from './validate.js';

const isDev = !app.isPackaged;
const appDir = app.getAppPath();

// Development/testing only: run against a scratch settings folder and save folder.
if (isDev && process.env.OOT_USER_DATA) app.setPath('userData', process.env.OOT_USER_DATA);

// Only one tracker at a time; a second launch focuses the first and exits right away
// (before it creates settings, windows or hotkeys).
const primaryInstance = app.requestSingleInstanceLock();
if (!primaryInstance) app.exit(0);

let main: BrowserWindow | null = null;
let controller: Controller;
let settings: SettingsStore;
let updater: ReturnType<typeof createUpdater> | null = null; // only in the installed app

function rendererUrl(page: string, query = '') {
  const dev = process.env.VITE_DEV_SERVER_URL;
  if (dev) return `${dev}${page}${query}`;
  const url = pathToFileURL(path.join(appDir, 'dist', page));
  url.search = query;
  return url.href;
}

/** The few texts main shows itself (the windows translate everything else). */
const DIALOG_TEXT: Record<MainLocale, { dataBroken: string; pickFolder: string }> = {
  'pt-BR': {
    dataBroken: 'Os arquivos de dados do tracker (data/checklist.json, data/save-mapping.json) estão ausentes ou corrompidos.',
    pickFolder: 'Selecione a pasta de saves do jogo',
  },
  'en-US': {
    dataBroken: "The tracker's data files (data/checklist.json, data/save-mapping.json) are missing or broken.",
    pickFolder: "Select the game's save folder",
  },
  'es-ES': {
    dataBroken: 'Faltan o están dañados los archivos de datos del tracker (data/checklist.json, data/save-mapping.json).',
    pickFolder: 'Selecciona la carpeta de partidas del juego',
  },
};
const dialogText = () => DIALOG_TEXT[isLocale(settings?.data.locale) ? settings.data.locale! : 'en-US'];

/** Saved bounds, if they still land on a connected display (monitors change); else undefined. */
function restoredBounds(saved: unknown): Rect | undefined {
  const b = cleanBounds(saved);
  if (!b) return undefined;
  try {
    const match = screen.getDisplayMatching(b);
    const areas = [match, ...screen.getAllDisplays()].filter(Boolean).map(d => d.workArea);
    return boundsVisible(b, areas) ? b : undefined;
  } catch { return undefined; }
}

/** Windows only show the app's own pages: no navigating away, ever. */
function lockNavigation(win: BrowserWindow) {
  win.webContents.on('will-navigate', e => e.preventDefault());
}

function createMain() {
  const b = restoredBounds(settings.data.mainBounds);
  main = new BrowserWindow({
    width: b?.width ?? 1280, height: b?.height ?? 900, x: b?.x, y: b?.y,
    minWidth: 640, minHeight: 480,
    backgroundColor: '#0e0e0f',
    title: 'Hyrule Tracker',
    icon: path.join(appDir, 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(appDir, 'dist-electron', 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  Menu.setApplicationMenu(null);
  void main.loadURL(rendererUrl('index.html'));
  const saveBounds = () => { if (main && !main.isMinimized() && !main.isMaximized()) settings.update(s => (s.mainBounds = main!.getBounds())); };
  main.on('resize', debounce(saveBounds, 500));
  main.on('move', debounce(saveBounds, 500));
  // Closing the main window quits the app, overlay included (a hidden overlay window
  // would otherwise keep it running in the background).
  main.on('closed', () => { main = null; overlay?.destroy(); app.quit(); });
  // Links open in the browser, never inside the app.
  main.webContents.setWindowOpenHandler(({ url }) => {
    let target: URL;
    try { target = new URL(url); } catch { return { action: 'deny' }; }
    if (target.protocol === 'https:' && ['nintendoeverything.com', 'www.nintendo.com', 'zelda.mtwildwood.net'].includes(target.hostname)) void shell.openExternal(target.href);
    return { action: 'deny' };
  });
  lockNavigation(main);
  if (isDev && process.env.OOT_DEVTOOLS) main.webContents.openDevTools({ mode: 'detach' });
}

// ---------------- Overlay ----------------
let overlay: BrowserWindow | null = null;

function createOverlay() {
  const o = settings.data.overlay;
  const wa = screen.getPrimaryDisplay().workArea;
  const b = restoredBounds(o.bounds) ?? { width: 360, height: 420, x: wa.x + wa.width - 380, y: wa.y + 40 };
  overlay = new BrowserWindow({
    ...b,
    minWidth: 220, minHeight: 90,
    frame: false, transparent: true, backgroundColor: '#00000000', hasShadow: false,
    alwaysOnTop: true, skipTaskbar: true, resizable: true, focusable: !o.locked, show: false,
    title: 'Hyrule Tracker overlay',
    webPreferences: { preload: path.join(appDir, 'dist-electron', 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  overlay.setAlwaysOnTop(true, 'screen-saver'); // stays above borderless-fullscreen games
  overlay.setVisibleOnAllWorkspaces(true);
  overlay.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  lockNavigation(overlay);
  void overlay.loadURL(rendererUrl('index.html', '?overlay=1'));
  const save = () => { if (overlay) settings.update(s => (s.overlay.bounds = overlay!.getBounds())); };
  overlay.on('move', debounce(save, 400));
  overlay.on('resize', debounce(save, 400));
  overlay.on('closed', () => { overlay = null; publishOverlay(false); });
  overlay.once('ready-to-show', () => { applyOverlaySettings(); overlay?.showInactive(); });
}

function applyOverlaySettings() {
  if (!overlay) return;
  const o = settings.data.overlay;
  overlay.setOpacity(o.opacity);
  // Locked: clicks pass through to the game. Unlocked: drag/resize it.
  overlay.setIgnoreMouseEvents(o.locked, { forward: true });
  overlay.setFocusable(!o.locked);
  overlay.setResizable(!o.locked);
}

function publishOverlay(visible = !!overlay?.isVisible()) {
  const o = settings.data.overlay;
  controller.patch({ overlay: { visible, locked: o.locked, opacity: o.opacity, mode: o.mode } });
}

function toggleOverlay() {
  if (overlay?.isVisible()) overlay.hide();
  else if (overlay) { applyOverlaySettings(); overlay.showInactive(); }
  else createOverlay();
  setTimeout(() => publishOverlay(), 50);
}

function toggleOverlayLock() {
  settings.update(s => (s.overlay.locked = !s.overlay.locked));
  applyOverlaySettings();
  if (overlay && !settings.data.overlay.locked && !overlay.isVisible()) overlay.showInactive();
  publishOverlay();
}

function registerHotkeys() {
  globalShortcut.unregisterAll();
  const errors: string[] = [];
  const hk = settings.data.hotkeys;
  for (const [accel, fn, what] of [[hk.toggleOverlay, toggleOverlay, 'show/hide overlay'], [hk.lockOverlay, toggleOverlayLock, 'lock/unlock overlay']] as const) {
    if (!accel) continue;
    try {
      if (!globalShortcut.register(accel, fn)) errors.push(`${accel} (${what}) is already used by another program`);
    } catch {
      errors.push(`"${accel}" isn't a valid shortcut`);
    }
  }
  controller.patch({ hotkeys: { ...hk, errors } });
}

function debounce<T extends (...a: never[]) => void>(fn: T, ms: number) {
  let t: NodeJS.Timeout | undefined;
  return (...a: Parameters<T>) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

// Never crash on an unexpected error: log it and keep running.
const logFile = () => path.join(app.getPath('userData'), 'error.log');
function logError(where: string, e: unknown) {
  const line = `[${new Date().toISOString()}] ${where}: ${e instanceof Error ? e.stack ?? e.message : String(e)}\n`;
  try { fs.appendFileSync(logFile(), line); } catch { /* ignore */ }
  console.error(line);
}

/** GetWindowThreadProcessId from user32.dll, loaded once. */
let windowOwner: Promise<(hwnd: bigint, pid: number[]) => number> | undefined;
function getWindowOwner() {
  windowOwner ??= import('koffi').then(({ default: koffi }) =>
    koffi.load('user32.dll').func('uint32_t __stdcall GetWindowThreadProcessId(uint64_t hwnd, _Out_ uint32_t *pid)'));
  windowOwner.catch(() => { windowOwner = undefined; }); // try again next time
  return windowOwner;
}

async function captureGame(pid: number, width = 960): Promise<string | undefined> {
  if (!pid || process.platform !== 'win32') return;
  try {
    const owner = await getWindowOwner();
    const sources = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width, height: Math.round(width * 9 / 16) }, fetchWindowIcons: false });
    for (const source of sources) {
      const hwnd = /^window:(\d+):/.exec(source.id)?.[1];
      if (!hwnd || source.thumbnail.isEmpty()) continue;
      const result = [0];
      owner(BigInt(hwnd), result);
      if (result[0] === pid) return 'data:image/jpeg;base64,' + source.thumbnail.toJPEG(75).toString('base64');
    }
  } catch (err) { console.error('game capture', err); }
}
process.on('uncaughtException', e => logError('uncaughtException', e));
process.on('unhandledRejection', e => logError('unhandledRejection', e));

app.on('second-instance', () => { if (main) { if (main.isMinimized()) main.restore(); main.focus(); } });

/** The app was renamed (formerly "OoT 100 Tracker"): carry settings, names and snapshots over once. */
function migrateOldUserData() {
  const now = app.getPath('userData');
  const old = path.join(app.getPath('appData'), 'OoT 100 Tracker');
  if (fs.existsSync(path.join(now, 'settings.json')) || !fs.existsSync(path.join(old, 'settings.json'))) return;
  try {
    fs.mkdirSync(now, { recursive: true });
    for (const f of ['settings.json', 'names.json']) if (fs.existsSync(path.join(old, f))) fs.copyFileSync(path.join(old, f), path.join(now, f));
    if (fs.existsSync(path.join(old, 'snapshots'))) fs.cpSync(path.join(old, 'snapshots'), path.join(now, 'snapshots'), { recursive: true });
  } catch (e) { logError('migrate old settings', e); }
}

// ---------------- Auto-update (GitHub Releases) ----------------
function startUpdater() {
  if (isDev) return; // nothing to update when running from source
  void import('electron-updater').then(({ autoUpdater }) => {
    const log = (...a: unknown[]) => console.log(...a);
    autoUpdater.logger = { info: log, warn: log, error: log, debug: () => {} } as typeof autoUpdater.logger;
    updater = createUpdater({
      autoUpdater,
      log,
      notify: (s: UpdateState) => { for (const w of BrowserWindow.getAllWindows()) w.webContents.send('update', s); },
    });
    updater.start();
  }).catch(e => console.log('update unavailable', e)); // without electron-updater the app runs normally
}

if (primaryInstance) app.whenReady().then(async () => {
  if (!process.env.OOT_USER_DATA) migrateOldUserData();
  settings = new SettingsStore(path.join(app.getPath('userData'), 'settings.json'));
  try {
    controller = new Controller({
      appDir,
      userData: app.getPath('userData'),
      snapshots: isDev ? path.join(appDir, 'fixtures', 'snapshots') : path.join(app.getPath('userData'), 'snapshots'),
      version: app.getVersion(),
      captureGame,
    }, settings);
  } catch (e) {
    logError('startup', e);
    dialog.showErrorBox('Hyrule Tracker', `${dialogText().dataBroken}\n\n${(e as Error).message}`);
    app.quit();
    return;
  }

  // Development: share the locally built key-name table with the packaged app (stays on this PC).
  if (isDev) {
    const src = path.join(appDir, 'local', 'names.json');
    const dst = path.join(app.getPath('userData'), 'names.json');
    try {
      if (fs.existsSync(src) && (!fs.existsSync(dst) || fs.statSync(src).mtimeMs > fs.statSync(dst).mtimeMs)) fs.copyFileSync(src, dst);
    } catch (e) { logError('copy names', e); }
  }
  controller.onState(s => {
    for (const w of BrowserWindow.getAllWindows()) w.webContents.send('state', s);
  });
  controller.onPlayer(p => {
    for (const w of BrowserWindow.getAllWindows()) w.webContents.send('player', p ?? null);
  });

  ipcMain.handle('state:get', () => controller.state);
  ipcMain.handle('update:get', () => updater?.getState() ?? { status: 'idle' });
  ipcMain.on('update:now', () => { void updater?.download(); });
  ipcMain.on('update:later', () => updater?.later());
  ipcMain.on('update:install', () => updater?.install());
  ipcMain.handle('prefs:get', () => settings.data.ui);
  // Everything from the windows is checked before use (cheap type guards; bad input is ignored).
  ipcMain.handle('locale:set', (_e, locale: unknown) => {
    if (!isLocale(locale)) return;
    if (settings.data.locale !== locale) settings.update(s => (s.locale = locale));
    for (const w of BrowserWindow.getAllWindows()) w.webContents.send('locale', locale);
  });
  ipcMain.handle('prefs:set', (_e, ui: unknown) => {
    const next = sanitizeUiPrefs(ui, settings.data.ui);
    if (next) settings.update(s => (s.ui = next));
    return settings.data.ui;
  });
  ipcMain.handle('slot:pin', (_e, name: unknown) => (name === null || isString(name, 100)) ? controller.pinSlot(name) : undefined);
  ipcMain.handle('manual:toggle', (_e, id: unknown) => isString(id) ? controller.toggleManual(id) : undefined);
  ipcMain.handle('dev:set', (_e, on: unknown) => controller.setDevPanel(on === true));
  ipcMain.handle('capture:get', () => controller.captureGame());
  ipcMain.handle('capture:set', (_e, on: unknown) => controller.setCaptureActivity(on === true));
  ipcMain.handle('log:set', (_e, on: unknown) => controller.setChangeLog(on === true));
  ipcMain.handle('log:open', () => shell.openPath(controller.logDir()));
  ipcMain.handle('snapshot:take', (_e, label: unknown) => controller.takeSnapshot(isString(label, 200) ? label : ''));
  ipcMain.handle('snapshot:open-folder', () => shell.openPath(controller.paths.snapshots));
  ipcMain.handle('identify:answer', (_e, reqId: unknown, itemIds: unknown) =>
    isString(reqId) && isStringArray(itemIds) ? controller.answerIdentify(reqId, itemIds) : undefined);
  ipcMain.handle('identify:skip', (_e, reqId: unknown) => isString(reqId) ? controller.skipIdentify(reqId) : undefined);
  ipcMain.handle('identify:forget', (_e, itemId: unknown) => isString(itemId) ? controller.forgetIdentification(itemId) : undefined);
  ipcMain.handle('identify:export', () => (isDev ? controller.exportLearned() : 'Only available when running from source'));
  ipcMain.handle('overlay:toggle', () => toggleOverlay());
  ipcMain.handle('overlay:lock', () => toggleOverlayLock());
  ipcMain.handle('overlay:set', (_e, patch: unknown) => {
    const p = parseOverlayPatch(patch);
    if (p.opacity === undefined && !p.mode) return;
    settings.update(s => {
      if (p.opacity !== undefined) s.overlay.opacity = p.opacity;
      if (p.mode) s.overlay.mode = p.mode;
    });
    applyOverlaySettings();
    publishOverlay();
  });
  ipcMain.handle('hotkeys:set', (_e, value: unknown) => {
    const hk = parseHotkeys(value);
    if (!hk) return;
    settings.update(s => (s.hotkeys = hk));
    registerHotkeys();
  });
  // Pick the save folder by hand. Cancel does nothing; errors are logged, never thrown at the window.
  ipcMain.handle('folder:browse', async () => {
    try {
      const options = { title: dialogText().pickFolder, properties: ['openDirectory' as const], defaultPath: settings.data.saveDir };
      const r = main ? await dialog.showOpenDialog(main, options) : await dialog.showOpenDialog(options);
      if (!r.canceled && r.filePaths[0]) await controller.pickFolder(r.filePaths[0]);
    } catch (e) { logError('folder:browse', e); }
    return controller.state;
  });

  ipcMain.handle('folder:scan', () => controller.scanFolders());
  ipcMain.handle('progress:refresh', () => controller.refreshNow());

  createMain();
  startUpdater();
  if (isDev && process.env.OOT_SAVE_DIR) settings.data.saveDir = process.env.OOT_SAVE_DIR;
  if (isDev && process.env.OOT_DEV_PANEL) settings.data.devPanel = true;
  registerHotkeys();
  await controller.start();
  if (isDev && process.env.OOT_OVERLAY) {
    if (process.env.OOT_OVERLAY_MODE) settings.data.overlay.mode = process.env.OOT_OVERLAY_MODE as OverlayMode;
    if (process.env.OOT_OVERLAY_UNLOCKED) settings.data.overlay.locked = false;
    toggleOverlay();
  }

  // Development aid: OOT_SCREENSHOT=<file.png> captures the window once loaded, then quits.
  const shot = process.env.OOT_SCREENSHOT;
  if (isDev && shot && main) {
    main.webContents.once('did-finish-load', () => setTimeout(async () => {
      if (process.env.OOT_SCREENSHOT_SCROLL) await main!.webContents.executeJavaScript(`document.querySelector('.grid-wrap').scrollTop = ${Number(process.env.OOT_SCREENSHOT_SCROLL)}`);
      if (process.env.OOT_SCREENSHOT_CLICK) await main!.webContents.executeJavaScript(`[...document.querySelectorAll('.tile')].find(t => t.title.includes(${JSON.stringify(process.env.OOT_SCREENSHOT_CLICK)}))?.click()`);
      await new Promise(r => setTimeout(r, 300));
      const img = await main!.webContents.capturePage();
      const fsMod = await import('node:fs');
      fsMod.writeFileSync(shot, img.toPNG());
      if (overlay) fsMod.writeFileSync(shot.replace(/\.png$/, '-overlay.png'), (await overlay.webContents.capturePage()).toPNG());
      app.quit();
    }, Number(process.env.OOT_SCREENSHOT_DELAY ?? 2500)));
  }
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => { controller?.stop(); app.quit(); });
