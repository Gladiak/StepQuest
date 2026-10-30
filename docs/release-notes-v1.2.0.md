# StepQuest v1.2.0

The Explorers’ Guild and the Wanderer’s Atlas turn real movement into a province shaped by your choices.

- Six one-time quests with two narrative endings each, a persistent journal and three cosmetic titles. One active quest and up to three acceptances per week; active quests do not expire.
- Complete an objective through a matching recorded Garmin activity or through new daily steps. Accepting and concluding quests costs no currency and gives no stat or economic bonus.
- Original pixel-art Guild hall, a new toolbar icon and full translations in six languages.
- Explore Refuge Province through ten map locations: the Refuge, six Guild chapters, two permanent narrative encounters and the Lantern Beacon expedition. Existing Guild choices appear automatically on the map.
- Choices leave visible traces: a bridge or ferry, sanctuary runes or mining lanterns, ribbons or a light beneath the old oak. The Beacon expedition remembers the province as it was when you departed.
- Four expedition stages, an original Beacon Warden and a dedicated pixel-art background. Entry costs 75 steps once; expedition battles, retreat and loot use the existing rules. Finishing all six Guild chapters and defeating the Warden unlocks the cosmetic Chronicler of the Refuge title.
- The Atlas and its two encounters have no currency cost or economic reward. No additional Garmin requests are needed to explore the map.
- The Refuge Chronicles add 21 illustrated keepsakes across steps, recorded activities, Atlas exploration and professions. Earn permanent memories, discover the Oak badge variant matching your choice and display three seals on your character’s banner in the profile.
- Start the Lantern Circuit: five narrative stops, 5,000 new steps each, no deadline or step cost. Stories remember the province’s choices when each stop is reached. The final stop also requires one completed Guild chapter.
- Earn the Lantern Bearer and Keeper of Horizons cosmetic titles. New keepsakes are announced and marked unread until preserved in the book; badges and titles grant no combat, currency or stat bonuses.
- Proven past story and profession milestones are recognised automatically. New movement counters start when a hero first opens after this update; existing credited steps form a baseline. Daily maxima prevent key aliases or account switches from counting the same daily steps twice.
- Recorded activity keepsakes use completed qualifying sessions observed after the register opens. Importing today’s steps also updates the seven-day activity archive, even without a Guild quest. Historical step requests remain limited to active Guild quests; no new API endpoint is introduced.
- Verified Garmin account identity preserves step-credit limits when renewing a Personal API key. Existing balances and original archived records are retained.
- A paginated seven-day activity archive supports delayed synchronization, stable activity IDs, original local dates and UTC timestamps. Manual activities and multisport children are excluded; unavailable activity data stays neutral.
- Existing step imports still credit today only. Historical steps fetched for quests never become past-day wallet credits.
- Automatic pre-migration backups cover the new Garmin, Guild, Atlas and Chronicles schemas.

The Personal API connection remains local and read-only. Recorded activity availability depends on data synchronized with Garmin Connect. Tests use synthetic profiles; no personal account is queried by automated checks.

## Interface improvements

- Every keepsake uses its own pixel-art contour, so cards, large previews and banner seals show the complete emblem without fragments of neighbouring badges.
- The Guild has two equally sized navigation buttons, Board and Atlas, aligned with the hero panel. Open the Chronicles from the board or the character profile.

## Compatibility and verification

Existing heroes, balances, equipment, mining jobs, quests and expeditions are retained. Verified backups precede schema migrations. Previously earned story and profession milestones are recovered where the save contains proof; new step and activity counters begin when each hero first opens after the update.

All 248 offline unit and integration tests, 625 layout and contrast screens across six languages, 24 deterministic economy scenarios, 30 crafting resale checks and the packaged macOS ARM64 application passed local verification. The release workflow builds macOS Apple Silicon, macOS Intel, Windows x64 and Linux x64 on native runners, checks the installed applications, and publishes only when every platform passes.

## Downloads

| Platform | File |
| --- | --- |
| macOS Apple Silicon | `StepQuest-1.2.0-mac-arm64.zip` |
| macOS Intel | `StepQuest-1.2.0-mac-x64.zip` |
| Windows x64 portable | `StepQuest-1.2.0-windows-x64-portable.exe` |
| Linux x64 AppImage | `StepQuest-1.2.0-linux-x86_64.AppImage` |
| Debian / Ubuntu x64 | `StepQuest-1.2.0-linux-amd64.deb` |
| Fedora / RPM x64 | `StepQuest-1.2.0-linux-x86_64.rpm` |

Verify the downloads with the release's `SHA256SUMS.txt`. macOS is ad-hoc signed and not notarized; Windows signing is not configured.

Garmin synchronization requires your own Personal API key and an internet connection. The key is stored in the local SQLite database and its backups. Local saves and unlocked game features remain available offline; new real-world movement and activity progress requires synchronization.
