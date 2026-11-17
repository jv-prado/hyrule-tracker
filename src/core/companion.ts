import { murmur3 } from '../gamedata/murmur3.js';
import type { Value, GameDataFile } from '../gamedata/parser.js';
import type { Rule } from '../gamedata/detect.js';
import type { ChecklistFile, MappingFile } from './tracker.js';

export interface ChestPlacement {
  hash: number;
  stage?: string;
  era?: 'child' | 'adult';
  x?: number;
  y?: number;
  z?: number;
  item?: string;
}
export interface CompanionData {
  enemyCounters: number[];
  statues: { actor: string; key?: number; requires: number[]; boss: boolean }[];
  rematches: { id: number; actor?: string; completed?: number; timeKeys: { field: number; key: number }[] }[];
  chests: ChestPlacement[];
  notes: ChestPlacement[];
  scarecrows: ChestPlacement[];
  grottos: ChestPlacement[];
}

export const CHAPTERS = [
  { id: 'deku', title: 'A Grande Árvore Deku', stages: [['Meet_DekuTree', 'Acorde na floresta Kokiri'], ['Get_StoneOfForest', 'Conquiste a Pedra da Floresta']] },
  { id: 'zelda', title: 'A princesa de Hyrule', stages: [['Goto_HyruleCastle', 'Encontre Zelda no Castelo de Hyrule']] },
  { id: 'stones', title: 'As três pedras espirituais', stages: [['Get_StoneOfFire', 'Conquiste a Pedra do Fogo'], ['Get_StoneOfWater', 'Conquiste a Pedra da Água'], ['DoorOfTime', 'Abra a Porta do Tempo']] },
  { id: 'sages', title: 'O despertar dos cinco sábios', stages: [['AllSage', 'Reúna os cinco sábios'], ['SageOfForest', 'Desperte a Sábia da Floresta'], ['SageOfFire', 'Desperte o Sábio do Fogo'], ['SageOfWater', 'Desperte a Sábia da Água'], ['SageOfShadow', 'Desperte a Sábia das Sombras'], ['SageOfSpirit', 'Desperte a Sábia dos Espíritos']] },
  { id: 'ganon', title: 'Luz e escuridão', stages: [['Defeat_Ganon', 'Derrote Ganon']] },
] as const;

export const TRIALS = [
  { id: 'child', label: 'Provação das Pedras Espirituais', result: 'DreamBossStage_HaveRecordedTime_BossRush', time: 'DreamWorld_BossRushBestTime' },
  { id: 'adult', label: 'Provação dos Cinco Sábios', result: 'DreamBossStage_HaveRecordedTime_BossRush_01', time: 'DreamWorld_BossrushBestTime_01' },
  { id: 'hero', label: 'Provação do Herói do Tempo', result: 'DreamBossStage_HaveRecordedTime_BossRush_02', time: 'DreamWorld_BossrushBestTime_02' },
] as const;

export const LOCAL_NAMES: Record<string, string> = {
  BottomOfTheWell: 'Fundo do Poço', DeathMountainCrater: 'Cratera da Montanha da Morte',
  DeathMountainTrail: 'Trilha da Montanha da Morte', DesertColossus: 'Colosso do Deserto',
  DodongoCavern: 'Caverna dos Dodongos', FireTemple: 'Templo do Fogo',
  ForestTemple: 'Templo da Floresta', GerudoFortress: 'Fortaleza Gerudo',
  GerudoTrainingGround: 'Campo de Treinamento Gerudo', GerudoValley: 'Vale Gerudo',
  GoronCity: 'Cidade Goron', Graveyard: 'Cemitério', HountedWasteland: 'Deserto Assombrado',
  HyruleCastle: 'Castelo de Hyrule', HyruleField: 'Campo de Hyrule', IceCavern: 'Caverna de Gelo',
  InsideGanonCastle: 'Castelo de Ganon', GanonCastle: 'Castelo de Ganon',
  InsideJabuJabuBelly: 'Barriga de Jabu-Jabu', InsideTheDekuTree: 'Grande Árvore Deku',
  KakarikoVillage: 'Vila Kakariko', KokiriForest: 'Floresta Kokiri', LakeHylia: 'Lago Hylia',
  LonLonRanch: 'Rancho Lon Lon', LostWood: 'Bosque Perdido', Market: 'Mercado',
  SacredForestMeadow: 'Clareira Sagrada', ShadowTemple: 'Templo das Sombras',
  SpiritTemple: 'Templo dos Espíritos', TimeTemple: 'Templo do Tempo', WaterTemple: 'Templo da Água',
  ZoraDomain: 'Domínio Zora', ZoraFountain: 'Fonte Zora', ZoraRiver: 'Rio Zora',
};

