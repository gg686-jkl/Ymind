import { gdb } from "https://cdn.jsdelivr.net/npm/genosdb@latest/dist/index.min.js";

// 兼容旧代码对全局 marked 的引用 - 等待 DOM 加载完成确保 CDN 脚本已执行
document.addEventListener('DOMContentLoaded', () => {
    window.marked = marked;
});

/* ========== Initialization ========== */
async function initApp() {
    try {
        /* --- Database & Security Setup --- */

        const storedMnemonic = localStorage.getItem('ymind_mnemonic');
        const ROOM_ID = storedMnemonic
            ? await deriveRoomName(storedMnemonic)
            : 'notes-dev-db';

        let e2eePassword = '';
        if (storedMnemonic) {
            const pref = await getE2eePreference(storedMnemonic);
            if (pref && pref.e2eeEnabled) {
                e2eePassword = await deriveE2EEPassword(storedMnemonic);
            }
        }

        const gdbConfig = {
            rtc: true,
            sm: {
                superAdmins: window.SUPERADMIN_ADDRESSES,
                customRoles: window.CUSTOM_ROLES,
                acls: true,
            },
        };

        if (e2eePassword) {
            gdbConfig.password = e2eePassword;
        }

        db = await gdb(ROOM_ID, gdbConfig);
        db.sm.setSecurityStateChangeCallback(handleSecurityStateChange);

        /* --- P2P Connection Events --- */
        if (db.room._unsubscribers) {
            db.room._unsubscribers.forEach(fn => { fn(); });
        }

        db.room._unsubscribers = [
            db.room.on('peer:join', (peerId) => {
            updateConnectionStatus('connected', 'P2P已连接');
        }),
            db.room.on('peer:leave', () => {
            updateConnectionStatus('disconnected', '连接已断开');
        }),
            db.room.on('sync', () => {
            updateConnectionStatus('syncing', '同步中...');
            setTimeout(() => {
                updateConnectionStatus('connected', '已连接');
                renderMindmapsList();
            }, 1500);
        })
        ];

        /* --- Auth Event Handlers --- */
        on(dom.authActions.generate, 'click', () => db.sm.startNewUserRegistration());
        on(dom.authActions.loginMnemonic, 'click', () => {
            const m = dom.mnemonicArea.value.trim();
            if (m) db.sm.loginOrRecoverUserWithMnemonic(m);
        });
        on(dom.authActions.loginPasskey, 'click', () => db.sm.loginCurrentUserWithWebAuthn());
        on(dom.authActions.copyPhrase, 'click', () => {
            navigator.clipboard.writeText(dom.mnemonicArea.value);
            alert('Mnemonic copied!');
        });
        on(dom.authActions.protectPasskey, 'click', () => db.sm.protectCurrentIdentityWithWebAuthn());
        on(dom.logoutBtn, 'click', () => db.sm.clearSecurity());

        /* --- Note CRUD Event Handlers --- */
        on(dom.newNoteBtn, 'click', () => {
            if (currentView === 'mindmaps') {
                createNewMindmap();
            } else {
                createNewNote();
            }
        });
        on(mindmapDom.newMindmapBtn, 'click', () => {
            createNewMindmap();
        });
        on(dom.newFolderBtn, 'click', () => {
            if (currentView === 'mindmaps') return;
            dom.createFolderModal.classList.remove('hidden');
            dom.folderNameInput.focus();
        });
        on(dom.cancelFolderBtn, 'click', () => {
            dom.createFolderModal.classList.add('hidden');
            dom.folderNameInput.value = '';
        });
        on(dom.createFolderSubmitBtn, 'click', async () => {
            const nameInput = dom.folderNameInput;
            const title = nameInput.value.trim();
            if (!title) return;
            await createFolder(title);
            dom.createFolderModal.classList.add('hidden');
            nameInput.value = '';
        });
        on(dom.deleteBtn, 'click', deleteNote);

        /* --- Batch Mode Handlers --- */
        on(dom.selectBtn, 'click', toggleBatchMode);
        on(dom.batchDeleteBtn, 'click', batchDelete);
        on(dom.batchExportBtn, 'click', batchExport);
        on(dom.batchShareBtn, 'click', () => {
            if (selectedNotes.size === 0) {
                showToast('No items selected');
                return;
            }
            renderShareModal([...selectedNotes]);
        });

        /* --- Editor Event Handlers --- */
        on(dom.backBtn, 'click', () => dom.noteEditorContainer.classList.remove('active'));
        on(dom.previewBtn, 'click', togglePreviewMode);
        setupSplitDivider();
        on(dom.noteTitleInput, 'input', () => {
            if (currentMindmapId) {
                updateMindmapTitle();
            }
        });
        on(dom.noteTitleInput, 'input', updateNote);
        on(dom.noteContentInput, 'input', () => {
            updateNote();
            // Clear initial welcome content on first edit
            const note = notesCache.get(activeNoteId);
            if (note?.value?.isInitialContent) {
                note.value.isInitialContent = false;
                dom.noteContentInput.classList.remove('initial-welcome');
                dom.noteContentInput.placeholder = 'Start writing... Supports Markdown.\n\nTip: Type your question, then press Enter twice to brainstorm with AI.';
            }
            if (noteViewMode === 'preview') {
                dom.notePreview.innerHTML = marked.parse(dom.noteContentInput.value);
            }
        });
        on(dom.noteContentInput, 'click', () => {
            // Clear initial welcome on any click in editor
            const note = notesCache.get(activeNoteId);
            if (note?.value?.isInitialContent) {
                note.value.isInitialContent = false;
                dom.noteContentInput.classList.remove('initial-welcome');
                dom.noteContentInput.placeholder = 'Start writing... Supports Markdown.\n\nTip: Type your question, then press Enter twice to brainstorm with AI.';
            }
        });
        function handleContentKeydown(e) {
            const shortcuts = loadShortcuts();
            const sc = shortcuts.brainstormCtrlEnter;
            const dc = shortcuts.brainstormDoubleEnter;

            if (!sc?.disabled && sc?.ctrl && e.ctrlKey && e.key === sc.key) {
                e.preventDefault();
                triggerBrainstormCtrlEnter();
                return;
            }

            if (!dc?.disabled && e.key === dc.key) {
                const now = Date.now();
                if (now - lastEnterTime < (dc.delay || 500)) {
                    e.preventDefault();
                    lastEnterTime = 0;
                    triggerBrainstorm();
                    return;
                }
                lastEnterTime = now;
            }
        }
        on(dom.noteContentInput, 'keydown', handleContentKeydown);
        on(dom.searchInput, 'input', debounce(e => setupNoteSubscriptions(e.target.value.trim()), 300));

        /* --- Theme --- */
        const savedTheme = localStorage.getItem('notesdev-theme') || 'light';
        applyTheme(savedTheme);
        on(dom.themeToggleBtn, 'click', toggleTheme);

        /* --- Sidebar Toggle --- */
        function applySidebarState() {
            // Always start expanded on page load
            document.body.classList.remove('sidebar-collapsed');
            const icon = document.querySelector('#sidebar-toggle-btn i');
            if (icon) {
                icon.className = 'ph-bold ph-sidebar-simple';
            }
        }
        on(dom.sidebarToggleBtn, 'click', () => {
            const collapsed = document.body.classList.toggle('sidebar-collapsed');
            const icon = document.querySelector('#sidebar-toggle-btn i');
            if (icon) {
                icon.className = collapsed ? 'ph-bold ph-sidebar' : 'ph-bold ph-sidebar-simple';
            }
        });
        applySidebarState();

        /* --- Mindmap Tab Switching --- */
        on(mindmapDom.listTabNotes, 'click', () => {
            if (currentView !== 'notes') switchTab('notes');
        });
        on(mindmapDom.listTabMindmaps, 'click', () => {
            if (currentView !== 'mindmaps') switchTab('mindmaps');
        });

                /* --- Preprompt Bubble Drag & Resize --- */
                makeDragResizable(prepromptBubbleWrapper, prepromptBubbleHeader, PREPROMPT_BUBBLE_KEY);

                /* --- Share Modal Handlers --- */
                
                on(dom.closeModalBtn, 'click', () => dom.shareModal.classList.add('hidden'));
                on(dom.addCollaboratorBtn, 'click', addCollaborator);

                /* --- Brainstorm Bubble Handlers --- */
                // Bulletproof close button binding
                const forceCloseBubble = function() {
                    const w = document.getElementById('bubble-resize-wrapper');
                    if (w) w.classList.add('hidden');
                };
                const closeBtn = document.getElementById('bubble-close-btn');
                if (closeBtn) {
                    on(closeBtn, 'click', function(e) {
                        e.stopPropagation();
                        e.preventDefault();
                        forceCloseBubble();
                    });
                    // Also mousedown to block header drag
                    on(closeBtn, 'mousedown', function(e) {
                        e.stopImmediatePropagation();
                    });
                }
                on(dom.bubbleContent, 'mouseup', () => {
                    const selection = window.getSelection().toString().trim();
                    if (selection) {
                        navigator.clipboard.writeText(selection);
                        dom.bubbleHint.textContent = 'Copied!';
                        setTimeout(() => {
                            dom.bubbleHint.textContent = 'Select text to copy';
                        }, 1500);
                    }
                });
                on(dom.bubbleRawBtn, 'click', () => { bubbleViewMode = 'raw'; updateBubbleViewButtons(); updateBubbleContent(); });
                on(dom.bubblePreviewBtn, 'click', () => { bubbleViewMode = 'preview'; updateBubbleViewButtons(); updateBubbleContent(); });
                on(dom.bubbleCopyBtn, 'click', () => {
                    if (brainstormResultText) {
                        navigator.clipboard.writeText(brainstormResultText);
                        showToast('AI output copied to clipboard');
                    }
                });
                on(dom.bubblePrevBtn, 'click', () => navigateAi(-1));
                on(dom.bubbleNextBtn, 'click', () => navigateAi(1));

                /* --- Model Selector - Restore Preferences --- */
                const savedProvider = localStorage.getItem('ymind_preferred_provider');
                const savedModel = localStorage.getItem('ymind_preferred_model');
                if (savedProvider) {
                    currentProvider = savedProvider;
                    for (const el of document.querySelectorAll('.provider-item')) {
                        el.classList.toggle('selected', el.dataset.provider === savedProvider);
                    }
                }
                if (savedModel) {
                    currentModel = savedModel;
                    for (const el of document.querySelectorAll('.model-item')) {
                        el.classList.toggle('selected', el.dataset.model === savedModel);
                    }
                }
                updateModelLabel();

                /* --- Load Mindmap Pre-prompts --- */
                mindmapLeftPrePrompt = loadMindmapLeftPrePrompt();
                mindmapRightPrePrompt = loadMindmapRightPrePrompt();
                mindmapResetPrePrompt = loadMindmapResetPrePrompt();

                /* --- Model Selector Logic --- */
                function updateModelLabel() {
                    selectedModelLabel.textContent = `${currentProvider} / ${currentModel}`;
                }

                function selectProvider(provider, model) {
                    currentProvider = provider;
                    currentModel = model;
                    localStorage.setItem('ymind_preferred_provider', provider);
                    localStorage.setItem('ymind_preferred_model', model);

                    // Update provider items
                    for (const el of document.querySelectorAll('.provider-item')) {
                        el.classList.toggle('selected', el.dataset.provider === provider);
                    }

                    // Update model items
                    for (const el of document.querySelectorAll('.model-item')) {
                        el.classList.toggle('selected', el.dataset.model === model);
                    }

                    updateModelLabel();
                    closeModelDropdown();
                }

                function openModelDropdown() {
                    modelSelector.classList.add('open');
                }

                function closeModelDropdown() {
                    modelSelector.classList.remove('open');
                    for (const el of document.querySelectorAll('.provider-item')) el.classList.remove('submenu-open');
                }

                // Toggle dropdown on button click
                on(modelSelectorBtn, 'click', (e) => {
                    e.stopPropagation();
                    modelSelector.classList.contains('open') ? closeModelDropdown() : openModelDropdown();
                });

                // Close dropdown when clicking outside
                closeOnClickOutside(modelSelector, null, closeModelDropdown);

                // Provider hover handling
                for (const providerEl of document.querySelectorAll('.provider-item')) {
                    on(providerEl, 'mouseenter', () => {
                        for (const el of document.querySelectorAll('.provider-item')) el.classList.remove('submenu-open');
                        providerEl.classList.add('submenu-open');
                    });

                    on(providerEl, 'click', () => {
                        const provider = providerEl.dataset.provider;
                        // Get first model from the submenu
                        const firstModelEl = providerEl.querySelector('.model-item');
                        if (firstModelEl) {
                            const model = firstModelEl.dataset.model;
                            selectProvider(provider, model);
                        }
                    });
                }

                // Model item click handling
                for (const modelEl of document.querySelectorAll('.model-item')) {
                    on(modelEl, 'click', (e) => {
                        e.stopPropagation();
                        const provider = modelEl.closest('.provider-item').dataset.provider;
                        const model = modelEl.dataset.model;
                        selectProvider(provider, model);
                    });
                }

                /* --- AI History --- */
                on(dom.aiHistoryBtn, 'click', (e) => {
                    e.stopPropagation();
                    dom.aiHistoryMenu.classList.toggle('hidden');
                    if (!dom.aiHistoryMenu.classList.contains('hidden')) {
                        loadAiHistory();
                    }
                });

                closeOnClickOutside(dom.aiHistoryMenu, dom.aiHistoryBtn, () => {
                    dom.aiHistoryMenu.classList.add('hidden');
                });

                function createHistoryItem(data, handlers) {
                    const item = document.createElement('div');
                    item.className = 'ai-history-item';
                    item.dataset.index = data.index;
                    item.dataset.hiddenId = data.hiddenId;
                    item.dataset.questionEndPos = data.questionEndPos;
                    const contentDiv = document.createElement('div');
                    contentDiv.className = 'item-content';
                    contentDiv.innerHTML = `<div class="question-preview">${escapeHtml(data.question)}...</div><div class="timestamp">${data.timestamp}</div>`;
                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'history-delete-btn';
                    deleteBtn.title = 'Delete';
                    deleteBtn.innerHTML = '<i class="ph-bold ph-x"></i>';
                    deleteBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        handlers.onDelete();
                    });
                    item.appendChild(contentDiv);
                    item.appendChild(deleteBtn);
                    item.addEventListener('mouseenter', handlers.onMouseEnter);
                    item.addEventListener('mouseleave', handlers.onMouseLeave);
                    item.addEventListener('click', (e) => {
                        if (e.target.closest('.history-delete-btn')) return;
                        handlers.onClick();
                    });
                    return item;
                }

                async function loadAiHistory() {
                    if (!activeNoteId) {
                        dom.aiHistoryContent.innerHTML = '<div class="ai-history-item">No note selected</div>';
                        return;
                    }
                    const { result } = await db.get(activeNoteId);
                    if (!result?.value?.aiResponses) {
                        dom.aiHistoryContent.innerHTML = '<div class="ai-history-item">No AI responses yet</div>';
                        return;
                    }
                    const responses = [...result.value.aiResponses].reverse();
                    dom.aiHistoryContent.innerHTML = '';
                    currentAiOutputs = [];
                    currentAiIndex = 0;
                    for (const r of responses) {
                        const { result: hiddenNote } = r.id ? await db.get(r.id) : { result: null };
                        const output = hiddenNote?.value?.content || 'AI output not found';
                        const question = output.substring(0, 50);
                        const item = createHistoryItem(
                            {
                                index: String(currentAiOutputs.length),
                                hiddenId: r.id,
                                questionEndPos: String(r.questionEndPos),
                                question: question,
                                timestamp: new Date(r.timestamp).toLocaleString()
                            },
                            {
                                onDelete: () => deleteAiHistoryItem(r.id),
                                onMouseEnter: () => highlightQuestionMark(r.questionEndPos),
                                onMouseLeave: () => clearHighlight(),
                                onClick: () => openAiBubble(r.id, r.questionEndPos)
                            }
                        );
                        dom.aiHistoryContent.appendChild(item);
                        currentAiOutputs.push({ id: r.id, questionEndPos: r.questionEndPos });
                    }
                    updateBubbleNav();
                }

                async function deleteAiHistoryItem(hiddenNoteId) {
                    if (!activeNoteId) return;
                    const { result } = await db.get(activeNoteId);
                    if (!result?.value?.aiResponses) return;
                    const note = result.value;
                    const idx = note.aiResponses.findIndex(r => r.id === hiddenNoteId);
                    if (idx === -1) return;
                    // Remove from aiResponses array
                    note.aiResponses.splice(idx, 1);
                    await db.sm.acls.set(note, activeNoteId);
                    // Refresh the history menu
                    loadAiHistory();
                    showToast('AI history item deleted');
                }

                async function openMostRecentAi() {
                    if (!activeNoteId) return;
                    const { result } = await db.get(activeNoteId);
                    if (!result?.value?.aiResponses || result.value.aiResponses.length === 0) {
                        showToast('No AI response to show');
                        return;
                    }
                    const latest = result.value.aiResponses[result.value.aiResponses.length - 1];
                    openAiBubble(latest.id, latest.questionEndPos);
                }

                function navigateAi(direction) {
                    if (currentAiOutputs.length === 0) return;
                    currentAiIndex = Math.max(0, Math.min(currentAiOutputs.length - 1, currentAiIndex + direction));
                    const current = currentAiOutputs[currentAiIndex];
                    if (current) openAiBubble(current.id, current.questionEndPos);
                }

                function updateBubbleNav() {
                    const total = currentAiOutputs.length;
                    const indicator = dom.bubbleNavIndicator;
                    const prevBtn = dom.bubblePrevBtn;
                    const nextBtn = dom.bubbleNextBtn;
                    if (!indicator || !prevBtn || !nextBtn) return;
                    if (total <= 1) {
                        indicator.style.display = 'none';
                        prevBtn.style.display = 'none';
                        nextBtn.style.display = 'none';
                    } else {
                        indicator.style.display = '';
                        prevBtn.style.display = '';
                        nextBtn.style.display = '';
                        indicator.textContent = `${currentAiIndex + 1} / ${total}`;
                        prevBtn.disabled = currentAiIndex <= 0;
                        nextBtn.disabled = currentAiIndex >= total - 1;
                    }
                }

                async function openAiBubble(hiddenNoteId, _questionEndPos) {
                    const { result } = await db.get(hiddenNoteId);
                    if (!result?.value) {
                        showToast('AI output not found');
                        return;
                    }
                    currentAiIndex = currentAiOutputs.findIndex(o => o.id === hiddenNoteId);
                    brainstormResultText = result.value.content;
                    bubbleViewMode = 'preview';
                    updateBubbleViewButtons();
                    updateBubbleContent();
                    updateBubbleNav();
                    dom.bubbleResizeWrapper.classList.remove('hidden');
                    dom.aiHistoryMenu.classList.add('hidden');
                }

                function highlightQuestionMark(questionEndPos) {
                    clearHighlight();
                    const textarea = dom.noteContentInput;
                    const content = textarea.value;
                    if (!questionEndPos || questionEndPos > content.length) return;
                    // The ? is at position questionEndPos - 1 (questionEndPos is exclusive end)
                    const pos = questionEndPos - 1;
                    if (pos < 0 || content[pos] !== '?') return;
                    textarea.focus({ preventScroll: true });
                    textarea.setSelectionRange(pos, pos + 1);
                    textarea.classList.add('ai-highlight');
                }

                function clearHighlight() {
                    const textarea = dom.noteContentInput;
                    textarea.classList.remove('ai-highlight');
                    if (document.activeElement === textarea) {
                        textarea.setSelectionRange(0, 0);
                    }
                }

                /* --- Keyboard Shortcuts --- */
                on(document, 'keydown', (e) => {
                    // Skip when shortcut input is in listening mode
                    if (document.querySelector('.settings-shortcut-input.listening')) return;

                    if (e.key === 'Escape' && !nodeEditDom.wrapper.classList.contains('hidden')) {
                        closeNodeEditBubble();
                        return;
                    }

                    const shortcuts = loadShortcuts();
                
                    if (!shortcuts.exitBatchMode.disabled && e.key === shortcuts.exitBatchMode.key && batchMode) {
                        e.preventDefault();
                        toggleBatchMode();
                        return;
                    }
                    if (!shortcuts.openAiHistory.disabled && (e.ctrlKey || e.metaKey) && e.key === shortcuts.openAiHistory.key) {
                        e.preventDefault();
                        openMostRecentAi();
                        return;
                    }
                    if (!shortcuts.navigateAiPrev.disabled && e.key === shortcuts.navigateAiPrev.key && currentAiOutputs.length > 0 && !dom.bubbleResizeWrapper.classList.contains('hidden')) {
                        e.preventDefault();
                        navigateAi(-1);
                        return;
                    }
                    if (!shortcuts.navigateAiNext.disabled && e.key === shortcuts.navigateAiNext.key && currentAiOutputs.length > 0 && !dom.bubbleResizeWrapper.classList.contains('hidden')) {
                        e.preventDefault();
                        navigateAi(1);
                        return;
                    }
                });

                /* --- Bubble Drag & Resize --- */
                const bubbleWrapper = dom.bubbleResizeWrapper;
                const bubbleHeader = dom.brainstormBubble.querySelector('.bubble-header');
                const BUBBLE_STORAGE_KEY = 'ymind-bubble-state';

                makeDragResizable(bubbleWrapper, bubbleHeader, BUBBLE_STORAGE_KEY, {
                    onInit: (w) => { w.style.bottom = 'auto'; w.style.transform = 'none'; w.style.maxHeight = '70vh'; },
                    onLoad: (w) => { w.style.bottom = 'auto'; w.style.transform = 'none'; w.style.maxHeight = 'none'; w.style.maxWidth = 'none'; },
                    onResize: (w) => { w.style.maxWidth = 'none'; w.style.maxHeight = 'none'; },
                });

                /* --- Node Edit Bubble Event Bindings --- */
                on(nodeEditDom.previewBtn, 'click', function () {
                    nodeEditViewMode = 'preview';
                    updateNodeEditView();
                });
                on(nodeEditDom.rawBtn, 'click', function () {
                    nodeEditViewMode = 'raw';
                    updateNodeEditView();
                });
                on(nodeEditDom.closeBtn, 'click', function (e) {
                    e.stopPropagation();
                    closeNodeEditBubble();
                });
                on(nodeEditDom.closeBtn, 'mousedown', function (e) {
                    e.stopImmediatePropagation();
                });
                on(nodeEditDom.cancelBtn, 'click', function () {
                    closeNodeEditBubble();
                });
                on(nodeEditDom.saveBtn, 'click', function () {
                    saveNodeEdit();
                });
                on(nodeEditDom.deleteBtn, 'click', function () {
                    deleteNodeFromMindmap(editingNodeId);
                });

                /* --- Context Menu Button Bindings --- */
                document.querySelectorAll('#mindmap-context-menu .context-menu-item').forEach(function (item) {
                    on(item, 'click', function () {
                        handleContextMenuAction(item.dataset.action);
                    });
                });

    } catch (error) {
        console.error('Failed to initialize Ymind:', error);
        document.body.innerHTML = '<pre>Error: ' + error.stack + '</pre>';
    } finally {
        dom.initialLoader.classList.add('hidden');
    }
}
on(document, 'DOMContentLoaded', initApp);
