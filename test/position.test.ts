import { describe, it, expect } from 'vitest';
import atlas from '../data/atlas.json';
import { locatePlayer, normalizeSceneName, resolveEffectiveScene, determineDungeonFloor, inDesertSandstorm, type AtlasPlace } from '../src/core/position';
import { PlayerReader, parsePlayerStruct, sceneFromBuffer, MAIN_MOD0_OFFSET } from '../src/gamedata/player';
import { GUEST_BASE, type Mem } from '../src/gamedata/live';

const places = atlas.places as AtlasPlace[];

describe('position projection', () => {
  it('normalizes save and Banc scene names', () => {
    expect(normalizeSceneName('ZoraFountain/ZoraFountain_Child')).toEqual({ scene: 'ZoraFountain', ageHint: 'child' });
    expect(normalizeSceneName('Work/Banc/Scene/FireTemple/FireTemple.bcett.json')).toEqual({ scene: 'FireTemple', ageHint: null });
  });

  it('routes the ranch and the lake out of the seamless field', () => {
    expect(resolveEffectiveScene('HyruleField', -100, 250)).toBe('LonLonRanch');
    expect(resolveEffectiveScene('HyruleField', -200, 500)).toBe('LakeHylia');
    expect(resolveEffectiveScene('HyruleField', 0, 0)).toBe('HyruleField');
  });

  it('picks dungeon floors from height', () => {
    expect(determineDungeonFloor('fuego', 100)).toBe('1F');
    expect(determineDungeonFloor('fuego', 190)).toBe('5F');
  });

  it('hides Link in the desert sandstorm and keeps the three stood places', () => {
    expect(inDesertSandstorm(15.5, -83.7)).toBe(false);
    expect(inDesertSandstorm(79.3, 32.83)).toBe(false);
    expect(inDesertSandstorm(-100.2, -55.8)).toBe(false);
    expect(inDesertSandstorm(-1.8, -35.6)).toBe(true);
    expect(inDesertSandstorm(116, 54)).toBe(true);
  });

  it('places Link from a real save (Zora Fountain, child) inside the map', () => {
    const fix = locatePlayer('ZoraFountain/ZoraFountain_Child', { x: 55.27, y: 102.47, z: 23.14, yaw: 52.1 }, places)!;
    expect(fix.placeId).toBe('fuente');
    expect(fix.age).toBe('child');
    expect(fix.at).not.toBeNull();
    for (const v of [fix.at!.x, fix.at!.y, fix.world.x, fix.world.y]) { expect(v).toBeGreaterThan(0.02); expect(v).toBeLessThan(0.98); }
    expect(fix.yaw).toBeCloseTo(52.1);
  });

  it('every atlas map has a viewBox for projection', () => {
    for (const p of places) for (const m of p.maps) expect(m.vb, `${p.id}/${m.id}`).toBeTruthy();
  });

  it('returns null for unknown scenes', () => {
    expect(locatePlayer('TitleScreen', { x: 1, y: 1, z: 1, yaw: 0 }, places)).toBeNull();
  });
});

