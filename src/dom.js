/* ========== Model Selector References ========== */
const modelSelector = document.getElementById('model-selector');
const modelSelectorBtn = document.getElementById('model-selector-btn');
const selectedModelLabel = document.getElementById('selected-model-label');

/* ========== DOM References ========== */
const dom = {
    initialLoader: document.getElementById('initial-loader'),
    authScreen: document.getElementById('auth-screen'),
    appScreen: document.getElementById('app-screen'),
    mnemonicArea: document.getElementById('mnemonic-area'),
    authActions: {
        generate: document.getElementById('generate-btn'),
        loginMnemonic: document.getElementById('login-mnemonic-btn'),
        loginPasskey: document.getElementById('login-passkey-btn'),
        copyPhrase: document.getElementById('copy-phrase-btn'),
        protectPasskey: document.getElementById('protect-passkey-btn'),
    },
    authWarning: document.getElementById('auth-warning'),
    sidebarUserId: document.getElementById('sidebar-user-id'),
    notesList: document.getElementById('notes-list'),
    noteEditorContainer: document.getElementById('note-editor-container'),
    editorPlaceholder: document.getElementById('editor-placeholder'),
    noteEditor: document.getElementById('note-editor'),
    noteTitleInput: document.getElementById('note-title-input'),
    noteContentInput: document.getElementById('note-content-input'),
    notePreview: document.getElementById('note-preview'),
    newNoteBtn: document.getElementById('new-note-btn'),
    deleteBtn: document.getElementById('delete-btn'),
    logoutBtn: document.getElementById('logout-btn'),
    searchInput: document.getElementById('search-input'),
    themeToggleBtn: document.getElementById('theme-toggle-btn'),
    backBtn: document.getElementById('back-btn'),
    previewBtn: document.getElementById('preview-btn'),

    shareModal: document.getElementById('share-modal'),
    closeModalBtn: document.getElementById('close-modal-btn'),
    addCollaboratorBtn: document.getElementById('add-collaborator-btn'),
    shareAddressInput: document.getElementById('share-address'),
    sharePermissionSelect: document.getElementById('share-permission'),
    collaboratorsContainer: document.getElementById('collaborators-container'),
    brainstormBubble: document.getElementById('brainstorm-bubble'),
    bubbleContent: document.getElementById('bubble-content'),
    bubbleCloseBtn: document.getElementById('bubble-close-btn'),
    bubbleHint: document.getElementById('bubble-hint'),
    bubbleRawBtn: document.getElementById('bubble-raw-btn'),
    bubblePreviewBtn: document.getElementById('bubble-preview-btn'),
    bubbleCopyBtn: document.getElementById('bubble-copy-btn'),
    modelSelector: document.getElementById('model-selector'),
    aiHistoryBtn: document.getElementById('ai-history-btn'),
    aiHistoryMenu: document.getElementById('ai-history-menu'),
    aiHistoryContent: document.getElementById('ai-history-content'),
    toast: document.getElementById('toast'),

    // Settings
    settingsPopover: document.getElementById('settings-popover'),
    settingsBtn: document.getElementById('settings-btn'),
    settingsConfirmBtn: document.getElementById('settings-confirm-btn'),
    settingsCancelBtn: document.getElementById('settings-cancel-btn'),
    settingsSeparatorInput: document.getElementById('settings-separator-input'),

    // Batch mode
    selectBtn: document.getElementById('select-btn'),
    notesListContainer: document.getElementById('notes-list-container'),
    batchCount: document.getElementById('batch-count'),
    batchDeleteBtn: document.getElementById('batch-delete-btn'),
    batchExportBtn: document.getElementById('batch-export-btn'),
    batchShareBtn: document.getElementById('batch-share-btn'),

    // Folders
    createFolderModal: document.getElementById('create-folder-modal'),
    folderNameInput: document.getElementById('folder-name-input'),
    newFolderBtn: document.getElementById('new-folder-btn'),
    cancelFolderBtn: document.getElementById('cancel-folder-btn'),
    createFolderSubmitBtn: document.getElementById('create-folder-submit-btn'),

    // Bubble
    bubbleResizeWrapper: document.getElementById('bubble-resize-wrapper'),
    bubblePrevBtn: document.getElementById('bubble-prev-btn'),
    bubbleNextBtn: document.getElementById('bubble-next-btn'),
    bubbleNavIndicator: document.getElementById('bubble-nav-indicator'),

    // Editor
    splitDivider: document.getElementById('split-divider'),
    noteEditorContent: document.getElementById('note-editor-content'),
    sidebarToggleBtn: document.getElementById('sidebar-toggle-btn'),

    // Modal
    confirmModal: document.getElementById('confirm-modal'),
    confirmCancelBtn: document.getElementById('confirm-cancel-btn'),
    confirmDeleteBtn: document.getElementById('confirm-delete-btn'),
};

/* ========== Mindmap DOM References ========== */
const mindmapDom = {
    listTabNotes: document.getElementById('mindmap-list-tab-notes') || document.querySelector('.list-tab[data-tab="notes"]'),
    listTabMindmaps: document.getElementById('mindmap-list-tab-mindmaps') || document.querySelector('.list-tab[data-tab="mindmaps"]'),
    mindmapContainer: document.getElementById('mindmap-container'),
    newMindmapBtn: document.getElementById('new-mindmap-btn'),
};

/* ========== Node Edit DOM References ========== */
const nodeEditDom = {
    wrapper: document.getElementById('node-edit-wrapper'),
    bubble: document.getElementById('node-edit-bubble'),
    header: document.getElementById('node-edit-header'),
    title: document.getElementById('node-edit-title'),
    textarea: document.getElementById('node-edit-textarea'),
    preview: document.getElementById('node-edit-preview'),
    previewBtn: document.getElementById('node-edit-preview-btn'),
    rawBtn: document.getElementById('node-edit-raw-btn'),
    closeBtn: document.getElementById('node-edit-close-btn'),
    cancelBtn: document.getElementById('node-edit-cancel-btn'),
    saveBtn: document.getElementById('node-edit-save-btn'),
    deleteBtn: document.getElementById('node-edit-delete-btn'),
};
