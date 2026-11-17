import fs from 'node:fs/promises';
import path from 'node:path';

// Development asset import. The installed tracker only loads bundled files.
const origin = 'https://zelda.mtwildwood.net';
const categories = ['enemies', 'bosses', 'places', 'dungeons'];
const output = 'src/renderer/public/images/reference';
const pages = await Promise.all(categories.map(async group => {
  const page = new URL('/en-gb/' + group + '/', origin);
  const response = await fetch(page);
  if (!response.ok) throw Error(String(response.status) + ' ' + page);
  const html = await response.text();
  return [...html.matchAll(/<a class="card"[^>]*href="([^"]+)"[^>]*>[\s\S]*?<img src="([^"]+)" alt="([^"]+)"[^>]*>[\s\S]*?<\/a>/g)]
    .filter(m => m[1].startsWith('/en-gb/' + group + '/') && m[2].startsWith('/img/'))
    .map(([, detail, image, name]) => ({ group, slug: detail.split('/').filter(Boolean).at(-1), name, image, detail }));
}));
const manifest = {};
await fs.mkdir(output, { recursive: true });
const queue = pages.flat();
await Promise.all(Array.from({ length: 6 }, async () => {
  while (queue.length) {
    const item = queue.shift();
    const image = new URL(item.image, origin);
    const response = await fetch(image, { redirect: 'error' });
    if (!response.ok) { console.warn(response.status, image.pathname); continue; }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 2_000_000 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') continue;
    const file = item.group + '-' + item.slug + '.webp';
    await fs.writeFile(path.join(output, file), bytes);
    manifest[item.group + ':' + item.slug] = { file: 'images/reference/' + file, name: item.name, source: new URL(item.detail, origin).href };
  }
}));
await fs.writeFile('src/renderer/reference-images.json', JSON.stringify(Object.fromEntries(Object.entries(manifest).sort()), null, 2) + '\n');
console.log(Object.keys(manifest).length + ' bundled images');