describe('live player reader', () => {
  // Synthetic guest memory: main module at guest 0x8000_0000, heap objects above 0x10_0000_0000.
  const MAIN = 0x8000_0000n;
  const pages = new Map<bigint, Buffer>();
  const put = (guest: bigint, buf: Buffer) => pages.set(GUEST_BASE + guest, buf);
  const u64 = (v: bigint) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(v); return b; };
  const mem: Mem = {
    read(addr, len) {
      for (const [at, buf] of pages) if (addr >= at && addr + BigInt(len) <= at + BigInt(buf.length)) {
        const o = Number(addr - at); return buf.subarray(o, o + len);
      }
      return null;
    },
  };
  const HEAP = 0x10_0000_0000n, SINGLETON = HEAP + 0x1000n, POBJ = HEAP + 0x2000n, ARR = HEAP + 0x3000n, SUB36 = HEAP + 0x4000n, SUB7 = HEAP + 0x5000n;

  it('parses a player struct and its heading', () => {
    const b = Buffer.alloc(0x40);
    b.writeBigUInt64LE(10n, 0); b.writeBigUInt64LE(20n, 8);
    b.writeFloatLE(1.5, 0x1c); b.writeFloatLE(100, 0x20); b.writeFloatLE(-3, 0x24);
    b.writeFloatLE(1, 0x28); b.writeFloatLE(0, 0x30); // facing +x = east = 90°
    expect(parsePlayerStruct(b, 10n, 20n)).toEqual({ x: 1.5, y: 100, z: -3, yaw: 90 });
    expect(parsePlayerStruct(b, 11n, 20n)).toBeNull();
  });

  it('finds the main module, walks to the player and reads the scene', () => {
    // The MOD0 marker must sit at mainBase + MAIN_MOD0_OFFSET, so the code region has to reach it.
    const big = Buffer.alloc(Number(MAIN_MOD0_OFFSET) + 0x100);
    big.writeUInt32LE(1, 0); big.writeUInt32LE(Number(MAIN_MOD0_OFFSET), 4);
    Buffer.from('4d4f44305467030124fb0f016c342501', 'hex').copy(big, Number(MAIN_MOD0_OFFSET));
    put(MAIN, big);
    // .bss singleton -> parent object -> sub array -> Sub[36]
    put(MAIN + 0x04e6c7a8n, u64(SINGLETON));
    const singleton = Buffer.alloc(0x18); singleton.writeBigUInt64LE(POBJ, 0x10); put(SINGLETON, singleton);
    const pobj = Buffer.alloc(0x60); pobj.writeBigUInt64LE(MAIN + 0x04ba27c8n, 0); pobj.writeUInt32LE(40, 0x50); pobj.writeBigUInt64LE(ARR, 0x58); put(POBJ, pobj);
    const arr = Buffer.alloc(40 * 8); arr.writeBigUInt64LE(SUB36, 36 * 8); arr.writeBigUInt64LE(SUB7, 7 * 8); put(ARR, arr);
    const sub = Buffer.alloc(0x40);
    sub.writeBigUInt64LE(MAIN + 0x04ba1818n, 0); sub.writeBigUInt64LE(MAIN + 0x03ee4f8cn, 8); sub.writeBigUInt64LE(POBJ, 0x10);
    sub.writeFloatLE(55.27, 0x1c); sub.writeFloatLE(102.47, 0x20); sub.writeFloatLE(23.14, 0x24);
    sub.writeFloatLE(0, 0x28); sub.writeFloatLE(-1, 0x30); // facing -z = north = 0°
    put(SUB36, sub);
    const s7 = Buffer.alloc(0x34 + 0x80); s7.write('Work/Banc/Scene/ZoraFountain/ZoraFountain_Child.bcett', 0x34, 'latin1'); put(SUB7, s7);
    const reader = new PlayerReader(mem, () => [{ base: GUEST_BASE + MAIN, size: BigInt(big.length) }]);
    let got = null;
    for (let i = 0; i < 20 && !got; i++) got = reader.read(i);
    expect(got).toEqual({ pos: { x: 55.27, y: 102.47, z: 23.14, yaw: 0 }, scene: 'ZoraFountain_Child' });
    expect(reader.stage).toBe('ok');
  });

  it('finds the main module inside one huge readable block (Linux builds)', () => {
    // The whole guest code window is one readable mapping, zeros except what was put there.
    const lo = GUEST_BASE + 0x0800_0000n, hi = GUEST_BASE + 0x1_8000_0000n;
    const sparse: Mem = {
      read(addr, len) {
        if (addr < lo || addr + BigInt(len) > hi) return mem.read(addr, len);
        const out = Buffer.alloc(len);
        for (const [at, buf] of pages) {
          const from = addr > at ? addr : at, to = addr + BigInt(len) < at + BigInt(buf.length) ? addr + BigInt(len) : at + BigInt(buf.length);
          if (from < to) buf.copy(out, Number(from - addr), Number(from - at), Number(to - at));
        }
        return out;
      },
    };
    const reader = new PlayerReader(sparse, () => [{ base: lo, size: hi - lo }]);
    let got = null;
    for (let i = 0; i < 20 && !got; i++) got = reader.read(i);
    expect(got?.scene).toBe('ZoraFountain_Child');
  });

  it('says it found no main module after a full search', () => {
    const reader = new PlayerReader(mem, () => []);
    expect(reader.read(0)).toBeNull();
    expect(reader.stage).toBe('no-module');
  });

  it('extracts scene names from Banc paths', () => {
    expect(sceneFromBuffer(Buffer.from('xxWork/Banc/Scene/FireTemple/FireTemple.bcett\0'))).toBe('FireTemple');
    expect(sceneFromBuffer(Buffer.from('nothing'))).toBeNull();
  });
});
