import { describe, expect, it } from 'vitest';
import { EventEmitter } from 'node:events';
import { createUpdater, notesToText, type AutoUpdaterLike } from '../src/main/updater.js';
import type { UpdateState } from '../src/shared/types.js';

function fake() {
  const ee = new EventEmitter();
  const calls: string[] = [];
  const au = {
    autoDownload: true, autoInstallOnAppQuit: true, allowPrerelease: true,
    on: (e: string, l: (...a: any[]) => void) => ee.on(e, l),
    checkForUpdates: async () => { calls.push('check'); },
    downloadUpdate: async () => { calls.push('download'); },
    quitAndInstall: () => { calls.push('install'); },
  } satisfies AutoUpdaterLike;
  return { ee, au, calls };
}

describe('notesToText', () => {
  it('turns GitHub release HTML into plain text bullets', () => {
    const html = '<h3>New</h3><ul><li><strong>Fast</strong> start</li><li>Fix &amp; polish</li></ul><script>x()</script>';
    expect(notesToText(html)).toBe('New\n• Fast start\n• Fix & polish');
  });
  it('accepts a list of notes and empty input', () => {
    expect(notesToText([{ version: '1', note: '<p>Hi</p>' }])).toBe('Hi');
    expect(notesToText(undefined)).toBe('');
  });
});

describe('createUpdater', () => {
  it('never downloads or installs by itself, and carries the changelog through states', async () => {
    const { ee, au, calls } = fake();
    const states: UpdateState[] = [];
    const u = createUpdater({ autoUpdater: au, notify: s => states.push(s) });
    expect(au.autoDownload).toBe(false);
    expect(au.autoInstallOnAppQuit).toBe(false);

    ee.emit('update-available', { version: '1.1.0', releaseNotes: '<ul><li>Cool</li></ul>' });
    expect(u.getState()).toMatchObject({ status: 'available', version: '1.1.0', notes: '• Cool' });
    expect(calls).toEqual([]);

    await u.download();
    expect(calls).toEqual(['download']);
    ee.emit('download-progress', { percent: 41.6 });
    expect(u.getState()).toMatchObject({ status: 'downloading', percent: 42, notes: '• Cool' });
    ee.emit('update-downloaded', { version: '1.1.0' });
    expect(u.getState().status).toBe('ready');
    u.install();
    expect(calls).toEqual(['download', 'install']);
  });

  it('stops prompting for a version the player declined', () => {
    const { ee, au } = fake();
    const u = createUpdater({ autoUpdater: au });
    ee.emit('update-available', { version: '1.1.0' });
    u.later();
    ee.emit('update-available', { version: '1.1.0' });
    expect(u.getState().status).toBe('idle');
    ee.emit('update-available', { version: '1.2.0' });
    expect(u.getState().status).toBe('available');
  });
});
