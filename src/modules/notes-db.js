/* ========== Note Subscriptions ========== */
function updateNoteCache(event) {
    if (event.action === 'removed') {
        notesCache.delete(event.id);
    } else {
        notesCache.set(event.id, { id: event.id, value: event.value, timestamp: event.timestamp });
    }
    if (event.id === activeNoteId) renderNoteEditor();
    renderNotesList();
    renderMindmapsList();
};

async function setupNoteSubscriptions(searchTerm = '') {
    cleanupNoteSubscriptions();
    const myNotesConditions = [{ type: 'note' }, { owner: currentUserAddress }];
    if (searchTerm) myNotesConditions.push({ $text: searchTerm });
    const myNotesSub = await db.map({ query: { $and: myNotesConditions } }, updateNoteCache);
    myNotesUnsubscribe = myNotesSub.unsubscribe;
    const folderConditions = [{ type: 'folder' }, { owner: currentUserAddress }];
    if (searchTerm) folderConditions.push({ $text: searchTerm });
    const folderSub = await db.map({ query: { $and: folderConditions } }, updateNoteCache);
    folderNotesUnsubscribe = folderSub.unsubscribe;
    const sharedNotesConditions = [{ type: 'note' }];
    if (searchTerm) sharedNotesConditions.push({ $text: searchTerm });
    const sharedNotesSub = await db.map({ query: { $and: sharedNotesConditions } }, (event) => {
        if (event.value?.collaborators?.[currentUserAddress]) {
            updateNoteCache(event);
        } else if (notesCache.has(event.id) && notesCache.get(event.id)?.value?.owner !== currentUserAddress) {
            updateNoteCache({ action: 'removed', id: event.id });
        }
    });
    sharedNotesUnsubscribe = sharedNotesSub.unsubscribe;
    const mindmapConditions = [{ type: 'mindmap' }, { owner: currentUserAddress }];
    if (searchTerm) mindmapConditions.push({ $text: searchTerm });
    const mindmapSub = await db.map({ query: { $and: mindmapConditions } }, updateNoteCache);
    mindmapUnsubscribe = mindmapSub.unsubscribe;
}

function cleanupNoteSubscriptions() {
    if (myNotesUnsubscribe) myNotesUnsubscribe();
    if (sharedNotesUnsubscribe) sharedNotesUnsubscribe();
    if (folderNotesUnsubscribe) folderNotesUnsubscribe();
    if (mindmapUnsubscribe) mindmapUnsubscribe();
    myNotesUnsubscribe = null;
    sharedNotesUnsubscribe = null;
    folderNotesUnsubscribe = null;
    mindmapUnsubscribe = null;
}
