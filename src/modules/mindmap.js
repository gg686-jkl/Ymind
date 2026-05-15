function defaultNodeData() {
    return {
        id: crypto.randomUUID ? crypto.randomUUID() : 'root-' + Date.now(),
        topic: '新建思维导图',
        content: '',
        linksLeft: [],
        linksRight: [],
        leftCollapsed: false,
        rightCollapsed: false
    };
}

function getMindmapData() {
    if (!mindmapRenderer) return null;
    return mindmapRenderer.getData();
}

async function createNewMindmap() {
    var rootData = defaultNodeData();
    var nodes = {};
    nodes[rootData.id] = rootData;
    var note = {
        type: 'mindmap',
        title: '新建思维导图',
        nodes: nodes,
        expansionBranches: []
    };
    var id = await db.sm.acls.set(note);
    currentMindmapId = id;
    notesCache.set(id, { id: id, value: note, timestamp: Date.now() });
    if (currentView !== 'mindmaps') switchTab('mindmaps');
    renderMindmapsList();
    loadMindmap(id);
}

function loadMindmapNodeData(dataValue) {
    if (dataValue.nodes) {
        return JSON.parse(JSON.stringify(dataValue.nodes));
    }
    if (dataValue.root) {
        return migrateOldRootToNodes(dataValue.root);
    }
    var rootData = defaultNodeData();
    var nodes = {};
    nodes[rootData.id] = rootData;
    return nodes;
}

async function loadMindmap(id) {
    var note = notesCache.get(id);
    if (!note) {
        var res = await db.get(id);
        if (!res || !res.result) return;
        notesCache.set(id, { id: id, value: res.result.value, timestamp: res.result.timestamp });
    }
    var data = notesCache.get(id);
    if (!data || !data.value || data.value.type !== 'mindmap') return;

    currentMindmapId = id;
    var nodes = loadMindmapNodeData(data.value);
    expansionBranches = data.value.expansionBranches || [];

    showMindmapCanvas();
    destroyMindmapInstance();
    bootMindmapRenderer(nodes);

    dom.noteTitleInput.value = data.value.title || '新建思维导图';
    updateMindmapTitle();
}

var saveMindmap = debounce(async function () {
    if (!currentMindmapId) return;
    var note = notesCache.get(currentMindmapId);
    if (!note || !note.value) return;
    var mapData = getMindmapData();
    if (!mapData) return;
    var updated = Object.assign({}, note.value, {
        title: dom.noteTitleInput.value || '新建思维导图',
        nodes: mapData.nodes,
        expansionBranches: mapData.expansionBranches
    });
    await db.sm.acls.set(updated, currentMindmapId);
}, 800);

function updateMindmapTitle() {
    if (!currentMindmapId) return;
    const title = dom.noteTitleInput.value.trim();
    if (title && title !== notesCache.get(currentMindmapId)?.value?.title) {
        saveMindmap();
    }
}

function renderMindmapsList() {
    const allItems = [...notesCache.values()]
        .filter(n => n.value !== null && n.value.type === 'mindmap');

    if (currentView !== 'mindmaps') return;

    dom.notesList.innerHTML = '';

    allItems.sort((a, b) => {
        const ta = a.timestamp || 0;
        const tb = b.timestamp || 0;
        return tb - ta;
    });

    for (const item of allItems) {
        const el = document.createElement('div');
        el.className = 'note-item mindmap-item';
        el.dataset.id = item.id;
        if (item.id === currentMindmapId) el.classList.add('active');

        var title = item.value.title;
        if (!title) {
            if (item.value.nodes) {
                var firstKey = Object.keys(item.value.nodes)[0];
                if (firstKey) title = item.value.nodes[firstKey].topic;
            } else if (item.value.root) {
                title = item.value.root.topic;
            }
        }
        title = title || 'Untitled Mindmap';

        const dateStr = item.timestamp
            ? new Date(item.timestamp).toLocaleDateString()
            : '';

        el.innerHTML = `
            <div class="note-checkbox"></div>
            <div class="note-item-content">
                <h3><i class="ph-bold ph-graph" style="font-size: 13px; margin-right: 4px;"></i>${escapeHtml(title)}</h3>
                ${dateStr ? '<p>' + dateStr + '</p>' : ''}
            </div>
        `;

        on(el, 'click', () => {
            if (batchMode) return;
            loadMindmap(item.id);
        });

        dom.notesList.appendChild(el);
    }
}

