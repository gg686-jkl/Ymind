/* ========== Share & Collaboration ========== */
function renderShareModal(noteIds) {
    // Determine which note IDs to operate on
    if (noteIds?.length) {
        batchShareNoteIds = [...noteIds];
    } else {
        batchShareNoteIds = null;
    }
    const ids = batchShareNoteIds || [activeNoteId];
    const firstId = ids[0];
    if (!firstId) return;

    // Build byParent map for recursive folder traversal
    const allItems = [...notesCache.values()].filter(n => n.value !== null && n.value.brainstormOutput !== true);
    const byParent = new Map();
    for (const item of allItems) {
        const pid = item.value.parentId || '__root__';
        if (!byParent.has(pid)) byParent.set(pid, []);
        byParent.get(pid).push(item);
    }

    // Collect union of all collaborators across selected items
    const allCollaborators = {};
    for (const id of ids) {
        const n = notesCache.get(id);
        if (n?.value?.collaborators) {
            Object.assign(allCollaborators, n.value.collaborators);
        }
    }

    // Update modal header
    const header = dom.shareModal.querySelector('h2');
    if (batchShareNoteIds && batchShareNoteIds.length > 1) {
        header.textContent = `Share ${batchShareNoteIds.length} Items`;
    } else {
        header.textContent = 'Share Note';
    }

    // Render collaborators
    dom.collaboratorsContainer.innerHTML = '';
    for (const [address, permission] of Object.entries(allCollaborators)) {
        const item = document.createElement('div');
        item.className = 'collaborator-item';
        item.innerHTML = `
            <div>
                <span data-address="${address}">${truncateAddress(address)}</span>
                <small>(${permission})</small>
            </div>
            <button data-address="${address}"><i class="ph-bold ph-x"></i></button>
        `;
        on(item.querySelector('span'), 'click', () => {
            dom.shareAddressInput.value = address;
            dom.sharePermissionSelect.value = permission;
        });
        on(item.querySelector('button'), 'click', () => removeCollaborator(address, byParent));
        dom.collaboratorsContainer.appendChild(item);
    }
    dom.shareModal.classList.remove('hidden');
}

async function addCollaborator() {
    const address = dom.shareAddressInput.value.trim();
    const permission = dom.sharePermissionSelect.value;
    if (!address) return;
    const ids = batchShareNoteIds || [activeNoteId];
    if (!ids[0]) return;

    // Build byParent map for recursive folder traversal
    const allItems = [...notesCache.values()].filter(n => n.value !== null && n.value.brainstormOutput !== true);
    const byParent = new Map();
    for (const item of allItems) {
        const pid = item.value.parentId || '__root__';
        if (!byParent.has(pid)) byParent.set(pid, []);
        byParent.get(pid).push(item);
    }

    // Grant ACL on all selected items (recursively for folders)
    for (const noteId of ids) {
        const item = notesCache.get(noteId);
        // If this is a folder, recursively share all descendants
        if (item?.value?.type === 'folder') {
            const descendants = getAllDescendants(noteId, byParent);
            for (const childId of descendants) {
                await db.sm.acls.grant(childId, address, permission);
            }
        }
        await db.sm.acls.grant(noteId, address, permission);
    }
    dom.shareAddressInput.value = '';

    // Refresh cache for all items
    for (const noteId of ids) {
        const { result: updatedNote } = await db.get(noteId);
        if (updatedNote) {
            notesCache.set(noteId, { id: noteId, value: updatedNote.value, timestamp: updatedNote.timestamp });
        }
    }
    renderShareModal(batchShareNoteIds);
}

async function removeCollaborator(address, byParent) {
    const ids = batchShareNoteIds || [activeNoteId];

    // Revoke ACL on all selected items (recursively for folders)
    for (const noteId of ids) {
        const item = notesCache.get(noteId);
        if (item?.value?.type === 'folder') {
            const descendants = getAllDescendants(noteId, byParent);
            for (const childId of descendants) {
                await db.sm.acls.revoke(childId, address);
            }
        }
        await db.sm.acls.revoke(noteId, address);
    }

    // Refresh cache for all items
    for (const noteId of ids) {
        const { result: updatedNote } = await db.get(noteId);
        if (updatedNote) {
            notesCache.set(noteId, { id: noteId, value: updatedNote.value, timestamp: updatedNote.timestamp });
        }
    }
    renderShareModal(batchShareNoteIds);
}
