/* ========== App Configuration ========== */
/* ============================================================
 * EDIT THIS FILE TO CUSTOMIZE YOUR YMIND INSTALLATION
 * ============================================================
 * All sensitive/private values are centralized here.
 * Runtime override: set window.APP_CONFIG before this script loads.
 * ============================================================ */

window.APP_CONFIG = window.APP_CONFIG || {};

/* --- Brainstorm / AI Worker --- */
const CONFIG = {
    /* Worker URL for AI chat (SSE streaming).
     * Replace YOUR_WORKER_ACCESS_TOKEN with your actual worker access token.
     * Can be overridden at runtime via window.APP_CONFIG.BRAINSTORM_WORKER_URL */
    BRAINSTORM_WORKER_URL: window.APP_CONFIG.BRAINSTORM_WORKER_URL || 'https://api.ymind.top/api/chat?key=YOUR_WORKER_ACCESS_TOKEN',

    /* ===== CRYPTOGRAPHIC CONSTANTS - DO NOT CHANGE =====
     * These values are used for deterministic key derivation.
     * Changing them will break ALL existing user data (room names,
     * E2EE passwords, preference hashes). They are documented here
     * for transparency only — not for user modification. */
    CRYPTO: {
        ROOM_SALT:      'ymind-room-salt',      // iterations: 100000, output: 256bits
        E2EE_SALT:       'ymind-e2ee-salt',       // iterations: 200000, output: 512bits
        PREF_SALT:      'ymind-pref-salt',      // iterations: 10000,  output: 128bits
        ROOM_ITERATIONS:   100000,
        E2EE_ITERATIONS:   200000,
        PREF_ITERATIONS:   10000,
    },

    /* --- Access Control --- */
    /* Ethereum addresses that have superadmin privileges.
     * Currently defaults to zero address (no superadmin).
     * Replace with your actual Ethereum address(es) to enable ACL management.
     * Can be overridden at runtime via window.APP_CONFIG.SUPERADMIN_ADDRESSES */
    SUPERADMIN_ADDRESSES: window.APP_CONFIG.SUPERADMIN_ADDRESSES || ['0x0000000000000000000000000000000000000000'],

    /* --- UI Defaults --- */
    /* Default brainstorm trigger separator. User can change in Settings.
     * Can be overridden at runtime via window.APP_CONFIG.DEFAULT_SEPARATOR */
    DEFAULT_SEPARATOR: window.APP_CONFIG.DEFAULT_SEPARATOR || '?',

    /* Default keyboard shortcuts. User can change in Settings.
     * Can be overridden at runtime via window.APP_CONFIG.DEFAULT_SHORTCUTS */
    DEFAULT_SHORTCUTS: window.APP_CONFIG.DEFAULT_SHORTCUTS || {
        brainstormDoubleEnter: { key: 'Enter', ctrl: false, count: 2, delay: 500, description: 'Double Enter (brainstorm)' },
        brainstormCtrlEnter:   { key: 'Enter', ctrl: true, description: 'Ctrl+Enter (region)' },
        openAiHistory:          { key: 's', ctrl: true, description: 'Ctrl+S (open AI history)' },
        exitBatchMode:         { key: 'Escape', description: 'Escape (exit batch)' },
        navigateAiPrev:        { key: 'ArrowLeft', description: 'Arrow Left (prev AI)' },
        navigateAiNext:        { key: 'ArrowRight', description: 'Arrow Right (next AI)' },
    },
};