// Link's live position (x, y, z and heading) from the running game's memory.
//
// Chain (game build used by the recomps): main module base, found by its MOD0 header →
// a player-subsystem singleton in .bss → its parent object → sub-object array → entry 36,
// whose struct holds the position at +0x1C and the facing direction at +0x28 / +0x30.
// Offsets, vtables and the chain come from Ocarina Atlas (src/lib/lichii-server.ts),
// MIT License, Copyright (c) 2026 antonioalvromero. See docs/atlas-license.txt.
//
// Read-only, like the rest of live tracking. Only for programs that map guest memory at a
// fixed host base (Hookshot, Longshot, NX2navi/Triforce, ReLink); emulators fall back to the
// position in the save.
import { GUEST_BASE, type Mem } from './live.js';
import type { PlayerPosition } from '../core/position.js';

export const MAIN_MOD0_OFFSET = 0x03c4705cn;
/** "MOD0" followed by the main module's dynamic / bss offsets. */
const MAIN_MOD0_PATTERN = Buffer.from('4d4f44305467030124fb0f016c342501', 'hex');
/** "Owl.nss\0MOD0": the module name right before its header (MOD0 = hit + 8). */
const OWL_MOD0_PATTERN = Buffer.from('4f776c2e6e7373004d4f4430', 'hex');
const SINGLETON_BSS = [0x04e6c7a8n, 0x04e6c938n];
const SUB36_VT1 = 0x04ba1818n, SUB36_VT2 = 0x03ee4f8cn, POBJ_VT = 0x04ba27c8n;
/** Guest heap pointers are at least this (HOS heap base). */
const MIN_HEAP = 0x10_0000_0000n;
/** Where to look for the main module (guest addresses). */
const CODE_LO = 0x0800_0000n, CODE_HI = 0x2_0000_0000n, CODE_NEAR = 0x8000_0000n;
const CHUNK = 1 << 20;
/** Most bytes one full search reads, and per call (so one tick stays short). */
const SCAN_BUDGET = 768 << 20, TICK_BUDGET = 64 << 20;
const RESCAN_MS = 10_000;

export interface Region { base: bigint; size: bigint }

/** True if `buf` (read at the module base) is the main module header. */
export function isMainHeader(buf: Buffer | null): boolean {
  return !!buf && buf.length >= 8 && buf.readUInt32LE(0) === 1 && buf.readUInt32LE(4) === Number(MAIN_MOD0_OFFSET);
}

function validCoord(x: number, y: number, z: number): boolean {
  return [x, y, z].every(v => Number.isFinite(v) && Math.abs(v) < 15000) &&
    (Math.abs(x) > 0.001 || Math.abs(y) > 0.001 || Math.abs(z) > 0.001);
}

/** Position and heading from a Sub[36] struct, if its vtables and coordinates check out. */
export function parsePlayerStruct(buf: Buffer | null, vt1: bigint, vt2: bigint): PlayerPosition | null {
  if (!buf || buf.length < 0x34) return null;
  if (buf.readBigUInt64LE(0) !== vt1 || buf.readBigUInt64LE(8) !== vt2) return null;
  const x = buf.readFloatLE(0x1c), y = buf.readFloatLE(0x20), z = buf.readFloatLE(0x24);
  if (!validCoord(x, y, z)) return null;
  const dx = buf.readFloatLE(0x28), dz = buf.readFloatLE(0x30);
  const yaw = Number.isFinite(dx) && Number.isFinite(dz) && Math.hypot(dx, dz) > 0.01
    ? ((Math.atan2(dx, -dz) * 180) / Math.PI + 360) % 360 : 0;
  return { x: round(x), y: round(y), z: round(z), yaw: Number(yaw.toFixed(1)) };
}

const round = (v: number) => Number(v.toFixed(2));

const SCENE_PATH = /Work\/Banc\/Scene\/([A-Za-z0-9_]+)\/([A-Za-z0-9_]+)\.bcett/;
/** Scene name ("ZoraFountain_Child") from a buffer holding the loaded Banc scene path. */
export function sceneFromBuffer(buf: Buffer | null): string | null {
  const m = buf?.toString('latin1').match(SCENE_PATH);
  return m ? m[2] || m[1] : null;
}

export interface LivePlayer { pos: PlayerPosition; scene: string | null }

export class PlayerReader {
  private mainBase = 0n;
  private sub36 = 0n;
  private pObj = 0n;
  private sub7 = 0n;
  private scene: string | null = null;
  private lastScan = -Infinity;
  private lastYaw = 0;
  private scan?: { blocks: { start: bigint; end: bigint }[]; i: number; at: bigint; spent: number };

  /**
   * @param mem the game process
   * @param regions its committed memory blocks (host addresses), for finding the main module
   * @param base host address of guest 0
   */
  constructor(private mem: Mem, private regions: () => Region[], private base = GUEST_BASE) {}

  private guest(addr: bigint, len: number) { return this.mem.read(this.base + addr, len); }
  private u64(addr: bigint) { const b = this.guest(addr, 8); return b ? b.readBigUInt64LE(0) : 0n; }

