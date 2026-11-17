import { mkdirSync, mkdtempSync, renameSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { murmur3 } from '../src/gamedata/murmur3.js';
import { Controller } from '../src/main/controller.js';
import { LiveSource } from '../src/main/live.js';
import { SettingsStore } from '../src/main/settings.js';

describe('a temporarily missing pinned slot', () => {
  let dir: string;
  let settings: SettingsStore;
  let controller: Controller;
  const itemId = 'minigames.shooting_child_expert';
  const marked = () => controller.state.categories.flatMap(c => c.items).find(i => i.id === itemId)?.done;
  const movePinned = (restore = false) => {
    const file = join(dir, 'slot_00', 'progress.sav');
    renameSync(restore ? file + '.pending' : file, restore ? file : file + '.pending');
  };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'hyrule-pinned-'));
    for (const [slot, hour] of [['slot_00', 10], ['slot_01', 11]] as const) {
      mkdirSync(join(dir, slot));
      const buffer = Buffer.alloc(0x38);
      buffer.writeUInt32LE(0x01020304, 0);
      buffer.writeUInt32LE(0x002d80eb, 4);
      buffer.writeUInt32LE(buffer.length, 8);
      buffer.writeUInt32LE(2, 0x2c);
      buffer.writeUInt32LE(murmur3('PlayerStatus.MaxLife'), 0x30);
      buffer.writeUInt32LE(28, 0x34);
      const file = join(dir, slot, 'progress.sav');
      writeFileSync(file, buffer);
      const stamp = new Date(2026, 0, 1, hour);
      utimesSync(file, stamp, stamp);
    }
    settings = new SettingsStore(join(dir, 'settings.json'));
    settings.data.saveDir = dir;
    controller = new Controller({ appDir: fileURLToPath(new URL('..', import.meta.url)),
      userData: dir, snapshots: join(dir, 'snapshots'), version: 'test', noLive: true }, settings);
  });

  afterEach(() => {
    controller.stop();
    vi.restoreAllMocks();
    rmSync(dir, { recursive: true, force: true });
  });

  it('reads and writes recent marks during fallback, then resumes the pin when its save returns', async () => {
    await controller.start();
    controller.stop(); // Make each refresh explicit, without a concurrent watcher.
    await controller.toggleManual(itemId);
    expect(marked()).toBe(true);
    await controller.pinSlot('slot_00');
    expect(marked()).toBe(false);
    movePinned();
    await controller.refresh(false);
    expect(controller.state).toMatchObject({ slotMode: 'recent', activeSlot: 'slot_01' });
    expect(marked()).toBe(true);
    await controller.toggleManual(itemId);
    expect(marked()).toBe(false);
    expect(settings.data.manual[`${dir}|@recent`]?.[itemId]).toBeUndefined();
    expect(settings.data.manual[`${dir}|slot_01`]).toBeUndefined();
    expect(settings.data.pinnedSlot).toBe('slot_00');
    movePinned(true);
    await controller.refresh(false);
    expect(controller.state).toMatchObject({ slotMode: 'manual', activeSlot: 'slot_00' });
    expect(marked()).toBe(false);
  });

  it('uses live position and refresh only while the displayed mode follows the latest save', async () => {
    // Stub the process-memory boundary; no running game is needed or accessed.
    vi.spyOn(LiveSource.prototype, 'start').mockResolvedValue();
    vi.spyOn(LiveSource.prototype, 'player').mockReturnValue({ scene: 'ZoraFountain/ZoraFountain_Child',
      pos: { x: 55.27, y: 102.47, z: 23.14, yaw: 52.1 }, atMs: 1 });
    const refresh = vi.spyOn(LiveSource.prototype, 'refreshNow').mockResolvedValue();
    controller.paths.noLive = false;
    await controller.start();
    await controller.pinSlot('slot_00');
    expect(controller.state.player).toBeUndefined();
    movePinned();
    await controller.refreshNow();
    expect(controller.state.slotMode).toBe('recent');
    expect(controller.state.player).toMatchObject({ source: 'live', placeId: 'fuente' });
    expect(refresh).toHaveBeenCalledTimes(1);
    movePinned(true);
    await controller.refreshNow();
    expect(controller.state.slotMode).toBe('manual');
    expect(controller.state.player).toBeUndefined();
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
