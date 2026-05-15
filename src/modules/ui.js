/* ========== Split View ========== */
function applySplitRatio(container) {
    const input = container.querySelector('#note-content-input');
    const preview = container.querySelector('#note-preview');
    const ratio = Math.max(0.2, Math.min(0.8, splitRatio));
    input.style.flex = `${ratio * 100}`;
    input.style.flexBasis = `${ratio * 100}%`;
    preview.style.flex = `${(1 - ratio) * 100}`;
    preview.style.flexBasis = `${(1 - ratio) * 100}%`;
}

function setupSplitDivider() {
    const divider = dom.splitDivider;
    if (!divider || divider._init) return;
    divider._init = true;

    let dragging = false;
    let startX = 0;
    let startRatio = 0;
    let wrapWidth = 0;
    let rafPending = false;
    let cachedEvent = null;
    const wrap = dom.noteEditorContent;
    const input = document.getElementById('note-content-input');
    const preview = document.getElementById('note-preview');

    function doDrag(e) {
        const dx = e.clientX - startX;
        const newRatio = startRatio + dx / wrapWidth;
        splitRatio = Math.max(0.2, Math.min(0.8, newRatio));
        applySplitRatio(wrap);
    }

    on(divider, 'mousedown', (e) => {
        if (!wrap.classList.contains('split-view')) return;
        dragging = true;
        startX = e.clientX;
        startRatio = splitRatio;
        wrapWidth = wrap.getBoundingClientRect().width;
        divider.classList.add('dragging');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        // Disable transitions for smooth drag
        input.style.transition = 'none';
        preview.style.transition = 'none';
        e.preventDefault();
    });

    on(document, 'mousemove', (e) => {
        if (!dragging) return;
        cachedEvent = e;
        if (!rafPending) {
            rafPending = true;
            requestAnimationFrame(() => {
                rafPending = false;
                if (dragging && cachedEvent) {
                    doDrag(cachedEvent);
                    cachedEvent = null;
                }
            });
        }
    });

    on(document, 'mouseup', () => {
        if (!dragging) return;
        dragging = false;
        rafPending = false;
        cachedEvent = null;
        divider.classList.remove('dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        // Re-enable transitions
        input.style.transition = '';
        preview.style.transition = '';
        localStorage.setItem('ymind_split_ratio', splitRatio);
    });
}

/* ========== Markdown Preview ========== */
function renderMarkdownPreview() {
    const contentWrap = dom.noteEditorContent;
    if (noteViewMode === 'preview') {
        contentWrap.classList.add('split-view');
        dom.noteContentInput.classList.remove('hidden');
        dom.notePreview.classList.remove('hidden');
        dom.notePreview.innerHTML = marked.parse(dom.noteContentInput.value);
        dom.previewBtn.innerHTML = '<i class="ph-bold ph-pencil-line"></i> Edit';

        // Apply split ratio
        applySplitRatio(contentWrap);

        // Sync scroll between textarea and preview
        const input = dom.noteContentInput;
        const preview = dom.notePreview;

        // Remove previous handlers if any
        if (input._syncHandler) input.removeEventListener('scroll', input._syncHandler);
        if (preview._syncHandler) preview.removeEventListener('scroll', preview._syncHandler);

        let syncing = false;
        const onInputScroll = () => {
            if (syncing) return;
            syncing = true;
            const ratio = input.scrollTop / (input.scrollHeight - input.clientHeight);
            preview.scrollTop = ratio * (preview.scrollHeight - preview.clientHeight);
            syncing = false;
        };
        const onPreviewScroll = () => {
            if (syncing) return;
            syncing = true;
            const ratio = preview.scrollTop / (preview.scrollHeight - preview.clientHeight);
            input.scrollTop = ratio * (input.scrollHeight - input.clientHeight);
            syncing = false;
        };
        input._syncHandler = onInputScroll;
        preview._syncHandler = onPreviewScroll;
        on(input, 'scroll', onInputScroll);
        on(preview, 'scroll', onPreviewScroll);
    } else {
        contentWrap.classList.remove('split-view');
        dom.noteContentInput.classList.remove('hidden');
        dom.notePreview.classList.add('hidden');
        dom.previewBtn.innerHTML = '<i class="ph-bold ph-eye"></i> Preview';
    }
}

function togglePreviewMode() {
    noteViewMode = noteViewMode === 'preview' ? 'edit' : 'preview';
    const note = notesCache.get(activeNoteId);
    const canWrite = note?.value?.owner === currentUserAddress || note?.value?.collaborators?.[currentUserAddress] === 'write';
    dom.noteTitleInput.readOnly = !canWrite;
    dom.noteContentInput.readOnly = !canWrite;
    renderMarkdownPreview();
}

/* ========== Toast ========== */
function showToast(message) {
    dom.toast.textContent = message;
    dom.toast.classList.remove('hidden');
    setTimeout(() => {
        dom.toast.classList.add('hidden');
    }, 2000);
}

/* ========== Connection Status ========== */
function updateConnectionStatus(state, text) {
    const el = document.getElementById('connection-status');
    const dot = document.getElementById('connection-dot');
    const textEl = document.getElementById('connection-text');
    if (!el || !dot || !textEl) return;
    el.className = 'connection-status ' + state;
    if (textEl) textEl.textContent = text || '';
}
