import { chat, name1 } from '../../lib/st-api.js';
import { EXTENSION_NAME, DEBUG } from '../../core/config.js';
import { settings, saveSettings, resolveObsidianFolderForLorebook } from '../../core/settings.js';
import { sanitizeFilenamePart, yamlEscapeScalar, dedupeCharacterNames } from '../../core/utils.js';
import { getUpsertConvertedEntryFn, getSummarizeEntriesFn, getPopupApi, getOptimizeApi } from '../integration/deeplore.js';
import { ensureDeepLoreContext, getActiveCharactersFromDoom, getPresentCharactersSnapshot } from '../integration/sillytavern.js';

const MEMORYBOOKS_EXPORT_SCHEMA_VERSION = 2;

function getUserCharacterNames() {
    const names = [];

    if (typeof name1 === 'string' && name1.trim()) {
        names.push(name1.trim());
    }

    try {
        const context = typeof SillyTavern !== 'undefined' && SillyTavern.getContext
            ? SillyTavern.getContext()
            : null;
        if (typeof context?.name1 === 'string' && context.name1.trim()) {
            names.push(context.name1.trim());
        }
        if (typeof context?.userName === 'string' && context.userName.trim()) {
            names.push(context.userName.trim());
        }
    } catch {
        // Ignore context lookup errors and fall back to exported globals.
    }

    return new Set(names.map((entry) => entry.toLowerCase()));
}

function parseCharacterThoughtsPayload(rawThoughts) {
    if (!rawThoughts) {
        return [];
    }

    let parsed = rawThoughts;
    if (typeof parsed === 'string') {
        try {
            parsed = JSON.parse(parsed);
        } catch (error) {
            DEBUG && console.warn(`[${EXTENSION_NAME}] Failed to parse characterThoughts payload:`, error);
            return [];
        }
    }

    if (Array.isArray(parsed)) {
        return parsed;
    }
    if (Array.isArray(parsed?.characters)) {
        return parsed.characters;
    }
    return [];
}

function getTrackerSwipeDataForMessage(message) {
    if (!message || message.is_user || !message.extra) {
        return null;
    }

    const swipeId = message.swipe_id || 0;
    let swipeData = message.extra.dooms_tracker_swipes?.[swipeId];
    if (!swipeData && message.swipe_info?.[swipeId]?.extra?.dooms_tracker_swipes) {
        swipeData = message.swipe_info[swipeId].extra.dooms_tracker_swipes[swipeId];
    }

    if (!swipeData && message.extra.dooms_tracker) {
        swipeData = message.extra.dooms_tracker;
    }

    return swipeData || null;
}

function getMemoryEntryRange(entry) {
    const start = Number(entry?.STMB_start);
    const end = Number(entry?.STMB_end);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start) {
        return null;
    }
    return { start, end };
}

function getPresentCharactersFromChatRange(entry) {
    const range = getMemoryEntryRange(entry);
    if (!range) {
        return { names: [], reason: 'MemoryBooks range metadata is missing.' };
    }

    if (!Array.isArray(chat) || chat.length === 0) {
        return { names: [], reason: 'Active chat messages are unavailable.' };
    }

    if (range.end >= chat.length) {
        return { names: [], reason: `MemoryBooks range ${range.start}-${range.end} exceeds current chat length ${chat.length}.` };
    }

    const userNames = getUserCharacterNames();
    const names = [];
    let trackerMessages = 0;

    for (let messageIndex = range.start; messageIndex <= range.end; messageIndex++) {
        const message = chat[messageIndex];
        const swipeData = getTrackerSwipeDataForMessage(message);
        if (!swipeData?.characterThoughts) {
            continue;
        }

        trackerMessages++;
        const thoughts = parseCharacterThoughtsPayload(swipeData.characterThoughts);
        for (const thought of thoughts) {
            const rawName = String(thought?.name || '').trim();
            if (!rawName) continue;
            if (userNames.has(rawName.toLowerCase())) continue;
            names.push(rawName);
        }
    }

    const deduped = dedupeCharacterNames(names);
    if (deduped.length === 0) {
        const reason = trackerMessages > 0
            ? `No non-user characters were found in characterThoughts for range ${range.start}-${range.end}.`
            : `No Doom tracker message data was found in range ${range.start}-${range.end}.`;
        return { names: [], reason };
    }

    return { names: deduped, reason: '' };
}