  /** Link's position and scene now, or null (not in game yet, different game build, or unreadable). */
  read(now = Date.now()): LivePlayer | null {
    if (!this.mainBase) {
      this.mainBase = this.findMainBase(now);
      if (!this.mainBase) return null;
    }
    const vt1 = this.mainBase + SUB36_VT1, vt2 = this.mainBase + SUB36_VT2;
    let pos = this.sub36 ? parsePlayerStruct(this.guest(this.sub36, 0x40), vt1, vt2) : null;
    if (!pos) {
      this.sub36 = this.resolveSub36();
      pos = this.sub36 ? parsePlayerStruct(this.guest(this.sub36, 0x40), vt1, vt2) : null;
    }
    if (!pos) {
      // The module itself may have moved (game restarted in the same process is unlikely, but cheap to recheck).
      if (!isMainHeader(this.guest(this.mainBase, 8))) this.mainBase = 0n;
      return null;
    }
    // Standing still: the direction vector is zero; keep the last heading.
    if (pos.yaw === 0) pos.yaw = this.lastYaw; else this.lastYaw = pos.yaw;
    return { pos, scene: this.readScene() };
  }

  /** The loaded scene: Sub[7] + 0x34, else the parent object + 0x768. Kept while unreadable. */
  private readScene(): string | null {
    const pObj = this.sub36 ? this.u64(this.sub36 + 0x10n) : 0n;
    if (pObj > MIN_HEAP && pObj !== this.pObj) {
      this.pObj = pObj;
      const head = this.guest(pObj, 0x60);
      const count = head?.readUInt32LE(0x50) ?? 0, arr = head?.readBigUInt64LE(0x58) ?? 0n;
      this.sub7 = count > 7 && count <= 128 && arr > MIN_HEAP ? this.u64(arr + 7n * 8n) : 0n;
    }
    const scene = (this.sub7 > MIN_HEAP ? sceneFromBuffer(this.guest(this.sub7 + 0x34n, 0x80)) : null) ??
      (this.pObj > MIN_HEAP ? sceneFromBuffer(this.guest(this.pObj + 0x768n, 0x480)) : null);
    if (scene) this.scene = scene;
    return this.scene;
  }

  private resolveSub36(): bigint {
    for (const off of SINGLETON_BSS) {
      const singleton = this.u64(this.mainBase + off);
      if (singleton <= MIN_HEAP) continue;
      const pObj = this.u64(singleton + 0x10n);
      if (pObj <= MIN_HEAP) continue;
      const head = this.guest(pObj, 0x60);
      if (!head || head.readBigUInt64LE(0) !== this.mainBase + POBJ_VT) continue;
      const count = head.readUInt32LE(0x50), arr = head.readBigUInt64LE(0x58);
      if (count <= 36 || count > 128 || arr <= MIN_HEAP) continue;
      const sub36 = this.u64(arr + 36n * 8n);
      if (sub36 > MIN_HEAP) return sub36;
    }
    return 0n;
  }

  /**
   * Search the code window for the main module's MOD0 header, nearest the usual code base
   * first. Resumable: reads at most TICK_BUDGET per call so the caller's thread never stalls.
   * Returns the base, 0n while still searching; after a full pass without a hit, waits RESCAN_MS.
   */
  private findMainBase(now: number): bigint {
    if (!this.scan) {
      if (now - this.lastScan < RESCAN_MS) return 0n;
      const lo = this.base + CODE_LO, hi = this.base + CODE_HI, near = this.base + CODE_NEAR;
      const blocks = this.regions()
        .map(r => ({ start: r.base > lo ? r.base : lo, end: r.base + r.size < hi ? r.base + r.size : hi }))
        .filter(r => r.end > r.start)
        .sort((a, b) => Number(abs(a.start - near) - abs(b.start - near)));
      this.scan = { blocks, i: 0, at: blocks[0]?.start ?? 0n, spent: 0 };
    }
    const s = this.scan;
    let budget = TICK_BUDGET;
    while (budget > 0 && s.i < s.blocks.length && s.spent < SCAN_BUDGET) {
      const r = s.blocks[s.i];
      if (s.at >= r.end) { if (++s.i < s.blocks.length) s.at = s.blocks[s.i].start; continue; }
      const len = Number(r.end - s.at < BigInt(CHUNK + 16) ? r.end - s.at : BigInt(CHUNK + 16));
      const at = s.at;
      s.at += BigInt(CHUNK);
      budget -= len;
      s.spent += len;
      const buf = this.mem.read(at, len);
      if (!buf) continue;
      for (const [pattern, adjust] of [[MAIN_MOD0_PATTERN, 0n], [OWL_MOD0_PATTERN, 8n]] as const) {
        for (let i = buf.indexOf(pattern); i >= 0; i = buf.indexOf(pattern, i + 1)) {
          const mainBase = at + BigInt(i) + adjust - this.base - MAIN_MOD0_OFFSET;
          if (mainBase > 0n && isMainHeader(this.guest(mainBase, 8))) { this.scan = undefined; return mainBase; }
        }
      }
    }
    if (s.i >= s.blocks.length || s.spent >= SCAN_BUDGET) { this.scan = undefined; this.lastScan = now; }
    return 0n;
  }
}

const abs = (v: bigint) => (v < 0n ? -v : v);
