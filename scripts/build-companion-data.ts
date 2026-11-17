// Rebuild portable metadata from the player's own extracted game. No artwork,
// audio, text files or saved games are copied into the application.
import fs from 'node:fs';
import path from 'node:path';
import { parseByml } from '../src/gamedata/byml.js';
import { RomFs } from '../src/gamedata/romfs.js';
import { loadGameDataList } from '../src/gamedata/gamedatalist.js';
import { murmur3 } from '../src/gamedata/murmur3.js';

const root = process.argv[2];
if (!root) throw Error('Usage: tsx scripts/build-companion-data.ts <romfs>');
const rom = new RomFs(root);
const data = loadGameDataList(root);
const get = (name: string) => data.entries.get(murmur3(name));
const struct = (name: string) => (get(name)?.defaultValue ?? []) as { Hash: number; Value: number }[];
type Actor = { Hash: bigint; Gyaml: string; Presence?: { FlagName: string }; Translate?: number[]; Dynamic?: Record<string, unknown> };
const decode = (file: string) => parseByml(rom.read(file)) as unknown as { Actors?: Actor[] };
const museum = decode('Banc/DreamWorld/EnemyMuseum_Static.bcett.byml.zs').Actors ?? [];
const statues = museum.filter(a => a.Gyaml.includes('EnemyPedestalPlate')).map(a => {
  const flag = a.Presence!.FlagName;
  const actor = flag.replace(/^(DreamWorldPlate_|HaveDefeatedEnemy_)/, '');
  const defeat = get('HaveDefeatedEnemy_' + actor);
  const operands = (defeat?.expr ?? []).filter(([, v]) => typeof v === 'bigint').map(([, v]) => Number(v));
  for (const child of operands.slice()) {
    const entry = data.entries.get(child);
    if (entry?.expr) operands.push(...entry.expr.filter(([, v]) => typeof v === 'bigint').map(([, v]) => Number(v)));
  }
  const key = operands.find(k => data.entries.get(k)?.type === 'Int');
  const requires = operands.filter(k => data.entries.get(k)?.type === 'Bool');
  return { actor, key, requires, boss: a.Gyaml.endsWith('_Boss') };
});
const chestKeys = new Set(struct('IsTreasureBoxOpen').map(e => e.Value));
const chests = new Map<number, { hash: number; stage: string; era?: string; x: number; y: number; z: number; item?: string }>();
type Placement = NonNullable<ReturnType<typeof chests.get>>;
const notes = new Map<number, Placement>();
const scarecrows = new Map<number, Placement>();
const grottos = new Map<string, Placement>();
const actorNames = new Map(fs.readdirSync(path.join(root, 'Pack', 'Actor')).map(file => file.replace(/\.pack\.zs$/, ''))
  .map(name => [murmur3(name), name]));
for (const name of ['EnemyTeam_IronKnuckle', 'EnemyTeam_Twinrova']) actorNames.set(murmur3(name), name);
const rematches = struct('DreamWorld_TimeTrial').map(({ Hash, Value }) => {
  const fields = (data.entries.get(Value)?.defaultValue ?? []) as { Hash: number; Value: number }[];
  return {
    id: Hash,
    actor: actorNames.get(Hash),
    completed: fields.find(f => f.Hash === murmur3('HaveRecordedTime'))?.Value,
    timeKeys: fields.filter(f => data.entries.get(f.Value)?.type === 'Float').map(f => ({ field: f.Hash, key: f.Value })),
  };
});
for (const file of fs.readdirSync(path.join(root, 'Banc'), { recursive: true })) {
  if (typeof file !== 'string' || !file.endsWith('.bcett.byml.zs')) continue;
  if (/DreamWorld|MasterQuest|Museum|Test|Title/i.test(file)) continue;
  const rel = 'Banc/' + file.replaceAll('\\', '/');
  try {
    for (const a of decode(rel).Actors ?? []) {
      if (!a.Translate || typeof a.Hash !== 'bigint') continue;
      const [x, y, z] = a.Translate.map(v => Math.round(v * 10) / 10);
      const era = file.match(/_(Child|Adult)_/)?.[1]?.toLowerCase();
      const stage = file.replaceAll('\\', '/').split('/')[0];
      const placement = { hash: 0, stage, era, x, y, z };
      const note = /^HrlField_Note_(\d+)$/.exec(a.Gyaml)?.[1];
      const flag = a.Presence?.FlagName;
      if (note) {
        const hash = murmur3('HaveReadHrlField_Note' + note);
        const region = ({ '01': 'LonLonRanch', '06': 'LakeHylia' } as Record<string,string>)[note] ?? stage;
        if (data.entries.get(hash)?.type === 'Bool') notes.set(hash, { ...placement, hash, stage: region, item: note });
      }
      if (a.Gyaml === 'Npc_Pierre_CallOcarina' && flag?.startsWith('Appear_SCARECROW_')) {
        const hash = murmur3(flag);
        const region = stage === 'HyruleField' ? 'LakeHylia' : stage;
        if (data.entries.get(hash)?.type === 'Bool') scarecrows.set(hash, { ...placement, hash, stage: region });
      }
      if (a.Gyaml === 'LookAttentionActor_HidingHoleEntrance') {
        const key = `${stage},${x},${z}`;
        if (grottos.has(key)) placement.era = undefined;
        grottos.set(key, { ...placement, hash: murmur3(key) });
      }
      const hash = murmur3('IsTreasureBoxOpen.' + a.Hash);
      if (!chestKeys.has(hash)) continue;
      const previous = chests.get(hash);
      if (previous) { if (previous.era !== era) previous.era = undefined; continue; }
      const drop = a.Dynamic?.['Drop__DropActor'];
      const item = typeof drop === 'string' ? drop : undefined;
      chests.set(hash, { ...placement, hash, item });
    }
  } catch { /* format variation: keep the unlocated chest in the totals */ }
}
const result = {
  enemyCounters: struct('DefeatedEnemyNum').map(e => e.Value),
  statues,
  rematches,
  chests: [...chestKeys].map(hash => chests.get(hash) ?? { hash }),
  notes: [...notes.values()].sort((a,b) => (a.item ?? '').localeCompare(b.item ?? '')),
  scarecrows: [...scarecrows.values()],
  grottos: [...grottos.values()],
};
fs.writeFileSync('data/companion.json', JSON.stringify(result, null, 2) + '\n');
console.log(`${statues.length} statues, ${rematches.length} rematches, ${chests.size}/${chestKeys.size} chests, ${notes.size} fairy thoughts, ${scarecrows.size} scarecrow spots, ${grottos.size} grotto entrances`);