function showMindmapCanvas() {
    dom.noteEditor.classList.remove('hidden');
    dom.editorPlaceholder.classList.add('hidden');
    mindmapDom.mindmapContainer.classList.remove('hidden');
    dom.noteContentInput.classList.add('hidden');
    dom.splitDivider.classList.add('hidden');
    dom.notePreview.classList.add('hidden');
    dom.previewBtn.classList.add('hidden');
}

function hideMindmapCanvas() {
    mindmapDom.mindmapContainer.classList.add('hidden');
    dom.noteContentInput.classList.remove('hidden');
    dom.previewBtn.classList.remove('hidden');
    destroyMindmapInstance();
}

function destroyMindmapInstance() {
    if (mindmapRenderer) {
        destroyMindmapRenderer();
        mindmapRenderer = null;
    }
}

function bootMindmapRenderer(nodes) {
    if (!nodes || Object.keys(nodes).length === 0) return;

    mindmapDom.mindmapContainer.innerHTML = '';

    mindmapRenderer = initMindmapRenderer(mindmapDom.mindmapContainer, {
        nodes: nodes,
        expansionBranches: expansionBranches,
        onNodeClick: function (id) {},
        onNodeDblClick: function (id) {
            var node = mindmapRenderer.getNodeById(id);
            if (node) openNodeEditBubble(node);
        },
        onNodeContextMenu: function (id, e) {
            showContextMenu(e, id);
        },
        onExpand: function (id, direction) {
            expandNodeDirection(id, direction);
        },
        onReset: function (id) {
            resetNodeContent(id);
        }
    });

    mindmapRenderer.toCenter();
    saveMindmap();
}

