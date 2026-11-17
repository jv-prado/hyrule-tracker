// The only bridge between the UI and the main process.
import { contextBridge, ipcRenderer } from 'electron';
import type { AppState, UiPrefs, OverlayMode, UpdateState, PlayerState } from '../shared/types.js';

const api = {
  getState: (): Promise<AppState> => ipcRenderer.invoke('state:get'),
  onState: (fn: (s: AppState) => void) => {
    const h = (_e: unknown, s: AppState) => fn(s);
    ipcRenderer.on('state', h);
    return () => { ipcRenderer.removeListener('state', h); };
  },
  /** Link's position on the map (live updates arrive here, not in onState). */
  onPlayer: (fn: (p: PlayerState | null) => void) => {
    const h = (_e: unknown, p: PlayerState | null) => fn(p);
    ipcRenderer.on('player', h);
    return () => { ipcRenderer.removeListener('player', h); };
  },
  getUpdate: (): Promise<UpdateState> => ipcRenderer.invoke('update:get'),
  onUpdate: (fn: (s: UpdateState) => void) => {
    const h = (_e: unknown, s: UpdateState) => fn(s);
    ipcRenderer.on('update', h);
    return () => { ipcRenderer.removeListener('update', h); };
  },
  updateNow: () => ipcRenderer.send('update:now'),
  updateLater: () => ipcRenderer.send('update:later'),
  installUpdate: () => ipcRenderer.send('update:install'),
  getPrefs: (): Promise<UiPrefs> => ipcRenderer.invoke('prefs:get'),
  setLanguage: (locale: string) => ipcRenderer.invoke('locale:set', locale),
  onLanguage: (fn: (locale: string) => void) => {
    const handler = (_e: unknown, locale: string) => fn(locale);
    ipcRenderer.on('locale', handler);
    return () => { ipcRenderer.removeListener('locale', handler); };
  },
  setPrefs: (p: UiPrefs): Promise<UiPrefs> => ipcRenderer.invoke('prefs:set', p),
  pinSlot: (name: string | null) => ipcRenderer.invoke('slot:pin', name),
  toggleManual: (id: string) => ipcRenderer.invoke('manual:toggle', id),
  setDevPanel: (on: boolean) => ipcRenderer.invoke('dev:set', on),
  captureGame: (): Promise<string | undefined> => ipcRenderer.invoke('capture:get'),
  setCaptureActivity: (on: boolean) => ipcRenderer.invoke('capture:set', on),
  setChangeLog: (on: boolean) => ipcRenderer.invoke('log:set', on),
  openLogFolder: () => ipcRenderer.invoke('log:open'),
  takeSnapshot: (label: string) => ipcRenderer.invoke('snapshot:take', label),
  openSnapshotFolder: () => ipcRenderer.invoke('snapshot:open-folder'),
  browseFolder: (): Promise<AppState> => ipcRenderer.invoke('folder:browse'),
  scanFolders: (): Promise<AppState> => ipcRenderer.invoke('folder:scan'),
  refreshProgress: (): Promise<void> => ipcRenderer.invoke('progress:refresh'),
  answerIdentify: (reqId: string, itemIds: string[]) => ipcRenderer.invoke('identify:answer', reqId, itemIds),
  skipIdentify: (reqId: string) => ipcRenderer.invoke('identify:skip', reqId),
  forgetIdentification: (itemId: string) => ipcRenderer.invoke('identify:forget', itemId),
  exportLearned: (): Promise<string> => ipcRenderer.invoke('identify:export'),
  toggleOverlay: () => ipcRenderer.invoke('overlay:toggle'),
  toggleOverlayLock: () => ipcRenderer.invoke('overlay:lock'),
  setOverlay: (p: { opacity?: number; mode?: OverlayMode }) => ipcRenderer.invoke('overlay:set', p),
  setHotkeys: (hk: { toggleOverlay: string; lockOverlay: string }) => ipcRenderer.invoke('hotkeys:set', hk),
};
export type TrackerApi = typeof api;
contextBridge.exposeInMainWorld('tracker', api);
