// Projects Link's in-game position (x, y, z) onto the atlas maps.
//
// Scene → place table, orthographic capture calibration, floor heights and the projection
// math are ported from Ocarina Atlas (src/lib/lichii-server.ts), MIT License,
// Copyright (c) 2026 antonioalvromero. See docs/atlas-license.txt.

export interface PlayerPosition { x: number; y: number; z: number; yaw: number }
export interface ViewBox { vx: number; vy: number; vw: number; vh: number }
export interface AtlasPlaceMap { id: string; aspect?: number; vb?: ViewBox }
export interface AtlasPlace { id: string; pin: { x: number; y: number }; startMap?: string; maps: AtlasPlaceMap[]; kind?: string }
export interface Fraction { x: number; y: number }

/** Where Link is on the atlas: the place, which of its maps, and 0..1 coordinates on it and on the world map. */
export interface PlayerFix {
  placeId: string;
  mapId: string | null;
  at: Fraction | null;
  world: Fraction;
  yaw: number;
  age: 'child' | 'adult' | null;
}


interface MapCaptureConfig {
  camX: number
  camY: number
  camZ: number
  height: number
  cx?: number
  cz?: number
  scaleX?: number
  scaleZ?: number
}

const CIUDADELA_ADULTO_CAPTURE: MapCaptureConfig = {
  camX: 0.0,
  camY: 200.0,
  camZ: 3.0,
  height: 214.0,
  scaleX: 8.4001,
  cx: 190.51,
  scaleZ: 8.0681,
  cz: 467.58,
}

const CIUDADELA_NINO_CAPTURE: MapCaptureConfig = {
  camX: 0.0,
  camY: 200.0,
  camZ: 3.0,
  height: 214.0,
  scaleX: 5.4314,
  cx: 422.86,
  scaleZ: 5.2191,
  cz: 305.08,
}

/**
 * Scene / BancName to oot.json placeId and orthographic capture parameters
 * from Game/MapCaptureInfo/MapCaptureInfo.game__MapCaptureInfo.bgyml
 * and Game/UI/MapMenuInfo.game__ui__MapMenuInfo.bgyml.
 */
const SCENE_TO_PLACE: Record<
  string,
  {
    placeId: string
    defaultAge?: 'child' | 'adult'
    capture?: MapCaptureConfig
    captureByMapId?: Record<string, MapCaptureConfig>
  }
