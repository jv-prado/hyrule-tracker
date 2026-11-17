import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// PNGs catalogued as Switch 2 remake sprites and models by Zelda Wiki.
const names = {
  "heart": "Heart Icon",
  "heart_piece": "Piece of Heart Icon",
  "heart_container": "Piece of Heart Full Icon",
  "gold_skulltula": "Token Icon",
  "chest": "Treasure Chest Model",
  "rupee": "Green Rupee Icon",
  "blue_rupee": "Blue Rupee Icon",
  "red_rupee": "Red Rupee Icon",
  "purple_rupee": "Purple Rupee Icon",
  "gold_rupee": "Gold Rupee Icon",
  "kokiri_sword": "Kokiri Sword Icon",
  "master_sword": "Master Sword Icon",
  "giants_knife": "Giant's Knife Icon",
  "biggorons_sword": "Biggoron Sword Icon",
  "deku_shield": "Deku Shield Icon",
  "hylian_shield": "Hylian Shield Icon",
  "mirror_shield": "Mirror Shield Icon",
  "kokiri_tunic_heros_clothes": "Hero's Clothes Icon",
  "goron_tunic": "Goron Tunic Icon",
  "zora_tunic": "Zora Tunic Icon",
  "iron_boots": "Iron Boots Icon",
  "hover_boots": "Hover Boots Icon",
  "fairy_slingshot": "Fairy Slingshot Icon",
  "fairy_bow": "Fairy Bow Icon",
  "fire_arrow": "Fire Arrow Item Menu Icon",
  "ice_arrow": "Ice Arrow Item Menu Icon",
  "light_arrow": "Light Arrow Item Menu Icon",
  "boomerang": "Boomerang Icon",
  "hookshot": "Hookshot Icon",
  "longshot": "Longshot Icon",
  "megaton_hammer": "Megaton Hammer Item Menu Icon",
  "gorons_bracelet": "Goron Bracelet Icon",
  "silver_gauntlets": "Silver Gauntlets Icon",
  "golden_gauntlets": "Golden Gauntlets Icon",
  "bomb_bag": "Bomb Bag Icon",
  "bombchus": "Bombchu Icon",
  "bomb": "Bomb Icon",
  "deku_sticks": "Deku Stick Icon",
  "deku_nuts": "Deku Nut Icon",
  "dins_fire": "Din's Fire Icon",
  "farores_wind": "Farore's Wind Icon",
  "nayrus_love": "Nayru's Love Icon",
  "double_magic": "Gift of Doubled Magic Icon",
  "lenses_of_truth": "Lenses of Truth Icon",
  "silver_scale": "Silver Scale Icon",
  "golden_scale": "Golden Scale Icon",
  "echo_gem": "Echo Gem Icon",
  "fairy_ocarina": "Fairy Ocarina Icon",
  "ocarina_of_time": "Ocarina of Time Icon",
  "magic_bean": "Magic Beans Icon",
  "gerudo_membership_card": "Gerudo Pass Icon",
  "business_scrub_seed": "Business Scrub Seed Icon",
  "keaton_mask": "Keaton Mask Icon",
  "skull_mask": "Skull Mask Icon",
  "spooky_mask": "Spooky Mask Icon",
  "bunny_hood": "Bunny Hood Icon",
  "mask_of_truth": "Mask of Truth Icon",
  "goron_mask": "Goron Mask Icon",
  "gerudo_mask": "Gerudo Mask Icon",
  "zora_mask": "Zora Mask Icon",
  "young_link": "https://zelda.mtwildwood.net/img/items/fairy-kid-mask.png",
  "young_zelda": "https://zelda.mtwildwood.net/img/items/princess-mask.png",
  "bottle": [
    "Empty Bottle Icon",
    "Bottle Icon"
  ],
  "lon_lon_milk": "Lon Lon Milk Icon",
  "big_poe": "Big Poe Icon",
  "kokiri_wallet": "Kokiri Wallet Icon",
  "adults_wallet": "Adult's Wallet Icon",
  "giants_wallet": "Giant's Wallet Icon",
  "bigger_bomb_bag": "Bigger Bomb Bag Icon",
  "biggest_bomb_bag": "Biggest Bomb Bag Icon",
  "bigger_deku_seed_bag": "Bigger Deku-Seed Bag Icon",
  "biggest_deku_seed_bag": "Biggest Deku-Seed Bag Icon",
  "bigger_quiver": "Bigger Quiver Icon",
  "biggest_quiver": "Biggest Quiver Icon",
  "deku_stick_capacity_20": "Bigger Deku-Stick Bag Icon",
  "deku_stick_capacity_30": "Biggest Deku-Stick Bag Icon",
  "deku_nut_capacity_30": "Bigger Deku-Nut Bag Icon",
  "deku_nut_capacity_40": "Biggest Deku-Nut Bag Icon",
  "kokiris_emerald": "Kokiri Emerald Icon",
  "gorons_ruby": "Goron Ruby Icon",
  "zoras_sapphire": "Zora Sapphire Icon",
  "light_medallion": "Light Medallion Icon",
  "forest_medallion": "Forest Medallion Icon",
  "fire_medallion": "Fire Medallion Icon",
  "water_medallion": "Water Medallion Icon",
  "shadow_medallion": "Shadow Medallion Icon",
  "spirit_medallion": "Spirit Medallion Icon",
  "weird_egg": "Weird Egg Icon",
  "wake_up_cucco": "https://zelda.mtwildwood.net/img/items/wake-up-cucco.png",
  "zeldas_letter": "Zelda's Letter Icon",
  "pocket_egg": "https://zelda.mtwildwood.net/img/items/pocket-egg.png",
  "pocket_cucco": "Pocket Cucco Icon",
  "cojiro": "Cojiro Icon",
  "odd_mushroom": "Odd Mushroom Icon",
  "odd_potion": "Odd Poultice Icon",
  "poachers_saw": "Poacher's Saw Icon",
  "broken_gorons_sword": "Broken Goron Sword Icon",
  "prescription": "Prescription Icon",
  "eyeball_frog": "Eyeball Frog Icon",
  "worlds_finest_eye_drops": "Specialty Eye Drops Icon",
  "claim_check": "Biggoron Receipt Icon",
  "zeldas_lullaby": "Zelda's Lullaby Icon",
  "suns_song": "Sun's Song Icon",
  "eponas_song": "Epona's Song Icon",
  "sarias_song": "Saria's Song Icon",
  "song_of_time": "Song of Time Icon",
  "song_of_storms": "Song of Storms Icon",
  "minuet_of_forest": "Minuet of the Forest Icon",
  "prelude_of_light": "Prelude of Light Icon",
  "bolero_of_fire": "Bolero of Fire Icon",
  "serenade_of_water": "Serenade of Water Icon",
  "nocturne_of_shadow": "Nocturne of Shadow Icon",
  "requiem_of_spirit": "Requiem of Spirit Icon",
  "scarecrows_song": [
    "Scarecrow Song Icon",
    "Scarecrow's Song Icon"
  ],
  "dungeon_map": "Dungeon Map Icon",
  "compass": "Compass Icon",
  "boss_key": "Boss Key Icon",
  "small_key": "Small Key Icon"
};
const target = new URL('../src/renderer/public/images/items/', import.meta.url);
const wiki = 'https://cdn.wikimg.net/en/zeldawiki/images/';
const manifest = {};

