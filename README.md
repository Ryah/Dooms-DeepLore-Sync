# DeepLore + Doom Sync

A SillyTavern extension that automatically synchronizes character presence data from [Doom's Enhancement Suite](https://github.com/DangerDaza/Dooms-Enhancement-Suite) to [DeepLore-Enhanced](https://github.com/pixelnull/sillytavern-DeepLore-Enhanced), enabling automatic lorebook context filtering based on which characters are present in the scene.

Full disclosure, this is mostly vibe coded for my own personal use. I use DeepLore-Enhanced to inject my MemoryBooks, which have tags for each character present in the scene.
If you have any feature requests, feel free to submit a request in Issues, but it may take a bit for me to get to it.
I will try and keep this updated if anything breaks.

## What It Does

This extension acts as a bridge between two popular SillyTavern extensions:

- **Doom's Enhancement Suite** tracks which characters are present in your roleplay scene
- **DeepLore-Enhanced** provides advanced lorebook context management with conditional gates

By syncing Doom's character tracking data to DeepLore's `character_present` field, your lorebook entries will automatically activate or deactivate based on whether specific characters are in the scene—no manual slash commands required.

### Example Use Case

You have a lorebook entry about a character named "Alec" that should only inject when Alec is present in the scene. Instead of manually running DeepLore slash commands to set character presence, this extension:

1. Detects when Doom's tracker updates (after each AI response)
2. Extracts the list of present characters from Doom
3. Automatically updates DeepLore's context gates
4. Your "Alec" lorebook entry now activates/deactivates automatically

## Requirements

- [SillyTavern](https://github.com/SillyTavern/SillyTavern) (latest version recommended)
- [Doom's Enhancement Suite](https://github.com/DangerDaza/Dooms-Enhancement-Suite) extension installed and active
- [DeepLore-Enhanced](https://github.com/pixelnull/sillytavern-DeepLore-Enhanced) extension installed and active

## Installation

Put this repo URL inside SillyTavern installation manager thing.
```
https://github.com/Ryah/Dooms-DeepLore-Sync
```

### Character Sync Settings

- **Enable automatic synchronization** - Master toggle for the extension
- **Sync first names only** - Extract only first names from Doom (e.g., "Alec Hamilton" → "Alec")
- Useful when your DeepLore entries use first names but Doom tracks full names
- **Initial Delay (ms)** - Wait time after events before checking Doom data (default: 1500ms)
- Increase if you use a separate API connection for Doom's tracker
- **Poll Interval (ms)** - How often to retry if Doom data isn't ready (default: 500ms)
- **Max Poll Attempts** - Maximum retry attempts before giving up (default: 6)

### (WIP) Optional Scene Context Sync

Optionally sync additional scene metadata from Doom to DeepLore:

- **Sync Location** - Current scene location
- **Sync Weather** - Current weather conditions
- **Sync Scene Type** - Time of day or scene classification

## How It Works

The extension listens for SillyTavern events:

1. **MESSAGE_RECEIVED** - New AI message arrives
2. **GENERATION_ENDED** - AI generation completes
3. **CHAT_CHANGED** - User switches to a different chat

When triggered, it:

1. Waits for the configured delay (to allow Doom's API to update)
2. Polls Doom's tracker data from `chat_metadata.dooms_tracker`
3. Extracts characters marked as "present"
4. Optionally converts full names to first names only
5. Updates DeepLore's `character_present` context field
6. Saves the chat metadata

Your DeepLore lorebook entries with `character_present` gates will now activate automatically!

## Testing & Debugging

Use the **Show Debug Info** button in settings to inspect:

- Whether chat metadata is accessible
- Doom's tracker data structure
- Current list of active characters
- DeepLore context state

Check your browser console (F12) for detailed logs prefixed with `[sillytavern-DeepLore-Doom-Sync]`.

## Troubleshooting

### Make sure it's an issue with the bridge extension itself first before troubleshooting.

**Characters not syncing:**
- Verify both Doom's Enhancement Suite and DeepLore-Enhanced are installed and enabled
- Check that Doom's tracker is actually generating character data (visible in Doom's UI)
- Increase the "Initial Delay" setting if using a separate API connection for Doom
- Click "Sync Now (Test)" to manually trigger a sync
- Check the browser console for error messages

**Names don't match:**
- Enable "Sync first names only" if Doom uses full names but your DeepLore entries use first names
- Ensure your DeepLore lorebook entries use the exact same character names (case-sensitive)

**Doom data not found:**
- Make sure you have an active chat open
- Confirm Doom's Enhancement Suite has generated at least one tracker update
- Check "Show Debug Info" to see if Doom data exists in chat metadata

## Credits

- [Doom's Enhancement Suite](https://github.com/DangerDaza/Dooms-Enhancement-Suite) by DangerDaza
- [DeepLore-Enhanced](https://github.com/pixelnull/sillytavern-DeepLore-Enhanced) by pixelnull
