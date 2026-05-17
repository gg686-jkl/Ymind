/* --- Settings Popover --- */
const settingsBtn = dom.settingsBtn;
const settingsPopover = dom.settingsPopover;
let listeningShortcutsActive = false;

const DEFAULT_SHORTCUTS = CONFIG.DEFAULT_SHORTCUTS;

function loadShortcuts() {
    const parsed = getJsonItem('ymind_shortcuts', null);
    if (parsed) {
        const result = {};
        for (const key of Object.keys(DEFAULT_SHORTCUTS)) {
            result[key] = { ...DEFAULT_SHORTCUTS[key], ...(parsed[key] || {}) };
        }
        return result;
    }
    return { ...DEFAULT_SHORTCUTS };
}

function saveShortcuts(shortcuts) {
    setJsonItem('ymind_shortcuts', shortcuts);
}

function loadSeparator() {
    return localStorage.getItem('ymind_separator') || CONFIG.DEFAULT_SEPARATOR;
}

function saveSeparator(sep) {
    localStorage.setItem('ymind_separator', sep);
}

function loadPrePrompt() {
    return localStorage.getItem('ymind_preprompt') || '';
}

function savePrePrompt(text) {
    localStorage.setItem('ymind_preprompt', text);
}

/* ========== Mindmap Pre-prompt ========== */
function loadMindmapLeftPrePrompt() {
    return localStorage.getItem('ymind_mindmap_left_preprompt') || '';
}

function saveMindmapLeftPrePrompt(text) {
    localStorage.setItem('ymind_mindmap_left_preprompt', text);
}

function loadMindmapRightPrePrompt() {
    return localStorage.getItem('ymind_mindmap_right_preprompt') || '';
}

function saveMindmapRightPrePrompt(text) {
    localStorage.setItem('ymind_mindmap_right_preprompt', text);
}

function loadMindmapResetPrePrompt() {
    return localStorage.getItem('ymind_mindmap_reset_preprompt') || '';
}

function saveMindmapResetPrePrompt(text) {
    localStorage.setItem('ymind_mindmap_reset_preprompt', text);
}

on(settingsBtn, 'click', (e) => {
    e.stopPropagation();
    const isOpen = !settingsPopover.classList.contains('hidden');
    if (isOpen) {
        settingsPopover.classList.add('hidden');
    } else {
        loadSettingsValues();
        settingsPopover.classList.remove('hidden');
    }
});

/* --- Close Settings on Escape (not during shortcut listening) --- */
on(document, 'keydown', (e) => {
    if (e.key === 'Escape' && !settingsPopover.classList.contains('hidden') && !listeningShortcutsActive) {
        settingsPopover.classList.add('hidden');
    }
});

for (const header of document.querySelectorAll('.settings-section-header')) {
    on(header, 'click', (e) => {
        const section = header.closest('.settings-section');
        // Pre-prompt Prefix section opens bubble directly
        if (section.dataset.section === 'preprompt') {
            e.stopPropagation();
            openPrepromptBubble();
            return;
        }
        const body = section.querySelector('.settings-section-body');
        const isOpen = !body.classList.contains('hidden');
        if (isOpen) {
            body.classList.add('hidden');
            section.classList.remove('open');
        } else {
            body.classList.remove('hidden');
            section.classList.add('open');
        }
    });
}

function formatShortcutLabel(action, cfg) {
    if (cfg.disabled) return 'Disabled';
    if (action === 'brainstormDoubleEnter') {
        const isDefault = cfg.key === 'Enter' && cfg.count === 2 && cfg.delay === 500;
        return isDefault ? 'Enter\u00d72' : (cfg.key + '\u00d7' + cfg.count);
    }
    if (action === 'brainstormCtrlEnter') {
        return cfg.ctrl ? 'Ctrl+' + cfg.key : cfg.key;
    }
    return cfg.ctrl ? 'Ctrl+' + cfg.key : cfg.key;
}

function loadSettingsValues() {
    const shortcuts = loadShortcuts();
    for (const input of document.querySelectorAll('.settings-shortcut-input')) {
        const action = input.dataset.action;
        const cfg = shortcuts[action];
        if (cfg) {
            input.value = formatShortcutLabel(action, cfg);
            input.dataset.config = JSON.stringify(cfg);
        }
    }
    const sepInput = dom.settingsSeparatorInput;
    if (sepInput) sepInput.value = loadSeparator();
    // Pre-fill mindmap prompt defaults if localStorage is empty
    if (!loadMindmapLeftPrePrompt()) { saveMindmapLeftPrePrompt(getDefaultLeftPrePrompt()); }
    if (!loadMindmapRightPrePrompt()) { saveMindmapRightPrePrompt(getDefaultRightPrePrompt()); }
    if (!loadMindmapResetPrePrompt()) { saveMindmapResetPrePrompt(getDefaultResetPrePrompt()); }
}

on(document, 'click', (e) => {
    const input = e.target.closest('.settings-shortcut-input');
    if (!input || !settingsPopover.contains(input)) return;
    if (input.classList.contains('listening')) {
        // Re-clicking same input cancels listening
        input.classList.remove('listening');
        delete input.dataset.listenning;
        input.value = input.dataset.previousValue || '';
        listeningShortcutsActive = false;
        return;
    }
    input.dataset.previousValue = input.value;
    input.classList.add('listening');
    input.value = 'Press keys...';
    input.dataset.listenning = 'true';
    listeningShortcutsActive = true;
});