function resolvePresentCharactersForExport(entry) {
    const ranged = getPresentCharactersFromChatRange(entry);
    if (ranged.names.length > 0) {
        return { names: ranged.names, usedFallback: false, fallbackReason: '' };
    }

    const fallbackNames = getPresentCharactersSnapshot();
    return {
        names: fallbackNames,
        usedFallback: true,
        fallbackReason: ranged.reason || 'Unable to resolve present characters from message range.',
    };
}

function injectMemorybooksMetadata(markdown, metadata = {}) {
    if (!markdown || typeof markdown !== 'string' || !markdown.startsWith('---\n')) {
        return markdown;
    }

    const frontmatterEnd = markdown.indexOf('\n---\n', 4);
    if (frontmatterEnd === -1) {
        return markdown;
    }

    let frontmatterBlock = markdown.slice(0, frontmatterEnd + 5);
    const afterFrontmatter = markdown.slice(frontmatterEnd + 5);

    if (/^summary:.*$/m.test(frontmatterBlock)) {
        frontmatterBlock = frontmatterBlock.replace(/^summary:.*$/m, 'summary: ""');
    } else {
        frontmatterBlock = frontmatterBlock.replace(/\n---\n$/, '\nsummary: ""\n---\n');
    }

    // Remove legacy per-bound fields now that range is stored as a single scalar.
    frontmatterBlock = frontmatterBlock
        .replace(/^st_memorybooks_start:.*\r?\n/mg, '')
        .replace(/^st_memorybooks_end:.*\r?\n/mg, '');

    const blockLines = [];

    if (metadata.lorebookName) {
        blockLines.push(`st_memorybooks_lorebook: "${yamlEscapeScalar(metadata.lorebookName)}"`);
    }

    if (metadata.uid !== undefined && metadata.uid !== null) {
        blockLines.push(`st_memorybooks_uid: ${Number(metadata.uid)}`);
    }

    if (Number.isInteger(metadata.rangeStart) && Number.isInteger(metadata.rangeEnd)) {
        blockLines.push(`st_memorybooks_range: "${metadata.rangeStart}-${metadata.rangeEnd}"`);
    }

    blockLines.push('st_memorybooks: true');

    const presentCharacters = Array.isArray(metadata.presentCharacters)
        ? metadata.presentCharacters.filter(Boolean)
        : [];
    if (presentCharacters.length > 0) {
        blockLines.push('present_characters:');
        for (const name of presentCharacters) {
            blockLines.push(`  - "${yamlEscapeScalar(name)}"`);
        }
    }

    frontmatterBlock = frontmatterBlock.replace(/\n---\n$/, `\n${blockLines.join('\n')}\n---\n`);
    return `${frontmatterBlock}${afterFrontmatter}`;
}

function computeEntrySignature(entry) {
    const key = Array.isArray(entry?.key) ? entry.key : [];
    const keysecondary = Array.isArray(entry?.keysecondary) ? entry.keysecondary : [];
    const payload = {
        exportSchemaVersion: MEMORYBOOKS_EXPORT_SCHEMA_VERSION,
        uid: Number(entry?.uid) || 0,
        comment: String(entry?.comment || ''),
        content: String(entry?.content || ''),
        key,
        keysecondary,
        order: Number(entry?.order) || 0,
    };
    return JSON.stringify(payload);
}

function buildMemorybooksFilename(entry) {
    const title = sanitizeFilenamePart(entry?.comment || `Memory-${entry?.uid || 'unknown'}`);
    return `${title}.md`;
}

