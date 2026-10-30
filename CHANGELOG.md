# Changelog

## Unreleased

- Expanded the Lantern Beacon into a province finale: the cartographer’s call, playable bridge/ferry consequences, a last-flame healing or protection choice, and a two-phase Warden with announced attacks and vulnerability windows. A replayable light ceremony and personal Chronicle epilogue preserve the journey’s choices, with an optional original chime and all six languages. Existing journeys retain their saved encounters and milestones.

- Reforging now raises equipment to the hero’s level with an itemized upgrade surcharge, preserving its original depth bonus, rarity, set and enhancements. Replaced the item dropdown with a filtered inventory grid and shared item-detail popups; stale quotes cannot spend coins.

- Replaced the equipment power score with background combat trials using the real battle engine. Recommendations account for survival, XP and recovery costs, with bounded caching, separate ring-slot results and stale-response protection.

- Disabled the optional GitHub Actions npm cache to avoid restore warnings when the account's cache egress limit is reached. CI continues to install dependencies with `npm ci` from the lockfile.

## [1.2.0](https://github.com/Gladiak/StepQuest/releases/tag/v1.2.0) — 2026-10-30

### Added

- Explorers’ Guild: six movement-based story chapters, permanent choices, a journal and cosmetic titles. Objectives accept qualifying recorded Garmin activities or new daily steps.
- Wanderer’s Atlas: ten locations in Refuge Province, two narrative encounters, visible consequences of your choices and the Lantern Beacon expedition with its original Warden.
- Refuge Chronicles: 21 illustrated keepsakes for walking, recorded activities, exploration and professions; three displayable banner seals; permanent achievement dates; and two cosmetic titles.
- Lantern Circuit: five narrative stops requiring 5,000 new steps each, with no deadline or step cost.
- Original pixel-art backgrounds, province map and keepsake illustrations, with interface translations in all six languages.

### Changed

- Verified Garmin account continuity preserves daily credit limits when a Personal API key is renewed. A paginated seven-day activity archive supports delayed synchronization.
- Step imports update activity progress even without an active Guild quest. Historical quest steps never credit the wallet, and unavailable Garmin data remains neutral.
- Migration backups cover the Guild, Atlas, Chronicles and Garmin schemas. Existing proven story and profession milestones are recognised automatically.
- Guild navigation now has equal-width Board and Atlas buttons aligned with the hero panel. The Chronicles open from the board or character profile.

### Fixed

- Keepsake artwork uses individual contours to prevent clipped emblems and fragments of adjacent badges in collection cards, previews and banner seals.

See the [full release notes](docs/release-notes-v1.2.0.md) for progression rules, compatibility and downloads.

## [1.1.0](https://github.com/Gladiak/StepQuest/releases/tag/v1.1.0) — 2026-10-29

- Added automatic mining with offline production, underground floors and tool upgrades.
- Added Blacksmith crafting, profession levels and reforging, alongside equipment refinement.
- Added a PvE Arena with free daily challenges and optional paid challenges.
- Added three pixel-art backgrounds and six-language support for the new sections.
- Made single skirmish the default outdoor mode and kept daily step credits independent for each hero.
- Stabilized mining production, authoritative crafting quotes, daily Arena refresh, large inventories and migration backups.
- Added packaged application checks for macOS Apple Silicon, macOS Intel, Windows and Linux.

See the [full release notes](docs/release-notes-v1.1.0.md).

## [1.0.0](https://github.com/Gladiak/StepQuest/releases/tag/v1.0.0) — 2026-10-29

- Initial desktop release: Garmin-powered steps, six hero classes, turn-based battles, expeditions, equipment, market and alchemy.
- Local SQLite saves with three character slots, six interface languages and bundled pixel-art assets.
- Desktop packages for macOS, Windows and Linux.

See the [full release notes](docs/release-notes-v1.0.0.md).
