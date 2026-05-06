import { EXTENSION_NAME } from '../../core/config.js';
import { settings, saveSettings, normalizeVaultFolder, normalizeLorebookFolderMap } from '../../core/settings.js';
import { getChatMetadata, ensureDeepLoreContext, getDoomTrackerData, getActiveCharactersFromDoom, performSync } from '../integration/sillytavern.js';

async function fetchVaultFoldersFromDeepLore() {
    try {
        const settingsMod = await import('/scripts/extensions/third-party/sillytavern-DeepLore-Enhanced/settings.js');
        const apiMod = await import('/scripts/extensions/third-party/sillytavern-DeepLore-Enhanced/src/vault/obsidian-api.js');

        const getSettings = settingsMod?.getSettings;
        const getPrimaryVault = settingsMod?.getPrimaryVault;
        const listAllFiles = apiMod?.listAllFiles;
        if (typeof getSettings !== 'function' || typeof getPrimaryVault !== 'function' || typeof listAllFiles !== 'function') {
            return { ok: false, error: 'DeepLore vault APIs are unavailable.' };
        }

        const dleSettings = getSettings();
        const vault = getPrimaryVault(dleSettings);
        if (!vault?.enabled) {
            return { ok: false, error: 'No enabled DeepLore vault is configured.' };
        }
        if (!vault.apiKey) {
            return { ok: false, error: 'DeepLore vault API key is missing.' };
        }

        const listing = await listAllFiles(vault.host, vault.port, vault.apiKey, '', 0, !!vault.https);
        const files = Array.isArray(listing?.files) ? listing.files : [];

        const folders = new Set(['']);
        for (const filePath of files) {
            const normalized = String(filePath || '').replace(/\\/g, '/');
            const parts = normalized.split('/').filter(Boolean);
            for (let i = 1; i < parts.length; i++) {
                folders.add(parts.slice(0, i).join('/'));
            }
        }

        return {
            ok: true,
            folders: [...folders].sort((a, b) => a.localeCompare(b)),
            partial: !!listing?.partial,
        };
    } catch (error) {
        return { ok: false, error: error?.message || String(error) };
    }
}

function getLorebookNames() {
    const names = new Set(Object.keys(normalizeLorebookFolderMap(settings.obsidianMemoryFolderByLorebook)));
    try {
        const context = typeof SillyTavern !== 'undefined' && SillyTavern.getContext ? SillyTavern.getContext() : null;
        const worldNames = typeof context?.getWorldInfoNames === 'function' ? context.getWorldInfoNames() : [];
        if (Array.isArray(worldNames)) {
            for (const name of worldNames) {
                const clean = String(name || '').trim();
                if (clean) names.add(clean);
            }
        }
    } catch {
        // Ignore context errors; mapped lorebooks are still shown.
    }
    return [...names].sort((a, b) => a.localeCompare(b));
}

function serializeLorebookFolderMap(rawMap) {
    const map = normalizeLorebookFolderMap(rawMap);
    const keys = Object.keys(map).sort((a, b) => a.localeCompare(b));
    if (keys.length === 0) {
        return '';
    }

    return keys.map((lorebook) => `${lorebook} = ${map[lorebook]}`).join('\n');
}

function parseLorebookFolderMapText(text) {
    const map = {};
    const errors = [];
    const lines = String(text || '').split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
        const lineNumber = i + 1;
        const raw = lines[i].trim();

        if (!raw || raw.startsWith('#')) {
            continue;
        }

        const eq = raw.indexOf('=');
        if (eq === -1) {
            errors.push(`Line ${lineNumber}: missing '=' between lorebook name and folder.`);
            continue;
        }

        const lorebook = raw.slice(0, eq).trim();
        const folder = normalizeVaultFolder(raw.slice(eq + 1).trim());
        if (!lorebook) {
            errors.push(`Line ${lineNumber}: lorebook name is empty.`);
            continue;
        }
        if (!folder) {
            errors.push(`Line ${lineNumber}: folder is empty.`);
            continue;
        }

        map[lorebook] = folder;
    }

    return {
        map: normalizeLorebookFolderMap(map),
        errors,
    };
}

