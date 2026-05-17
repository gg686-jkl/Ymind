/* ========== Helper Utilities ========== */

// Brainstorm config - references config.js (loaded before this script)
const BRAINSTORM_WORKER_URL = CONFIG.BRAINSTORM_WORKER_URL;

/* ========== Helper Utilities ========== */
function on(el, event, handler, options) {
    el.addEventListener(event, handler, options);
}

function closeOnClickOutside(popover, trigger, onClose) {
    const handler = (e) => {
        if (!popover.contains(e.target) &&
            (!trigger || (e.target !== trigger && !trigger.contains(e.target)))) {
            if (onClose) onClose();
            else popover.classList.add('hidden');
        }
    };
    document.addEventListener('click', handler);
    return { remove: () => document.removeEventListener('click', handler) };
}

function getJsonItem(key, defaultValue) {
    try {
        const v = localStorage.getItem(key);
        return v ? JSON.parse(v) : defaultValue;
    } catch { return defaultValue; }
}

function setJsonItem(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

/* ========== Crypto / E2EE Helpers ========== */

/** Derive a deterministic room name from a mnemonic phrase using PBKDF2 */
async function deriveRoomName(mnemonic) {
    const salt = CONFIG.CRYPTO.ROOM_SALT;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(mnemonic), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: enc.encode(salt), iterations: CONFIG.CRYPTO.ROOM_ITERATIONS, hash: 'SHA-256' },
        key, 256
    );
    const base64 = btoa(String.fromCharCode(...new Uint8Array(bits)));
    return 'ymind-' + base64.replace(/[^a-zA-Z0-9]/g, '').slice(0, 32);
}

/** Derive E2EE password from mnemonic using a different salt than room name */
async function deriveE2EEPassword(mnemonic) {
    const salt = CONFIG.CRYPTO.E2EE_SALT;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(mnemonic), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: enc.encode(salt), iterations: CONFIG.CRYPTO.E2EE_ITERATIONS, hash: 'SHA-256' },
        key, 512
    );
    return btoa(String.fromCharCode(...new Uint8Array(bits))).replace(/[^a-zA-Z0-9]/g, '');
}

/* ========== E2EE Preference Management ========== */
async function hashMnemonic(mnemonic) {
    const salt = CONFIG.CRYPTO.PREF_SALT;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(mnemonic), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: enc.encode(salt), iterations: CONFIG.CRYPTO.PREF_ITERATIONS, hash: 'SHA-256' },
        key, 128
    );
    return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

async function getE2eePreference(mnemonic) {
    const hash = await hashMnemonic(mnemonic);
    const prefs = JSON.parse(localStorage.getItem('ymind_e2ee_prefs') || '[]');
    return prefs.find(p => p.hash === hash);
}

async function saveE2eePreference(mnemonic, enabled) {
    const hash = await hashMnemonic(mnemonic);
    let prefs = JSON.parse(localStorage.getItem('ymind_e2ee_prefs') || '[]');
    const existing = prefs.findIndex(p => p.hash === hash);
    if (existing >= 0) {
        prefs[existing].e2eeEnabled = enabled;
    } else {
        prefs.push({ hash, e2eeEnabled: enabled });
    }
    localStorage.setItem('ymind_e2ee_prefs', JSON.stringify(prefs));
}

function showE2eePrompt() {
    return new Promise((resolve) => {
        const modal = document.getElementById('e2ee-prompt-modal');
        const yesBtn = document.getElementById('e2ee-yes-btn');
        const noBtn = document.getElementById('e2ee-no-btn');
        modal.classList.remove('hidden');
        const cleanup = () => {
            modal.classList.add('hidden');
            yesBtn.onclick = null;
            noBtn.onclick = null;
        };
        yesBtn.onclick = () => { cleanup(); resolve(true); };
        noBtn.onclick = () => { cleanup(); resolve(false); };
    });
}

