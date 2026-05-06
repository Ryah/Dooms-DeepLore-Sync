/**
 * DeepLore + Doom Sync Extension
 *
 * Automatically synchronizes Doom's Enhancement Suite character tracking
 * with DeepLore-Enhanced's contextual gates.
 */

import { eventSource, event_types } from './src/lib/st-api.js';
import { EXTENSION_NAME, DEBUG } from './src/core/config.js';
import { loadSettings } from './src/core/settings.js';
import { performSync } from './src/systems/integration/sillytavern.js';
import { handleWorldInfoUpdated } from './src/systems/export/memorybooks.js';
import { createSettingsUI } from './src/systems/ui/settings.js';

console.log(`[${EXTENSION_NAME}] Script loaded`);

let worldInfoSyncQueue = Promise.resolve();

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

    eventSource.on(event_types.WORLDINFO_UPDATED, (lorebookName, lorebookData) => {
        worldInfoSyncQueue = worldInfoSyncQueue
            .then(() => handleWorldInfoUpdated(lorebookName, lorebookData))
            .catch((error) => {
                console.error(`[${EXTENSION_NAME}] WORLDINFO_UPDATED sync failed:`, error);
            });
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
