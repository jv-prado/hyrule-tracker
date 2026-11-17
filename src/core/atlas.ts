import type { GameDataFile } from '../gamedata/parser.js';

export interface AtlasRule { id: string; hex32: number[]; hex64: string[] }
export type AtlasStatus = 'done' | 'todo' | 'unknown';

export function evaluateAtlas(items: AtlasRule[], save: GameDataFile): Record<string, AtlasStatus> {
  return Object.fromEntries(items.map(item => {
    const saved = item.hex32.map(key => save.entries.get(key)?.value);
    const done = saved.some(v => v === true || (typeof v === 'number' && v > 0)) ||
      item.hex64.some(hex => save.bool64.has(BigInt(hex)));
    const known = item.hex64.length > 0 || saved.some(v => typeof v === 'boolean' || typeof v === 'number');
    return [item.id, done ? 'done' : known ? 'todo' : 'unknown'];
  }));
}
