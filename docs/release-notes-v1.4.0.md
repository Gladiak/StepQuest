# StepQuest v1.4.0

Prepare your equipment with runewords, face optional Echo challenges, and visit merchant caravans that grow with your adventure. Automatic combat gains explicit strategies, visible runic reports and optional prepaid provisions.

## Rune inscriptions and Echo challenges

- Discover 12 personal runes and 16 runewords: eight for weapons and eight for body armor. The Forge shows recipes, individual bonuses, exact effects, requirements and compatibility with your automatic strategy.
- Inscribe only your currently equipped weapon or body armor. Quotes show the price before confirmation; extraction returns all runes while preserving the item's identity, set, refinement and enchantment. Inscribed items are protected from bulk sales.
- From level 15, claim a one-time starter selection of runes and fragments. Later victories can provide more resources; ordinary paths remain available.
- Choose Aggressive or Prudent automatic combat. Prudent responds to announced heavy attacks and available runic purification. Reports show decisions, activations, effective damage, protection, healing and reasons why a word did not activate. Potions during a turn remain manual.
- Unlock optional Echoes I at level/depth 30/60 and Echoes II at 45/100. Announced attack sequences, wounds and additional fragments offer challenges for enhanced legendary gear and advanced unique sets. Arena retains separate health and its ordinary opponents.

## Merchant caravans and travel provisions

- Six caravan tiers unlock at levels 1, 4, 15, 45, 150 and 500, improving stock quality throughout the game, including level 900 and beyond. A visible, persistent countdown announces featured bargains; from level 150 every refresh includes a legendary bargain with six positive properties. Unique gear remains an adventure reward.
- Browse Weapons, Armor, Accessories, Potions and Food in that order, with 3/3/2/3/1 offers. Accessories specialize in wealth/experience or loot/potion power. Healing consumables show effective recovery and a share of maximum health.
- Read compact upgrade and downgrade arrows directly beside prices without hovering. Equivalent, pending and uncertain results have distinct symbols. Ring advice considers both replacement slots.
- Buy personal prepaid provisions with a confirmed quote and a 20-ration capacity. Optionally enable post-victory resupply at 50%, 70% or 90% health, using at most three owned rations per victory. Reports show actual healing and remaining stock; the game never buys replacements automatically.
- Defeats, retreats, Arena and concluding expedition guardians do not consume provisions. Manual consumption remains available outside combat. Gear comparisons include the selected plan, available stock and the cost of rations actually used in their trials.

## Interface and save compatibility

The game window is resizable and maximizable, opening larger when the display allows it. Panels use available space, scroll within their boundaries and retain their position across updates and asynchronous quotes. All new controls and text support Italian, English, French, Spanish, German and Japanese.

Existing heroes, balances, equipment, enhancements and paid encounters are preserved. New merchant quality guarantees apply at the next refresh; existing offers keep their prices and values. Rune and provision records are included in save protection and backups. Previously started encounters keep their saved rules, and older expeditions remain ordinary unless a new Echo expedition is selected.

## Verification

The source passed 336 offline unit and integration tests, 650 general Electron layout/contrast screens and 92 merchant screens across six languages. Earlier targeted checks also cover rune inscriptions and scrolling. Economic checks passed 24 deterministic scenarios and 30 crafting resale checks without negative balances. The production merchant audit verified 1,260 assortments containing 10,080 equipment pieces across all six classes and seven level checkpoints. These synthetic audits do not promise an upgrade for every build.

The release workflow repeats offline tests and economic checks, runs the general Electron suite, and verifies packaged applications on native macOS Apple Silicon, macOS Intel, Windows x64 and Linux x64 runners before publication. Tests use temporary profiles and do not access personal Garmin accounts.

## Downloads

| Platform | File |
| --- | --- |
| macOS Apple Silicon | `StepQuest-1.4.0-mac-arm64.zip` |
| macOS Intel | `StepQuest-1.4.0-mac-x64.zip` |
| Windows x64 portable | `StepQuest-1.4.0-windows-x64-portable.exe` |
| Linux x64 AppImage | `StepQuest-1.4.0-linux-x86_64.AppImage` |
| Debian / Ubuntu x64 | `StepQuest-1.4.0-linux-amd64.deb` |
| Fedora / RPM x64 | `StepQuest-1.4.0-linux-x86_64.rpm` |

Verify downloads with `SHA256SUMS.txt`. macOS packages are ad-hoc signed and not notarized; Windows signing is not configured.

Garmin synchronization requires your own Personal API key and an internet connection. The key remains in the local SQLite database and its backups. Local saves and unlocked features remain available offline; new movement and activity progress require synchronization.