function updateTrashModal() {
    const list = document.getElementById('mindmap-trash-list');

    if (mindmapTrash.length === 0) {
        list.innerHTML = '<div class="trash-empty">Trash is empty</div>';
        return;
    }

    list.innerHTML = mindmapTrash.map(item => {
        const date = new Date(item.deletedAt).toLocaleDateString();
        return `
            <div class="trash-item" data-id="${item.id}">
                <div class="trash-item-info">
                    <div class="trash-item-title">${escapeHtml(item.title || 'Untitled')}</div>
                    <div class="trash-item-date">${date}</div>
                </div>
                <div class="trash-item-actions">
                    <button class="trash-recover-btn" data-action="recover">Recover</button>
                    <button class="trash-permanent-btn" data-action="permanent">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

function showTrashModal() {
    updateTrashModal();
    document.getElementById('mindmap-trash-modal').classList.remove('hidden');
}

function hideTrashModal() {
    document.getElementById('mindmap-trash-modal').classList.add('hidden');
}

async function recoverTrashItem(trashId) {
    const item = mindmapTrash.find(t => t.id === trashId);
    if (!item) return;

    if (currentMindmapId) {
        saveMindmap();
    }

    var mapData = item.nodeData || {};
    const note = {
        type: 'mindmap',
        title: item.title || 'Recovered Mindmap',
        nodes: mapData.nodes || {},
        expansionBranches: mapData.expansionBranches || [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };

    await db.sm.acls.set(note);

    mindmapTrash = mindmapTrash.filter(t => t.id !== trashId);

    renderMindmapsList();
    updateTrashModal();
    showToast('Mindmap recovered');
}

function permanentDeleteTrashItem(trashId) {
    mindmapTrash = mindmapTrash.filter(t => t.id !== trashId);
    updateTrashModal();
    showToast('Permanently deleted');
}

let trashModalSetup = false;

function setupTrashModal() {
    if (trashModalSetup) return;
    trashModalSetup = true;

    on(document.getElementById('mindmap-trash-btn'), 'click', showTrashModal);

    on(document.getElementById('mindmap-trash-close'), 'click', hideTrashModal);

    const modal = document.getElementById('mindmap-trash-modal');
    on(modal, 'click', (e) => {
        if (e.target === modal) hideTrashModal();
    });

    on(document.getElementById('mindmap-trash-list'), 'click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;

        const action = btn.dataset.action;
        const item = e.target.closest('.trash-item');
        if (!item) return;

        const id = item.dataset.id;

        if (action === 'recover') {
            recoverTrashItem(id);
        } else if (action === 'permanent') {
            permanentDeleteTrashItem(id);
        }
    });
}

function switchTab(view) {
    currentView = view;
    hideMindmapCanvas();
    mindmapDom.listTabNotes.classList.toggle('active', view === 'notes');
    mindmapDom.listTabMindmaps.classList.toggle('active', view === 'mindmaps');

    dom.newNoteBtn.title = view === 'mindmaps' ? 'New Mind Map' : 'New Note';
    dom.newNoteBtn.innerHTML = view === 'mindmaps'
        ? '<i class="ph-bold ph-graph"></i>'
        : '<i class="ph-bold ph-plus"></i>';

    dom.newFolderBtn.style.display = view === 'mindmaps' ? 'none' : '';

    if (view === 'notes') {
        renderNotesList();
    } else {
        renderMindmapsList();
        dom.editorPlaceholder.classList.remove('hidden');
        dom.noteEditor.classList.add('hidden');
        mindmapDom.mindmapContainer.classList.add('hidden');
    }
}

/* ========== Node Edit Bubble ========== */
function openNodeEditBubble(node) {
    editingNodeId = node.id;
    nodeEditDom.title.value = node.topic || '';
    nodeEditDom.textarea.value = node.content || '';
    nodeEditViewMode = 'edit';
    updateNodeEditView();
    var wrapper = nodeEditDom.wrapper;
    wrapper.classList.remove('hidden');
    if (wrapper.dataset.dragInit !== '1') {
        makeDragResizable(wrapper, nodeEditDom.header, 'ymind-node-edit-bubble-state', {
            onInit: function (w) { w.style.transform = 'none'; },
            onLoad: function (w) { w.style.transform = 'none'; }
        });
        wrapper.dataset.dragInit = '1';
    }
}

function closeNodeEditBubble() {
    editingNodeId = null;
    nodeEditDom.wrapper.classList.add('hidden');
}

function updateNodeEditView() {
    var textarea = nodeEditDom.textarea;
    var preview = nodeEditDom.preview;
    var previewBtn = nodeEditDom.previewBtn;
    var rawBtn = nodeEditDom.rawBtn;
    if (nodeEditViewMode === 'edit') {
        textarea.classList.remove('hidden');
        preview.classList.add('hidden');
        previewBtn.classList.remove('active');
        rawBtn.classList.remove('active');
    } else if (nodeEditViewMode === 'preview') {
        textarea.classList.add('hidden');
        preview.classList.remove('hidden');
        preview.innerHTML = marked.parse(textarea.value || '');
        previewBtn.classList.add('active');
        rawBtn.classList.remove('active');
    } else if (nodeEditViewMode === 'raw') {
        textarea.classList.remove('hidden');
        preview.classList.add('hidden');
        previewBtn.classList.remove('active');
        rawBtn.classList.add('active');
    }
}

function saveNodeEdit() {
    if (!editingNodeId) return;
    var title = nodeEditDom.title.value.trim();
    var content = nodeEditDom.textarea.value;
    if (!title) { alert('标题不能为空'); return; }
    if (mindmapRenderer) {
        mindmapRenderer.reshapeNode(editingNodeId, { topic: title, content: content });
    }
    saveMindmap();
    closeNodeEditBubble();
}

function deleteNodeFromMindmap(nodeId) {
    if (!mindmapRenderer || !currentMindmapId) { showToast('No active mindmap'); return; }
    var node = mindmapRenderer.getNodeById(nodeId);
    if (!node) { showToast('Node not found'); return; }
    if (mindmapTrash.length >= MAX_TRASH_ITEMS) mindmapTrash.shift();
    mindmapTrash.push({
        id: nodeId,
        title: node.topic || 'Untitled',
        nodeData: JSON.parse(JSON.stringify(mindmapRenderer.getData())),
        deletedAt: Date.now()
    });
    mindmapRenderer.removeNode(nodeId);
    saveMindmap();
    closeNodeEditBubble();
    showToast('Node deleted');
}

/* ========== Expansion Branch Management ========== */
function getDeepestActiveBranch() {
    for (var i = expansionBranches.length - 1; i >= 0; i--) {
        if (expansionBranches[i].active) return i;
    }
    return -1;
}

function undoLastExpansion() {
    var idx = getDeepestActiveBranch();
    if (idx < 0) { showToast('没有可返回的扩展'); return; }
    expansionBranches[idx].active = false;
    mindmapRenderer.refresh();
    saveMindmap();
}

/* ========== Node Reset ========== */
function getDefaultResetPrePrompt() {
    return `你是一个AI知识整合助手。用户需要你重写一个知识节点的内容，使其与上下游知识点更加自洽和连贯。

要求：
1. 根据提供的子节点内容，重新生成节点的标题(topic)和内容(content)
2. topic: 简短标题（≤10字），中文字
3. content: 详细解释，综合子节点内容，提炼核心概念
4. 只返回JSON对象格式，包含 topic 和 content 两个字段，不要其他内容
5. 不要添加解释或其他文字

示例返回：
{"topic":"概率论基础","content":"概率论是研究随机现象数量规律的数学分支，核心概念包括样本空间、事件、概率公理等。"}`;
}

async function resetNodeContent(nodeId) {
    if (isExpandingNode) { showToast('AI 正在处理中，请稍候...'); return; }

    var node = mindmapRenderer.getNodeById(nodeId);
    if (!node) return;
    var topic = node.topic || '';
    var content = node.content || '';

    var childTopics = [];
    var all = (node.linksLeft || []).concat(node.linksRight || []);
    all.forEach(function (cid) {
        var c = mindmapRenderer.state.nodes[cid];
        if (c && c.topic) childTopics.push(c.topic + ': ' + (c.content || ''));
    });

    var prePrompt = mindmapResetPrePrompt || getDefaultResetPrePrompt();
    var childCtx = childTopics.length > 0 ? '\n\n子节点：\n' + childTopics.join('\n---\n') : '\n\n（无子节点）';
    var fullPrompt = prePrompt + '\n\n当前节点：\n标题：' + topic + '\n内容：' + (content || '（无）') + childCtx;

    isExpandingNode = true;
    showToast('AI 重新生成中...');

    try {
        var text = await streamAIResponse(fullPrompt, {
            provider: currentProvider,
            model: currentModel
        });
        var m = text.match(/\{[\s\S]*\}/);
        if (!m) { showToast('AI 返回格式错误'); return; }
        var result = JSON.parse(m[0]);
        if (!result.topic) { showToast('AI 返回内容不完整'); return; }
        node.topic = result.topic.substring(0, 10);
        node.content = result.content || '';
        mindmapRenderer.reshapeNode(nodeId, { topic: node.topic, content: node.content });
        saveMindmap();
        showToast('节点已重置');
    } catch (e) {
        if (e.name !== 'AbortError') showToast('AI错误: ' + e.message);
    } finally { isExpandingNode = false; }
}

/* ========== AI Expand Logic ========== */
function getDefaultLeftPrePrompt() {
    return `你是一个AI学习助手。用户正在学习某个知识点，你需要帮助他们补充前置知识。

要求：
1. 返回2-4个必要的前置知识点
2. 每个知识点包含：
   - topic: 简短标题（≤10字）
   - content: 简要说明（1-2段）
3. 只返回JSON数组格式，不要其他内容
4. topic使用中文，content使用中文
5. 不要添加解释或其他文字

示例返回：
[
  {"topic":"概率基础","content":"概率论的基本概念，包括事件、样本空间、概率公理等。"},
  {"topic":"随机变量","content":"随机变量的定义、离散和连续随机变量的区别。"}
]`;
}

function getDefaultRightPrePrompt() {
    return `你是一个AI学习助手。用户正在学习某个知识点，你需要帮助他们深入探索。

要求：
1. 返回3-5个深入学习的子主题
2. 每个子主题包含：
   - topic: 简短标题（≤10字）
   - content: 详细解释（1-2段）
3. 只返回JSON数组格式，不要其他内容
4. topic使用中文，content使用中文
5. 不要添加解释或其他文字

示例返回：
[
  {"topic":"联合分布","content":"联合分布描述多个随机变量同时取值的概率规律..."},
  {"topic":"边缘分布","content":"边缘分布是从联合分布中通过求和或积分得到的单个变量的分布..."}
]`;
}

async function expandNodeDirection(nodeId, direction) {
    if (isExpandingNode) { showToast('AI 正在扩展中，请稍候...'); return; }

    var node = mindmapRenderer.getNodeById(nodeId);
    if (!node) return;

    var topic = node.topic || '';
    var content = node.content || '';
    var promptText = content || topic;

    if (!promptText.trim()) { alert('节点内容为空，无法扩展'); return; }

    var hasExisting;
    if (direction === 'left') {
        hasExisting = node.linksLeft && node.linksLeft.length > 0;
    } else {
        hasExisting = node.linksRight && node.linksRight.length > 0;
    }

    var branchIdx = -1;
    if (hasExisting) {
        branchIdx = expansionBranches.length;
        var nodes = mindmapRenderer.state.nodes;
        var pathIds = {};
        pathIds[nodeId] = true;
        var q = [nodeId];
        var qh = 0;
        while (qh < q.length) {
            var pid = q[qh++];
            var pn = nodes[pid];
            if (!pn || !pn.linksLeft) continue;
            for (var li = 0; li < pn.linksLeft.length; li++) {
                var aid = pn.linksLeft[li];
                if (!pathIds[aid]) { pathIds[aid] = true; q.push(aid); }
            }
        }
        var hiddenIds = [];
        for (var nid in nodes) {
            if (!pathIds[nid]) hiddenIds.push(nid);
        }
        expansionBranches.push({
            id: crypto.randomUUID ? crypto.randomUUID() : 'b-' + Date.now(),
            nodeId: nodeId, side: direction,
            newNodeIds: [], hiddenNodeIds: hiddenIds,
            active: false
        });
        mindmapRenderer.refresh();
    }

    isExpandingNode = true;
    var prePrompt = direction === 'left'
        ? (mindmapLeftPrePrompt || getDefaultLeftPrePrompt())
        : (mindmapRightPrePrompt || getDefaultRightPrePrompt());
    var fullPrompt = prePrompt + '\n\n当前节点信息：\n标题：' + topic + '\n内容：' + (content || '（无）');

    try {
        await doMindmapFetch(nodeId, direction, fullPrompt, branchIdx);
    } finally { isExpandingNode = false; }
}

function parseMindmapAIResponse(text) {
    try {
        let clean = text.replace(/^```json\s*/i, '').replace(/^```\s*$/im, '').trim();
        const firstBracket = clean.indexOf('[');
        const lastBracket = clean.lastIndexOf(']');
        if (firstBracket === -1 || lastBracket === -1) {
            const parsed = JSON.parse(clean);
            if (Array.isArray(parsed)) return parsed;
            return null;
        }
        const jsonStr = clean.substring(firstBracket, lastBracket + 1);
        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed)) {
            return parsed.filter(function (item) { return item.topic && item.content; });
        }
        return null;
    } catch (err) {
        console.warn('Failed to parse mindmap AI response:', err);
        return null;
    }
}

function showMindmapLoading() {
    showToast('AI 思考中...');
}

function hideMindmapLoading() {
}

async function doMindmapFetch(parentNodeId, direction, prompt, branchIdx) {
    var abortController = new AbortController();
    var fullText, nodes, j, node, nodeData;

    showMindmapLoading();

    try {
        fullText = await streamAIResponse(prompt, {
            provider: currentProvider,
            model: currentModel,
            signal: abortController.signal
        });

        hideMindmapLoading();

        nodes = parseMindmapAIResponse(fullText);
        if (!nodes || nodes.length === 0) {
            showToast('AI 未返回有效内容');
            return;
        }

        var newNodeIds = [];
        for (j = 0; j < nodes.length; j++) {
            node = nodes[j];
            var nd = createNodeData(node.topic.substring(0, 10), node.content);
            mindmapRenderer.addChild(parentNodeId, direction, nd);
            newNodeIds.push(nd.id);
        }

        if (branchIdx >= 0 && branchIdx < expansionBranches.length) {
            expansionBranches[branchIdx].newNodeIds = newNodeIds;
            expansionBranches[branchIdx].active = true;
        }
        mindmapRenderer.refresh();

        saveMindmap();

    } catch (error) {
        hideMindmapLoading();
        if (error.name === 'AbortError') {
            showToast('已取消');
        } else {
            showToast('AI错误: ' + error.message);
        }
    }
}

/* ========== Context Menu ========== */
function showContextMenu(e, nodeId) {
    e.preventDefault();
    e.stopPropagation();

    contextMenuNodeId = nodeId;

    var menu = document.getElementById('mindmap-context-menu');
    menu.classList.remove('hidden');

    var x = Math.min(e.clientX, window.innerWidth - menu.offsetWidth - 10);
    var y = Math.min(e.clientY, window.innerHeight - menu.offsetHeight - 10);
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
}

function hideContextMenu() {
    contextMenuNodeId = null;
    var menu = document.getElementById('mindmap-context-menu');
    if (menu) menu.classList.add('hidden');
}

function handleContextMenuAction(action) {
    if (!contextMenuNodeId) return;
    var nodeId = contextMenuNodeId;
    hideContextMenu();
    switch (action) {
        case 'add-left':
            addChildManual(nodeId, 'left');
            break;
        case 'add-right':
            addChildManual(nodeId, 'right');
            break;
        case 'edit': {
            var node = mindmapRenderer.getNodeById(nodeId);
            if (node) openNodeEditBubble(node);
            break;
        }
        case 'delete':
            deleteNodeFromMindmap(nodeId);
            break;
    }
}

function addChildManual(parentId, direction) {
    if (!mindmapRenderer) return;
    var newNode = createNodeData('', '');
    mindmapRenderer.addChild(parentId, direction, newNode);
    mindmapRenderer.refresh();
    saveMindmap();
    setTimeout(function () {
        var node = mindmapRenderer.getNodeById(newNode.id);
        if (node) openNodeEditBubble(node);
    }, 50);
}

function setupContextMenuListeners() {
    var canvas = document.getElementById('mindmap-container');
    if (!canvas) return;
    on(canvas, 'contextmenu', function (e) {
        var node = e.target.closest('.mm-node');
        if (node && node.getAttribute('data-node-id')) {
            showContextMenu(e, node.getAttribute('data-node-id'));
        } else {
            hideContextMenu();
        }
    });
    on(document, 'click', function (e) {
        var menu = document.getElementById('mindmap-context-menu');
        if (menu && !menu.contains(e.target)) hideContextMenu();
    });
    on(document, 'keydown', function (e) {
        if (e.key === 'Escape') hideContextMenu();
    });
}

on(document, 'DOMContentLoaded', setupContextMenuListeners);
on(document, 'DOMContentLoaded', function () {
    var backBtn = document.getElementById('mindmap-back-btn');
    if (backBtn) on(backBtn, 'click', undoLastExpansion);
});