async function exportMemorybooksEntryToObsidian(lorebookName, entry) {
    const upsertConvertedEntry = await getUpsertConvertedEntryFn();
    if (!upsertConvertedEntry) {
        return false;
    }

    const entryKey = `${lorebookName}:${entry.uid}`;
    const folder = resolveObsidianFolderForLorebook(lorebookName);
    const filename = buildMemorybooksFilename(entry);
    const memoryRange = getMemoryEntryRange(entry);
    const presentCharacterResolution = resolvePresentCharactersForExport(entry);
    const presentCharacters = presentCharacterResolution.names;

    const result = await upsertConvertedEntry(entry, {
        folder,
        filename,
        transformContent: (markdown) => injectMemorybooksMetadata(markdown, {
            lorebookName,
            uid: entry.uid,
            rangeStart: memoryRange?.start,
            rangeEnd: memoryRange?.end,
            presentCharacters,
        }),
    });

    if (!result.ok) {
        console.warn(`[${EXTENSION_NAME}] Obsidian export failed for ${entryKey}: ${result.error}`);
        return false;
    }

    if (!settings.obsidianEntryPathMap || typeof settings.obsidianEntryPathMap !== 'object') {
        settings.obsidianEntryPathMap = {};
    }
    settings.obsidianEntryPathMap[entryKey] = result.path;

    return {
        ok: true,
        path: result.path,
        title: String(entry?.comment || '').trim() || `Memory ${entry?.uid ?? ''}`,
        content: String(entry?.content || ''),
        keys: Array.isArray(entry?.key) ? [...entry.key] : [],
        usedPresentCharactersFallback: presentCharacterResolution.usedFallback,
        presentCharactersFallbackReason: presentCharacterResolution.fallbackReason,
    };
}

async function runDeepLoreSummary(exportedEntries) {
    const summarizeEntries = await getSummarizeEntriesFn();
    if (!summarizeEntries) {
        return;
    }

    const summarizeTargets = exportedEntries.map((item) => ({
        title: item.title,
        content: item.content,
        filename: item.path,
        summary: '',
    }));

    try {
        const result = await summarizeEntries(summarizeTargets);
        toastr.success(
            `DeepLore summaries: ${result.generated} written, ${result.skipped} skipped, ${result.failed} failed${result.aborted ? `, ${result.aborted} aborted` : ''}.`,
            'DeepLore + Doom Sync',
        );
    } catch (error) {
        console.warn(`[${EXTENSION_NAME}] DeepLore summarize failed:`, error);
    }
}

async function runDeepLoreOptimize(exportedEntries) {
    const optimizeApi = await getOptimizeApi();
    if (!optimizeApi) {
        return;
    }

    const { optimizeEntryKeys, showOptimizePopup } = optimizeApi;
    let attempted = 0;
    let failed = 0;

    for (const item of exportedEntries) {
        const entryForOptimize = {
            title: item.title,
            content: item.content,
            filename: item.path,
            keys: Array.isArray(item.keys) ? item.keys : [],
            vaultSource: undefined,
        };

        attempted++;
        try {
            const suggestions = await optimizeEntryKeys(entryForOptimize);
            if (!suggestions) {
                failed++;
                continue;
            }
            await showOptimizePopup(entryForOptimize, suggestions);
        } catch (error) {
            failed++;
            console.warn(`[${EXTENSION_NAME}] Keyword optimize failed for "${entryForOptimize.title}":`, error);
        }
    }

    if (attempted > 0) {
        toastr.info(
            `DeepLore optimize finished: ${attempted - failed} processed, ${failed} failed to generate suggestions.`,
            'DeepLore + Doom Sync',
        );
    }
}

