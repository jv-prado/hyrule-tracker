# Changelog

Player-facing changes in each Hyrule Tracker version. Every published version needs a `## [version]` section here:
`scripts/ensure-release.mjs` uses it as the GitHub release text, and the in-app updater shows it before the player decides to update.
Format: `New`, `Improved`, `Fixed`, `Known` (open issue).

## [1.1.0] - 2026-11-17

### New
- **Link on the map.** A pin with a facing cone shows where Link is on the Hyrule map and on each regional and dungeon floor map. It moves in real time while **Live** reads Hookshot, Longshot, NX2navi (Triforce) or ReLink, and otherwise shows where you last saved.
- **Live tracking is always on.** With the game open, the tracker follows it right away; there's no setting to turn it on. The sidebar shows whether it's waiting for the game, looking for Link or tracking him live.
- **Follow Link switches floors.** In dungeons the regional map now follows Link between floors (and child/adult maps) on its own.
- **Big Poes defeated on the counter card.** The **Big Poes Sold** card also shows how many of the ten Hyrule Field Big Poes you've defeated.

### Improved
- **Maps fit the window.** In fullscreen or maximized windows, the Hyrule map and the regional floor maps now shrink to fit the screen height instead of growing past it.

### Fixed
- **Big Poes now detected.** The Poe Collector counts points (100 per Big Poe), so a full collection showed as "1000 of 10", and the ten Hyrule Field Big Poes stayed pending on the map and checklist even after all were sold. Both now show 10/10, and finishing the Poe Collector's bottle quest counts as at least 5 sold. Thanks to **memorialpaper** for reporting it and sharing a save that pinned down the cause.

### Known
- If you've sold only some of the Big Poes (1 to 9), the save doesn't say which ones, so their Hyrule Field spots stay pending until all ten are sold. Mark them by hand if you want them ticked.
- The two amiibo masks (Young Link and Young Zelda) are detected from best-guess save flags and may need manual marking.
- The installer is not code-signed yet, so Windows SmartScreen may warn on first install.

## [1.0.0] - 2026-11-16

### New
- **First public release.** Live save tracking for the Ocarina of Time remake on Nintendo Switch 2, with checklist, Hyrule map, minigames, Hall of Enemies, daily log, rumor quests and daily quiz.
- **Windows installer.** Hyrule Tracker now ships as a regular `.exe` installer instead of a portable executable.
- **Automatic update check.** The app looks for new versions on GitHub, shows what changed and only downloads after you confirm.
- **PT, EN and ES.** The whole interface is available in Portuguese, English and Spanish.
- **In-game overlay** with counters, remaining objectives and what is available now.
- **Manual save folder.** If the save is not found automatically, pick the folder yourself with **Choose folder**.

### Known
- The two amiibo masks (Young Link and Young Zelda) are detected from best-guess save flags and may need manual marking.
- The installer is not code-signed yet, so Windows SmartScreen may warn on first install.
