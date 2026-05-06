# DeepLore + Doom Sync

DeepLore + Doom Sync is a bridge extension for [SillyTavern](https://github.com/SillyTavern/SillyTavern).

It connects:

- [Doom's Enhancement Suite](https://github.com/DangerDaza/Dooms-Enhancement-Suite) (which tracks who is currently in the scene)
- [DeepLore-Enhanced](https://github.com/pixelnull/sillytavern-DeepLore-Enhanced) (which manages lorebook/context behavior and Obsidian workflows)

In plain terms: this extension keeps your character-aware lore and MemoryBooks workflow in sync automatically, so you do not have to keep doing manual steps every time the scene changes.

## Important: Required Dependencies

This bridge is not standalone. It will not work by itself.

You must have all of the following:

- [SillyTavern](https://github.com/SillyTavern/SillyTavern)
- [Doom's Enhancement Suite](https://github.com/DangerDaza/Dooms-Enhancement-Suite)
- [DeepLore-Enhanced](https://github.com/pixelnull/sillytavern-DeepLore-Enhanced)
- [SillyTavern-MemoryBooks](https://github.com/Nexus333/st-memorybooks)
- Obsidian Local REST API plugin in your Obsidian vault: [obsidian-local-rest-api](https://github.com/coddingtonbear/obsidian-local-rest-api)

## Who is this made for?

When roleplay scenes shift quickly, manual context management gets annoying fast.

Typical pain points this extension solves:

- "I forgot to update who is present, so wrong lore triggered."
- "My MemoryBooks are generated, but I still have to manually move/export them into Obsidian."
- "Different chats/lorebooks should go to different vault folders, but setting paths by hand is tedious."
- "After export, I want summary/keyword steps quickly without hunting through menus."

If this sounds like you, then this may help.

## What This Extension Does

### 1) Automatic Present Character Sync (Doom -> DeepLore)

The extension reads Doom's current present-character tracking and updates DeepLore's character context automatically.

Example:

- Scene starts with Alec and Flora present.
- Doom marks Alec/Flora as present.
- DeepLore gates that rely on present characters update automatically.
- When Alec leaves later, those Alec-specific entries stop triggering without manual commands.

Why this matters:

- Fewer wrong lore injections.
- Less manual correction during long sessions.

### 2) Automatic MemoryBooks Export to Obsidian

When MemoryBooks entries are produced, this extension can export those entries to Obsidian automatically.

It exports only MemoryBooks entries, and writes a clean note with useful metadata so the note is easier to track later.

Example:

- You finish a scene and MemoryBooks updates a lorebook.
- Export runs automatically.
- The note appears in your chosen vault folder with a clean filename/title match.

Why this matters:

- No copy/paste routine.
- Obsidian stays up-to-date with your current chat memory workflow.

### 3) Better Present Character Accuracy for Exported Notes

For exported MemoryBooks notes, present characters are resolved from the exact message range that generated that memory whenever possible.

Example:

- A memory came from messages 120-135.
- The extension tries to read character presence from that same range.
- You get character tags that better match the moment the memory was created.

Why this matters:

- Better historical accuracy in saved notes.
- Fewer "current scene" mismatches on older memories.

### 4) Smart Folder Routing (Global + Per-Lorebook)

You can set:

- one default export folder
- optional folder overrides per lorebook

If a lorebook has a custom folder, that wins. If not, default folder is used.

Example:

- `Flora MemoryBooks` -> `Lorebooks/Flora`
- `Regency Lore` -> `Lorebooks/Regency`
- everything else -> default folder

Why this matters:

- Cleaner vault organization.
- Less manual sorting after export.

### 5) Live Vault Folder Browser (No More Guessing Paths)

Instead of typing folder paths by hand, you can load folders directly from Obsidian Local REST API and pick them in the UI.

Why this matters:

- Fewer path typos.
- Faster setup, especially in large vaults.

### 6) One Post-Export Popup for Optional Follow-Up Actions

After export, you can optionally show one popup where you choose what to run now:

- DeepLore summarize
- DeepLore keyword optimize

This is a single popup toggle in settings, with per-run choices inside the popup.

Why this matters:

- Keeps workflow fast and consistent.
- No duplicated prompts.

## Installation

Install via SillyTavern's extension installer using:

```text
https://github.com/Ryah/Dooms-DeepLore-Sync
```

## Settings Guide

### Sync Behavior

- Enable automatic synchronization: master on/off switch.
- Sync first names only: turns "Alec Hamilton" into "Alec" for matching if your DeepLore gates use first names.

### Obsidian Export

- Auto-export MemoryBooks entries to Obsidian: enables automatic export.
- Show post-export popup to choose summarize and keyword optimize: controls whether the optional follow-up popup appears.
- Default export folder: fallback folder when no lorebook-specific folder is set.

### Lorebook Folder Routing

- Load Vault Folders: fetches folders from your configured DeepLore vault connection.
- Use As Default: sets currently selected folder as default export folder.
- Assign Mapping: maps selected lorebook to selected folder.
- Remove Mapping: removes folder override for that lorebook.
- Advanced mapping text box: optional direct edit mode (`Lorebook Name = Folder/Path`).

### Timing

- Initial Delay (ms): wait time before checking Doom data.
- Poll Interval (ms): retry rate when data is not ready yet.
- Max Poll Attempts: retry count before stopping.

## Quick Real-World Example

You run two different story lines in one vault:

- Flora chat should export to `Lorebooks/Flora`
- Regency chat should export to `Lorebooks/Regency`

With this extension:

1. You load vault folders once from the picker.
2. You map each lorebook to the right folder.
3. MemoryBooks export and route automatically.
4. Present characters are carried into exported frontmatter.
5. You optionally run summarize/optimize from one popup.

Result: less maintenance, cleaner vaults, and fewer context mistakes.

## Troubleshooting

### Characters are not syncing

- Verify both [Doom's Enhancement Suite](https://github.com/DangerDaza/Dooms-Enhancement-Suite) and [DeepLore-Enhanced](https://github.com/pixelnull/sillytavern-DeepLore-Enhanced) are installed and enabled.
- Confirm Doom tracker data is actually being generated in your current chat.
- Increase Initial Delay if updates arrive late.
- Use Sync Now (Test) in settings.

### Export features are not working

- Confirm DeepLore vault settings are configured.
- Confirm Obsidian Local REST API plugin is installed and running: [obsidian-local-rest-api](https://github.com/coddingtonbear/obsidian-local-rest-api)
- Confirm API key/connection in DeepLore is valid.

### Folder picker does not load

- Check that DeepLore has an enabled primary vault.
- Check that Local REST API is reachable from SillyTavern.

### Need deeper debug info

- Use Show Debug Info in extension settings.
- Open browser console and look for logs starting with `[sillytavern-DeepLore-Doom-Sync]`.

## Credits

- [Doom's Enhancement Suite](https://github.com/DangerDaza/Dooms-Enhancement-Suite) by DangerDaza
- [DeepLore-Enhanced](https://github.com/pixelnull/sillytavern-DeepLore-Enhanced) by pixelnull
- [SillyTavern-MemoryBooks](https://github.com/Nexus333/st-memorybooks) by Nexus333
- GitHub Copilot (GPT-5.3-Codex) for implementation support and iteration help
