import { chat_metadata, saveChatDebounced } from '../../lib/st-api.js';
import { EXTENSION_NAME, DEBUG } from '../../core/config.js';
import { settings } from '../../core/settings.js';
import { dedupeCharacterNames, sleep } from '../../core/utils.js';

export function getChatMetadata() {
    try {
        if (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) {
            const context = SillyTavern.getContext();
            if (context?.chat_metadata) {
                DEBUG && console.log(`[${EXTENSION_NAME}] Got chat_metadata via SillyTavern.getContext()`);
                return context.chat_metadata;
            }
        }

        if (typeof chat_metadata !== 'undefined' && chat_metadata) {
            DEBUG && console.log(`[${EXTENSION_NAME}] Got chat_metadata as global`);
            return chat_metadata;
        }

        DEBUG && console.log(`[${EXTENSION_NAME}] chat_metadata not available (no chat loaded?)`);
        return null;
    } catch (error) {
        console.error(`[${EXTENSION_NAME}] Error getting chat metadata:`, error);
        return null;
    }
}

export function saveChat() {
    if (typeof saveChatDebounced === 'function') {
        saveChatDebounced();
        DEBUG && console.log(`[${EXTENSION_NAME}] Chat saved via saveChatDebounced`);
    } else if (typeof window.saveChatDebounced === 'function') {
        window.saveChatDebounced();
        DEBUG && console.log(`[${EXTENSION_NAME}] Chat saved via window.saveChatDebounced`);
    }
}

export function ensureDeepLoreContext() {
    const metadata = getChatMetadata();
    if (!metadata) {
        DEBUG && console.log(`[${EXTENSION_NAME}] No chat metadata available`);
        return null;
    }

    if (!metadata.deeplore_context) {
        metadata.deeplore_context = {};
        DEBUG && console.log(`[${EXTENSION_NAME}] Created new deeplore_context`);
    }
    return metadata.deeplore_context;
}

export function getDoomTrackerData() {
    try {
        const metadata = getChatMetadata();
        if (!metadata) {
            DEBUG && console.log(`[${EXTENSION_NAME}] No chat metadata for Doom data`);
            return null;
        }

        const doomData = metadata.dooms_tracker;
        if (doomData) {
            console.log(`[${EXTENSION_NAME}] ✅ Found Doom data in chat_metadata.dooms_tracker`);
            DEBUG && console.log(`[${EXTENSION_NAME}] Doom data keys:`, Object.keys(doomData));
            return doomData;
        }

        DEBUG && console.log(`[${EXTENSION_NAME}] ❌ No dooms_tracker in chat_metadata`);
        return null;
    } catch (error) {
        console.error(`[${EXTENSION_NAME}] Error getting Doom data:`, error);
        return null;
    }
}

function extractFirstName(fullName) {
    if (!fullName) {
        return '';
    }
    return fullName.trim().split(/\s+/)[0];
}

export function getActiveCharactersFromDoom() {
    try {
        const doomData = getDoomTrackerData();
        if (!doomData) {
            return null;
        }

        const characters = [];
        let charData = doomData.lastGeneratedData?.characterThoughts || doomData.committedTrackerData?.characterThoughts;

        if (!charData) {
            DEBUG && console.log(`[${EXTENSION_NAME}] No characterThoughts found in lastGeneratedData or committedTrackerData`);
            return [];
        }

        if (typeof charData === 'string') {
            try {
                charData = JSON.parse(charData);
            } catch (error) {
                console.error(`[${EXTENSION_NAME}] Failed to parse characterThoughts:`, error);
                return [];
            }
        }

        const charArray = Array.isArray(charData) ? charData : (charData.characters || []);

        console.log(`[${EXTENSION_NAME}] Found ${charArray.length} total characters in characterThoughts`);

        for (const char of charArray) {
            if (!char || !char.name) {
                continue;
            }

            if (char.present !== false) {
                let resolvedName = char.name;

                if (settings.firstNameOnly) {
                    const firstName = extractFirstName(resolvedName);
                    console.log(`[${EXTENSION_NAME}]   ✅ ${resolvedName} → ${firstName} (present, first name only)`);
                    resolvedName = firstName;
                } else {
                    console.log(`[${EXTENSION_NAME}]   ✅ ${resolvedName} (present, full name)`);
                }

                characters.push(resolvedName);
            } else {
                DEBUG && console.log(`[${EXTENSION_NAME}]   ❌ ${char.name} (absent)`);
            }
        }

        console.log(`[${EXTENSION_NAME}] Extracted ${characters.length} present characters:`, characters);
        return characters;
    } catch (error) {
        console.error(`[${EXTENSION_NAME}] Error extracting characters:`, error);
        return null;
    }
}