export function createSettingsUI() {
    const settingsHtml = `
        <div class="deeplore-doom-sync-settings">
            <style>
                .deeplore-doom-sync-settings .dds-content {
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                    padding-top: 4px;
                }

                .deeplore-doom-sync-settings .dds-section {
                    border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.14));
                    border-radius: 10px;
                    padding: 10px;
                    background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.03));
                }

                .deeplore-doom-sync-settings .dds-section-title {
                    font-size: 0.95rem;
                    font-weight: 700;
                    margin: 0 0 8px;
                    opacity: 0.95;
                }

                .deeplore-doom-sync-settings .dds-help {
                    display: block;
                    margin: 0 0 6px;
                    opacity: 0.8;
                    line-height: 1.35;
                }

                .deeplore-doom-sync-settings .dds-stack {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .deeplore-doom-sync-settings .dds-row {
                    display: flex;
                    gap: 8px;
                    align-items: center;
                    flex-wrap: wrap;
                }

                .deeplore-doom-sync-settings .dds-row > .text_pole,
                .deeplore-doom-sync-settings .dds-row > select.text_pole {
                    flex: 1;
                    min-width: 220px;
                }

                .deeplore-doom-sync-settings .dds-status {
                    display: block;
                    min-height: 1.2em;
                    opacity: 0.95;
                }

                .deeplore-doom-sync-settings .dds-kv {
                    display: grid;
                    gap: 4px;
                }

                .deeplore-doom-sync-settings .dds-actions {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
            </style>
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>DeepLore + Doom Sync</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content dds-content">
                    <div class="dds-section">
                        <h4 class="dds-section-title">Sync Behavior</h4>
                        <div class="dds-stack">
                            <label class="checkbox_label" for="deeplore_doom_sync_enabled">
                                <input type="checkbox" id="deeplore_doom_sync_enabled" ${settings.enabled ? 'checked' : ''} />
                                <span>Enable automatic synchronization</span>
                            </label>

                            <label class="checkbox_label" for="deeplore_doom_first_name_only">
                                <input type="checkbox" id="deeplore_doom_first_name_only" ${settings.firstNameOnly ? 'checked' : ''} />
                                <span>Sync first names only (e.g., "Alec" instead of "Alec Hamilton")</span>
                            </label>
                        </div>
                    </div>

                    <div class="dds-section">
                        <h4 class="dds-section-title">Obsidian Export</h4>
                        <div class="dds-stack">
                            <label class="checkbox_label" for="deeplore_doom_obsidian_export_enabled">
                                <input type="checkbox" id="deeplore_doom_obsidian_export_enabled" ${settings.obsidianAutoExportEnabled ? 'checked' : ''} />
                                <span>Auto-export MemoryBooks entries to Obsidian</span>
                            </label>

                            <label class="checkbox_label" for="deeplore_doom_prompt_post_export_popup">
                                <input type="checkbox" id="deeplore_doom_prompt_post_export_popup" ${settings.promptDeepLorePostExportPopup ? 'checked' : ''} />
                                <span>Show post-export popup to choose summarize and keyword optimize</span>
                            </label>

                            <label for="deeplore_doom_obsidian_folder" class="dds-help">
                                Default export folder (used when no lorebook mapping exists)
                            </label>
                            <input type="text" id="deeplore_doom_obsidian_folder" class="text_pole" value="${settings.obsidianMemoryFolder || ''}" placeholder="(root) or a folder like Lorebooks/General" />
                        </div>
                    </div>

                    <div class="dds-section">
                        <h4 class="dds-section-title">Lorebook Folder Routing</h4>
                        <small class="dds-help">Load available folders from Obsidian Local REST API using DeepLore vault settings.</small>
                        <div class="dds-stack">
                            <div class="dds-row">
                                <div class="menu_button menu_button_icon" id="deeplore_doom_load_vault_folders">
                                    <i class="fa-solid fa-folder-tree"></i>
                                    <span>Load Vault Folders</span>
                                </div>
                                <select id="deeplore_doom_folder_picker" class="text_pole">
                                    <option value="">(root)</option>
                                </select>
                                <div class="menu_button menu_button_icon" id="deeplore_doom_apply_global_folder">
                                    <i class="fa-solid fa-arrow-down"></i>
                                    <span>Use As Default</span>
                                </div>
                            </div>
                            <small id="deeplore_doom_folder_picker_status" class="dds-status"></small>

                            <small class="dds-help">Assign the selected folder to a specific lorebook.</small>
                            <div class="dds-row">
                                <select id="deeplore_doom_lorebook_picker" class="text_pole"></select>
                                <div class="menu_button menu_button_icon" id="deeplore_doom_assign_lorebook_folder">
                                    <i class="fa-solid fa-link"></i>
                                    <span>Assign Mapping</span>
                                </div>
                                <div class="menu_button menu_button_icon" id="deeplore_doom_remove_lorebook_mapping">
                                    <i class="fa-solid fa-unlink"></i>
                                    <span>Remove Mapping</span>
                                </div>
                            </div>
                            <small id="deeplore_doom_lorebook_picker_status" class="dds-status"></small>

                            <label for="deeplore_doom_lorebook_folder_map" class="dds-help">
                                Advanced: edit mappings directly (one per line: Lorebook Name = Vault/Folder)
                            </label>
                            <textarea
                                id="deeplore_doom_lorebook_folder_map"
                                class="text_pole"
                                rows="5"
                                placeholder="Example MemoryBook = Lorebooks/MemoryBooks/Example Chat"
                            >${serializeLorebookFolderMap(settings.obsidianMemoryFolderByLorebook)}</textarea>
                            <small id="deeplore_doom_lorebook_folder_map_status" class="dds-status"></small>
                        </div>
                    </div>

                    <div class="dds-section">
                        <h4 class="dds-section-title">Timing</h4>
                        <div class="dds-stack">
                            <label for="deeplore_doom_sync_delay" class="dds-help">Initial delay (ms): wait before checking Doom data</label>
                            <input type="number" id="deeplore_doom_sync_delay" class="text_pole" value="${settings.syncDelay}" min="0" max="10000" step="100" />

                            <label for="deeplore_doom_poll_interval" class="dds-help">Poll interval (ms): retry frequency while data is not ready</label>
                            <input type="number" id="deeplore_doom_poll_interval" class="text_pole" value="${settings.pollInterval}" min="100" max="5000" step="100" />

                            <label for="deeplore_doom_max_polls" class="dds-help">Max poll attempts: total retries before giving up</label>
                            <input type="number" id="deeplore_doom_max_polls" class="text_pole" value="${settings.maxPollAttempts}" min="1" max="20" step="1" />
                        </div>
                    </div>

                    <div class="dds-section">
                        <h4 class="dds-section-title">Tools and Status</h4>
                        <div class="dds-actions">
                            <div class="menu_button" id="deeplore_doom_sync_now">
                                <i class="fa-solid fa-sync"></i>
                                <span>Sync Now (Test)</span>
                            </div>
                            <div class="menu_button menu_button_icon" id="deeplore_doom_debug_info">
                                <i class="fa-solid fa-bug"></i>
                                <span>Show Debug Info</span>
                            </div>
                            <div class="dds-kv">
                                <small><strong>Current characters:</strong> <span id="deeplore_doom_current_chars">Loading...</span></small>
                                <small><strong>Doom data found:</strong> <span id="deeplore_doom_data_status">Checking...</span></small>
                                <small><strong>Auto-export folder:</strong> <span id="deeplore_doom_export_folder_status">-</span></small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    $('#extensions_settings2').append(settingsHtml);

    const $folderPicker = $('#deeplore_doom_folder_picker');
    const $folderStatus = $('#deeplore_doom_folder_picker_status');
    const $lorebookPicker = $('#deeplore_doom_lorebook_picker');
    const $lorebookStatus = $('#deeplore_doom_lorebook_picker_status');

    function setMappingStatus(text, isError = false) {
        $lorebookStatus.text(text || '');
        $lorebookStatus.css('color', isError ? 'var(--red, #d33)' : 'var(--green, #2f8f2f)');
    }

    function persistLorebookFolderMap(nextMap) {
        const normalizedNext = normalizeLorebookFolderMap(nextMap);
        const prevJson = JSON.stringify(normalizeLorebookFolderMap(settings.obsidianMemoryFolderByLorebook));
        const nextJson = JSON.stringify(normalizedNext);
        if (prevJson !== nextJson) {
            settings.obsidianEntryPathMap = {};
            settings.obsidianEntrySignatures = {};
        }

        settings.obsidianMemoryFolderByLorebook = normalizedNext;
        saveSettings();
        $('#deeplore_doom_lorebook_folder_map').val(serializeLorebookFolderMap(normalizedNext));
    }

    function refreshLorebookPicker(selectedLorebook = '') {
        const names = getLorebookNames();
        const current = selectedLorebook || String($lorebookPicker.val() || '').trim();
        $lorebookPicker.empty();

        if (names.length === 0) {
            $lorebookPicker.append('<option value="">(no lorebooks detected yet)</option>');
            return;
        }

        for (const name of names) {
            const selected = name === current ? ' selected' : '';
            $lorebookPicker.append(`<option value="${name}"${selected}>${name}</option>`);
        }
    }

    function populateFolderPicker(folders = [], selectedFolder = '') {
        const selected = normalizeVaultFolder(selectedFolder);
        $folderPicker.empty();
        $folderPicker.append('<option value="">(root)</option>');
        for (const folder of folders) {
            const clean = normalizeVaultFolder(folder);
            if (!clean) continue;
            const isSelected = clean === selected ? ' selected' : '';
            $folderPicker.append(`<option value="${clean}"${isSelected}>${clean}</option>`);
        }
        if (selected && !$folderPicker.find(`option[value="${selected.replace(/"/g, '\\"')}"]`).length) {
            $folderPicker.append(`<option value="${selected}" selected>${selected}</option>`);
        }
    }

    function updateStatusDisplay() {
        const context = ensureDeepLoreContext();
        const chars = context?.character_present || [];
        $('#deeplore_doom_current_chars').text(chars.length > 0 ? chars.join(', ') : 'None');

        const doomData = getDoomTrackerData();
        $('#deeplore_doom_data_status').text(doomData ? '✅ Yes' : '❌ No');

        const folder = normalizeVaultFolder(settings.obsidianMemoryFolder) || '(root)';
        const statusText = settings.obsidianAutoExportEnabled ? folder : 'Disabled';
        $('#deeplore_doom_export_folder_status').text(statusText);
    }

    updateStatusDisplay();
    refreshLorebookPicker();
    populateFolderPicker([], settings.obsidianMemoryFolder);

    $('#deeplore_doom_sync_enabled').on('change', function () {
        settings.enabled = $(this).is(':checked');
        saveSettings();
    });

    $('#deeplore_doom_first_name_only').on('change', function () {
        settings.firstNameOnly = $(this).is(':checked');
        saveSettings();
        console.log(`[${EXTENSION_NAME}] First name only: ${settings.firstNameOnly}`);
    });

    $('#deeplore_doom_obsidian_export_enabled').on('change', function () {
        settings.obsidianAutoExportEnabled = $(this).is(':checked');
        saveSettings();
        updateStatusDisplay();
    });

    $('#deeplore_doom_prompt_post_export_popup').on('change', function () {
        settings.promptDeepLorePostExportPopup = $(this).is(':checked');
        saveSettings();
    });

    $('#deeplore_doom_obsidian_folder').on('input', function () {
        const nextFolder = normalizeVaultFolder($(this).val());
        if (nextFolder !== normalizeVaultFolder(settings.obsidianMemoryFolder)) {
            settings.obsidianEntryPathMap = {};
            settings.obsidianEntrySignatures = {};
        }
        settings.obsidianMemoryFolder = nextFolder;
        saveSettings();
        updateStatusDisplay();
    });

    $('#deeplore_doom_lorebook_folder_map').on('input', function () {
        const parsed = parseLorebookFolderMapText($(this).val());
        const $status = $('#deeplore_doom_lorebook_folder_map_status');

        if (parsed.errors.length > 0) {
            $status.text(parsed.errors[0]);
            $status.css('color', 'var(--red, #d33)');
            return;
        }

        persistLorebookFolderMap(parsed.map);
        $status.text(`Saved ${Object.keys(parsed.map).length} lorebook folder mapping${Object.keys(parsed.map).length === 1 ? '' : 's'}.`);
        $status.css('color', 'var(--green, #2f8f2f)');
        refreshLorebookPicker();
        updateStatusDisplay();
    });

    $('#deeplore_doom_load_vault_folders').on('click', async function () {
        const $btn = $(this);
        $btn.addClass('disabled');
        $folderStatus.text('Loading folders from Obsidian vault...').css('color', 'var(--text, #ccc)');

        const result = await fetchVaultFoldersFromDeepLore();
        $btn.removeClass('disabled');

        if (!result.ok) {
            $folderStatus.text(`Failed to load folders: ${result.error}`).css('color', 'var(--red, #d33)');
            return;
        }

        populateFolderPicker(result.folders, settings.obsidianMemoryFolder);
        const partialMsg = result.partial ? ' (partial listing; some subfolders could not be read)' : '';
        $folderStatus.text(`Loaded ${result.folders.length} folders${partialMsg}.`).css('color', 'var(--green, #2f8f2f)');
    });

    $('#deeplore_doom_apply_global_folder').on('click', function () {
        const selectedFolder = normalizeVaultFolder($folderPicker.val());
        $('#deeplore_doom_obsidian_folder').val(selectedFolder).trigger('input');
        $folderStatus.text(`Default folder set to ${selectedFolder || '(root)'}.`).css('color', 'var(--green, #2f8f2f)');
    });

    $('#deeplore_doom_assign_lorebook_folder').on('click', function () {
        const lorebook = String($lorebookPicker.val() || '').trim();
        if (!lorebook) {
            setMappingStatus('Select a lorebook first.', true);
            return;
        }

        const folder = normalizeVaultFolder($folderPicker.val());
        const map = { ...normalizeLorebookFolderMap(settings.obsidianMemoryFolderByLorebook), [lorebook]: folder };
        if (!folder) {
            delete map[lorebook];
            persistLorebookFolderMap(map);
            setMappingStatus(`Removed mapping for "${lorebook}" (using default folder).`, false);
            return;
        }

        persistLorebookFolderMap(map);
        setMappingStatus(`Mapped "${lorebook}" to "${folder}".`, false);
    });

    $('#deeplore_doom_remove_lorebook_mapping').on('click', function () {
        const lorebook = String($lorebookPicker.val() || '').trim();
        if (!lorebook) {
            setMappingStatus('Select a lorebook first.', true);
            return;
        }

        const map = { ...normalizeLorebookFolderMap(settings.obsidianMemoryFolderByLorebook) };
        if (!map[lorebook]) {
            setMappingStatus(`No mapping exists for "${lorebook}".`, true);
            return;
        }

        delete map[lorebook];
        persistLorebookFolderMap(map);
        setMappingStatus(`Removed mapping for "${lorebook}".`, false);
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

    $('#deeplore_doom_debug_info').on('click', function () {
        console.log(`[${EXTENSION_NAME}] === DEBUG INFO ===`);
        console.log(`[${EXTENSION_NAME}] SillyTavern global available:`, typeof SillyTavern !== 'undefined');
        console.log(`[${EXTENSION_NAME}] SillyTavern.getContext available:`, typeof SillyTavern !== 'undefined' && typeof SillyTavern.getContext === 'function');
        const metadata = getChatMetadata();
        console.log(`[${EXTENSION_NAME}] Chat metadata:`, metadata);
        const doomData = metadata?.dooms_tracker;
        console.log(`[${EXTENSION_NAME}] Doom tracker data:`, doomData);
        console.log(`[${EXTENSION_NAME}] lastGeneratedData:`, doomData?.lastGeneratedData);
        console.log(`[${EXTENSION_NAME}] committedTrackerData:`, doomData?.committedTrackerData);
        console.log(`[${EXTENSION_NAME}] Character thoughts (lastGenerated):`, doomData?.lastGeneratedData?.characterThoughts);
        console.log(`[${EXTENSION_NAME}] Character thoughts (committed):`, doomData?.committedTrackerData?.characterThoughts);
        console.log(`[${EXTENSION_NAME}] DeepLore context:`, ensureDeepLoreContext());
        console.log(`[${EXTENSION_NAME}] Active characters:`, getActiveCharactersFromDoom());
        console.log(`[${EXTENSION_NAME}] First name only setting:`, settings.firstNameOnly);
        console.log(`[${EXTENSION_NAME}] MemoryBooks auto-export enabled:`, settings.obsidianAutoExportEnabled);
        console.log(`[${EXTENSION_NAME}] MemoryBooks export folder:`, settings.obsidianMemoryFolder);
        console.log(`[${EXTENSION_NAME}] MemoryBooks lorebook folder map:`, settings.obsidianMemoryFolderByLorebook);
        console.log(`[${EXTENSION_NAME}] Prompt DeepLore post-export popup:`, settings.promptDeepLorePostExportPopup);
        console.log(`[${EXTENSION_NAME}] ===================`);
    });
}
