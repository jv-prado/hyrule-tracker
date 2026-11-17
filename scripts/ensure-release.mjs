// Creates (or reuses) the DRAFT GitHub release for the current version before publishing, with the
// matching section of CHANGELOG.md as its text. The draft only becomes a real release when YOU publish it
// on GitHub (the gate: the app only sees published releases).
//
//   GH_TOKEN=<token with repo access> node scripts/ensure-release.mjs
// The token stays on your machine (environment variable). It never goes into the repository or the app.
import { readFileSync } from 'node:fs';

const token = process.env.GH_TOKEN;
if (!token) { console.error('[release] GH_TOKEN is not set.'); process.exit(1); }

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const { owner, repo } = pkg.build.publish;
const tag = `v${pkg.version}`;
const api = `https://api.github.com/repos/${owner}/${repo}/releases`;
const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'hyrule-tracker-release-script' };

// The release text is the version's section of CHANGELOG.md. No section, no release: an empty or wrong changelog never ships.
const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
const escaped = pkg.version.replace(/\./g, '\\.');
const section = changelog.match(new RegExp(`^## \\[${escaped}\\][^\\n]*\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'm'));
const notes = section ? section[1].trim() : '';
if (!notes) { console.error(`[release] CHANGELOG.md has no (or an empty) "## [${pkg.version}]" section. Write the changelog first.`); process.exit(1); }

const list = await fetch(`${api}?per_page=50`, { headers });
if (!list.ok) { console.error(`[release] could not list releases: ${list.status}`); process.exit(1); }
const matches = (await list.json()).filter(r => r.tag_name === tag);
if (matches.length > 1) { console.error(`[release] ${matches.length} releases share tag ${tag}; delete the duplicates on GitHub.`); process.exit(1); }
if (matches.length === 1) {
  if (!matches[0].draft) { console.error(`[release] ${tag} is already published in ${owner}/${repo}; bump the version in package.json.`); process.exit(1); }
  const updated = await fetch(`${api}/${matches[0].id}`, { method: 'PATCH', headers, body: JSON.stringify({ body: notes }) });
  if (!updated.ok) { console.error(`[release] could not update draft ${tag}: ${updated.status}`); process.exit(1); }
  console.log(`[release] reusing draft ${tag} (text refreshed from CHANGELOG.md)`);
  process.exit(0);
}
const created = await fetch(api, { method: 'POST', headers, body: JSON.stringify({ tag_name: tag, name: pkg.version, body: notes, draft: true }) });
if (!created.ok) { console.error(`[release] could not create draft ${tag}: ${created.status} ${await created.text()}`); process.exit(1); }
console.log(`[release] draft ${tag} created in ${owner}/${repo}`);