export function canonicalStage(raw?: string): string | undefined {
  if (!raw) return;
  const alias: Record<string, string> = { DodongoCave: 'DodongoCavern', InsideJabu_Jabu: 'InsideJabuJabuBelly',
    TempleOfTime: 'TimeTemple', TempleOfTimeExterior: 'TimeTemple', LostWoods: 'LostWood',
    HauntedWasteland: 'HountedWasteland', MarketEntrance: 'Market', BackAlley: 'Market', InsideDekuTree: 'InsideTheDekuTree' };
  const value = raw.split('/').at(-1)!.replace(/_(Child|Adult)$/i, '');
  return LOCAL_NAMES[value] ? value : alias[value];
}

const itemText = (item: string) => item.replace(/^(Obj|Item|Armor|Weapon|TBox)_/, '').replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
const hex = (n: number) => '0x' + n.toString(16);
const found = (name: string): Rule => ({ name, eq: 'Complete' });
const done = (name: string): Rule => ({ name, eq: true });
const bestShot = {
  shooting_child: 'MiniGame_HitTarget_BestScore',
  shooting_adult: 'MiniGame_HitTarget_Kakariko_BestScore',
  archery_750: 'MiniGame_HorsebackArchery_BestScore',
};
const enemyName = (actor: string) => ({
  Enemy_DungeonBoss_Dodongo: 'King Dodongo', Enemy_Bubble_Green_Big: 'Giant Green Bubble',
  Enemy_MiddleBoss_Poe_Meg: 'Meg', Enemy_Stalfos_Weak: 'Stalfos (Forest Temple)',
  Enemy_Stalfos_ShadowTemple: 'Stalfos (Shadow Temple)', Enemy_Moblin_Club: 'Great Moblin',
  Enemy_Scrub_Business: 'Business Scrub', Enemy_Scrub_Deku: 'Deku Scrub', Enemy_Scrub_Mad: 'Mad Scrub',
  Enemy_Amos: 'Armos', Enemy_Dekubaba: 'Deku Baba', Enemy_Poe_Big: 'Big Poe',
  Enemy_IronKnuckle_Silver: 'Iron Knuckle (silver)', Enemy_IronKnuckle_Black: 'Iron Knuckle (black)',
  Enemy_MiddleBoss_IronKnuckle_Nabooru: 'Iron Knuckle (Nabooru)', Enemy_MiddleBoss_GerudoThief: 'Gerudo Thief',
  EnemyTeam_IronKnuckle: 'Iron Knuckle (team)', EnemyTeam_Twinrova: 'Twinrova',
} as Record<string, string>)[actor] ?? itemText(actor.replace(/^Enemy_(DungeonBoss_|MiddleBoss_)?/, ''));
const rematchName = (id: number, actor?: string) => actor ? enemyName(actor) : ({
  [0x695a031e]: 'Revanche 1', [0x9c44144a]: 'Revanche 2',
} as Record<number,string>)[id] ?? 'Revanche';

