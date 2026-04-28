/**
 * DeepLore + Doom Sync Extension
 *
 * Automatically synchronizes Doom's Enhancement Suite character tracking
 * with DeepLore-Enhanced's contextual gates.
 */

import { eventSource, event_types, chat, chat_metadata, saveSettingsDebounced, characters, this_chid } from '../../../../script.js';

const EXTENSION_NAME = 'sillytavern-DeepLore-Doom-Sync';
const DEBUG = true;

console.log(`[${EXTENSION_NAME}] Script loaded`);

// Configuration
const defaultSettings = {
    enabled: true,
    syncDelay: 1500,
    pollInterval: 500,
    maxPollAttempts: 6,
    // syncLocation: false,
    // syncWeather: false,
    // syncSceneType: false,
    firstNameOnly: true, // Only sync first names
};

let settings = { ...defaultSettings };

/**
 * Get chat metadata safely
 * Access via SillyTavern.getContext() like Doom does
 */
function getChatMetadata() {
    try {
        // Try SillyTavern.getContext() first (most reliable)
        if (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) {
            const context = SillyTavern.getContext();
            if (context?.chat_metadata) {
                DEBUG && console.log(`[${EXTENSION_NAME}] Got chat_metadata via SillyTavern.getContext()`);
                return context.chat_metadata;
            }
        }

        // Fallback to global variable
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

/**
 * Save chat
 */
function saveChat() {
    if (typeof saveChatDebounced === 'function') {
        saveChatDebounced();
        DEBUG && console.log(`[${EXTENSION_NAME}] Chat saved via saveChatDebounced`);
    } else if (typeof window.saveChatDebounced === 'function') {
        window.saveChatDebounced();
        DEBUG && console.log(`[${EXTENSION_NAME}] Chat saved via window.saveChatDebounced`);
    }
}

/**
 * Load extension settings
 */
function loadSettings() {
    try {
        const saved = localStorage.getItem(`${EXTENSION_NAME}_settings`);
        if (saved) {
            settings = { ...defaultSettings, ...JSON.parse(saved) };
        }
        DEBUG && console.log(`[${EXTENSION_NAME}] Settings loaded:`, settings);
    } catch (error) {
        console.error(`[${EXTENSION_NAME}] Failed to load settings:`, error);
    }
}

/**
 * Save extension settings
 */
function saveSettings() {
    try {
        localStorage.setItem(`${EXTENSION_NAME}_settings`, JSON.stringify(settings));
        DEBUG && console.log(`[${EXTENSION_NAME}] Settings saved`);
    } catch (error) {
        console.error(`[${EXTENSION_NAME}] Failed to save settings:`, error);
    }
}

/**
 * Get or initialize DeepLore context
 */
function ensureDeepLoreContext() {
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

/**
 * Get Doom's tracker data from chat metadata
 */
function getDoomTrackerData() {
    try {
        const metadata = getChatMetadata();
        if (!metadata) {
            DEBUG && console.log(`[${EXTENSION_NAME}] No chat metadata for Doom data`);
            return null;
        }

        // Doom stores data in chat_metadata.dooms_tracker
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

/**
 * Extract first name from a full name
 * @param {string} fullName - Full character name (e.g., "Alec Hamilton")
 * @returns {string} - First name only (e.g., "Alec")
 */
function extractFirstName(fullName) {
    if (!fullName) return '';
    return fullName.trim().split(/\s+/)[0];
}

/**
 * Extract active character names from Doom's tracker
 * Doom stores present characters in lastGeneratedData.characterThoughts or committedTrackerData.characterThoughts
 */
function getActiveCharactersFromDoom() {
    try {
        const doomData = getDoomTrackerData();
        if (!doomData) {
            return null;
        }

        const characters = [];

        // Character data is stored in lastGeneratedData or committedTrackerData
        // Try lastGeneratedData first (most recent), then committedTrackerData (last saved)
        let charData = doomData.lastGeneratedData?.characterThoughts ||
            doomData.committedTrackerData?.characterThoughts;

        if (!charData) {
            DEBUG && console.log(`[${EXTENSION_NAME}] No characterThoughts found in lastGeneratedData or committedTrackerData`);
            return [];
        }

        // characterThoughts might be a string (JSON) or already parsed
        if (typeof charData === 'string') {
            try {
                charData = JSON.parse(charData);
            } catch (e) {
                console.error(`[${EXTENSION_NAME}] Failed to parse characterThoughts:`, e);
                return [];
            }
        }

        // characterThoughts can be an array or object with characters array
        const charArray = Array.isArray(charData) ? charData : (charData.characters || []);

        console.log(`[${EXTENSION_NAME}] Found ${charArray.length} total characters in characterThoughts`);

        for (const char of charArray) {
            if (!char || !char.name) continue;

            // Only include characters marked as present
            // If 'present' field doesn't exist, assume present
            if (char.present !== false) {
                let name = char.name;

                // Extract first name only if setting is enabled
                if (settings.firstNameOnly) {
                    const firstName = extractFirstName(name);
                    console.log(`[${EXTENSION_NAME}]   ✅ ${name} → ${firstName} (present, first name only)`);
                    characters.push(firstName);
                } else {
                    console.log(`[${EXTENSION_NAME}]   ✅ ${name} (present, full name)`);
                    characters.push(name);
                }
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

/**
 * Poll for Doom data updates with retry logic
 */
async function pollForDoomUpdate(attempt = 0) {
    if (attempt >= settings.maxPollAttempts) {
        DEBUG && console.log(`[${EXTENSION_NAME}] Max poll attempts reached`);
        return [];
    }

    const characters = getActiveCharactersFromDoom();

    if (characters === null) {
        DEBUG && console.log(`[${EXTENSION_NAME}] Poll ${attempt + 1}/${settings.maxPollAttempts}: Waiting for Doom data...`);
        await new Promise(resolve => setTimeout(resolve, settings.pollInterval));
        return pollForDoomUpdate(attempt + 1);
    }

    DEBUG && console.log(`[${EXTENSION_NAME}] Poll ${attempt + 1}: Data ready with ${characters.length} characters`);
    return characters;
}

/**
 * Sync characters to DeepLore context
 */
async function syncCharactersToDeepLore(usePoll = false) {
    if (!settings.enabled) {
        DEBUG && console.log(`[${EXTENSION_NAME}] Sync disabled`);
        return;
    }

    try {
        const ctx = ensureDeepLoreContext();
        if (!ctx) {
            DEBUG && console.log(`[${EXTENSION_NAME}] Could not initialize DeepLore context (no chat loaded?)`);
            return;
        }

        const previousChars = ctx.character_present || [];
        let activeCharacters;

        if (usePoll) {
            activeCharacters = await pollForDoomUpdate();
        } else {
            activeCharacters = getActiveCharactersFromDoom() || [];
        }

        ctx.character_present = activeCharacters;

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

/**
 * Sync additional scene context from Doom's infoBox
 */
async function syncSceneContextToDeepLore() {
    if (!settings.enabled) return;

    try {
        const ctx = ensureDeepLoreContext();
        if (!ctx) return;

        const doomData = getDoomTrackerData();
        if (!doomData) return;

        // Scene info is in lastGeneratedData or committedTrackerData
        const trackerData = doomData.lastGeneratedData || doomData.committedTrackerData;
        if (!trackerData) return;

        // Doom stores scene info in infoBox
        let infoBox = trackerData.infoBox;
        if (typeof infoBox === 'string') {
            try {
                infoBox = JSON.parse(infoBox);
            } catch (e) {
                infoBox = null;
            }
        }

        if (!infoBox) return;

        let hasChanges = false;

        if (settings.syncLocation) {
            const location = infoBox.location?.value || infoBox.location;
            if (location && ctx.location !== location) {
                ctx.location = location;
                hasChanges = true;
                DEBUG && console.log(`[${EXTENSION_NAME}] Synced location:`, location);
            }
        }

        if (settings.syncWeather) {
            const weather = infoBox.weather?.value || infoBox.weather;
            if (weather && ctx.weather !== weather) {
                ctx.weather = weather;
                hasChanges = true;
                DEBUG && console.log(`[${EXTENSION_NAME}] Synced weather:`, weather);
            }
        }

        if (settings.syncSceneType) {
            const sceneType = infoBox.time?.value || infoBox.time;
            if (sceneType && ctx.scene_type !== sceneType) {
                ctx.scene_type = sceneType;
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

/**
 * Main sync function
 */
async function performSync(useDelay = true) {
    DEBUG && console.log(`[${EXTENSION_NAME}] Sync triggered (delay: ${useDelay})`);

    if (useDelay && settings.syncDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, settings.syncDelay));
    }

    await syncCharactersToDeepLore(true);
    await syncSceneContextToDeepLore();
}

/**
 * Create settings UI
 */
function createSettingsUI() {
    const settingsHtml = `
        <div class="deeplore-doom-sync-settings">
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>DeepLore + Doom Sync</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content">
                    <label class="checkbox_label" for="deeplore_doom_sync_enabled">
                        <input type="checkbox" id="deeplore_doom_sync_enabled" ${settings.enabled ? 'checked' : ''} />
                        <span>Enable automatic synchronization</span>
                    </label>

                    <label class="checkbox_label" for="deeplore_doom_first_name_only">
                        <input type="checkbox" id="deeplore_doom_first_name_only" ${settings.firstNameOnly ? 'checked' : ''} />
                        <span>Sync first names only (e.g., "Alec" instead of "Alec Hamilton")</span>
                    </label>

                    <label for="deeplore_doom_sync_delay">
                        <small>Initial Delay (ms) - Wait time before checking Doom data</small>
                    </label>
                    <input type="number" id="deeplore_doom_sync_delay" class="text_pole" value="${settings.syncDelay}" min="0" max="10000" step="100" />

                    <label for="deeplore_doom_poll_interval">
                        <small>Poll Interval (ms) - How often to retry if data not ready</small>
                    </label>
                    <input type="number" id="deeplore_doom_poll_interval" class="text_pole" value="${settings.pollInterval}" min="100" max="5000" step="100" />

                    <label for="deeplore_doom_max_polls">
                        <small>Max Poll Attempts - How many times to retry</small>
                    </label>
                    <input type="number" id="deeplore_doom_max_polls" class="text_pole" value="${settings.maxPollAttempts}" min="1" max="20" step="1" />

                    <hr>

                    <!-- <h4>Optional Scene Context Sync</h4>

                    <label class="checkbox_label" for="deeplore_doom_sync_location">
                        <input type="checkbox" id="deeplore_doom_sync_location" ${settings.syncLocation ? 'checked' : ''} />
                        <span>Sync Location</span>
                    </label>

                    <label class="checkbox_label" for="deeplore_doom_sync_weather">
                        <input type="checkbox" id="deeplore_doom_sync_weather" ${settings.syncWeather ? 'checked' : ''} />
                        <span>Sync Weather</span>
                    </label>

                    <label class="checkbox_label" for="deeplore_doom_sync_scenetype">
                        <input type="checkbox" id="deeplore_doom_sync_scenetype" ${settings.syncSceneType ? 'checked' : ''} />
                        <span>Sync Scene Type</span>
                    </label>

                    <hr> -->

                    <div class="flex-container flexFlowColumn">
                        <div class="menu_button" id="deeplore_doom_sync_now">
                            <i class="fa-solid fa-sync"></i>
                            <span>Sync Now (Test)</span>
                        </div>
                        <div class="menu_button menu_button_icon" id="deeplore_doom_debug_info">
                            <i class="fa-solid fa-bug"></i>
                            <span>Show Debug Info</span>
                        </div>
                        <small><strong>Current characters:</strong> <span id="deeplore_doom_current_chars">Loading...</span></small>
                        <small><strong>Doom data found:</strong> <span id="deeplore_doom_data_status">Checking...</span></small>
                    </div>
                </div>
            </div>
        </div>
    `;

    $('#extensions_settings2').append(settingsHtml);

    function updateStatusDisplay() {
        const ctx = ensureDeepLoreContext();
        const chars = ctx?.character_present || [];
        $('#deeplore_doom_current_chars').text(chars.length > 0 ? chars.join(', ') : 'None');

        const doomData = getDoomTrackerData();
        $('#deeplore_doom_data_status').text(doomData ? '✅ Yes' : '❌ No');
    }
    updateStatusDisplay();

    $('#deeplore_doom_sync_enabled').on('change', function () {
        settings.enabled = $(this).is(':checked');
        saveSettings();
    });

    $('#deeplore_doom_first_name_only').on('change', function () {
        settings.firstNameOnly = $(this).is(':checked');
        saveSettings();
        console.log(`[${EXTENSION_NAME}] First name only: ${settings.firstNameOnly}`);
    });

    $('#deeplore_doom_sync_delay').on('input', function () {
        settings.syncDelay = parseInt($(this).val()) || 0;
        saveSettings();
    });

    $('#deeplore_doom_poll_interval').on('input', function () {
        settings.pollInterval = parseInt($(this).val()) || 500;
        saveSettings();
    });

    $('#deeplore_doom_max_polls').on('input', function () {
        settings.maxPollAttempts = parseInt($(this).val()) || 6;
        saveSettings();
    });

    $('#deeplore_doom_sync_location').on('change', function () {
        settings.syncLocation = $(this).is(':checked');
        saveSettings();
    });

    $('#deeplore_doom_sync_weather').on('change', function () {
        settings.syncWeather = $(this).is(':checked');
        saveSettings();
    });

    $('#deeplore_doom_sync_scenetype').on('change', function () {
        settings.syncSceneType = $(this).is(':checked');
        saveSettings();
    });

    $('#deeplore_doom_sync_now').on('click', async function () {
        console.log(`[${EXTENSION_NAME}] 🔄 Manual sync triggered`);
        await performSync(true);
        updateStatusDisplay();
    });

    // Debug info button
    $('#deeplore_doom_debug_info').on('click', function () {
        console.log(`[${EXTENSION_NAME}] === DEBUG INFO ===`);
        console.log(`SillyTavern global available:`, typeof SillyTavern !== 'undefined');
        console.log(`SillyTavern.getContext available:`, typeof SillyTavern !== 'undefined' && typeof SillyTavern.getContext === 'function');
        const metadata = getChatMetadata();
        console.log(`Chat metadata:`, metadata);
        const doomData = metadata?.dooms_tracker;
        console.log(`Doom tracker data:`, doomData);
        console.log(`lastGeneratedData:`, doomData?.lastGeneratedData);
        console.log(`committedTrackerData:`, doomData?.committedTrackerData);
        console.log(`Character thoughts (lastGenerated):`, doomData?.lastGeneratedData?.characterThoughts);
        console.log(`Character thoughts (committed):`, doomData?.committedTrackerData?.characterThoughts);
        console.log(`DeepLore context:`, ensureDeepLoreContext());
        console.log(`Active characters:`, getActiveCharactersFromDoom());
        console.log(`First name only setting:`, settings.firstNameOnly);
        console.log(`===================`);
    });
}

/**
 * Initialize the extension
 */
function initialize() {
    console.log(`[${EXTENSION_NAME}] 🚀 Initializing...`);

    loadSettings();
    createSettingsUI();

    // Don't sync immediately - wait for a chat to be loaded
    // The event listeners will trigger sync when appropriate

    // Event listeners
    eventSource.on(event_types.MESSAGE_RECEIVED, () => {
        DEBUG && console.log(`[${EXTENSION_NAME}] 📩 MESSAGE_RECEIVED`);
        performSync(true);
    });

    eventSource.on(event_types.GENERATION_ENDED, () => {
        DEBUG && console.log(`[${EXTENSION_NAME}] ⏹️ GENERATION_ENDED`);
        performSync(true);
    });

    eventSource.on(event_types.CHAT_CHANGED, () => {
        DEBUG && console.log(`[${EXTENSION_NAME}] 💬 CHAT_CHANGED`);
        // Sync without delay when chat changes
        performSync(false);
    });

    eventSource.on(event_types.MESSAGE_DELETED, () => {
        DEBUG && console.log(`[${EXTENSION_NAME}] 🗑️ MESSAGE_DELETED`);
        performSync(true);
    });

    console.log(`[${EXTENSION_NAME}] ✅ Initialized successfully`);
}

// Initialize when jQuery is ready
jQuery(() => {
    console.log(`[${EXTENSION_NAME}] jQuery ready, starting initialization...`);
    try {
        initialize();
    } catch (error) {
        console.error(`[${EXTENSION_NAME}] ❌ Initialization failed:`, error);
        console.error(error.stack);
    }
});
