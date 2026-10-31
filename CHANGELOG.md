# Changelog

## Unreleased

## [1.4.0](https://github.com/Gladiak/StepQuest/releases/tag/v1.4.0) — 2026-10-31

### Added

- Six progressive merchant caravans with class-compatible stock, specialized accessories and a visible countdown to featured bargains. Featured gear has maximum positive affixes; advanced caravans guarantee a legendary bargain at every refresh. Healing previews show effective HP and a share of maximum health.
- Personal prepaid provisions with a quoted purchase, a 20-ration capacity and optional post-victory resupply at 50%, 70% or 90% health. At most three rations are consumed per victory; reports show actual healing and remaining stock. Equipment trials include the selected plan and consumed-ration costs. Existing fights retain their saved rules.
- Runic inscriptions on currently equipped weapons and body armor at the Forge: 12 personal runes and 16 runewords, eight for weapons and eight for body armor. Recipes show their exact effects, level requirements, individual stat bonuses and automatic-profile compatibility. Quoted engraving and full rune recovery preserve the original piece and its enhancements.
- Explicit, personal automatic strategies: Aggressive keeps attacking; Prudent defends against announced heavy strikes and uses available runic purification. Battle reports show decisions, activations, effective extra damage, absorption, healing, cleanses and reasons for inactive words. Potions remain manual.
- Optional Echoes I and II for enhanced legendary equipment and complete enhanced unique sets, unlocked at level/depth 30/60 and 45/100. Deterministic enemy intents, wounds and additional rune fragments provide advanced progression without changing ordinary paths.

### Changed

- Merchant sections now follow Weapons, Armor, Accessories, Potions, Food. Accessories and food have separate stock allocations; the next refresh guarantees offers in every section. A catalog migration reclassifies existing items while preserving prices, stock, wallets and paid encounters. Added a reproducible level-900 merchant design review.
- Compact comparison arrows now appear beside prices directly in merchant lists, including downgrades and equivalent items, with pending and unavailable states. Ring recommendations prefer an equivalent replacement over a downgrade when available.

- Resizable, maximizable game window with a larger initial viewport where the display allows it. Adventure panels use the extra space, keep scrolling inside their own boundaries and retain their position across updates and asynchronous quotes.

- Equipment trials simulate runewords, the selected automatic strategy and Echo difficulty with matching cache invalidation. Arena trials use runewords and the selected strategy with separate health and ordinary opponents.
- Save migration and backups include rune stock, inscriptions and combat snapshots. Bulk sales protect inscribed pieces; individual sales require extracting their runes first. The new interface is translated into all six supported languages.

## [1.3.0](https://github.com/Gladiak/StepQuest/releases/tag/v1.3.0) — 2026-10-31

- Expanded the Lantern Beacon into a province finale: the cartographer’s call, playable bridge/ferry consequences, a last-flame healing or protection choice, and a two-phase Warden with announced attacks and vulnerability windows. A replayable light ceremony and personal Chronicle epilogue preserve the journey’s choices, with an optional original chime and all six languages. Existing journeys retain their saved encounters and milestones.

- Reforging now raises equipment to the hero’s level with an itemized upgrade surcharge, preserving its original depth bonus, rarity, set and enhancements. Replaced the item dropdown with a filtered inventory grid and shared item-detail popups; stale quotes cannot spend coins.

- Replaced the equipment power score with background combat trials using the real battle engine. Recommendations account for survival, XP and recovery costs, with bounded caching, separate ring-slot results and stale-response protection.

- Disabled the optional GitHub Actions npm cache to avoid restore warnings when the account's cache egress limit is reached. CI continues to install dependencies with `npm ci` from the lockfile.

See the [full release notes](docs/release-notes-v1.3.0.md) for the Beacon finale, equipment improvements, save compatibility and downloads.

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
