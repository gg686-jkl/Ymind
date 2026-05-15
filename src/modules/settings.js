/* --- Settings Popover --- */
const settingsBtn = dom.settingsBtn;
const settingsPopover = dom.settingsPopover;
let listeningShortcutsActive = false;

const DEFAULT_SHORTCUTS = {
    brainstormDoubleEnter: { key: 'Enter', ctrl: false, count: 2, delay: 500, description: 'Double Enter (brainstorm)' },
    brainstormCtrlEnter:   { key: 'Enter', ctrl: true, description: 'Ctrl+Enter (region)' },
    openAiHistory:          { key: 's', ctrl: true, description: 'Ctrl+S (open AI history)' },
    exitBatchMode:         { key: 'Escape', description: 'Escape (exit batch)' },
    navigateAiPrev:        { key: 'ArrowLeft', description: 'Arrow Left (prev AI)' },
    navigateAiNext:        { key: 'ArrowRight', description: 'Arrow Right (next AI)' },
};

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
    return localStorage.getItem('ymind_separator') || '?';
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
    const mindmapLeft = document.getElementById('mindmap-left-preprompt');
    const mindmapRight = document.getElementById('mindmap-right-preprompt');
    if (mindmapLeft) mindmapLeft.value = loadMindmapLeftPrePrompt();
    if (mindmapRight) mindmapRight.value = loadMindmapRightPrePrompt();
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
    prepromptBubbleWrapper.classList.add('hidden');
}

function confirmPrepromptBubble() {
    const text = prepromptBubbleTextarea.value;
    savePrePrompt(text);
    closePrepromptBubble();
    showToast('Pre-prompt saved');
}

on(prepromptBubbleCancel, 'click', closePrepromptBubble);
on(prepromptBubbleConfirm, 'click', confirmPrepromptBubble);

/* --- Mindmap Prompt Section --- */
const mindmapLeftTextarea = document.getElementById('mindmap-left-preprompt');
const mindmapRightTextarea = document.getElementById('mindmap-right-preprompt');
const mindmapResetTextarea = document.getElementById('mindmap-reset-preprompt');
const mindmapPromptCancel = document.getElementById('mindmap-prompt-cancel');
const mindmapPromptSave = document.getElementById('mindmap-prompt-save');

if (mindmapLeftTextarea && mindmapRightTextarea) {
    mindmapLeftTextarea.value = loadMindmapLeftPrePrompt();
    mindmapRightTextarea.value = loadMindmapRightPrePrompt();
    if (mindmapResetTextarea) {
        mindmapResetTextarea.value = loadMindmapResetPrePrompt();
    }

    on(mindmapPromptSave, 'click', () => {
        saveMindmapLeftPrePrompt(mindmapLeftTextarea.value);
        saveMindmapRightPrePrompt(mindmapRightTextarea.value);
        if (mindmapResetTextarea) {
            saveMindmapResetPrePrompt(mindmapResetTextarea.value);
            mindmapResetPrePrompt = mindmapResetTextarea.value;
        }
        mindmapLeftPrePrompt = mindmapLeftTextarea.value;
        mindmapRightPrePrompt = mindmapRightTextarea.value;
        const settingsPopover = dom.settingsPopover;
        settingsPopover.classList.add('hidden');
        showToast('Mindmap prompts saved');
    });

    on(mindmapPromptCancel, 'click', () => {
        mindmapLeftTextarea.value = loadMindmapLeftPrePrompt();
        mindmapRightTextarea.value = loadMindmapRightPrePrompt();
        if (mindmapResetTextarea) {
            mindmapResetTextarea.value = loadMindmapResetPrePrompt();
        }
    });
}
