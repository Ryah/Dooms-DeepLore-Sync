# Changelog

All notable changes related to the DeepLore + Doom Sync integration are documented in this file.

This changelog intentionally tracks integration work across both `sillytavern-DeepLore-Doom-Sync` and `sillytavern-DeepLore-Enhanced`, so the full workflow can be reviewed from one place.

# [Unreleased] - 2026-05-05

## Extension: sillytavern-DeepLore-Doom-Sync

#### Added
- Added automatic export of MemoryBooks-generated lorebook entries to Obsidian when SillyTavern emits `WORLDINFO_UPDATED`.
- Added export filtering so only `STMemoryBooks` entries are processed.
- Added `present_characters` frontmatter injection during export, sourced from Doom's Enhancement Suite tracking.
- Added metadata injection for exported MemoryBooks notes:
  - `st_memorybooks: true`
  - `st_memorybooks_lorebook`
  - `st_memorybooks_uid`
  - `st_memorybooks_range`
  - `present_characters`
- Added user settings in Doom Sync for:
  - enabling/disabling automatic Obsidian export
  - selecting the Obsidian target folder for exported MemoryBooks notes
  - assigning specific lorebook names to specific Obsidian folders (with global folder fallback)
  - loading and browsing folders directly from Obsidian Local REST API using DeepLore's configured vault connection
  - toggling whether to show a combined post-export popup for DeepLore summarize/keyword optimize choices
- Added export path/signature tracking in Doom Sync settings to avoid duplicate processing and support updates.
- Added a combined post-export action prompt with checkboxes so users can choose whether to:
  - run DeepLore summary generation
  - run DeepLore keyword optimization
- Added lazy runtime loading for DeepLore bridge APIs from Doom Sync so missing or not-yet-ready DeepLore modules do not prevent Doom Sync from activating.
- Added range-aware present character extraction that reads `STMB_start` / `STMB_end` from MemoryBooks entries and scans the corresponding chat messages for embedded Doom tracker data.
- Added swipe-aware tracker lookup for present character extraction using per-message `dooms_tracker_swipes` data, with fallback support for persisted `swipe_info` and direct tracker payload layouts.
- Added toast warnings when the exporter has to fall back from range-based present character extraction to the current live tracked character list.

#### Changed
- Changed exported MemoryBooks note filenames to use the numbered entry title only, so the note filename matches the first markdown `#` heading exactly.
- Changed exported MemoryBooks notes to clear the imported `summary` field to an empty string instead of keeping the placeholder `Imported from SillyTavern World Info`.
- Changed post-export processing from two separate prompts into a single combined prompt.
- Changed export behavior so old verbose filename mappings are treated as mismatches and re-exported to the new canonical filename.
- Changed `present_characters` export behavior to prefer characters found across the exact summarized MemoryBooks message range instead of only using the current live Doom Sync snapshot.
- Refactored Doom Sync into a modular `src/` layout with separate core, integration, export, and UI files so the extension is easier to expand without growing `index.js` into a single large script.
- Changed MemoryBooks range frontmatter to emit only `st_memorybooks_range` (removed `st_memorybooks_start` and `st_memorybooks_end`).
- Changed MemoryBooks export signature version so previously exported notes are re-written once and legacy `st_memorybooks_start` / `st_memorybooks_end` fields are removed from existing Obsidian entries.
- Changed Obsidian export routing to resolve folders per lorebook mapping first, then fall back to the global MemoryBooks export folder.
- Changed global default export folder behavior to avoid pre-populating a `DeepLore/...` path; default is now empty/root unless user selects a folder.
- Changed post-export prompt settings from two separate toggles to one popup toggle; summarize/optimize are selected per run inside the popup.

#### Fixed
- Fixed Doom Sync activation failure caused by a top-level hard import into DeepLore internals by replacing it with lazy dynamic imports.
- Fixed exported Obsidian entries using mismatched filename/header naming.
- Fixed imported placeholder summary text leaking low-value retrieval text into DeepLore's lore selection pipeline.
- Fixed a temporary syntax regression introduced while adding the keyword optimization workflow.

#### Notes
- Present character handling remains in `sillytavern-DeepLore-Doom-Sync` only.
- The current implementation uses event-driven lorebook export via `WORLDINFO_UPDATED` rather than scanning chat logs.
- Present character extraction now uses the active in-memory SillyTavern chat objects for the exact MemoryBooks range rather than parsing raw `.jsonl` files directly.

#### Files Affected
- `data/default-user/extensions/sillytavern-DeepLore-Doom-Sync/index.js`
- `data/default-user/extensions/sillytavern-DeepLore-Doom-Sync/src/core/config.js`
- `data/default-user/extensions/sillytavern-DeepLore-Doom-Sync/src/core/settings.js`
- `data/default-user/extensions/sillytavern-DeepLore-Doom-Sync/src/core/utils.js`
- `data/default-user/extensions/sillytavern-DeepLore-Doom-Sync/src/lib/st-api.js`
- `data/default-user/extensions/sillytavern-DeepLore-Doom-Sync/src/systems/export/memorybooks.js`
- `data/default-user/extensions/sillytavern-DeepLore-Doom-Sync/src/systems/integration/deeplore.js`
- `data/default-user/extensions/sillytavern-DeepLore-Doom-Sync/src/systems/integration/sillytavern.js`
- `data/default-user/extensions/sillytavern-DeepLore-Doom-Sync/src/systems/ui/settings.js`

