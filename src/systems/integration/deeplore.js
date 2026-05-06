import { EXTENSION_NAME } from '../../core/config.js';

let cachedUpsertConvertedEntry = null;
let importBridgeLoadFailed = false;
let cachedSummarizeEntries = null;
let summarizeBridgeLoadFailed = false;
let cachedPopupApi = null;
let popupApiLoadFailed = false;
let cachedOptimizeApi = null;
let optimizeBridgeLoadFailed = false;

export async function getUpsertConvertedEntryFn() {
    if (cachedUpsertConvertedEntry) {
        return cachedUpsertConvertedEntry;
    }
    if (importBridgeLoadFailed) {
        return null;
    }

    try {
        const mod = await import('/scripts/extensions/third-party/sillytavern-DeepLore-Enhanced/src/vault/import.js');
        if (typeof mod?.upsertConvertedEntry === 'function') {
            cachedUpsertConvertedEntry = mod.upsertConvertedEntry;
            return cachedUpsertConvertedEntry;
        }

        importBridgeLoadFailed = true;
        console.warn(`[${EXTENSION_NAME}] DeepLore import bridge loaded but upsertConvertedEntry was not found.`);
        return null;
    } catch (error) {
        importBridgeLoadFailed = true;
        console.warn(`[${EXTENSION_NAME}] DeepLore import bridge unavailable:`, error?.message || error);
        return null;
    }
}

export async function getSummarizeEntriesFn() {
    if (cachedSummarizeEntries) {
        return cachedSummarizeEntries;
    }
    if (summarizeBridgeLoadFailed) {
        return null;
    }

    try {
        const mod = await import('/scripts/extensions/third-party/sillytavern-DeepLore-Enhanced/src/ui/commands-ai.js');
        if (typeof mod?.summarizeEntries === 'function') {
            cachedSummarizeEntries = mod.summarizeEntries;
            return cachedSummarizeEntries;
        }

        summarizeBridgeLoadFailed = true;
        console.warn(`[${EXTENSION_NAME}] DeepLore summarize bridge loaded but summarizeEntries was not found.`);
        return null;
    } catch (error) {
        summarizeBridgeLoadFailed = true;
        console.warn(`[${EXTENSION_NAME}] DeepLore summarize bridge unavailable:`, error?.message || error);
        return null;
    }
}

export async function getPopupApi() {
    if (cachedPopupApi) {
        return cachedPopupApi;
    }
    if (popupApiLoadFailed) {
        return null;
    }

    try {
        const mod = await import('/scripts/popup.js');
        if (typeof mod?.callGenericPopup === 'function' && mod?.POPUP_TYPE?.CONFIRM) {
            cachedPopupApi = {
                callGenericPopup: mod.callGenericPopup,
                POPUP_TYPE: mod.POPUP_TYPE,
            };
            return cachedPopupApi;
        }

        popupApiLoadFailed = true;
        console.warn(`[${EXTENSION_NAME}] Popup API loaded but required exports were missing.`);
        return null;
    } catch (error) {
        popupApiLoadFailed = true;
        console.warn(`[${EXTENSION_NAME}] Popup API unavailable:`, error?.message || error);
        return null;
    }
}

export async function getOptimizeApi() {
    if (cachedOptimizeApi) {
        return cachedOptimizeApi;
    }
    if (optimizeBridgeLoadFailed) {
        return null;
    }

    try {
        const mod = await import('/scripts/extensions/third-party/sillytavern-DeepLore-Enhanced/src/ui/popups.js');
        if (typeof mod?.optimizeEntryKeys === 'function' && typeof mod?.showOptimizePopup === 'function') {
            cachedOptimizeApi = {
                optimizeEntryKeys: mod.optimizeEntryKeys,
                showOptimizePopup: mod.showOptimizePopup,
            };
            return cachedOptimizeApi;
        }

        optimizeBridgeLoadFailed = true;
        console.warn(`[${EXTENSION_NAME}] DeepLore optimize API loaded but required exports were missing.`);
        return null;
    } catch (error) {
        optimizeBridgeLoadFailed = true;
        console.warn(`[${EXTENSION_NAME}] DeepLore optimize API unavailable:`, error?.message || error);
        return null;
    }
}
