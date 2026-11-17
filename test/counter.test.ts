import { describe, expect, it } from 'vitest';
import { evaluateCounter, type CounterRule } from '../src/gamedata/detect.js';
import { murmur3 } from '../src/gamedata/murmur3.js';
import type { Entry, GameDataFile } from '../src/gamedata/parser.js';

const save = (entries: [string, Entry['type'], Entry['value']][]): GameDataFile => ({
  version: 0x2d80eb, dataStart: 0, size: 0, bool64: new Set(), warnings: [],
  entries: new Map(entries.map(([name, type, value]) => [murmur3(name), { hash: murmur3(name), type, value, recordOffset: 0 } as Entry])),
});
const coupons = (n: number) => save([['GhostShop_CouponNum', 'Int', n]]);

describe('evaluateCounter pointsPer', () => {
  const rule: CounterRule = { value: { name: 'GhostShop_CouponNum' }, pointsPer: 100 };
  it('reads small values as a count', () => {
    expect(evaluateCounter(rule, coupons(0))).toBe(0);
    expect(evaluateCounter(rule, coupons(7))).toBe(7);
  });
  it('reads point totals as Big Poes', () => {
    expect(evaluateCounter(rule, coupons(500))).toBe(5);
    expect(evaluateCounter(rule, coupons(1000))).toBe(10);
  });
});

describe('evaluateCounter atLeast', () => {
  const rule: CounterRule = { value: { name: 'GhostShop_CouponNum' }, pointsPer: 100, atLeast: [{ when: { name: 'Step_SubEvent_GhostShop', eq: 'Complete' }, value: 5 }] };
  const done = (n?: number) => save([
    ['Step_SubEvent_GhostShop', 'Enum', murmur3('Complete')],
    ...(n === undefined ? [] : [['GhostShop_CouponNum', 'Int', n] as [string, Entry['type'], Entry['value']]]),
  ]);
  it('raises a lagging count to the milestone', () => expect(evaluateCounter(rule, done(0))).toBe(5));
  it('keeps a higher count', () => expect(evaluateCounter(rule, done(800))).toBe(8));
  it('applies even when the raw value is missing', () => expect(evaluateCounter(rule, done())).toBe(5));
  it('does nothing before the milestone', () => expect(evaluateCounter(rule, coupons(0))).toBe(0));
});
