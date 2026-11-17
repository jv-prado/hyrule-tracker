import index from './reference-images.json';

type Photo = { file: string; name: string; source: string };
const photos: Record<string, Photo> = index;
export const quizImages = (kind: 'enemy' | 'place') => Object.entries(photos)
  .filter(([key, photo]) => (kind === 'enemy' ? /^(enemies|bosses):/ : /^(places|dungeons):/).test(key) && photo.name !== 'Chest')
  .map(([, photo]) => photo).filter((photo, i, all) => all.findIndex(other => other.name === photo.name) === i);
const actorAliases: Record<string, string> = {
  Scrub_Mad: 'mad-scrub', Scrub_Deku: 'deku-scrub', Scrub_Business: 'business-scrub', Dekubaba: 'deku-baba',
  SkullKid: 'skull-kid', Poe_Meg: 'meg-firstborn', Poe_Joelle: 'jo-second-born', Poe_Beth: 'beth-third-born',
  Poe_Amy: 'amy-fourth-born', Poe_Sharp: 'sharp-the-elder', Poe_Flat: 'flat-the-younger', Poe_Big: 'big-poe', Poe_Hyrule: 'poe',
  Skulltula_Gold: 'gold-skulltula', Moblin_Club: 'great-moblin', Dodongo: 'king-dodongo', IronKnuckle_Black: 'iron-knuckle',
  IronKnuckle_Silver: 'iron-knuckle', IronKnuckle_Nabooru: 'iron-knuckle', Stalfos_Weak: 'stalfos', Stalfos_ShadowTemple: 'stalfos',
  Bubble_Green_Big: 'green-bubble', Bubble_Green: 'green-bubble', Bubble_Red: 'red-bubble', Bubble_White: 'white-bubble', Bubble_Blue: 'blue-bubble',
  ReDead: 'redead', Wolfos_White: 'white-wolfos',
  TrickyDoor_SpiritTemple: 'false-door', TrickyDoor: 'false-door', Leever_Big: 'leever', Keese_Ice: 'ice-keese',
  Keese_Fire: 'fire-keese', Tektite_Blue: 'blue-tektite', Tektite_Red: 'red-tektite', Amos: 'armos', CrazyFloorTile: 'flying-tile',
};
const slug = (name: string) => name.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const spaced = (name: string) => name.replaceAll('_', ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
export function enemyPhoto(id: string, label: string) {
  const base = id.split('.').at(-1) ?? '';
  const actor = base.replace(/^Enemy_(DungeonBoss_|MiddleBoss_)?|^EnemyTeam_/, '');
  const key = (base === 'Enemy_Dodongo' ? 'dodongo' : actorAliases[actor]) ?? slug(/^Enemy(?:Team)?_/.test(base) ? spaced(actor) : label);
  const aliases: Record<string, string> = { 'irmas-poe': 'meg-firstborn', 'guardas-gerudo': 'gerudo-thief', 'ganondorf-ganon': 'ganon', 'iron-knuckle-team': 'iron-knuckle',
    'iron-knuckle-negro': 'iron-knuckle', 'iron-knuckle-prateado': 'iron-knuckle', 'iron-knuckle-nabooru': 'iron-knuckle', 'stalfos-em-sequencia': 'stalfos' };
  const preferred = aliases[key] ?? key;
  return photos['bosses:' + preferred] ?? photos['enemies:' + preferred];
}

export function regionPhoto(stage: string) {
  const aliases: Record<string, string> = {
    Market: 'hyrule-castle-town', TimeTemple: 'temple-of-time', LostWood: 'lost-woods',
    SacredForestMeadow: 'sacred-grove', HountedWasteland: 'mirage-desert', DesertColossus: 'evil-desert-colossus',
    InsideTheDekuTree: 'great-deku-tree', InsideJabuJabuBelly: 'lord-jabu-jabus-belly',
    DodongoCavern: 'dodongo-cavern', InsideGanonCastle: 'inside-ganondorfs-castle', GerudoTrainingGround: 'gerudo-proving-grounds',
  };
  const key = aliases[stage] ?? slug(spaced(stage));
  return photos['places:' + key] ?? photos['dungeons:' + key] ?? Object.entries(photos)
    .find(([key, photo]) => /^(places|dungeons):/.test(key) && slug(photo.name) === (aliases[stage] ?? slug(spaced(stage))))?.[1];
}