#### PR Draft (Doom Sync Repo)
```markdown
## Summary
- Add event-driven MemoryBooks export to Obsidian on `WORLDINFO_UPDATED`.
- Export only `stmemorybooks === true` entries and track signatures/paths to avoid duplicates.
- Enrich exported notes with MemoryBooks metadata and `present_characters` frontmatter.
- Resolve `present_characters` from exact MemoryBooks message ranges (`STMB_start..STMB_end`) using Doom tracker swipe payloads.
- Add fallback warning behavior when range-based character resolution is unavailable.
- Add optional post-export DeepLore actions (summarize and keyword optimize) via a single combined prompt.
- Refactor Doom Sync into a modular `src/` layout to improve maintainability.

## Why
- Automates cross-extension memory export flow.
- Improves provenance/auditability by storing source message ranges.
- Makes present character data more accurate by tying extraction to the actual summarized range.
- Reduces activation risk with lazy DeepLore bridge imports.

## Validation
- Static diagnostics report no errors in refactored Doom Sync files.
- Export path, metadata injection, and post-export flows were verified in code paths.

## Changelog Scope
- This PR includes only Doom Sync-owned runtime changes and UI/settings wiring.
```
---

## Extension: sillytavern-DeepLore-Enhanced

#### Added
- Added reusable helper `upsertConvertedEntry(...)` in the DeepLore import bridge to convert and upsert a single World Info entry into Obsidian.
- Added Polyceph compatibility helpers in DeepLore entrypoint globals:
  - `deepLoreEnhanced_polycephRetrieve`
  - `deepLoreEnhanced_polycephPublish`
- Added chat folder routing utility module for per-chat folder mapping and filter resolution (`src/chat-folder-routing.js`).
- Added drawer footer `Reset AI Breaker` control (local divergence vs upstream) for manual AI circuit-breaker recovery.

#### Changed
- Changed AI circuit-breaker UX in the drawer footer to show retry countdown and reveal a reset row while the breaker is open.
- Changed AI response parsing to support additional provider envelope shapes (including nested candidate/parts style responses) and more resilient JSON extraction.
- Changed settings defaults/constraints to include chat folder routing controls (`chatFolderRoutingEnabled`, `chatFolderRoutingMode`, `chatFolderAssignments`).
- Changed drawer/footer, settings popup, and stylesheet structure/styling as part of local UI updates tracked against upstream.

#### Fixed
- Fixed drawer footer `Reset AI Breaker` button wiring by aligning the button class with the delegated action handler selector.
- Fixed AI Studio JSON API parsing edge cases by unwrapping nested provider response envelopes and handling non-array JSON payload shapes during AI response extraction.

#### Notes
- No new `present_characters` logic was added directly to DeepLore-Enhanced.
- DeepLore-Enhanced is used as the Obsidian import/write layer and as the source of summarize/optimize tooling.
- This section reflects local divergence detected against upstream `pixelnull/sillytavern-DeepLore-Enhanced` `origin/staging`.

#### Files Affected
- `public/scripts/extensions/third-party/sillytavern-DeepLore-Enhanced/CHANGELOG.md`
- `public/scripts/extensions/third-party/sillytavern-DeepLore-Enhanced/index.js`
- `public/scripts/extensions/third-party/sillytavern-DeepLore-Enhanced/settings-popup.html`
- `public/scripts/extensions/third-party/sillytavern-DeepLore-Enhanced/settings.js`
- `public/scripts/extensions/third-party/sillytavern-DeepLore-Enhanced/style.css`
- `public/scripts/extensions/third-party/sillytavern-DeepLore-Enhanced/src/chat-folder-routing.js`
- `public/scripts/extensions/third-party/sillytavern-DeepLore-Enhanced/src/drawer/drawer-events.js`
- `public/scripts/extensions/third-party/sillytavern-DeepLore-Enhanced/src/drawer/drawer-render-footer.js`
- `public/scripts/extensions/third-party/sillytavern-DeepLore-Enhanced/src/helpers.js`
- `public/scripts/extensions/third-party/sillytavern-DeepLore-Enhanced/src/state.js`
- `public/scripts/extensions/third-party/sillytavern-DeepLore-Enhanced/src/ui/settings-ui.js`
- `public/scripts/extensions/third-party/sillytavern-DeepLore-Enhanced/src/vault/import.js`
- `public/scripts/extensions/third-party/sillytavern-DeepLore-Enhanced/drawer.html`

#### PR Draft (DeepLore-Enhanced Repo)
```markdown
## Summary
- Add reusable `upsertConvertedEntry(...)` helper in the import bridge for single-entry conversion/upsert workflows.
  - Future lorebook automation support, added example for MemoryBooks in my [companion extension](https://github.com/Ryah/Dooms-DeepLore-Sync).
  - My example is pretty hardcoded for specifically MemoryBooks, so I didn't want to include it in this PR to avoid any future conflicts.
- Add [Polyceph](https://github.com/nialyn-mid/polyceph) compatibility hooks for retrieval/publish integration:
  - `deepLoreEnhanced_polycephRetrieve`
  - `deepLoreEnhanced_polycephPublish`
- Add a drawer footer `Reset AI Breaker` control for manual breaker recovery.
- Improve AI breaker UX with countdown visibility and explicit manual reset control.
- Fix reset button wiring so `Reset AI Breaker` reliably triggers the delegated action handler.
- Improve AI response parsing to handle additional provider envelope shapes and nested response payloads.
- Fix AI Studio JSON API parsing fallback so nested JSON response envelopes resolve to usable model text/results.

## Why
- Enables cleaner extension-to-extension integration without duplicating import/write logic.
- Improves resilience and usability around AI service degradation/recovery.
- Increases compatibility with provider-specific response payload formats.

## Validation
- Local diff verified against upstream `origin/staging`.
- UI action path verified for breaker reset: button selector -> delegated handler -> breaker state reset.
```