async function maybePromptDeepLorePostExportActions(exportedEntries) {
    if (!Array.isArray(exportedEntries) || exportedEntries.length === 0) {
        return;
    }

    if (!settings.promptDeepLorePostExportPopup) {
        return;
    }

    const popupApi = await getPopupApi();
    if (!popupApi) {
        return;
    }

    const { callGenericPopup, POPUP_TYPE } = popupApi;
    const count = exportedEntries.length;
    let runSummary = true;
    let runOptimize = false;

    const popupHtml = `
        <div class="dle-popup">
            <p>Exported <b>${count}</b> MemoryBooks entr${count === 1 ? 'y' : 'ies'} to Obsidian.</p>
            <p>Choose which DeepLore post-processing to run now:</p>
            <label class="checkbox_label" for="deeplore_doom_post_summary">
                <input type="checkbox" id="deeplore_doom_post_summary" ${runSummary ? 'checked' : ''} />
                <span>Generate summaries (DeepLore summarize flow, with review)</span>
            </label>
            <label class="checkbox_label" for="deeplore_doom_post_optimize">
                <input type="checkbox" id="deeplore_doom_post_optimize" ${runOptimize ? 'checked' : ''} />
                <span>Optimize keywords (DeepLore optimize flow, per-entry approval)</span>
            </label>
        </div>
    `;

    const confirmed = await callGenericPopup(popupHtml, POPUP_TYPE.CONFIRM, '', {
        onOpen: () => {
            const summaryEl = document.getElementById('deeplore_doom_post_summary');
            const optimizeEl = document.getElementById('deeplore_doom_post_optimize');
            if (summaryEl) {
                runSummary = !!summaryEl.checked;
                summaryEl.addEventListener('change', () => {
                    runSummary = !!summaryEl.checked;
                });
            }
            if (optimizeEl) {
                runOptimize = !!optimizeEl.checked;
                optimizeEl.addEventListener('change', () => {
                    runOptimize = !!optimizeEl.checked;
                });
            }
        },
    });

    if (!confirmed) {
        return;
    }

    if (runSummary) {
        await runDeepLoreSummary(exportedEntries);
    }
    if (runOptimize) {
        await runDeepLoreOptimize(exportedEntries);
    }
}

export async function handleWorldInfoUpdated(lorebookName, lorebookData) {
    if (!settings.enabled || !settings.obsidianAutoExportEnabled) {
        return;
    }

    if (!lorebookName || !lorebookData?.entries) {
        return;
    }

    const entries = Object.values(lorebookData.entries).filter((entry) => entry?.stmemorybooks === true);
    if (entries.length === 0) {
        return;
    }

    if (!settings.obsidianEntrySignatures || typeof settings.obsidianEntrySignatures !== 'object') {
        settings.obsidianEntrySignatures = {};
    }

    let changedCount = 0;
    let exportedCount = 0;
    const exportedEntries = [];
    const fallbackWarnings = [];

    for (const entry of entries) {
        if (!entry || entry.uid === undefined || entry.uid === null) {
            continue;
        }

        const entryKey = `${lorebookName}:${entry.uid}`;
        const signature = computeEntrySignature(entry);
        const expectedFilename = buildMemorybooksFilename(entry);
        const mappedPath = settings.obsidianEntryPathMap?.[entryKey] || '';
        const mappedFilename = mappedPath ? mappedPath.split('/').pop() : '';
        const filenameMismatch = !!mappedFilename && mappedFilename !== expectedFilename;

        if (!filenameMismatch && settings.obsidianEntrySignatures[entryKey] === signature) {
            continue;
        }

        changedCount++;
        const exportResult = await exportMemorybooksEntryToObsidian(lorebookName, entry);
        if (exportResult?.ok) {
            settings.obsidianEntrySignatures[entryKey] = signature;
            exportedCount++;
            exportedEntries.push(exportResult);
            if (exportResult.usedPresentCharactersFallback) {
                fallbackWarnings.push(`${entry.comment || entry.uid}: ${exportResult.presentCharactersFallbackReason}`);
            }
        }
    }

    if (changedCount > 0) {
        saveSettings();
    }

    if (exportedCount > 0) {
        console.log(`[${EXTENSION_NAME}] Exported ${exportedCount}/${changedCount} MemoryBooks entries to Obsidian from "${lorebookName}"`);
        if (fallbackWarnings.length > 0) {
            const summary = fallbackWarnings[0];
            toastr.warning(
                `Used current tracked present_characters fallback for ${fallbackWarnings.length} exported entr${fallbackWarnings.length === 1 ? 'y' : 'ies'}. ${summary}`,
                'DeepLore + Doom Sync',
                { timeOut: 10000 },
            );
        }
        await maybePromptDeepLorePostExportActions(exportedEntries);
    }
}
