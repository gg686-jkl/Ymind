/* ========== Batch Mode ========== */

function toggleNoteSelection(noteId, noteEl) {
    if (selectedNotes.has(noteId)) {
        selectedNotes.delete(noteId);
        if (noteEl) {
            noteEl.classList.remove('selected');
            noteEl.querySelector('.note-checkbox')?.classList.remove('checked');
        }
    } else {
        selectedNotes.add(noteId);
        if (noteEl) {
            noteEl.classList.add('selected');
            noteEl.querySelector('.note-checkbox')?.classList.add('checked');
        }
    }
    updateBatchCount();
}

function toggleBatchMode() {
    batchMode = !batchMode;
    if (!batchMode) {
        selectedNotes.clear();
    }
    dom.notesListContainer.classList.toggle('batch-mode', batchMode);
    dom.selectBtn.innerHTML = batchMode
        ? '<i class="ph-bold ph-x"></i>'
        : '<i class="ph-bold ph-list"></i>';
    dom.selectBtn.title = batchMode ? 'Cancel Select' : 'Batch Select';
    updateBatchCount();
    renderNotesList();
}

function updateBatchCount() {
    const el = dom.batchCount;
    if (el) el.textContent = `${selectedNotes.size} selected`;
}

function batchDelete() {
    if (selectedNotes.size === 0) return;
    showConfirmModal('Delete Notes?', `Delete ${selectedNotes.size} note(s)? This action cannot be undone.`, async () => {
        for (const id of selectedNotes) {
            if (id === activeNoteId) {
                activeNoteId = null;
                showEditor(false);
            }
            await db.sm.acls.delete(id);
        }
        selectedNotes.clear();
        if (batchMode) toggleBatchMode();
    });
}

function batchExport() {
    for (const id of selectedNotes) {
        const note = notesCache.get(id);
        if (!note?.value) continue;
        const title = note.value.title || 'Untitled';
        const content = note.value.content || '';
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title}.md`;
        a.click();
        URL.revokeObjectURL(url);
    }
}
