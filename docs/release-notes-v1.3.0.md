# StepQuest v1.3.0

The Lantern Beacon becomes a province finale, and equipment decisions gain clearer comparisons and level-aware reforging.

## The Beacon’s call

- The cartographer introduces the journey after your first Guild chapter. The expedition still costs 75 steps once and has four stages.
- The bridge or ferry you restored offers different opportunities during the crossing. The journey remembers the province as it was when you departed.
- Choose how to use the last flame: restore health before the summit or preserve a single protection against the Warden’s Shattered Dawn.
- Face a two-phase Beacon Warden. At half health the lantern’s seal breaks; announced attacks, a gathering turn and vulnerability windows make timing your defence matter. Manual and automatic resolution remain available.
- Relight the province through an animated map ceremony with an optional original chime. Animations respect reduced-motion preferences.
- Keep a personal epilogue recording your crossing and flame choice. Replay the rekindling from the expedition report, Atlas, Beacon keepsake in the Chronicles or cartographer’s notice at the Refuge. Replays grant no additional rewards.
- All new story text, choices, combat intents, logs and controls are translated into Italian, English, French, Spanish, German and Japanese.

## Equipment improvements

- Equipment recommendations now use background combat trials with the real battle engine, accounting for survival, experience and recovery costs. Comparisons keep separate results for both ring slots and protect against outdated responses.
- Reforging raises equipment to the hero’s current level with an itemized upgrade surcharge. Item identity, depth bonus, rarity, set, enchantment and refinement are preserved; attributes are rerolled as shown before confirmation.
- Select reforging targets through a filtered inventory grid and shared item-detail popups. Expired quotes cannot spend coins.
- Shared inventory, comparison and item-detail modules replace duplicated interface code; the unused steps dashboard has been removed.
- Layout checks correctly handle deliberately truncated labels, and contrast captures wait for Electron to repaint when hiding and restoring text.

## Save compatibility and verification

Existing heroes, balances, equipment, Guild choices, achievements and dates are retained. Expeditions already in progress keep their saved stages and previous Warden mechanics. Start a new Beacon expedition to play the expanded finale. Heroes who have already defeated the Warden can revisit to earn the new personal epilogue without replacing their original milestone.

No new database schema or Garmin endpoint is required for the finale. Its phase, flame protection, world snapshot and epilogue use the existing saved game records. The Garmin connection and local save model are unchanged.

The gameplay source passed 287 offline unit and integration tests, 650 Electron layout and contrast screens across six languages, 24 deterministic economy scenarios and 30 crafting resale checks. The release workflow repeats the automated checks and verifies packaged applications on native macOS Apple Silicon, macOS Intel, Windows x64 and Linux x64 runners before publication. Automated checks use synthetic profiles and do not query personal Garmin accounts.

## Downloads

| Platform | File |
| --- | --- |
| macOS Apple Silicon | `StepQuest-1.3.0-mac-arm64.zip` |
| macOS Intel | `StepQuest-1.3.0-mac-x64.zip` |
| Windows x64 portable | `StepQuest-1.3.0-windows-x64-portable.exe` |
| Linux x64 AppImage | `StepQuest-1.3.0-linux-x86_64.AppImage` |
| Debian / Ubuntu x64 | `StepQuest-1.3.0-linux-amd64.deb` |
| Fedora / RPM x64 | `StepQuest-1.3.0-linux-x86_64.rpm` |

Verify downloads with the release’s `SHA256SUMS.txt`. macOS packages are ad-hoc signed and not notarized; Windows signing is not configured.

Garmin synchronization requires your own Personal API key and an internet connection. The key is stored in the local SQLite database and its backups. Local saves and unlocked features remain available offline; new real-world movement and activity progress requires synchronization.