const minigames: [string, string, Rule | null, string?][] = [
  ['shooting_child', 'Tiro ao alvo no Mercado', done('MiniGame_HitTarget_HrlCity_FirstTimeClear'), 'Mercado'],
  ['shooting_child_upgrade', 'Bolsa de sementes do tiro ao alvo', done('MiniGame_HitTarget_HrlCity_Get_BulletBag'), 'Mercado'],
  ['shooting_adult', 'Tiro ao alvo em Kakariko', done('MiniGame_HitTarget_Kakariko_FirstTimeClear'), 'Vila Kakariko'],
  ['shooting_adult_upgrade', 'Aljava do tiro ao alvo', done('MiniGame_HitTarget_Kakariko_Get_Quiver'), 'Vila Kakariko'],
  ['bowling_first', 'Boliche de Bombchu: primeira vitória', done('MiniGame_BombchuBowling_ClearFirstTime'), 'Mercado'],
  ['bowling_second', 'Boliche de Bombchu: segunda vitória', done('MiniGame_BombchuBowling_ClearSecondTime'), 'Mercado'],
  ['bowling_third', 'Boliche de Bombchu: terceira vitória', done('MiniGame_BombchuBowling_ClearThirdTime'), 'Mercado'],
  ['chest_game', 'Jogo dos baús', found('Step_MiniGame_SequentialChoiceTreasure'), 'Mercado'],
  ['fishing_child', 'Pesca: pedaço de coração', done('MiniGame_Fishing_GetHeartPiece'), 'Lago Hylia'],
  ['fishing_adult', 'Pesca: Escala Dourada', done('MiniGame_Fishing_GetGoldScale'), 'Lago Hylia'],
  ['archery_750', 'Tiro a cavalo: 750 pontos', { any: [done('MiniGame_HorsebackArchery_GotaHeart'), { name: bestShot.archery_750, gte: 750 }] }, 'Fortaleza Gerudo'],
  ['archery_1400', 'Tiro a cavalo: 1.400 pontos', { any: [done('MiniGame_HorseBackArchery_Get_Quiver'), { name: bestShot.archery_750, gte: 1400 }] }, 'Fortaleza Gerudo'],
  ['dampe_dig', 'Escavação de Dampé', done('GraveYard_DiggingHoleTour_Drop_HeartPiece'), 'Cemitério'],
  ['dampe_race', 'Corrida de Dampé: pedaço de coração', done('UnderTheGrave_DampeRace_HeartGeted'), 'Cemitério'],
  ['diving', 'Mergulho: Escala Prateada', done('MiniGame_Diving_ShilverScale_First'), 'Domínio Zora'],
  ['frogs_storm', 'Sapos: Canção das Tempestades', done('MiniGame_FrogTenors_StormSong'), 'Rio Zora'],
  ['frogs_song', 'Sapos: sequência musical', done('MiniGame_FrogTenors_InsectRepellent_ClearAfter'), 'Rio Zora'],
  ['ingo_race', 'Corrida de Ingo', { any: [found('Step_Get_Epona'), found('Step_MiniGame_GambleRace'), done('LonLonRanch_AfterWonGambleRace')] }, 'Rancho Lon Lon'],
  ['obstacle_course', 'Pista com obstáculos do Rancho Lon Lon', { any: [
    { all: [{ name: 'MiniGame_HorseRace_BestTime_Minutes', eq: 0 }, { name: 'MiniGame_HorseRace_BestTime_Second', gte: 1, lte: 39 }] },
    done('HavePlayedEvent.Animal_Cow_LinkHouse_GiveMilk'),
  ] }, 'Rancho Lon Lon'],
  ['lost_woods_target', 'Alvo do Bosque Perdido', done('LostWood_HitTargetOfDekuScrub_FirstClear'), 'Bosque Perdido'],
  ['theater_skull', 'Teatro Deku: Máscara de Caveira', null, 'Bosque Perdido'],
  ['theater_truth', 'Teatro Deku: Máscara da Verdade', null, 'Bosque Perdido'],
  ['super_cucco', 'Encontre o Super Cucco', done('IsClear_Minigame_FindOutCucco'), 'Rancho Lon Lon'],
  ['cucco_lady', 'Reúna os Cuccos de Kakariko', done('MiniGame_CatchCucco_IsCompleted'), 'Vila Kakariko'],
  ['skull_kid', 'Sessão musical dos Skull Kids', done('Minigame_SkullKidSession_IsGetHeartPiece'), 'Bosque Perdido'],
  ['running_man', 'Complete a corrida com o corredor', done('Subevent_RunningRace_HaveFinished'), 'Vale Gerudo'],
  ['dampe_race_win', 'Corrida de Dampé: primeira vitória', { any: [
    { name: 'MiniGame_DampeRace_ClearCount', gte: 1 }, done('UnderTheGrave_DampeRace_HeartGeted'),
  ] }, 'Cemitério'],
  ['shooting_child_expert', 'Modo especialista no Mercado', null, 'Mercado'],
  ['shooting_adult_expert', 'Modo especialista em Kakariko', null, 'Vila Kakariko'],
];
const sideEvents: [string, string, Rule | null, string?][] = [
  ['light', 'O Sábio da Luz', found('Step_SageOfLight'), 'Templo do Tempo'],
  ['escape', 'Fuga do Castelo de Ganon', found('Step_EscapeFromCrumblingGanonCastle'), 'Castelo de Ganon'],
  ['richard', 'Encontre Richard', found('Step_SubEvent_FindRichard'), 'Mercado'],
  ['bottle_tutorial', 'Aprenda a usar uma garrafa', found('Step_Market_Item_Bottle_TutorialEvent'), 'Mercado'],
  ['fire_arrow', 'Conquiste as Flechas de Fogo', found('Step_SubEvent_GetFireArrow'), 'Lago Hylia'],
  ['truth', 'Encontre a Lente da Verdade', found('Step_SubEvent_GetGlassTruth'), 'Fundo do Poço'],
  ['ice_arrow', 'Conquiste as Flechas de Gelo', found('Step_SubEvent_GetIceArrow'), 'Campo de Treinamento Gerudo'],
  ['poes', 'Colecionador de fantasmas', found('Step_SubEvent_GhostShop'), 'Mercado'],
  ['skull_rewards', 'Libere a Casa das Skulltulas', found('Step_GatheringTokenGold'), 'Vila Kakariko'],
  ['all_bosses', 'Complete os combates do Salão', found('Step_SubEvent_AllBossBattle')],
];