async function pollForDoomUpdate(attempt = 0) {
    if (attempt >= settings.maxPollAttempts) {
        DEBUG && console.log(`[${EXTENSION_NAME}] Max poll attempts reached`);
        return [];
    }

    const characters = getActiveCharactersFromDoom();

    if (characters === null) {
        DEBUG && console.log(`[${EXTENSION_NAME}] Poll ${attempt + 1}/${settings.maxPollAttempts}: Waiting for Doom data...`);
        await sleep(settings.pollInterval);
        return pollForDoomUpdate(attempt + 1);
    }

    DEBUG && console.log(`[${EXTENSION_NAME}] Poll ${attempt + 1}: Data ready with ${characters.length} characters`);
    return characters;
}

async function syncCharactersToDeepLore(usePoll = false) {
    if (!settings.enabled) {
        DEBUG && console.log(`[${EXTENSION_NAME}] Sync disabled`);
        return;
    }

    try {
        const context = ensureDeepLoreContext();
        if (!context) {
            DEBUG && console.log(`[${EXTENSION_NAME}] Could not initialize DeepLore context (no chat loaded?)`);
            return;
        }

        const previousChars = context.character_present || [];
        const activeCharacters = usePoll ? await pollForDoomUpdate() : (getActiveCharactersFromDoom() || []);

        context.character_present = activeCharacters;

        const previousStr = JSON.stringify([...previousChars].sort());
        const currentStr = JSON.stringify([...activeCharacters].sort());

        if (previousStr !== currentStr) {
            console.log(`[${EXTENSION_NAME}] ✅ Character list updated`);
            console.log(`[${EXTENSION_NAME}]    Previous:`, previousChars);
            console.log(`[${EXTENSION_NAME}]    Current:`, activeCharacters);
            saveChat();
        } else {
            DEBUG && console.log(`[${EXTENSION_NAME}] No change in characters`);
        }
    } catch (error) {
        console.error(`[${EXTENSION_NAME}] Sync failed:`, error);
    }
}

async function syncSceneContextToDeepLore() {
    if (!settings.enabled) {
        return;
    }

    try {
        const context = ensureDeepLoreContext();
        if (!context) {
            return;
        }

        const doomData = getDoomTrackerData();
        if (!doomData) {
            return;
        }

        const trackerData = doomData.lastGeneratedData || doomData.committedTrackerData;
        if (!trackerData) {
            return;
        }

        let infoBox = trackerData.infoBox;
        if (typeof infoBox === 'string') {
            try {
                infoBox = JSON.parse(infoBox);
            } catch {
                infoBox = null;
            }
        }

        if (!infoBox) {
            return;
        }

        let hasChanges = false;

        if (settings.syncLocation) {
            const location = infoBox.location?.value || infoBox.location;
            if (location && context.location !== location) {
                context.location = location;
                hasChanges = true;
                DEBUG && console.log(`[${EXTENSION_NAME}] Synced location:`, location);
            }
        }

        if (settings.syncWeather) {
            const weather = infoBox.weather?.value || infoBox.weather;
            if (weather && context.weather !== weather) {
                context.weather = weather;
                hasChanges = true;
                DEBUG && console.log(`[${EXTENSION_NAME}] Synced weather:`, weather);
            }
        }

        if (settings.syncSceneType) {
            const sceneType = infoBox.time?.value || infoBox.time;
            if (sceneType && context.scene_type !== sceneType) {
                context.scene_type = sceneType;
                hasChanges = true;
                DEBUG && console.log(`[${EXTENSION_NAME}] Synced scene_type:`, sceneType);
            }
        }

        if (hasChanges) {
            saveChat();
        }
    } catch (error) {
        console.error(`[${EXTENSION_NAME}] Scene context sync failed:`, error);
    }
}

export async function performSync(useDelay = true) {
    DEBUG && console.log(`[${EXTENSION_NAME}] Sync triggered (delay: ${useDelay})`);

    if (useDelay && settings.syncDelay > 0) {
        await sleep(settings.syncDelay);
    }

    await syncCharactersToDeepLore(true);
    await syncSceneContextToDeepLore();
}

export function getPresentCharactersSnapshot() {
    const names = getActiveCharactersFromDoom() || ensureDeepLoreContext()?.character_present || [];
    return dedupeCharacterNames(names);
}
