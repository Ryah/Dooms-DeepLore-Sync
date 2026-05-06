import { EXTENSION_NAME, DEBUG, defaultSettings } from './config.js';

export const settings = { ...defaultSettings };

export function loadSettings() {
    try {
        const saved = localStorage.getItem(`${EXTENSION_NAME}_settings`);
        const parsed = saved ? JSON.parse(saved) : {};
        Object.assign(settings, defaultSettings, parsed || {});

        if (parsed && typeof parsed === 'object' && parsed.promptDeepLorePostExportPopup === undefined) {
            const legacySummary = !!parsed.promptDeepLoreSummaryAfterExport;
            const legacyOptimize = !!parsed.promptDeepLoreOptimizeAfterExport;
            settings.promptDeepLorePostExportPopup = legacySummary || legacyOptimize;
        }

        DEBUG && console.log(`[${EXTENSION_NAME}] Settings loaded:`, settings);
    } catch (error) {
        console.error(`[${EXTENSION_NAME}] Failed to load settings:`, error);
        Object.assign(settings, defaultSettings);
    }
}

export function saveSettings() {
    try {
        localStorage.setItem(`${EXTENSION_NAME}_settings`, JSON.stringify(settings));
        DEBUG && console.log(`[${EXTENSION_NAME}] Settings saved`);
    } catch (error) {
        console.error(`[${EXTENSION_NAME}] Failed to save settings:`, error);
    }
}

export function normalizeVaultFolder(folder) {
    return String(folder || '').trim().replace(/^\/+/, '').replace(/\/+$/, '');
}

export function normalizeLorebookFolderMap(rawMap) {
    if (!rawMap || typeof rawMap !== 'object' || Array.isArray(rawMap)) {
        return {};
    }

    const normalized = {};
    for (const [rawLorebook, rawFolder] of Object.entries(rawMap)) {
        const lorebook = String(rawLorebook || '').trim();
        if (!lorebook) {
            continue;
        }

        const folder = normalizeVaultFolder(rawFolder);
        if (!folder) {
            continue;
        }

        normalized[lorebook] = folder;
    }

    return normalized;
}

export function resolveObsidianFolderForLorebook(lorebookName) {
    const normalizedMap = normalizeLorebookFolderMap(settings.obsidianMemoryFolderByLorebook);
    settings.obsidianMemoryFolderByLorebook = normalizedMap;

    const lorebookKey = String(lorebookName || '').trim();
    if (lorebookKey && normalizedMap[lorebookKey]) {
        return normalizedMap[lorebookKey];
    }

    return normalizeVaultFolder(settings.obsidianMemoryFolder);
}