export function extendChecklist(checklist: ChecklistFile, mapping: MappingFile, data: CompanionData) {
  type Category = ChecklistFile['categories'][number];
  const add = (id: string, label: string, entries: [string, string, Rule | null, string?][], part: Category['part'] = 'A', iconId = id) => {
    const items = entries.map(([suffix, name, detect, chapter], i) => {
      const itemId = id + '.' + suffix;
      mapping.entries[itemId] = { label: name, detect, confidence: 'confirmed', evidence: detect ? 'Campo do progresso do remake.' : 'Confirmação manual no tracker.' };
      return { id: itemId, name, iconId, number: i + 1, chapter };
    });
    checklist.categories.push({ id, label, kind: 'list', part, countsToward100: part === 'A', items });
  };
  add('main_quests', 'Missões principais', CHAPTERS.map(c => [c.id, c.title, { all: c.stages.map(([key]) => found('Step_' + key)) }]), 'A', 'side_quest');
  const side = checklist.categories.find(c => c.id === 'side_quests')!;
  side.items.push({
    id: 'side_quests.royal_family_song', number: 7, name: 'A Song of the Royal Family', iconId: 'side_quest',
    where: "In Kakariko Graveyard, play Zelda's Lullaby at the Royal Family's Tomb to open it. Read the inscription at the back of the tomb to learn the Sun's Song.",
  });
  // The quest covers every Great Fairy fountain (6), not just the first visit.
  const fairies = checklist.categories.find(c => c.id === 'great_fairies')?.items ?? [];
  const fairyRules = fairies.map(f => mapping.entries[f.id]?.detect).filter((r): r is Rule => !!r);
  if (fairyRules.length && mapping.entries['side_quests.to_the_great_fairy']) {
    mapping.entries['side_quests.to_the_great_fairy'] = {
      ...mapping.entries['side_quests.to_the_great_fairy'],
      detect: { all: fairyRules },
      evidence: 'Concluída quando as 6 fontes das Grandes Fadas foram visitadas (categoria Grandes Fadas).',
    };
  }
  mapping.entries['side_quests.royal_family_song'] = { label: 'A Song of the Royal Family', detect: found('Step_SubEvent_GetMelodySun'), confidence: 'confirmed', evidence: 'Etapa de conclusão da Canção do Sol.' };
  const masks = checklist.categories.find(c => c.id === 'masks')!;
  for (const [id, label] of [['Goron', 'Goron Mask'], ['Zora', 'Zora Mask'], ['Gerudo', 'Gerudo Mask']]) {
    const itemId = 'masks.' + id.toLowerCase() + '_mask';
    masks.items.push({ id: itemId, number: masks.items.length + 1, name: label, iconId: 'masks' });
    mapping.entries[itemId] = { label, detect: done('IsGet.Armor_Child_Mask_' + id), confidence: 'confirmed', evidence: 'Flag de aquisição da máscara do remake.' };
  }
  add('statues', 'Estátuas de monstros', data.statues.map(s => [
    s.actor, enemyName(s.actor),
    { all: [...(s.key ? [{ key: hex(s.key), gte: 1 }] : [{ name: 'DefeatedEnemyNum.Enemy_Stalfos', gte: 1 }]), ...s.requires.map(k => ({ key: hex(k), eq: true }))] },
  ]), 'A', 'boss');
  add('trials', 'Provações do Salão', TRIALS.map(t => [t.id, t.label, { name: t.result }]), 'A', 'boss');
  add('rematches', 'Revanche dos chefes', data.rematches.map(r => [
    r.actor ?? hex(r.id), rematchName(r.id, r.actor), r.completed ? { key: hex(r.completed) } : null,
  ]), 'A', 'boss');
  add('minigames', 'Minijogos', minigames.map(([id, label, detect, region]) => {
    const chestPrize = id === 'chest_game' ? mapping.entries['heart_pieces.029']?.detect : null;
    return [id, label, chestPrize && detect ? { any: [chestPrize, detect] } : detect, region];
  }), 'B', 'key_items');
  add('side_events', 'Eventos e descobertas', sideEvents, 'B', 'side_quest');
  add('bean_spots', 'Locais de feijão mágico', [
    ['KokiriForest', 'Floresta Kokiri'], ['LostWood01', 'Bosque Perdido'], ['LostWood02', 'Bosque Perdido'],
    ['Graveyard', 'Cemitério'], ['ZoraRiver', 'Rio Zora'], ['LakeHylia', 'Lago Hylia'],
    ['DeathMountainTrail', 'Trilha da Montanha da Morte'], ['DeathMountainCrater', 'Cratera da Montanha da Morte'],
    ['GerudoValley', 'Vale Gerudo'], ['DesertColossus', 'Colosso do Deserto'],
  ].map(([key, region]) => [key, region, done('Gimmick_MagicBeanSoil_' + key), region]), 'B', 'key_items');
  add('big_poe_spots', 'Big Poes do Campo de Hyrule', Array.from({ length: 10 }, (_, i) => {
    const n = String(i + 1).padStart(2, '0');
    // A tester save with all ten sold (GhostShop_CouponNum = 1000) had every HyruleField_Defeat_BigPoe flag false,
    // so those flags don't stick. 1,000 points means all ten field Big Poes were caught.
    return [n, 'Big Poe ' + n, { any: [done('HyruleField_Defeat_BigPoe_' + n), { name: 'GhostShop_CouponNum', gte: 1000 }] }, LOCAL_NAMES.HyruleField];
  }), 'B', 'boss');
  const stoneGroups = [
    ['GORON_CITY', 'GoronCity', 2], ['HYRULE_FIELD', 'HyruleField', 4],
    ['KAKARIKO_VILLAGE', 'KakarikoVillage', 1], ['HYRULE_CASTLE', 'HyruleCastle', 3],
    ['KOKIRI_FOREST', 'KokiriForest', 4], ['LOST_WOOD', 'LostWood', 2], ['LAKE_HYLIA', 'LakeHylia', 3],
    ['ZORA_RIVER', 'ZoraRiver', 3], ['ZORA_FOUNTAIN', 'ZoraFountain', 2], ['HYRULE_MARKET', 'Market', 4],
    ['GERUDO_VALLEY', 'GerudoValley', 1], ['SACRED_FOREST_MEADOW', 'SacredForestMeadow', 3],
    ['DEATH_MOUNTAIN_CRATER', 'DeathMountainCrater', 2], ['DESERT_COLOSSUS', 'DesertColossus', 1],
    ['DEATH_MOUNTAIN_TRAIL', 'DeathMountainTrail', 2], ['DODONGO_CAVERN', 'DodongoCavern', 1],
    ['ZORA_DOMAIN', 'ZoraDomain', 1], ['GRAVEYARD', 'Graveyard', 1],
  ] as const;
  add('gossip_stones', 'Pedras falantes', stoneGroups.flatMap(([flag, region, count]) =>
    Array.from({ length: count }, (_, i): [string, string, Rule, string] => {
      const id = flag + '_' + String(i + 1).padStart(2, '0');
      return [id, `Pedra falante ${i + 1}`, done('BlewOcarinaByGossipStone.GOSSIP_' + id), LOCAL_NAMES[region]];
    })), 'B', 'key_items');
  const coinRooms = [
    ['IceCavern_Room06_SilverRupeeGet', 'IceCavern', '06'],
    ['BottomOfTheWell_Level_Room_09_A_SilverRupee_GetAll', 'BottomOfTheWell', '09'],
    ...['02', '06', '09'].map(n => [`GerudoTrainingGround_Dungeon_Room${n}_SilverRupee`, 'GerudoTrainingGround', n]),
    ...['03', '10', '14', '16'].map(n => [`InsideGanonCastle_Dungeon_Room${n}_SilverRupee`, 'InsideGanonCastle', n]),
  ];
  add('silver_rupees', 'Desafios das rupees prateadas', coinRooms.map(([flag, region, room]) =>
    [flag, `Rupees prateadas ${room}`, done(flag), LOCAL_NAMES[region]]), 'B', 'key_items');
  add('cow_rewards', 'Vacas e leite', [
    ['house', 'Vaca para a casa de Link', done('HavePlayedEvent.Animal_Cow_LinkHouse_GiveMilk'), LOCAL_NAMES.KokiriForest],
    ['milk', 'Toque para uma vaca e ganhe leite', done('HavePlayedEvent.Animal_Cow_GiveMilk')],
  ], 'B', 'key_items');
  add('chests', 'Baús', data.chests.map(c => [hex(c.hash), c.item ? itemText(c.item) : 'Baú do tesouro',
    { key: hex(c.hash) }, c.stage ? LOCAL_NAMES[c.stage] ?? itemText(c.stage) : undefined]), 'B', 'key_items');
  for (const [id, label, rows, kind, automatic] of [
    ['fairy_thoughts', 'Pensamentos de fada', data.notes, 'Pensamento de fada', true],
    ['scarecrow_spots', 'Chamadas de Pierre', data.scarecrows, 'Chamado de Pierre', true],
    ['grottos', 'Entradas de grutas', data.grottos, 'Entrada de gruta', false],
  ] as const) add(id, label, rows.map((p, i) => [hex(p.hash), `${kind} ${p.item ?? i + 1}`,
    automatic ? { key: hex(p.hash) } : null, p.stage ? LOCAL_NAMES[p.stage] ?? itemText(p.stage) : undefined]), 'B', 'key_items');
}