on(document, 'keydown', (e) => {
    const listeningInput = document.querySelector('.settings-shortcut-input.listening');
    if (!listeningInput) return;
    e.preventDefault();
    e.stopImmediatePropagation();

    const action = listeningInput.dataset.action;
    const currentShortcuts = loadShortcuts();
    const existingCfg = currentShortcuts[action];
    const cfg = existingCfg ? { ...existingCfg } : { ...DEFAULT_SHORTCUTS[action] };

    if (e.key === 'Escape') {
        listeningInput.classList.remove('listening');
        delete listeningInput.dataset.listenning;
        listeningShortcutsActive = false;
        if (existingCfg) {
            listeningInput.value = formatShortcutLabel(action, existingCfg);
        }
        return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
        cfg.disabled = true;
        const label = 'Disabled';
        listeningInput.value = label;
        listeningInput.dataset.config = JSON.stringify(cfg);
        listeningInput.classList.remove('listening');
        delete listeningInput.dataset.listenning;
        listeningShortcutsActive = false;
        const shortcuts = loadShortcuts();
        shortcuts[action] = cfg;
        saveShortcuts(shortcuts);
        return;
    }

    cfg.key = e.key;
    cfg.ctrl = e.ctrlKey || e.metaKey;
    delete cfg.disabled;

    const label = formatShortcutLabel(action, cfg);
    listeningInput.value = label;
    listeningInput.dataset.config = JSON.stringify(cfg);
    listeningInput.classList.remove('listening');
    delete listeningInput.dataset.listenning;
    listeningShortcutsActive = false;

    const shortcuts = loadShortcuts();
    shortcuts[action] = cfg;
    saveShortcuts(shortcuts);
});

/* --- Apply Settings Confirmation --- */
on(dom.settingsConfirmBtn, 'click', () => {
    const sepInput = dom.settingsSeparatorInput;
    if (sepInput) saveSeparator(sepInput.value);
    const settingsPopover = dom.settingsPopover;
    settingsPopover.classList.add('hidden');
    showToast('Settings saved');
});

on(dom.settingsCancelBtn, 'click', () => {
    dom.settingsPopover.classList.add('hidden');
});

/* --- Preprompt Expand Bubble --- */
const prepromptBubbleWrapper = document.getElementById('preprompt-bubble-wrapper');
const prepromptBubbleCancel = document.getElementById('preprompt-bubble-cancel');
const prepromptBubbleConfirm = document.getElementById('preprompt-bubble-confirm');
const prepromptBubbleTextarea = document.getElementById('preprompt-bubble-textarea');
const prepromptBubbleHeader = document.getElementById('preprompt-bubble-header');
const PREPROMPT_BUBBLE_KEY = 'ymind-preprompt-bubble-state';

function openPrepromptBubble() {
    prepromptBubbleTextarea.value = loadPrePrompt();
    prepromptBubbleWrapper.classList.remove('hidden');
    prepromptBubbleTextarea.focus();
}

function closePrepromptBubble() {
    editingMindmapPrompt = null;
    prepromptBubbleWrapper.classList.add('hidden');
    var titleSpan = prepromptBubbleHeader.querySelector('.bubble-title');
    if (titleSpan) titleSpan.innerHTML = '<i class="ph-bold ph-textbox"></i> Pre-prompt';
}

function confirmPrepromptBubble() {
    var text = prepromptBubbleTextarea.value;
    if (editingMindmapPrompt) {
        if (editingMindmapPrompt === 'left') {
            saveMindmapLeftPrePrompt(text);
            mindmapLeftPrePrompt = text;
        } else if (editingMindmapPrompt === 'right') {
            saveMindmapRightPrePrompt(text);
            mindmapRightPrePrompt = text;
        } else if (editingMindmapPrompt === 'reset') {
            saveMindmapResetPrePrompt(text);
            mindmapResetPrePrompt = text;
        }
        editingMindmapPrompt = null;
        closePrepromptBubble();
        showToast('Mindmap prompt saved');
        return;
    }
    savePrePrompt(text);
    closePrepromptBubble();
    showToast('Pre-prompt saved');
}

on(prepromptBubbleCancel, 'click', closePrepromptBubble);
on(prepromptBubbleConfirm, 'click', confirmPrepromptBubble);

/* --- Mindmap Prompt Section (bubble editing) --- */
var editingMindmapPrompt = null;

on(document, 'click', (e) => {
    var btn = e.target.closest('.mindmap-prompt-edit-btn');
    if (!btn) return;
    e.stopPropagation();
    editingMindmapPrompt = btn.dataset.prompt;
    var promptValue = '';
    var titleHtml = '';
    if (editingMindmapPrompt === 'left') {
        promptValue = loadMindmapLeftPrePrompt();
        titleHtml = '<i class="ph-bold ph-textbox"></i> Left Expand Prompt';
    } else if (editingMindmapPrompt === 'right') {
        promptValue = loadMindmapRightPrePrompt();
        titleHtml = '<i class="ph-bold ph-textbox"></i> Right Expand Prompt';
    } else if (editingMindmapPrompt === 'reset') {
        promptValue = loadMindmapResetPrePrompt();
        titleHtml = '<i class="ph-bold ph-textbox"></i> Reset Prompt';
    }
    var titleSpan = prepromptBubbleHeader.querySelector('.bubble-title');
    if (titleSpan) titleSpan.innerHTML = titleHtml;
    prepromptBubbleTextarea.value = promptValue;
    prepromptBubbleWrapper.classList.remove('hidden');
    prepromptBubbleTextarea.focus();
});
