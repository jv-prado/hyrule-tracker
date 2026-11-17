<div align="center">

# 🗡️ Hyrule Tracker

### Track your journey through the Ocarina of Time remake for Nintendo Switch 2

![Platform](https://img.shields.io/badge/platform-Windows%20x64-0078D6?logo=windows&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green)
![Languages](https://img.shields.io/badge/lang-PT%20%7C%20EN%20%7C%20ES-orange)
![Open Source](https://img.shields.io/badge/open%20source-contributions%20welcome-brightgreen)

A Windows desktop app that **reads your local save** and updates the checklist, map and counters as you play. 🌍 Available in Portuguese, English and Spanish.

👤 Created by **João Victor Prado**.

[🚀 First use](#-first-use) · [✨ Features](#-features) · [🎮 Compatibility](#-compatibility) · [🔒 Local data](#-local-data) · [🛠️ Development](#️-development) · [🤝 Contributing](#-contributing)

</div>

---

## 🚀 First use

1. 🎮 Open the game in a compatible environment and load a game with at least one save.
2. 📦 Download `Hyrule-Tracker-Setup-1.1.0.exe` from the [Releases](https://github.com/jv-prado/hyrule-tracker/releases) tab, run it and open **Hyrule Tracker**. The tracker looks for saves automatically in known installations.
   > 🛡️ The installer is not code-signed yet, so Windows SmartScreen may show "Windows protected your PC". Click **More info → Run anyway**.
3. 🟢 Check the status next to the installation name:
   - **Save connected** → the tracker read the save from disk.
   - **Live** → the tracker is reading the running game.
4. 📂 Save not found? Click **Choose folder** (on the start screen or in **Settings**) and select the folder that contains the `slot_*` directories (game folder or emulator data folder, as long as it has a recognized layout). Picking a `slot_*` folder or a folder just above the profile also works.
5. 🌐 English is the default on first launch. Use **EN**, **PT** or **ES** next to **Refresh now** to change the language. The tracker remembers your choice.

> 💡 **Automatic updates:** the app checks GitHub for new versions, shows what changed and only downloads after you confirm. **Refresh now** re-reads your save progress.

## ✨ Features

| | Screen | What you can track |
| :-: | --- | --- |
| 📊 | **Overview** | Checklist %, hearts, Gold Skulltulas, opened chests, rupees and recent activity. |
| 🗺️ | **Hyrule Map** | 32 regions, per-floor maps, location photos and filters by Link's age, collectible type and completion. A pin shows **where Link is**, live while playing, and **Follow Link** keeps his region and dungeon floor on screen. Maps fit the window, even fullscreen. |
| ✅ | **100% Checklist** | Hearts, 100 Gold Skulltulas, songs, equipment, trades, dungeons, Big Poes and more. Done items are struck through. **Available now** shows what you can get with known requirements. |
| ⏳ | **Threads of Time+** | Chapters, story steps and seven expandable side quests with guidance and progress from the save. |
| 🎯 | **Minigames** | 18 activities with wins, prizes and scores: shooting galleries, Bombchu Bowling, fishing, races. Deku Theater and expert modes accept manual marking. |
| ⚔️ | **Hall of Enemies** | 84 statues, 25 rematches and three trials, with best times from your save and reference images. |
| 📅 | **Daily log and My data** | Progress seen while the tracker is open, local captures and medals calculated from your game. |
| 📸 | **Rumor quests** | The tracker's photo hunt: follow clues, visit the region and capture the game window in **Live** mode. |
| 🧩 | **Daily quiz** | Test your knowledge of the game with rotating questions. |

The overall percentage uses the **100% Checklist** objectives. Minigame prizes that belong to it (heart pieces, equipment upgrades) already count. Wins and records are counted separately on the **Minigames** page.

👻 **Big Poes** are read from the Poe Collector's points (100 per Poe, bottle at 500, Gold Rupee at 1,000). The card also shows how many of the ten Hyrule Field Big Poes you've defeated. The save doesn't record which spot each sold Poe came from, so the field spots are ticked together once all ten are sold. Before that, mark them by hand if you want.

📚 The catalog includes **206** chest flags, **23** Fairy Thoughts, **16** Pierre summons and **37** underground entrance markers. Entries without automatic detection accept manual marking, and the map flags chests whose position is still unmapped. See the [sources and coverage details](docs/coverage-sources.md).

### 🔄 Updating during play

| Mode | Behavior |
| --- | --- |
| ⚡ **Live** | Always on: as soon as the game is open, Link's position moves on the map in real time and progress is polled about every half second once the tracker links the running session to the recent save. The sidebar shows the live tracking status. |
| 💾 **Save connected** | Follows the next save or autosave, watching the folder and periodically checking slots. |
| 🔁 **Refresh now** | Forces an immediate read, retrying if the save is being written. |
| 📌 **Follow latest save** | Uses live reading. Pinning a slot shows the on-disk reading of that save. |

### 🪟 In-game overlay

Turn on **Show in-game overlay** in Settings. It can show counters, remaining objectives in the region or what is available now, with adjustable opacity and locking.

| Default shortcut | Action |
| --- | --- |
| `Ctrl + Shift + O` | 👁️ Show or hide the overlay. |
| `Ctrl + Shift + L` | 🔒 Lock or unlock the overlay for moving and resizing. |

## 🎮 Compatibility

- 🖥️ Desktop app for **Windows x64**, using the save format of the **Nintendo Switch 2 remake**.
- 🔎 Search recognizes installations and saves from **Triforce / NX2navi**, **Hookshot**, **Longshot**, **ReLink**, **Ocarina Reborn**, **Fritchii** and **Lichii**.
- ⚡ Live reading depends on the game version and the memory layout of the port or emulator. See the [live mode documentation](docs/live-memory.md).
- 🗂️ Saves from other environments can be selected manually if they expose the same format.
- ❌ Nintendo 64, Ocarina of Time 3D and original-game port saves use different formats and are **not** supported.

<details>
<summary>❓ <b>My game does not appear</b></summary>

1. Confirm that you saved inside the game. The tracker looks for `progress.sav` inside a `slot_*` directory.
2. Open **Settings → Find saves**. For secondary drives or custom emulator folders, use **Choose folder** and select the profile folder that contains the slots.
3. For **Live** reading, keep the game loaded and select **Follow latest save**. The indicator changes to **Live** when the tracker finds the running game.
4. If the status stays **Save connected**, save in the game or click **Refresh now** to confirm the on-disk reading follows your changes.

</details>

## 🔒 Local data

- 📴 Works **offline**. Preferences, manual marks and activity are stored in `%APPDATA%\Hyrule Tracker`.
- 🗺️ Maps, photos and WebP icons are bundled with the app. The only network access is the update check on GitHub.
- 👀 Save and memory reading is **read-only**. Window captures for the history can be turned off in **Settings**.
- 🏠 Everything is local: no Nintendo account, remote database or VPS.

## 🛠️ Development

Built with **Electron**, **React**, **TypeScript**, **Vite** and **Vitest**. Requires **Node.js 22+** and npm. The first install and packaging may download build tools and binaries.

```powershell
npm ci
npm run dev
```

| Command | Result |
| --- | --- |
| `npm start` | ▶️ Builds and opens the app. |
| `npm run typecheck` | 🔍 Checks TypeScript types. |
| `npm test` | 🧪 Runs the test suite (tests needing private fixtures are skipped in public clones). |
| `npm run dist` | 📦 Builds the Windows x64 installer (`Hyrule-Tracker-Setup-<version>.exe`) in `release/`. |
| `npm run dist:publish` | 🚀 Creates the draft GitHub release from `CHANGELOG.md` and uploads the installer (needs `GH_TOKEN`). |

### 🚀 Releasing a version

1. Bump `version` in `package.json` and add a `## [x.y.z]` section to [CHANGELOG.md](CHANGELOG.md). That section is the release text **and** the "What's new" the app shows to players.
2. Run `GH_TOKEN=<token> npm run dist:publish`. It creates a **draft** release and uploads the installer, `latest.yml` and the blockmap.
3. Review the draft on GitHub and publish it. Installed apps only see published releases.

### 🖼️ Images

Images are **not** stored in Git (`src/renderer/public/images/` is ignored), so a fresh clone needs this step before `npm run build` or `npm run dist`, otherwise the app ships without icons and maps. Fetch the game and wiki images into `src/renderer/public/` before building. The item icon importer uses FFmpeg to create WebP files.

```powershell
node scripts/fetch-item-images.mjs
node scripts/fetch-reference-images.mjs
node scripts/fetch-atlas.mjs
```

### 📁 Project layout

```text
src/main/        Electron process, save discovery, watching and live reading
src/preload/     IPC bridge between the window and the main process
src/gamedata/    Binary format reading and flag evaluation
src/core/        Catalog, progress rules, maps and availability logic
src/renderer/    React interface, translations and bundled images
data/            Checklist, mappings and remake data
test/            Automated tests
docs/            References and technical documentation
```

## 🤝 Contributing

Hyrule Tracker is **open source** and everyone is welcome to contribute! 💚 Bug reports, translations, new detections, data fixes, UI ideas and code are all appreciated.

1. 🍴 Fork [the repository](https://github.com/jv-prado/hyrule-tracker) and create a branch for your change.
2. 🛠️ Run `npm install`, then `npm run dev` to work with hot reload.
3. ✅ Before opening a pull request, make sure `npm run typecheck` and `npm test` pass.
4. 📬 Open a [pull request](https://github.com/jv-prado/hyrule-tracker/pulls) describing what changed and why.

Not a coder? Open an [issue](https://github.com/jv-prado/hyrule-tracker/issues) with suggestions, missing translations or wrong data — that helps a lot too.

🐛 **Reporting an issue:** include the tracker version, port or emulator, connection status and the objective you observed. Steps and observed values are usually enough, no need to share save files. See [the save format](docs/save-format.md) and [the mapping rules](docs/save-mapping.md) to contribute detections.

## 🙏 Credits and license

- 👤 **João Victor Prado** created Hyrule Tracker.
- 🗺️ Maps and location photos come from Ocarina Atlas and Nintendúo. Enemy, region and item images are credited in the docs. See [third-party credits](THIRD_PARTY_NOTICES.md).
- 📄 Code is under the [MIT license](LICENSE). Game images and trademarks belong to their owners and have their own terms of use.

> ⚠️ Hyrule Tracker is an independent fan project, not affiliated with Nintendo.