const numeric = (value: Value | undefined) => typeof value === 'number' && Number.isFinite(value) ? value : null;
export const MASK_SALE_NAMES = ['Keaton Mask', 'Skull Mask', 'Spooky Mask', 'Bunny Hood'] as const;
const MASK_SALES_BY_STEP = [
  ['NotReady', 'Ready', 'Step01', 'Step01_Hint'],
  ['Step02', 'Step03', 'Step03_Hint'],
  ['Step04', 'Step05', 'Step05_Hint'],
  ['Step06', 'Step07', 'Step07_Hint'],
  ['Step08', 'Complete'],
].map(steps => steps.map(step => murmur3(step)));

function maskSales(get: (name: string) => Value | undefined): number | null {
  const step = get('Step_SubEvent_MaskSalesman');
  const soldByStep = typeof step === 'number' ? MASK_SALES_BY_STEP.findIndex(steps => steps.includes(step >>> 0)) : -1;
  // Borrowing the next mask confirms the preceding sale, even if the quest step is missing.
  const soldByEvidence = [
    get('IsGet.Armor_Child_Mask_Skull') === true,
    get('IsGet.Armor_Child_Mask_Spooky') === true,
    get('IsGet.Armor_Child_Mask_Bunny') === true,
    get('IsAfterSell_Mask_Bunny') === true || get('IsGet.Armor_Child_Mask_Truth') === true,
  ].lastIndexOf(true) + 1;
  return soldByStep < 0 && soldByEvidence === 0 ? null : Math.max(soldByStep, soldByEvidence);
}

