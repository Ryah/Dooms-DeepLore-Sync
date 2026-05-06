# DeepLore + Doom Sync for SillyTavern

DeepLore + Doom Sync is a companion bridge extension for [SillyTavern](https://github.com/SillyTavern/SillyTavern).

It acts as a bridge between these 3 extensions:

- [Doom's Enhancement Suite](https://github.com/DangerDaza/Dooms-Enhancement-Suite) scene tracking
- [SillyTavern-MemoryBooks](https://github.com/Nexus333/st-memorybooks) memory generation
- [DeepLore-Enhanced](https://github.com/pixelnull/sillytavern-DeepLore-Enhanced) Obsidian + lore processing

So instead of manually updating character presence, exporting memories, and sorting notes by hand, this extension ties those steps together for you.

This project is still evolving and feedback is welcome.

## Contents

- [Installation](#installation)
- [Requirements](#requirements)
- [Features](#features)
- [Troubleshooting](#troubleshooting)
- [Customization](#customization)
- [Credits](#credits)
- [License](#license)

## Installation

1. Open SillyTavern.
2. Go to Extensions.
3. Choose Install Extension.
4. Paste this URL:

```text
https://github.com/Ryah/Dooms-DeepLore-Sync
```

5. Install and reload SillyTavern.

## Requirements

This bridge is not standalone. It requires all of the following:

- [SillyTavern](https://github.com/SillyTavern/SillyTavern)
- [Doom's Enhancement Suite](https://github.com/DangerDaza/Dooms-Enhancement-Suite)
- [DeepLore-Enhanced](https://github.com/pixelnull/sillytavern-DeepLore-Enhanced)
- [SillyTavern-MemoryBooks](https://github.com/Nexus333/st-memorybooks)
- Obsidian Local REST API plugin in your vault: [obsidian-local-rest-api](https://github.com/coddingtonbear/obsidian-local-rest-api)

Without Doom, there is no scene presence source.
Without DeepLore, there is no vault bridge/summarize/optimize flow.
Without MemoryBooks, there are no MemoryBooks entries to export.
Without Obsidian Local REST API, folder browsing and Obsidian write flows cannot run.

## Features

### Automatic Present Character Sync

Reads Doom's tracked present characters and mirrors them into DeepLore context.

Why you want this:

- Prevents wrong lore from triggering after scene changes.
- Removes repetitive manual updates.

Example:

- Alec and Flora are present at the start of a scene.
- Doom marks them present.
- DeepLore gates that depend on those names activate automatically.
- Later Alec leaves, and Alec-only lore naturally stops applying.

### Automatic MemoryBooks Export to Obsidian

When MemoryBooks updates a lorebook, matching MemoryBooks entries can be exported to Obsidian automatically.

Why you want this:

- No copy/paste memory workflow.
- Your vault stays in sync with ongoing chats.

Example:

- A new MemoryBooks entry is created after a scene.
- Export runs automatically.
- A note is written with a clean filename and useful metadata.

### Better Character Accuracy in Exported Notes

For exported notes, present characters are resolved from the exact MemoryBooks source range whenever possible.

Why you want this:

- More trustworthy historical context.
- Fewer "this was from a different moment" mismatches.

Example:

- A memory came from message range 120-135.
- Character tags are resolved from that same range, not just current live state.

### Smart Folder Routing (Default + Per-Lorebook)

Supports one global default export folder and optional per-lorebook folder overrides.

Why you want this:

- Keeps large vaults organized automatically.
- Avoids post-export cleanup.

Example:

- Flora lorebook exports to `Lorebooks/Flora`
- Regency lorebook exports to `Lorebooks/Regency`
- Anything unmapped uses your default folder.

### Live Vault Folder Browser

Loads folder choices directly from your Obsidian vault via Local REST API, so you can pick instead of typing paths.

Why you want this:

- Fewer path mistakes.
- Faster setup for big vaults.

### Single Post-Export Action Popup

Optional popup after export lets you choose follow-up actions per run:

- DeepLore summarize
- DeepLore keyword optimize

Why you want this:

- One consistent decision step.
- Quick control without opening multiple menus.

## Troubleshooting

### Characters are not syncing

- Confirm [Doom's Enhancement Suite](https://github.com/DangerDaza/Dooms-Enhancement-Suite) and [DeepLore-Enhanced](https://github.com/pixelnull/sillytavern-DeepLore-Enhanced) are installed and enabled.
- Confirm Doom tracker data exists in the active chat.
- Increase Initial Delay if Doom updates arrive later than sync checks.
- Use Sync Now (Test) from settings.

### Export is not working

- Confirm [SillyTavern-MemoryBooks](https://github.com/Nexus333/st-memorybooks) is installed and generating entries.
- Confirm DeepLore vault settings are configured.
- Confirm [obsidian-local-rest-api](https://github.com/coddingtonbear/obsidian-local-rest-api) is installed and running.
- Confirm host/port/api key are valid in DeepLore settings.

### Folder picker does not load

- Confirm DeepLore has an enabled primary vault.
- Confirm Obsidian Local REST API is reachable from SillyTavern.

### Debugging details

- Use Show Debug Info in extension settings.
- Open browser console and look for logs starting with `[sillytavern-DeepLore-Doom-Sync]`.

## Customization

### Settings Panel

The settings panel is organized into practical sections:

1. Sync Behavior
2. Obsidian Export
3. Lorebook Folder Routing
4. Timing
5. Tools and Status

### Quick settings reference

- Enable automatic synchronization: master on/off.
- Sync first names only: useful when gates use first names but Doom tracks full names.
- Auto-export MemoryBooks entries: writes MemoryBooks notes to Obsidian automatically.
- Show post-export popup: choose summarize/optimize each run.
- Default export folder: fallback path.
- Lorebook mapping controls: assign different lorebooks to different folders.

## Credits

- [Doom's Enhancement Suite](https://github.com/DangerDaza/Dooms-Enhancement-Suite) by DangerDaza
- [DeepLore-Enhanced](https://github.com/pixelnull/sillytavern-DeepLore-Enhanced) by pixelnull
- [SillyTavern-MemoryBooks](https://github.com/Nexus333/st-memorybooks) by Nexus333
- GitHub Copilot (GPT-5.3-Codex) for implementation support and iteration help

## License

See [LICENSE](LICENSE).
