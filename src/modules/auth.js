/* ========== Theme Functions ========== */
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('notesdev-theme', theme);
    updateThemeIcon(theme);
}

function updateThemeIcon(theme) {
    const icon = dom.themeToggleBtn.querySelector('i');
    if (!icon) return;
    icon.className = theme === 'dark' ? 'ph-bold ph-sun' : 'ph-bold ph-moon';
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
}

/* ========== Auth UI ========== */
function renderAuthUI(state) {
    dom.authActions.generate.classList.remove('hidden');
    dom.authActions.loginMnemonic.classList.remove('hidden');
    dom.authActions.loginPasskey.classList.remove('hidden');
    dom.authActions.copyPhrase.classList.add('hidden');
    dom.authActions.protectPasskey.classList.add('hidden');
    dom.authWarning.classList.add('hidden');
    dom.mnemonicArea.readOnly = false;
    dom.mnemonicArea.value = '';
    if (state.hasVolatileIdentity) {
        dom.authActions.generate.classList.add('hidden');
        dom.authActions.loginPasskey.classList.add('hidden');
        dom.authActions.copyPhrase.classList.remove('hidden');
        dom.authActions.protectPasskey.classList.remove('hidden');
        dom.authWarning.classList.remove('hidden');
        dom.mnemonicArea.readOnly = true;
        const mnemonic = db.sm.getMnemonicForDisplayAfterRegistrationOrRecovery();
        if (mnemonic) dom.mnemonicArea.value = mnemonic;
    }
}

/* ========== Auth ========== */
async function handleSecurityStateChange(state) {
    currentUserAddress = state.activeAddress;
    if (state.isActive) {
        const mn = db.sm.getMnemonicForDisplayAfterRegistrationOrRecovery();
        if (mn) {
            localStorage.setItem('ymind_mnemonic', mn);
            const pref = await getE2eePreference(mn);
            if (pref === undefined) {
                const enabled = await showE2eePrompt();
                await saveE2eePreference(mn, enabled);
                if (enabled) {
                    await reinitializeWithE2EE(mn);
                    return;
                }
            }
        }
        dom.authScreen.classList.add('hidden');
        dom.appScreen.classList.remove('hidden');
        dom.sidebarUserId.textContent = 'ID: ' + truncateAddress(currentUserAddress);
        await setupNoteSubscriptions();
    } else {
        localStorage.removeItem('ymind_mnemonic');
        dom.appScreen.classList.add('hidden');
        dom.authScreen.classList.remove('hidden');
        renderAuthUI(state);
        cleanupNoteSubscriptions();
        notesCache.clear();
        activeNoteId = null;
        renderNotesList();
        showEditor(false);
    }
}

async function reinitializeWithE2EE(mnemonic) {
    try {
        const e2eePassword = await deriveE2EEPassword(mnemonic);
        const ROOM_ID = await deriveRoomName(mnemonic);

        db = await gdb(ROOM_ID, {
            rtc: true,
            password: e2eePassword,
            sm: {
                superAdmins: SUPERADMIN_ADDRESSES,
                customRoles: CUSTOM_ROLES,
                acls: true,
            },
        });

        db.sm.setSecurityStateChangeCallback(handleSecurityStateChange);

        if (db.room._unsubscribers) {
            db.room._unsubscribers.forEach(fn => { fn(); });
        }

        db.room._unsubscribers = [
            db.room.on('peer:join', () => {
            updateConnectionStatus('connected', 'P2P已连接');
        }),
            db.room.on('peer:leave', () => {
            updateConnectionStatus('disconnected', '连接已断开');
        }),
            db.room.on('sync', () => {
            updateConnectionStatus('syncing', '同步中...');
            setTimeout(() => {
                updateConnectionStatus('connected', '已连接');
            }, 1500);
        })
        ];

        dom.authScreen.classList.add('hidden');
        dom.appScreen.classList.remove('hidden');
        dom.sidebarUserId.textContent = 'ID: ' + truncateAddress(currentUserAddress);
        await setupNoteSubscriptions();
    } catch (error) {
        console.error('Failed to reinitialize with E2EE:', error);
    }
}