async function convert(png, file) {
  await new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-threads', '1', '-i', 'pipe:0',
      '-vf', 'scale=\'min(128,iw)\':\'min(128,ih)\':force_original_aspect_ratio=decrease', '-an', '-c:v', 'libwebp',
      '-lossless', '1', '-threads', '1', '-y', file], { stdio: ['pipe', 'ignore', 'inherit'] });
    ffmpeg.once('error', reject);
    ffmpeg.once('exit', code => code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code} for ${file}`)));
    ffmpeg.stdin.on('error', reject);
    ffmpeg.stdin.end(png);
  });
}

async function importIcon([id, candidates]) {
  for (const name of [candidates].flat()) {
    const filename = `OoTNS2_${name.replaceAll(' ', '_')}.png`;
    const hash = createHash('md5').update(filename).digest('hex');
    const source = name.startsWith('https://') ? name : `${wiki}${hash[0]}/${hash.slice(0, 2)}/${encodeURIComponent(filename)}`;
    const response = await fetch(source, { signal: AbortSignal.timeout(20000) });
    if (response.status === 404) continue;
    if (!response.ok) throw new Error(`${response.status} for ${source}`);
    const png = Buffer.from(await response.arrayBuffer());
    if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error(`Expected PNG at ${source}`);
    const file = `images/items/${id}.webp`;
    await convert(png, fileURLToPath(new URL(`${id}.webp`, target)));
    manifest[id] = { file, source };
    return;
  }
  console.warn(`Missing: ${id}`);
}

await mkdir(target, { recursive: true });
const entries = Object.entries(names);
while (entries.length) await Promise.all(entries.splice(0, 8).map(importIcon));
await writeFile(new URL('../src/renderer/item-images.json', import.meta.url),
  JSON.stringify(Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b))), null, 2) + '\n');
console.log(`Imported ${Object.keys(manifest).length} item images.`);
