/* ========== Brainstorm UI ========== */
function showBrainstormBubble() {
    dom.bubbleResizeWrapper.classList.remove('hidden');
    dom.bubbleContent.textContent = '';
    brainstormResultText = '';
    bubbleViewMode = 'preview';
    updateBubbleViewButtons();
}

function hideBrainstormBubble() {
    dom.bubbleResizeWrapper.classList.add('hidden');
    if (brainstormAbortController) {
        brainstormAbortController.abort();
        brainstormAbortController = null;
    }
}

function setBrainstormLoading(loading) {
    if (loading) {
        dom.bubbleContent.classList.add('single-mode');
        dom.bubbleContent.innerHTML = '<div class="bubble-loading">Thinking...</div>';
    }
}

function appendBrainstormText(text) {
    const loadingEl = dom.bubbleContent.querySelector('.bubble-loading');
    if (loadingEl) loadingEl.remove();
    brainstormResultText += text;
    brainstormResultText = brainstormResultText.replace(/\n{3,}/g, '\n\n');
    updateBubbleContent();
}

function updateBubbleContent() {
    const el = dom.bubbleContent;
    el.classList.remove('split-mode');
    el.classList.add('single-mode');
    if (bubbleViewMode === 'preview') {
        el.innerHTML = marked.parse(brainstormResultText);
    } else {
        el.textContent = brainstormResultText;
    }
    el.scrollTop = el.scrollHeight;
}

function updateBubbleViewButtons() {
    dom.bubbleRawBtn.classList.toggle('active', bubbleViewMode === 'raw');
    dom.bubblePreviewBtn.classList.toggle('active', bubbleViewMode === 'preview');
}

/* ========== Brainstorm Fetch & Trigger ========== */
async function doBrainstormFetch(prompt, lastQ) {
    const provider = currentProvider;
    const model = currentModel;
    showBrainstormBubble();
    setBrainstormLoading(true);
    brainstormAbortController = new AbortController();
    let streamError = false;
    try {
        const prePrompt = loadPrePrompt();
        const fullPrompt = prePrompt ? `${prePrompt}\n\n${prompt}` : prompt;
        await streamAIResponse(fullPrompt, {
            signal: brainstormAbortController.signal,
            provider: provider,
            model: model,
            onChunk: function (chunk) { appendBrainstormText(chunk); }
        });
    } catch (error) {
        console.error('[DEBUG] fetch error:', error);
        streamError = true;
        if (error.name === 'AbortError') {
            appendBrainstormText('\n\n[Cancelled]');
        } else {
            appendBrainstormText(`\n\n[Error] ${error.message}`);
        }
    }
    brainstormAbortController = null;

    // Auto-save to history after successful streaming
    if (!streamError && brainstormResultText.trim() && activeNoteId && lastQ !== undefined) {
        const sessionKey = `bubble_closed_${activeNoteId}_${lastQ}`;
        sessionStorage.removeItem(sessionKey);
        try {
            const result = await createHiddenNote(brainstormResultText, activeNoteId, lastQ);
            await updateParentAiResponses(activeNoteId, result.id, lastQ);
            sessionStorage.setItem(sessionKey, '1');
        } catch (e) { /* silent fail */ }
    }
}

async function triggerBrainstorm() {
    if (!BRAINSTORM_WORKER_URL) {
        alert('Please set your Worker URL in settings.');
        return;
    }
    const content = dom.noteContentInput.value.replace(/💭/g, '');
    const sep = loadSeparator();
    const lastSepPos = content.lastIndexOf(sep);
    if (lastSepPos === -1) return;
    const prompt = content.slice(0, lastSepPos + sep.length);
    await doBrainstormFetch(prompt, lastSepPos + sep.length);
}

async function triggerBrainstormCtrlEnter() {
    if (!BRAINSTORM_WORKER_URL) {
        alert('Please set your Worker URL in settings.');
        return;
    }
    const content = dom.noteContentInput.value.replace(/💭/g, '');
    const sep = loadSeparator();
    const lastQ = content.lastIndexOf(sep);
    if (lastQ === -1) {
        triggerBrainstorm();
        return;
    }
    const beforeLast = content.slice(0, lastQ);
    const prevQ = beforeLast.lastIndexOf(sep);
    let prompt;
    if (prevQ === -1) {
        prompt = content.slice(0, lastQ + sep.length);
    } else {
        prompt = content.slice(prevQ + sep.length, lastQ + sep.length);
    }
    if (!prompt.trim()) return;
    await doBrainstormFetch(prompt, lastQ + sep.length);
}

/* ========== AI Response Storage ========== */
async function updateParentAiResponses(noteId, hiddenNoteId, questionEndPos) {
    if (!noteId) return;
    const { result } = await db.get(noteId);
    if (!result?.value) return;
    const note = result.value;
    if (!note.aiResponses) note.aiResponses = [];
    const exists = note.aiResponses.some(r => r.id === hiddenNoteId);
    if (!exists) {
        note.aiResponses.push({
            id: hiddenNoteId,
            questionEndPos: questionEndPos,
            timestamp: Date.now()
        });
    }
    await db.sm.acls.set(note, noteId);
}

async function createHiddenNote(output, parentId, questionEndPos) {
    const note = {
        type: 'note',
        title: output.substring(0, 30) || 'AI Output',
        content: output,
        brainstormOutput: true,
        parentNoteId: parentId,
        questionEndPos: questionEndPos,
    };
    const id = await db.sm.acls.set(note);
    return { id };
}
