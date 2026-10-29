# StepQuest v1.0.0

Turn your daily Garmin steps into a pixel-art fantasy adventure.

- Six hero classes, twelve character sprites, and three local save slots.
- Turn-based and automatic battles, elite enemies, and branching expeditions.
- Loot, class sets, a persistent market, and alchemical enchantments.
- Daily Garmin step imports and supported wellness effects.
- English, Italian, French, Spanish, German, and Japanese interfaces.
- Local SQLite saves; no StepQuest backend or account required.

## Downloads

| Platform | File |
| --- | --- |
| macOS Apple Silicon | `StepQuest-1.0.0-mac-arm64.zip` |
| macOS Intel | `StepQuest-1.0.0-mac-x64.zip` |
| Windows x64 portable | `StepQuest-1.0.0-windows-x64-portable.exe` |
| Linux x64 AppImage | `StepQuest-1.0.0-linux-x86_64.AppImage` |
| Debian / Ubuntu x64 | `StepQuest-1.0.0-linux-amd64.deb` |
| Fedora / RPM distributions x64 | `StepQuest-1.0.0-linux-x86_64.rpm` |

SHA-256 hashes for all six files are provided in `SHA256SUMS.txt`.

## Getting started

Extract the macOS ZIP and move StepQuest.app to Applications, run the Windows portable executable, or install/run your preferred Linux package. Make the AppImage executable before running it; a FUSE compatibility package may be required.

Create a hero and enter your own Garmin Connect Personal API key in Settings. Garmin synchronization requires a valid key and internet access. Importing today's steps multiple times credits only new steps.

## Release notes

The macOS and Windows builds are unsigned, and the macOS builds are not notarized. Your operating system may display a security warning or require approval before opening the application.

The Garmin key is saved in plain text in your local SQLite database. Repository files and application packages exclude private environment files, personal databases, and exports. Keep your local database and backups private.

StepQuest is an independent project and is not affiliated with or endorsed by Garmin.
