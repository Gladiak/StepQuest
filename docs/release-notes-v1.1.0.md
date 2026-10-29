# StepQuest v1.1.0

Mining, crafting and PvE training, with safer local saves.

- Automatic mining expeditions continue while the game is closed, with up to 24 hours of stored production, five underground floors, tool upgrades and a separate material inventory.
- The Blacksmith crafts class-compatible equipment, gains profession levels, reforges attributes while preserving rarity, sets and upgrades, and offers the existing step-based refinement.
- The PvE Arena provides unlimited practice, three free daily XP challenges and three additional challenges paid with coins or steps. Training uses separate health and does not consume items. PvP is not included.
- Three original pixel-art backgrounds and interface translations for all six supported languages.
- Single skirmish is the default outdoor mode; existing expeditions resume in their own mode.
- Independent daily Garmin step credits for each hero and level/depth information on character selection cards.

## Stabilization

- Mining preparation applies only to the first cycle of new automatic expeditions. Fractional production is retained across collections, so tool upgrades contribute their full advertised base yield over time.
- The next mining trip can be configured while the current crew is working. The configuration takes effect at collection; completed work and remaining time are retained according to the documented production rules.
- Blacksmith quotes come from the game engine and include every material, optional gem, profession XP and effective rarity probability. Changed quotes are rejected before any charge.
- Reforging shows preserved properties instead of unrelated crafting rarity probabilities.
- Daily Arena challenges refresh at midnight and when returning to the application, without replacing an open dialog.
- Item metadata is loaded in batches to reduce state-building time for large inventories.
- An integrity-checked SQLite backup is made before save migrations. Startup failures offer recovery from a backup; restoration retains the previous database and its journal files in a recovery directory.
- A single application instance owns the normal user profile. Offline tests and packaged-app smoke checks always use isolated temporary profiles.

## Compatibility and verification

Existing heroes, balances, rolled items, ongoing adventures and pending enchantments are retained. Previously saved mining reward plans are preserved; corrected production rules apply to newly planned work. The migration regression fixtures were generated from synthetic v1.0.0 saves and contain no personal data.

Local verification covers unit/integration tests, rendered layout and contrast in six languages, deterministic 7/30-day economy scenarios, and the actual macOS ARM64 package. The build workflow also runs the packaged-application smoke check on macOS Intel, Windows and Linux. Platform results must pass before publication.

## Downloads

| Platform | File |
| --- | --- |
| macOS Apple Silicon | `StepQuest-1.1.0-mac-arm64.zip` |
| macOS Intel | `StepQuest-1.1.0-mac-x64.zip` |
| Windows x64 portable | `StepQuest-1.1.0-windows-x64-portable.exe` |
| Linux x64 AppImage | `StepQuest-1.1.0-linux-x86_64.AppImage` |
| Debian / Ubuntu x64 | `StepQuest-1.1.0-linux-amd64.deb` |
| Fedora / RPM x64 | `StepQuest-1.1.0-linux-x86_64.rpm` |

Release downloads and checksums are available after publication. The macOS package is ad-hoc signed and not notarized; Windows signing is not configured.

Garmin synchronization requires your own Personal API key and internet access. The key is stored in the local SQLite database, including its backups. Keep saves and backups private. Character creation, existing saves, mining, crafting and training work offline.

StepQuest is independent and is not affiliated with or endorsed by Garmin.