export const RUPEES = murmur3('PlayerStatus.CurrentRupee');
export function companionProgress(data: CompanionData, save: GameDataFile) {
  const get = (name: string) => save.entries.get(murmur3(name))?.value;
  const getKey = (key: number) => numeric(save.entries.get(key)?.value);
  const counters = data.enemyCounters.map(getKey).filter((n): n is number => n !== null);
  return {
    rupees: getKey(RUPEES),
    enemies: counters.length ? counters.reduce((sum, n) => sum + n, 0) : null,
    visited: Object.keys(LOCAL_NAMES).filter(stage => get('IsVisitLocation.' + stage) === true),
    maskSales: maskSales(get),
    minigameScores: Object.fromEntries(Object.entries(bestShot).map(([id, name]) => [id, numeric(get(name))])),
    trials: TRIALS.map(t => ({ id: t.id, label: t.label, done: get(t.result) === true, frames: numeric(get(t.time)) })),
    rematches: data.rematches.map(r => {
      const key = r.timeKeys.find(k => k.field === murmur3('BestTimeFrame'))?.key;
      return { id: 'rematches.' + (r.actor ?? hex(r.id)), frames: key == null ? null : getKey(key) };
    }),
    chapters: CHAPTERS.map(c => ({ id: c.id, title: c.title, stages: c.stages.map(([name, label]) => {
      const value = get('Step_' + name);
      return { label, done: value === murmur3('Complete'), started: typeof value === 'number' && value !== murmur3('NotReady') };
    }) })),
  };
}

export type CompanionProgress = ReturnType<typeof companionProgress>;
