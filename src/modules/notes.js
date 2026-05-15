        /* ========== Note List Rendering ========== */
        const folderExpanded = new Set();

        function renderNotesList() {
            const allItems = [...notesCache.values()]
                .filter(n => n.value !== null && n.value.brainstormOutput !== true && n.value.type !== 'mindmap');
            const idSet = new Set(allItems.map(n => n.id));
            noteOrder = noteOrder.filter(id => idSet.has(id));
            for (const note of allItems) {
                if (!noteOrder.includes(note.id)) noteOrder.push(note.id);
            }

            // Build tree: group items by parentId
            const byParent = new Map();
            for (const item of allItems) {
                const pid = item.value.parentId || '__root__';
                if (!byParent.has(pid)) byParent.set(pid, []);
                byParent.get(pid).push(item);
            }

            dom.notesList.innerHTML = '';
            renderItemList(dom.notesList, '__root__', byParent, 0);
        }

        function renderItemList(container, parentId, byParent, depth) {
            const items = (byParent.get(parentId) || [])
                .sort((a, b) => noteOrder.indexOf(a.id) - noteOrder.indexOf(b.id));

            for (const item of items) {
                if (item.value.type === 'folder') {
                    renderFolderItem(container, item, byParent, depth);
                } else {
                    renderNoteItem(container, item, depth);
                }
            }
        }

        function setupDragHandlers(el, id, dragOverClass, onDrop) {
            el.draggable = true;
            el.addEventListener('dragstart', (e) => {
                el.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', id);
            });
            el.addEventListener('dragend', () => {
                el.classList.remove('dragging');
                for (const target of document.querySelectorAll('.drag-over, .drag-over-folder')) target.classList.remove('drag-over', 'drag-over-folder');
            });
            el.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                for (const target of document.querySelectorAll(`.${dragOverClass}`)) target.classList.remove(dragOverClass);
                el.classList.add(dragOverClass);
            });
            el.addEventListener('dragleave', () => {
                el.classList.remove(dragOverClass);
            });
            el.addEventListener('drop', (e) => {
                e.preventDefault();
                el.classList.remove(dragOverClass);
                const draggedId = e.dataTransfer.getData('text/plain');
                if (draggedId && draggedId !== id) {
                    onDrop(draggedId);
                }
            });
        }

        function renderFolderItem(container, folder, byParent, depth) {
            const isOwner = folder.value.owner === currentUserAddress;
            const isExpanded = folderExpanded.has(folder.id);
            const folderEl = document.createElement('div');
            folderEl.className = 'note-item folder-item';
            folderEl.dataset.id = folder.id;
            if (folder.id === activeNoteId) folderEl.classList.add('active');
            if (!isOwner) folderEl.classList.add('shared-with-me');

            const checkboxHtml = batchMode ? `<div class="note-checkbox${selectedNotes.has(folder.id) ? ' checked' : ''}"></div>` : '';
            folderEl.innerHTML = `
                ${checkboxHtml}
                <span class="folder-toggle"><i class="ph-bold ${isExpanded ? 'ph-folder-open' : 'ph-folder'}"></i></span>
                <div class="folder-info">
                    <h3>${folder.value.title || 'Untitled Folder'}</h3>
                </div>
            `;

            if (selectedNotes.has(folder.id)) folderEl.classList.add('selected');

            on(folderEl, 'click', (_e) => {
                if (batchMode) {
                    toggleFolderSelection(folder.id, folderEl, byParent);
                    return;
                }
                selectNote(folder.id);
                if (folderExpanded.has(folder.id)) {
                    folderExpanded.delete(folder.id);
                } else {
                    folderExpanded.add(folder.id);
                }
                renderNotesList();
            });

            container.appendChild(folderEl);

            // Children
            const childrenContainer = document.createElement('div');
            childrenContainer.className = `folder-children${isExpanded ? '' : ' collapsed'}`;
            renderItemList(childrenContainer, folder.id, byParent, depth + 1);
            container.appendChild(childrenContainer);

            // Drag folder support
            setupDragHandlers(folderEl, folder.id, 'drag-over-folder', (draggedId) => moveItemToFolder(draggedId, folder.id));
        }

        function renderNoteItem(container, note, depth) {
            const isOwner = note.value.owner === currentUserAddress;
            const noteEl = document.createElement('div');
            noteEl.className = 'note-item';
            if (depth > 0) noteEl.classList.add(`depth-${Math.min(depth, 4)}`);
            noteEl.dataset.id = note.id;
            if (note.id === activeNoteId) noteEl.classList.add('active');
            if (!isOwner) noteEl.classList.add('shared-with-me');

            noteEl.innerHTML = `
                <div class="note-checkbox${selectedNotes.has(note.id) ? ' checked' : ''}"></div>
                <div class="note-item-content">
                    <h3>${note.value.title || 'Untitled Note'}</h3>
                    <p>${(note.value.content || 'No additional text').substring(0, 100)}</p>
                </div>
            `;
            if (selectedNotes.has(note.id)) noteEl.classList.add('selected');

            on(noteEl, 'click', (_e) => {
                if (batchMode) {
                    toggleNoteSelection(note.id, noteEl);
                } else {
                    selectNote(note.id);
                }
            });
            setupDragHandlers(noteEl, note.id, 'drag-over', (draggedId) => {
                noteOrder = noteOrder.filter(id => id !== draggedId);
                const targetIdx = noteOrder.indexOf(note.id);
                if (targetIdx >= 0) noteOrder.splice(targetIdx, 0, draggedId);
                else noteOrder.push(draggedId);
                renderNotesList();
            });
            container.appendChild(noteEl);
        }

        /* ========== Folder & Note Operations ========== */
        function toggleFolderSelection(folderId, _folderEl, byParent) {
            const children = getAllDescendants(folderId, byParent);
            const allIds = [folderId, ...children];
            const allSelected = allIds.every(id => selectedNotes.has(id));
            if (allSelected) {
                for (const id of allIds) selectedNotes.delete(id);
            } else {
                for (const id of allIds) selectedNotes.add(id);
            }
            updateBatchCount();
            renderNotesList();
        }

        function getAllDescendants(parentId, byParent) {
            const result = [];
            const children = byParent.get(parentId) || [];
            for (const child of children) {
                result.push(child.id);
                if (child.value.type === 'folder') {
                    result.push(...getAllDescendants(child.id, byParent));
                }
            }
            return result;
        }

        async function moveItemToFolder(itemId, folderId) {
            const item = notesCache.get(itemId);
            if (!item?.value) return;
            const updated = { ...item.value, parentId: folderId };
            // Remove from noteOrder when moving into a folder (simplified)
            noteOrder = noteOrder.filter(id => id !== itemId);
            await db.sm.acls.set(updated, itemId);
        }

        /* ========== Editor Functions ========== */
        function renderNoteEditor() {
            const note = notesCache.get(activeNoteId);
            if (!note?.value) {
                showEditor(false);
                return;
            }
            const isFolder = note.value.type === 'folder';
            const isOwner = note.value.owner === currentUserAddress;
            const collaborators = note.value.collaborators || {};
            const userPermission = collaborators[currentUserAddress];
            const canWrite = isOwner || userPermission === 'write';
            dom.noteTitleInput.value = note.value.title || '';
            dom.noteContentInput.value = isFolder ? '' : (note.value.content || '');
            dom.noteTitleInput.readOnly = !canWrite;
            dom.noteContentInput.readOnly = isFolder || !canWrite;

            // Handle initial welcome content
            const hasInitialContent = note.value.isInitialContent === true;
            dom.noteContentInput.classList.toggle('initial-welcome', hasInitialContent);

            if (isFolder) {
                dom.noteContentInput.placeholder = 'This is a folder. Drag notes into it.';
            } else {
                dom.noteContentInput.placeholder = hasInitialContent ? '' : 'Start writing... Supports Markdown.\n\nTip: Type your question, then press Enter twice to brainstorm with AI.';
            }
            dom.deleteBtn.classList.toggle('hidden', !isOwner);
            
            dom.previewBtn.classList.toggle('hidden', isFolder);
            renderMarkdownPreview();
            showEditor(true);
        }

        function showEditor(show) {
            dom.noteEditor.classList.toggle('hidden', !show);
            dom.editorPlaceholder.classList.toggle('hidden', show);
            if (window.innerWidth <= 768 && show) {
                dom.noteEditorContainer.classList.add('active');
            }
        }

        function selectNote(id) {
            activeNoteId = id;
            noteViewMode = 'edit';
            renderNotesList();
            renderNoteEditor();
        }

        async function createNewNote(content = '') {
            const initialContent = '# Welcome to Ymind\n\nStart typing here. Markdown is supported.';
            const newNote = {
                type: 'note',
                title: 'New Note',
                content: content || initialContent,
                isInitialContent: content ? false : true, // flag to track if this is the initial welcome content
            };
            const id = await db.sm.acls.set(newNote);
            selectNote(id);
        }

        async function createFolder(title) {
            if (!title) return;
            const folder = {
                type: 'folder',
                title: title,
                content: '',
            };
            await db.sm.acls.set(folder);
        }

        const updateNote = debounce(async () => {
            if (!activeNoteId) return;
            const existingNote = notesCache.get(activeNoteId);
            if (!existingNote?.value) return;
            const updatedNote = { ...existingNote.value, title: dom.noteTitleInput.value, content: dom.noteContentInput.value };
            await db.sm.acls.set(updatedNote, activeNoteId);
        }, 500);

        async function deleteNote() {
            if (!activeNoteId) return;
            showConfirmModal('Delete Note?', 'This action cannot be undone.', async () => {
                const noteIdToDelete = activeNoteId;
                activeNoteId = null;
                showEditor(false);
                await db.sm.acls.delete(noteIdToDelete);
            });
        }

        function showConfirmModal(title, message, onConfirm) {
            const modal = dom.confirmModal;
            modal.querySelector('h2').textContent = title;
            modal.querySelector('p').textContent = message;
            modal.classList.remove('hidden');
            const cancelBtn = dom.confirmCancelBtn;
            const confirmBtn = dom.confirmDeleteBtn;
            const close = () => modal.classList.add('hidden');
            on(cancelBtn, 'click', close);
            on(modal, 'click', (e) => { if (e.target === modal) close(); });
            on(confirmBtn, 'click', () => { close(); onConfirm(); });
        }