> = {
  KokiriForest: {
    placeId: 'kokiri',
    capture: {
      camX: -5.0,
      camY: 120.0,
      camZ: -12.0,
      height: 300.0,
      scaleX: 2.8985,
      cx: 429.08,
      scaleZ: 2.749,
      cz: 250.37,
    },
  },
  LostWood: {
    placeId: 'perdido',
    capture: { camX: 6.0, camY: 200.0, camZ: -1.0, height: 400.0 },
  },
  LostWoods: {
    placeId: 'perdido',
    capture: { camX: 6.0, camY: 200.0, camZ: -1.0, height: 400.0 },
  },
  SacredForestMeadow: {
    placeId: 'prado',
    capture: {
      camX: -12.0,
      camY: 150.0,
      camZ: -25.0,
      height: 317.0,
      scaleX: 6.15,
      cx: 487.31,
      scaleZ: 6.15,
      cz: 1062.72,
    },
  },
  HyruleField: {
    placeId: 'llanura',
    capture: {
      camX: -23.0,
      camY: 200.0,
      camZ: 197.0,
      height: 736.0,
      scaleX: 1.4552,
      cx: 504.27,
      scaleZ: 1.4867,
      cz: 11.89,
    },
  },
  LonLonRanch: {
    placeId: 'lonlon',
    capture: {
      camX: -86.0,
      camY: 200.0,
      camZ: 239.0,
      height: 276.0,
      scaleX: 5.5232,
      cx: 917.27,
      scaleZ: 5.7915,
      cz: -996.27,
    },
  },
  Market: {
    placeId: 'ciudadela',
    capture: CIUDADELA_ADULTO_CAPTURE,
    captureByMapId: { nino: CIUDADELA_NINO_CAPTURE },
  },
  MarketEntrance: {
    placeId: 'ciudadela',
    capture: CIUDADELA_ADULTO_CAPTURE,
    captureByMapId: { nino: CIUDADELA_NINO_CAPTURE },
  },
  BackAlley: {
    placeId: 'ciudadela',
    capture: CIUDADELA_ADULTO_CAPTURE,
    captureByMapId: { nino: CIUDADELA_NINO_CAPTURE },
  },
  TempleOfTimeExterior: {
    placeId: 'ciudadela',
    capture: CIUDADELA_ADULTO_CAPTURE,
    captureByMapId: { nino: CIUDADELA_NINO_CAPTURE },
  },
  TempleOfTime: {
    placeId: 'ciudadela',
    capture: CIUDADELA_ADULTO_CAPTURE,
    captureByMapId: { nino: CIUDADELA_NINO_CAPTURE },
  },
  GuardHouse: {
    placeId: 'ciudadela',
    capture: {
      camX: 0.0,
      camY: 200.0,
      camZ: 3.0,
      height: 214.0,
      scaleX: 6.15,
      cx: 412.06,
      scaleZ: 6.15,
      cz: 269.08,
    },
  },
  HyruleCastle: {
    placeId: 'castillo',
    defaultAge: 'child',
    capture: { camX: 0.0, camY: 200.0, camZ: -80.0, height: 242.0 },
    captureByMapId: {
      nino: {
        camX: 0.0,
        camY: 200.0,
        camZ: -80.0,
        height: 242.0,
        scaleX: 8.2959,
        cx: 286.92,
        scaleZ: 8.5297,
        cz: 1319.87,
      },
    },
  },
  CastleGrounds: {
    placeId: 'castillo',
    capture: { camX: 0.0, camY: 200.0, camZ: -80.0, height: 242.0 },
    captureByMapId: {
      nino: {
        camX: 0.0,
        camY: 200.0,
        camZ: -80.0,
        height: 242.0,
        scaleX: 8.2959,
        cx: 286.92,
        scaleZ: 8.5297,
        cz: 1319.87,
      },
    },
  },
  GanonsCastleExterior: {
    placeId: 'castillo',
    defaultAge: 'adult',
    capture: { camX: 0.0, camY: 200.0, camZ: -80.0, height: 242.0 },
  },
  KakarikoVillage: {
    placeId: 'kakariko',
    capture: {
      camX: -50.0,
      camY: 200.0,
      camZ: 42.0,
      height: 246.0,
      scaleX: 4.8703,
      cx: 671.18,
      scaleZ: 5.0719,
      cz: 188.14,
    },
  },
  Graveyard: {
    placeId: 'cementerio',
    capture: {
      camX: 18.0,
      camY: 200.0,
      camZ: 8.0,
      height: 148.0,
      scaleX: 6.8026,
      cx: 290.99,
      scaleZ: 6.3988,
      cz: 122.36,
    },
  },
  RoyalFamilysTomb: {
    placeId: 'cementerio',
    capture: {
      camX: 18.0,
      camY: 200.0,
      camZ: 8.0,
      height: 148.0,
      scaleX: 6.8026,
      cx: 290.99,
      scaleZ: 6.3988,
      cz: 122.36,
    },
  },
  WindmillAndDampesGrave: {
    placeId: 'cementerio',
    capture: {
      camX: 18.0,
      camY: 200.0,
      camZ: 8.0,
      height: 148.0,
      scaleX: 6.8026,
      cx: 290.99,
      scaleZ: 6.3988,
      cz: 122.36,
    },
  },
  DeathMountainTrail: {
    placeId: 'sendero',
    capture: {
      camX: -21.0,
      camY: 200.0,
      camZ: -36.0,
      height: 390.0,
      scaleX: 7.5379,
      cx: 644.3,
      scaleZ: 8.0032,
      cz: 1341.65,
    },
  },
  GoronCity: {
    placeId: 'goron',
    capture: {
      camX: -5.0,
      camY: 150.0,
      camZ: 0.0,
      height: 156.0,
      scaleX: 8.97,
      cx: 463.57,
      scaleZ: 9.1644,
      cz: 502.25,
    },
  },
  DeathMountainCrater: {
    placeId: 'crater',
    capture: {
      camX: -12.0,
      camY: 200.0,
      camZ: 12.0,
      height: 188.0,
      scaleX: 7.5556,
      cx: 535.67,
      scaleZ: 7.0278,
      cz: 376.06,
    },
  },
  ZoraRiver: {
    placeId: 'rio',
    capture: {
      camX: 20.0,
      camY: 200.0,
      camZ: -15.0,
      height: 265.0,
      scaleX: 3.2759,
      cx: 352.05,
      scaleZ: 3.2953,
      cz: 225.64,
    },
  },
  ZorasRiver: {
    placeId: 'rio',
    capture: {
      camX: 20.0,
      camY: 200.0,
      camZ: -15.0,
      height: 265.0,
      scaleX: 3.2759,
      cx: 352.05,
      scaleZ: 3.2953,
      cz: 225.64,
    },
  },
  ZoraDomain: {
    placeId: 'dominio',
    capture: {
      camX: 30.0,
      camY: 225.0,
      camZ: -14.0,
      height: 151.0,
      scaleX: 6.4055,
      cx: 218.87,
      scaleZ: 6.3045,
      cz: 315.57,
    },
  },
  ZorasDomain: {
    placeId: 'dominio',
    capture: {
      camX: 30.0,
      camY: 225.0,
      camZ: -14.0,
      height: 151.0,
      scaleX: 6.4055,
      cx: 218.87,
      scaleZ: 6.3045,
      cz: 315.57,
    },
  },
  ZoraFountain: {
    placeId: 'fuente',
    capture: {
      camX: 30.0,
      camY: 200.0,
      camZ: -13.0,
      height: 195.0,
      scaleX: 7.0485,
      cx: 200.7,
      scaleZ: 7.1346,
      cz: 527.48,
    },
  },
  ZorasFountain: {
    placeId: 'fuente',
    capture: {
      camX: 30.0,
      camY: 200.0,
      camZ: -13.0,
      height: 195.0,
      scaleX: 7.0485,
      cx: 200.7,
      scaleZ: 7.1346,
      cz: 527.48,
    },
  },
  LakeHylia: {
    placeId: 'lago',
    capture: {
      camX: -200.0,
      camY: 200.0,
      camZ: 490.0,
      height: 422.0,
      scaleX: 2.9309,
      cx: 995.76,
      scaleZ: 3.044,
      cz: -1162.42,
    },
  },
  GerudoValley: {
    placeId: 'valle',
    capture: {
      camX: 0.0,
      camY: 200.0,
      camZ: -13.0,
      height: 240.0,
      scaleX: 5.2663,
      cx: 412.17,
      scaleZ: 5.2871,
      cz: 480.49,
    },
  },
  GerudoFortress: {
    placeId: 'fortaleza',
    defaultAge: 'adult',
    capture: {
      camX: 86.0,
      camY: 130.0,
      camZ: -22.0,
      height: 340.0,
      scaleX: 3.0667,
      cx: 199.04,
      scaleZ: 3.0306,
      cz: 421.96,
    },
  },
  GerudosFortress: {
    placeId: 'fortaleza',
    defaultAge: 'adult',
    capture: {
      camX: 86.0,
      camY: 130.0,
      camZ: -22.0,
      height: 340.0,
      scaleX: 3.0667,
      cx: 199.04,
      scaleZ: 3.0306,
      cz: 421.96,
    },
  },
  ThievesHideout: {
    placeId: 'fortaleza',
    defaultAge: 'adult',
    capture: {
      camX: 86.0,
      camY: 130.0,
      camZ: -22.0,
      height: 340.0,
      scaleX: 3.0667,
      cx: 199.04,
      scaleZ: 3.0306,
      cz: 421.96,
    },
  },
  HountedWasteland: {
    placeId: 'desierto',
    defaultAge: 'adult',
    capture: { camX: 6.0, camY: 100.0, camZ: -52.0, height: 645.0 },
  },
  HauntedWasteland: {
    placeId: 'desierto',
    defaultAge: 'adult',
    capture: { camX: 6.0, camY: 100.0, camZ: -52.0, height: 645.0 },
  },
  DesertColossus: {
    placeId: 'coloso',
    capture: {
      camX: -88.0,
      camY: 200.0,
      camZ: 12.0,
      height: 305.0,
      scaleX: 3.8733,
      cx: 790.51,
      scaleZ: 4.0488,
      cz: 279.89,
    },
  },
  InsideTheDekuTree: {
    placeId: 'deku',
    defaultAge: 'child',
    capture: {
      camX: -36.0,
      camY: 200.0,
      camZ: 18.0,
      height: 125.0,
      scaleX: 8.5609,
      cx: 733.86,
      scaleZ: 8.9211,
      cz: 139.64,
    },
  },
  DekuTree: {
    placeId: 'deku',
    defaultAge: 'child',
    capture: {
      camX: -36.0,
      camY: 200.0,
      camZ: 18.0,
      height: 125.0,
      scaleX: 8.5609,
      cx: 733.86,
      scaleZ: 8.9211,
      cz: 139.64,
    },
  },
  DodongoCavern: {
    placeId: 'dodongos',
    capture: {
      camX: 31.0,
      camY: 115.0,
      camZ: -30.0,
      height: 256.0,
      scaleX: 4.2462,
      cx: 284.07,
      scaleZ: 4.2462,
      cz: 505.86,
    },
  },
  DodongosCavern: {
    placeId: 'dodongos',
    capture: {
      camX: 31.0,
      camY: 115.0,
      camZ: -30.0,
      height: 256.0,
      scaleX: 4.2462,
      cx: 284.07,
      scaleZ: 4.2462,
      cz: 505.86,
    },
  },
  InsideJabuJabuBelly: {
    placeId: 'jabu',
    defaultAge: 'child',
    capture: { camX: -1.0, camY: 200.0, camZ: -92.0, height: 328.0 },
  },
  JabuJabusBelly: {
    placeId: 'jabu',
    defaultAge: 'child',
    capture: { camX: -1.0, camY: 200.0, camZ: -92.0, height: 328.0 },
  },
  ForestTemple: {
    placeId: 'bosque',
    defaultAge: 'adult',
    capture: {
      camX: -3.0,
      camY: 200.0,
      camZ: 6.0,
      height: 245.0,
      scaleX: 5.5747,
      cx: 462.29,
      scaleZ: 5.6324,
      cz: 406.55,
    },
  },
  FireTemple: {
    placeId: 'fuego',
    defaultAge: 'adult',
    capture: {
      camX: 17.0,
      camY: 200.0,
      camZ: -3.0,
      height: 220.0,
      scaleX: 3.965,
      cx: 354.2,
      scaleZ: 3.9651,
      cz: 218.31,
    },
  },
  WaterTemple: {
    placeId: 'agua',
    defaultAge: 'adult',
    capture: {
      camX: -24.0,
      camY: 200.0,
      camZ: -45.0,
      height: 263.0,
      scaleX: 4.9626,
      cx: 524.8,
      scaleZ: 4.9061,
      cz: 655.73,
    },
  },
  ShadowTemple: {
    placeId: 'sombra',
    defaultAge: 'adult',
    capture: {
      camX: -22.0,
      camY: 200.0,
      camZ: 7.0,
      height: 433.0,
      scaleX: 1.9291,
      cx: 467.09,
      scaleZ: 1.9529,
      cz: 259.55,
    },
  },
  SpiritTemple: {
    placeId: 'espiritu',
    capture: {
      camX: 0.0,
      camY: 200.0,
      camZ: -24.0,
      height: 202.0,
      // Least-squares fit against Spirit Temple's 5 Gold Skulltulas & Entrance Anchor in SVG space
      scaleX: 6.0705,
      cx: 423.4,
      scaleZ: 6.4032,
      cz: 594.39,
    },
  },
  BottomOfTheWell: {
    placeId: 'pozo',
    defaultAge: 'child',
    capture: {
      camX: -12.0,
      camY: 200.0,
      camZ: -32.0,
      height: 238.0,
      scaleX: 8.0269,
      cx: 535.33,
      scaleZ: 8.1374,
      cz: 945.29,
    },
  },
  IceCavern: {
    placeId: 'hielo',
    defaultAge: 'adult',
    capture: {
      camX: 11.0,
      camY: 110.0,
      camZ: 12.0,
      height: 287.0,
      scaleX: 5.2876,
      cx: 337.98,
      scaleZ: 5.1869,
      cz: 469.16,
    },
  },
  GerudoTrainingGround: {
    placeId: 'gerudo',
    defaultAge: 'adult',
    capture: { camX: 21.0, camY: 130.0, camZ: -57.0, height: 190.0 },
  },
  GanonCastle: {
    placeId: 'ganon',
    defaultAge: 'adult',
    capture: { camX: 61.0, camY: 200.0, camZ: 297.0, height: 268.0 },
  },
  InsideGanonCastle: {
    placeId: 'ganon',
    defaultAge: 'adult',
    capture: { camX: 0.0, camY: 500.0, camZ: -22.0, height: 380.0 },
  },
  InsideGanonsCastle: {
    placeId: 'ganon',
    defaultAge: 'adult',
    capture: { camX: 0.0, camY: 500.0, camZ: -22.0, height: 380.0 },
  },
  GanonsTower: {
    placeId: 'ganon',
    defaultAge: 'adult',
    capture: { camX: 0.0, camY: 500.0, camZ: -22.0, height: 380.0 },
  },
  CrumblingGanonCastle: {
    placeId: 'ganon',
    defaultAge: 'adult',
    capture: { camX: 0.0, camY: 500.0, camZ: -22.0, height: 380.0 },
  },
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** "ZoraFountain/ZoraFountain_Child" or a Work/Banc/Scene path → scene key and age hint. */
export function normalizeSceneName(rawScene: string | null | undefined): { scene: string | null; ageHint: 'child' | 'adult' | null } {
  if (!rawScene) return { scene: null, ageHint: null };
  let cleaned = rawScene.trim();
  const bcett = cleaned.match(/Scene\/([A-Za-z0-9_]+)\/([A-Za-z0-9_]+)/);
  if (bcett) cleaned = bcett[2] || bcett[1] || cleaned;
  else if (cleaned.includes('/')) cleaned = cleaned.split('/').filter(Boolean).pop() ?? cleaned;
  cleaned = cleaned.replace(/\.(bcett|json|byml|bgyml).*$/i, '');
  let ageHint: 'child' | 'adult' | null = null;
  if (/_Child(_Alternative)?$/i.test(cleaned)) { ageHint = 'child'; cleaned = cleaned.replace(/_Child(_Alternative)?$/i, ''); }
  else if (/_Adult(_Alternative)?$/i.test(cleaned)) { ageHint = 'adult'; cleaned = cleaned.replace(/_Adult(_Alternative)?$/i, ''); }
  return { scene: cleaned || null, ageHint };
}

export function determineDungeonFloor(placeId: string, y: number): string {
  switch (placeId) {
    case 'espiritu': return y < 109.5 ? '1F' : y < 127.5 ? '2F' : y < 148.0 ? '3F' : '4F';
    case 'deku': return y < 70.0 ? 'S2' : y < 90.0 ? 'S1' : y < 104.0 ? '1F' : y < 115.0 ? '2F' : '3F';
    case 'dodongos': return y < 105.0 ? '1F' : '2F';
    case 'jabu': return y < 85.0 ? 'S1' : y < 94.0 ? '1F' : '2F';
    case 'bosque': return y < 66.0 ? 'S2' : y < 90.0 ? 'S1' : y < 109.0 ? '1F' : y < 120.0 ? '2F' : '3F';
    case 'fuego': return y < 124.0 ? '1F' : y < 142.0 ? '2F' : y < 164.0 ? '3F' : y < 182.0 ? '4F' : '5F';
    case 'agua': return y < 95.0 ? 'S1' : y < 106.0 ? '1F' : y < 114.0 ? '2F' : '3F';
    case 'sombra': return y < 45.0 ? 'S4' : y < 70.0 ? 'S3' : y < 87.0 ? 'S2' : 'S1';
    case 'pozo': return y < 94.0 ? 'S2' : 'S1';
    case 'hielo': return 'principal';
    default: return '1F';
  }
}

export function determineMapId(place: AtlasPlace, age: 'child' | 'adult' | null, y: number | null): string | null {
  if (place.maps.length === 0) return null;
  if (place.maps.length === 1) return place.maps[0].id;
  const ids = new Set(place.maps.map(m => m.id));
  if (ids.has('nino') && ids.has('adulto')) return age === 'child' ? 'nino' : 'adulto';
  if (y !== null && Number.isFinite(y)) {
    const floor = determineDungeonFloor(place.id, y);
    if (ids.has(floor)) return floor;
  }
  return place.startMap ?? place.maps[0].id;
}

/** The overworld is one seamless HyruleField scene; route the ranch and the lake out of it. */
export function resolveEffectiveScene(sceneKey: string | null, x: number | null, z: number | null): string | null {
  if (sceneKey !== 'HyruleField' || x === null || z === null) return sceneKey;
  if (x >= -165 && x <= -14 && z >= 186 && z <= 305) return 'LonLonRanch';
  if (x >= -350 && x <= -40 && z >= 395 && z <= 620) return 'LakeHylia';
  return sceneKey;
}

export function projectToPlaceMap(sceneKey: string, place: AtlasPlace, mapId: string | null, x: number, z: number): Fraction | null {
  if (!mapId) return null;
  const placeMap = place.maps.find(m => m.id === mapId) ?? place.maps[0];
  if (!placeMap) return null;
  const info = SCENE_TO_PLACE[sceneKey];
  const cap = info?.captureByMapId?.[placeMap.id] ?? info?.capture;
  const vb = placeMap.vb;
  const round = (f: Fraction) => ({ x: Number(f.x.toFixed(4)), y: Number(f.y.toFixed(4)) });
  if (cap && vb) {
    const scaleX = cap.scaleX ?? 1260.0 / cap.height;
    const scaleZ = cap.scaleZ ?? 1260.0 / cap.height;
    const cx = cap.cx ?? vb.vx + vb.vw / 2 - cap.camX * scaleX;
    const cz = cap.cz ?? vb.vy + vb.vh / 2 - cap.camZ * scaleZ;
    return round({ x: clamp((cx + x * scaleX - vb.vx) / vb.vw, 0.02, 0.98), y: clamp((cz + z * scaleZ - vb.vy) / vb.vh, 0.02, 0.98) });
  }
  if (cap) {
    const width = cap.height * (placeMap.aspect ?? 1.6);
    return round({ x: clamp(0.5 + (x - cap.camX) / width, 0.02, 0.98), y: clamp(0.5 + (z - cap.camZ) / cap.height, 0.02, 0.98) });
  }
  return null;
}

function projectToWorldMap(place: AtlasPlace, f: Fraction | null): Fraction {
  if (!f) return { ...place.pin };
  const spread = place.id === 'llanura' ? 0.14 : place.kind === 'zone' ? 0.035 : 0.018;
  return {
    x: Number(clamp(place.pin.x + (f.x - 0.5) * spread, 0.02, 0.98).toFixed(4)),
    y: Number(clamp(place.pin.y + (f.y - 0.5) * spread, 0.02, 0.98).toFixed(4)),
  };
}

/** Scene name (save or live) + position → where to draw Link on the atlas, or null if the scene isn't mapped. */
export function locatePlayer(rawScene: string | null | undefined, pos: PlayerPosition, places: AtlasPlace[], ageHint?: 'child' | 'adult' | null): PlayerFix | null {
  const norm = normalizeSceneName(rawScene);
  const sceneKey = resolveEffectiveScene(norm.scene, pos.x, pos.z);
  if (!sceneKey) return null;
  const info = SCENE_TO_PLACE[sceneKey];
  if (!info) return null;
  const place = places.find(p => p.id === info.placeId);
  if (!place) return null;
  const age = norm.ageHint ?? ageHint ?? info.defaultAge ?? null;
  const mapId = determineMapId(place, age, pos.y);
  const at = projectToPlaceMap(sceneKey, place, mapId, pos.x, pos.z);
  return { placeId: place.id, mapId, at, world: projectToWorldMap(place, at), yaw: ((pos.yaw % 360) + 360) % 360, age };
}