/* ========== Drag & Resize Factory ========== */
function makeDragResizable(wrapper, header, storageKey, opts) {
    opts = opts || {};
    const minW = opts.minW || 300;
    const minH = opts.minH || 200;

    let isDragging = false;
    let isResizing = false;
    let resizeDir = null;
    let dragStartX, dragStartY;
    let startLeft, startTop;
    let startWidth, startHeight;

    function initPosition() {
        if (wrapper.style.left && wrapper.style.left !== 'auto') return;
        const rect = wrapper.getBoundingClientRect();
        wrapper.style.left = rect.left + 'px';
        wrapper.style.top = rect.top + 'px';
        wrapper.style.width = rect.width + 'px';
        wrapper.style.height = rect.height + 'px';
        if (opts.onInit) opts.onInit(wrapper);
    }

    function clampPosition() {
        const rect = wrapper.getBoundingClientRect();
        const maxX = window.innerWidth - 20;
        const maxY = window.innerHeight - 20;
        let left = parseFloat(wrapper.style.left) || rect.left;
        let top = parseFloat(wrapper.style.top) || rect.top;
        if (left < 0) left = 0;
        if (top < 0) top = 0;
        if (left + rect.width > maxX) left = maxX - rect.width;
        if (top + rect.height > maxY) top = maxY - rect.height;
        wrapper.style.left = left + 'px';
        wrapper.style.top = top + 'px';
    }

    function saveState() {
        const state = {
            left: parseFloat(wrapper.style.left) || 0,
            top: parseFloat(wrapper.style.top) || 0,
            width: parseFloat(wrapper.style.width) || minW,
            height: parseFloat(wrapper.style.height) || minH,
        };
        try {
            localStorage.setItem(storageKey, JSON.stringify(state));
        } catch (e) { /* ignore */ }
    }

    function loadState() {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const state = JSON.parse(saved);
                const left = typeof state.left === 'number' ? state.left : parseFloat(state.left) || 0;
                const top = typeof state.top === 'number' ? state.top : parseFloat(state.top) || 0;
                const width = typeof state.width === 'number' ? state.width : parseFloat(state.width) || minW;
                const height = typeof state.height === 'number' ? state.height : parseFloat(state.height) || minH;
                wrapper.style.left = Math.round(left) + 'px';
                wrapper.style.top = Math.round(top) + 'px';
                wrapper.style.width = Math.max(minW, Math.round(width)) + 'px';
                wrapper.style.height = Math.max(minH, Math.round(height)) + 'px';
                if (opts.onLoad) opts.onLoad(wrapper);
                return true;
            }
        } catch (e) { /* ignore */ }
        return false;
    }

    // MutationObserver lazy-init when hidden class is removed
    let initialized = false;
    const observer = new MutationObserver(() => {
        if (!wrapper.classList.contains('hidden') && !initialized) {
            initialized = true;
            if (!loadState()) {
                initPosition();
            }
            clampPosition();
        }
        if (wrapper.classList.contains('hidden')) {
            initialized = false;
        }
    });
    observer.observe(wrapper, { attributes: true, attributeFilter: ['class'] });

    // Header drag
    on(header, 'mousedown', (e) => {
        if (e.target.closest('button') || e.target.closest('.resize-handle')) return;

        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        const rect = wrapper.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;
        wrapper.classList.add('dragging');
        document.body.style.userSelect = 'none';

        if (wrapper.style.left === '' || wrapper.style.left === 'auto') {
            initPosition();
            const r2 = wrapper.getBoundingClientRect();
            startLeft = r2.left;
            startTop = r2.top;
        }
    });

    // Global mousemove
    on(document, 'mousemove', (e) => {
        if (!isDragging && !isResizing) return;

        if (isDragging) {
            const dx = e.clientX - dragStartX;
            const dy = e.clientY - dragStartY;
            let newLeft = startLeft + dx;
            let newTop = startTop + dy;

            const rect = wrapper.getBoundingClientRect();
            const maxX = window.innerWidth - 20;
            const maxY = window.innerHeight - 20;

            if (newLeft < 0) newLeft = 0;
            if (newTop < 0) newTop = 0;
            if (newLeft + rect.width > maxX) newLeft = maxX - rect.width;
            if (newTop + rect.height > maxY) newTop = maxY - rect.height;

            wrapper.style.left = newLeft + 'px';
            wrapper.style.top = newTop + 'px';
        }

        if (isResizing) {
            const dx = e.clientX - dragStartX;
            const dy = e.clientY - dragStartY;
            const maxW = window.innerWidth - 40;
            const maxH = window.innerHeight - 40;

            let newLeft = startLeft;
            let newTop = startTop;
            let newW = startWidth;
            let newH = startHeight;

            if (resizeDir.includes('e')) {
                newW = Math.max(minW, Math.min(maxW, startWidth + dx));
            }
            if (resizeDir.includes('w')) {
                newW = Math.max(minW, Math.min(maxW, startWidth - dx));
                newLeft = startLeft + (startWidth - newW);
            }
            if (resizeDir.includes('s')) {
                newH = Math.max(minH, Math.min(maxH, startHeight + dy));
            }
            if (resizeDir.includes('n')) {
                newH = Math.max(minH, Math.min(maxH, startHeight - dy));
                newTop = startTop + (startHeight - newH);
            }

            wrapper.style.width = newW + 'px';
            wrapper.style.height = newH + 'px';
            wrapper.style.left = newLeft + 'px';
            wrapper.style.top = newTop + 'px';

            if (opts.onResize) opts.onResize(wrapper);
        }
    });

    // Global mouseup
    on(document, 'mouseup', () => {
        if (isDragging) {
            isDragging = false;
            wrapper.classList.remove('dragging');
            document.body.style.userSelect = '';
            saveState();
        }
        if (isResizing) {
            isResizing = false;
            resizeDir = null;
            wrapper.classList.remove('resizing');
            document.body.style.userSelect = '';
            saveState();
        }
    });

    // Resize handles (4 edges + 4 corners)
    for (const handle of wrapper.querySelectorAll('.resize-handle')) {
        on(handle, 'mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            isResizing = true;
            resizeDir = handle.dataset.dir;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            const rect = wrapper.getBoundingClientRect();
            startWidth = rect.width;
            startHeight = rect.height;
            startLeft = rect.left;
            startTop = rect.top;
            wrapper.classList.add('resizing');
            document.body.style.userSelect = 'none';

            if (wrapper.style.left === '' || wrapper.style.left === 'auto') {
                initPosition();
                const r2 = wrapper.getBoundingClientRect();
                startWidth = r2.width;
                startHeight = r2.height;
                startLeft = r2.left;
                startTop = r2.top;
            }
        });
    }

    // Window resize clamp
    on(window, 'resize', () => {
        if (!wrapper.classList.contains('hidden') && wrapper.style.left !== '' && wrapper.style.left !== 'auto') {
            clampPosition();
        }
    });

    return {
        init: initPosition,
        clamp: clampPosition,
    };
}

/* ========== General Utilities ========== */
function debounce(func, delay) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

function truncateAddress(address) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
