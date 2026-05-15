/* ========== Mindmap Renderer - DAG Pointer Model ========== */
// NODE_PADDING_X, NODE_PADDING_Y, NODE_FONT_SIZE, NODE_MIN_WIDTH,
// LEVEL_GAP_X, SIBLING_GAP_Y, NODE_HEIGHT are defined in constants.js

var mindmapState = null;

// Cached canvas context for text measurement (Item 8)
var _measureCtx = null;

function measureText(topic) {
    if (!topic) return NODE_MIN_WIDTH;
    if (!_measureCtx) {
        var c = document.createElement('canvas');
        _measureCtx = c.getContext('2d');
    }
    _measureCtx.font = NODE_FONT_SIZE + 'px -apple-system, sans-serif';
    var w = _measureCtx.measureText(topic).width + NODE_PADDING_X * 2;
    return Math.max(w, NODE_MIN_WIDTH);
}

function createNodeData(topic, content) {
    return {
        id: crypto.randomUUID ? crypto.randomUUID() : 'n-' + Date.now(),
        topic: topic || '',
        content: content || '',
        linksLeft: [],
        linksRight: [],
        leftCollapsed: false,
        rightCollapsed: false
    };
}

/* ========== Migration: Tree Model → DAG Pointer Model ========== */

function migrateOldRootToNodes(oldRoot) {
    var nodes = {};
    function walk(node) {
        if (!node || !node.id) return;
        var newNode = {
            id: node.id,
            topic: node.topic || '',
            content: node.content || '',
            linksLeft: [],
            linksRight: [],
            leftCollapsed: node.leftCollapsed || false,
            rightCollapsed: node.rightCollapsed || false,
            hidden: node.hidden || false
        };
        nodes[newNode.id] = newNode;

        // leftChildren: the parent (current node) is to the RIGHT of its leftChildren
        // So leftChildren[i] --> current node  (left→right)
        if (node.leftChildren) {
            for (var i = 0; i < node.leftChildren.length; i++) {
                var child = node.leftChildren[i];
                walk(child);
                newNode.linksLeft.push(child.id);
            }
        }

        // rightChildren: current node --> rightChildren[i]  (left→right)
        if (node.rightChildren) {
            for (var i = 0; i < node.rightChildren.length; i++) {
                var child = node.rightChildren[i];
                walk(child);
                newNode.linksRight.push(child.id);
            }
        }
    }
    walk(oldRoot);

    // Ensure bidirectional consistency: if A.linksRight has B, B.linksLeft must have A
    for (var id in nodes) {
        var node = nodes[id];
        for (var i = 0; i < node.linksRight.length; i++) {
            var childId = node.linksRight[i];
            if (nodes[childId] && nodes[childId].linksLeft.indexOf(id) === -1) {
                nodes[childId].linksLeft.push(id);
            }
        }
    }

    return nodes;
}

/* ========== Layout Engine (DAG Two-Pass) ========== */

function findRootNodes(nodesMap) {
    var roots = [];
    for (var id in nodesMap) {
        var node = nodesMap[id];
        if (!node.linksLeft || node.linksLeft.length === 0) {
            roots.push(node);
        }
    }
    return roots;
}

function calcSizes(nodesMap) {
    for (var id in nodesMap) {
        var node = nodesMap[id];
        if (!node._visible) {
            node._width = 0;
            node._height = 0;
        } else {
            node._width = measureText(node.topic);
            node._height = NODE_HEIGHT;
        }
    }
}

function placeNewNodes(nodesMap) {
    var newNodes = [];
    for (var id in nodesMap) {
        var nd = nodesMap[id];
        if (nd._visible && (nd._x === undefined || nd._y === undefined)) {
            newNodes.push(nd);
        }
    }
    if (newNodes.length === 0) return;

    // Initialize positions near connected visible nodes
    for (var idx1 = 0; idx1 < newNodes.length; idx1++) {
        var node = newNodes[idx1];
        var bestX = null, bestY = null;
        // Check linksLeft (parents to left of node)
        var leftLinks = node.linksLeft || [];
        for (var pIdx = 0; pIdx < leftLinks.length; pIdx++) {
            var par = nodesMap[leftLinks[pIdx]];
            if (par && par._visible && par._x !== undefined) {
                bestX = par._x + par._width + LEVEL_GAP_X;
                bestY = par._y;
                break;
            }
        }
        // If no left parent, check linksRight (children to right of node)
        if (bestX === null) {
            var rightLinks = node.linksRight || [];
            for (var cIdx = 0; cIdx < rightLinks.length; cIdx++) {
                var chd = nodesMap[rightLinks[cIdx]];
                if (chd && chd._visible && chd._x !== undefined) {
                    bestX = chd._x - LEVEL_GAP_X - (node._width || NODE_MIN_WIDTH);
                    bestY = chd._y;
                    break;
                }
            }
        }
        if (bestX !== null) {
            node._x = bestX;
            node._y = bestY + (idx1 - newNodes.length / 2) * (NODE_HEIGHT + SIBLING_GAP_Y);
        } else {
            node._x = DEFAULT_CENTER_X;
            node._y = DEFAULT_CENTER_Y;
        }
    }

    // Force iterations
    for (var iter = 0; iter < 10; iter++) {
        for (var i = 0; i < newNodes.length; i++) {
            var ni = newNodes[i];
            var fx = 0, fy = 0;
            // Repulsion from other new nodes
            for (var j = 0; j < newNodes.length; j++) {
                if (i === j) continue;
                var nj = newNodes[j];
                var dx = ni._x - nj._x;
                var dy = ni._y - nj._y;
                var dist = Math.sqrt(dx * dx + dy * dy) || 1;
                var force = 5000 / (dist * dist);
                fx += (dx / dist) * force;
                fy += (dy / dist) * force;
            }
            // Attraction to connected visible nodes
            var parents = ni.linksLeft || [];
            for (var pi = 0; pi < parents.length; pi++) {
                var p = nodesMap[parents[pi]];
                if (!p || !p._visible || p._x === undefined) continue;
                fx += (p._x + p._width + LEVEL_GAP_X - ni._x) * 0.1;
                fy += (p._y - ni._y) * 0.1;
            }
            var children = ni.linksRight || [];
            for (var ci = 0; ci < children.length; ci++) {
                var c = nodesMap[children[ci]];
                if (!c || !c._visible || c._x === undefined) continue;
                fx += (c._x - LEVEL_GAP_X - (ni._width || NODE_MIN_WIDTH) - ni._x) * 0.1;
                fy += (c._y - ni._y) * 0.1;
            }
            ni._x += fx * 0.1;
            ni._y += fy * 0.1;
        }
    }
}

function computeVisibility(nodesMap, expansionBranches) {
    // Build hidden/forceVisible maps from active expansion branches
    var hiddenMap = {};
    var forceVisible = {};
    if (expansionBranches) {
        for (var i = 0; i < expansionBranches.length; i++) {
            var branch = expansionBranches[i];
            if (!branch.active) continue;
            if (branch.hiddenNodeIds) {
                for (var j = 0; j < branch.hiddenNodeIds.length; j++) {
                    hiddenMap[branch.hiddenNodeIds[j]] = true;
                }
            }
            if (branch.newNodeIds) {
                for (var k = 0; k < branch.newNodeIds.length; k++) {
                    forceVisible[branch.newNodeIds[k]] = true;
                }
            }
        }
    }

    // Find all nodes with no linksLeft as potential roots
    var roots = [];
    for (var id in nodesMap) {
        if (!nodesMap[id].linksLeft || nodesMap[id].linksLeft.length === 0) {
            roots.push(nodesMap[id]);
        }
    }

    // Reset visibility and layer
    for (var id in nodesMap) {
        nodesMap[id]._visible = false;
        nodesMap[id]._layer = null;
    }

    if (roots.length === 0) return { minLayer: 0, maxLayer: 0, layers: {} };

    // BFS right: follow linksRight from roots, stop at rightCollapsed or expansion-hidden
    var queue = roots.slice();
    var head = 0;
    for (var r = 0; r < roots.length; r++) {
        roots[r]._visible = true;
        roots[r]._layer = 0;
    }

    while (head < queue.length) {
        var node = queue[head++];
        // Don't traverse through rightCollapsed nodes (unless force-visible)
        if (node.rightCollapsed && !forceVisible[node.id]) continue;
        // Don't traverse through expansion-hidden nodes (unless force-visible)
        if (hiddenMap[node.id] && !forceVisible[node.id]) continue;

        var links = node.linksRight || [];
        for (var i = 0; i < links.length; i++) {
            var child = nodesMap[links[i]];
            if (!child) continue;
            if (!child._visible) {
                child._visible = true;
                child._layer = node._layer + 1;
                queue.push(child);
            }
        }
    }

    // BFS left: follow linksLeft from all visible nodes, stop at leftCollapsed or expansion-hidden
    queue = [];
    head = 0;
    for (var id in nodesMap) {
        if (nodesMap[id]._visible) queue.push(nodesMap[id]);
    }

    while (head < queue.length) {
        var node = queue[head++];
        // Don't traverse through leftCollapsed nodes (unless force-visible)
        if (node.leftCollapsed && !forceVisible[node.id]) continue;
        // Don't traverse through expansion-hidden nodes (unless force-visible)
        if (hiddenMap[node.id] && !forceVisible[node.id]) continue;

        var links = node.linksLeft || [];
        for (var i = 0; i < links.length; i++) {
            var parent = nodesMap[links[i]];
            if (!parent) continue;
            if (!parent._visible) {
                parent._visible = true;
                parent._layer = node._layer - 1;
                queue.push(parent);
            }
        }
    }

    // Force-visible nodes: mark visible even if unreachable via BFS (for newNodeIds)
    for (var id in forceVisible) {
        if (nodesMap[id] && !nodesMap[id]._visible) {
            nodesMap[id]._visible = true;
            // Try to assign a layer: use the first connected visible neighbor as anchor
            var n = nodesMap[id];
            var allLinks = (n.linksLeft || []).concat(n.linksRight || []);
            for (var li = 0; li < allLinks.length; li++) {
                var neighbor = nodesMap[allLinks[li]];
                if (neighbor && neighbor._layer !== null) {
                    n._layer = neighbor._layer;
                    break;
                }
            }
            if (n._layer === null) n._layer = 0;
        }
    }

    // Ensure all visible nodes have default width/height before positioning
    for (var id in nodesMap) {
        var n = nodesMap[id];
        if (n._visible) {
            if (!n._width) n._width = measureText(n.topic);
            if (!n._height) n._height = NODE_HEIGHT;
        }
    }

    // Hybrid layout: preserve existing node positions, use force-directed for new nodes
    var _newCnt = 0, _existCnt = 0;
    for (var _nid in nodesMap) {
        var _nd = nodesMap[_nid];
        if (_nd._visible) {
            if (_nd._x !== undefined && _nd._y !== undefined) { _existCnt++; }
            else { _newCnt++; }
        }
    }

    if (_existCnt > 0) {
        // Keep existing positions; use force-directed placement for new nodes only
        if (_newCnt > 0) placeNewNodes(nodesMap);

        // Build layer reference map (skip layer-based positioning — positions are already set)
        var _layers = {};
        var _minL = Infinity, _maxL = -Infinity;
        for (var _lid in nodesMap) {
            var _ln = nodesMap[_lid];
            if (!_ln._visible || _ln._layer === null) continue;
            if (!_layers[_ln._layer]) _layers[_ln._layer] = [];
            _layers[_ln._layer].push(_ln);
            if (_ln._layer < _minL) _minL = _ln._layer;
            if (_ln._layer > _maxL) _maxL = _ln._layer;
        }
        if (!isFinite(_minL)) { _minL = 0; _maxL = 0; _layers = { 0: [] }; }
        return { minLayer: _minL, maxLayer: _maxL, layers: _layers };
    }

    // All visible nodes are new — use full layer-based layout
    // Group by layer
    var layers = {};
    var minLayer = Infinity;
    var maxLayer = -Infinity;
    for (var id in nodesMap) {
        var node = nodesMap[id];
        if (!node._visible || node._layer === null) continue;
        if (!layers[node._layer]) layers[node._layer] = [];
        layers[node._layer].push(node);
        if (node._layer < minLayer) minLayer = node._layer;
        if (node._layer > maxLayer) maxLayer = node._layer;
    }

    if (!isFinite(minLayer)) {
        minLayer = 0;
        maxLayer = 0;
        layers = { 0: [] };
    }

    // Compute max width per layer
    var layerMaxWidth = {};
    for (var l = minLayer; l <= maxLayer; l++) {
        var maxW = 0;
        var layerNodes = layers[l] || [];
        for (var j = 0; j < layerNodes.length; j++) {
            if (layerNodes[j]._width > maxW) maxW = layerNodes[j]._width;
        }
        layerMaxWidth[l] = maxW;
    }

    // Position x: right side (layer >= 0)
    var centerX = mindmapState ? (mindmapState._centerX || DEFAULT_CENTER_X) : DEFAULT_CENTER_X;
    var rightEdge = centerX;
    for (var l = 0; l <= maxLayer; l++) {
        var layerNodes = layers[l] || [];
        var maxW = layerMaxWidth[l] || 0;
        var x = (l === 0) ? centerX : rightEdge + LEVEL_GAP_X;
        for (var j = 0; j < layerNodes.length; j++) {
            layerNodes[j]._x = x;
        }
        rightEdge = x + maxW;
    }

    // Position x: left side (layer < 0)
    var leftEdge = centerX;
    for (var l = -1; l >= minLayer; l--) {
        var layerNodes = layers[l] || [];
        var maxW = layerMaxWidth[l] || 0;
        var x = leftEdge - LEVEL_GAP_X - maxW;
        for (var j = 0; j < layerNodes.length; j++) {
            layerNodes[j]._x = x;
        }
        leftEdge = x;
    }

    // Position y: vertical stacking per layer, centered around centerY
    var centerY = mindmapState ? (mindmapState._centerY || DEFAULT_CENTER_Y) : DEFAULT_CENTER_Y;
    for (var l = minLayer; l <= maxLayer; l++) {
        var layerNodes = layers[l] || [];
        for (var j = 0; j < layerNodes.length; j++) {
            if (!layerNodes[j]._height) layerNodes[j]._height = NODE_HEIGHT;
        }
        var totalH = 0;
        for (var j = 0; j < layerNodes.length; j++) {
            totalH += layerNodes[j]._height + SIBLING_GAP_Y;
        }
        if (totalH > 0) totalH -= SIBLING_GAP_Y;

        var startY = centerY - totalH / 2;
        for (var j = 0; j < layerNodes.length; j++) {
            var node = layerNodes[j];
            node._y = startY;
            startY += node._height + SIBLING_GAP_Y;
        }
    }

    return { minLayer: minLayer, maxLayer: maxLayer, layers: layers };
}

/* ========== Rendering ========== */

function buildLines(svg, nodesMap, state) {
    var NS = 'http://www.w3.org/2000/svg';
    for (var id in nodesMap) {
        var node = nodesMap[id];
        if (!node._visible) continue;

        var px = node._x + node._width;
        var py = node._y + node._height / 2;

        // Draw lines to linksRight (outgoing to the right)
        if (!node.rightCollapsed && node.linksRight) {
            for (var i = 0; i < node.linksRight.length; i++) {
                var childId = node.linksRight[i];
                var child = nodesMap[childId];
                if (!child || !child._visible) continue;

        var cx = child._x;
        var cy = child._y + child._height / 2;
        var ctrlOffset = LEVEL_GAP_X * CTRL_OFFSET_FACTOR;

        var d = 'M ' + px + ' ' + py +
            ' C ' + (px + ctrlOffset) + ' ' + py +
            ' ' + (cx - ctrlOffset) + ' ' + cy +
            ' ' + cx + ' ' + cy;

        var path = document.createElementNS(NS, 'path');
        path.setAttribute('d', d);
        path.setAttribute('stroke', '#aaa');
        path.setAttribute('stroke-width', STROKE_WIDTH);
                path.setAttribute('fill', 'none');
                path.setAttribute('data-source', node.id);
                path.setAttribute('data-target', childId);
                svg.appendChild(path);
                var edgeKey = node.id + '|' + childId;
                state._edgePathMap[edgeKey] = path;
            }
        }


    }
}

function handleNodeHover(node, state) {
    var container = state.container;
    var svg = state.linesSvg;
    var nodes = state.nodes;

    container.classList.add('mm-hover');

    for (var nid in nodes) {
        var nn = nodes[nid];
        if (nn._el) nn._el.classList.remove('mm-hover-hi');
    }
    var oldPaths = svg.querySelectorAll('.mm-hover-line');
    for (var pi = 0; pi < oldPaths.length; pi++) {
        oldPaths[pi].classList.remove('mm-hover-line');
    }

    // Build blocked edges: 1) parent→sibling  2) co-parent→shared child
    var blockedEdges = {};
    var parents = node.linksLeft || [];
    for (var pi = 0; pi < parents.length; pi++) {
        var parentId = parents[pi];
        var parent = nodes[parentId];
        if (!parent) continue;
        var siblings = parent.linksRight || [];
        for (var si = 0; si < siblings.length; si++) {
            if (siblings[si] !== node.id) {
                blockedEdges[parentId + '|' + siblings[si]] = true;
            }
        }
    }
    var children = node.linksRight || [];
    for (var ci = 0; ci < children.length; ci++) {
        var childId = children[ci];
        var child = nodes[childId];
        if (!child) continue;
        var coParents = child.linksLeft || [];
        for (var cpi = 0; cpi < coParents.length; cpi++) {
            if (coParents[cpi] !== node.id) {
                blockedEdges[coParents[cpi] + '|' + childId] = true;
            }
        }
    }

    // BFS from hovered node, respecting blocked edges
    var visited = {};
    var edges = {};
    var queue = [node.id];
    visited[node.id] = true;
    var head = 0;
    while (head < queue.length) {
        var curId = queue[head++];
        var cur = nodes[curId];
        if (!cur) continue;
        if (cur._el) cur._el.classList.add('mm-hover-hi');

        var right = cur.linksRight || [];
        for (var ri = 0; ri < right.length; ri++) {
            var childId = right[ri];
            if (blockedEdges[curId + '|' + childId]) continue;
            edges[curId + '|' + childId] = true;
            if (!visited[childId]) {
                visited[childId] = true;
                queue.push(childId);
            }
        }

        var left = cur.linksLeft || [];
        for (var li = 0; li < left.length; li++) {
            var neighborId = left[li];
            if (blockedEdges[neighborId + '|' + curId]) continue;
            edges[neighborId + '|' + curId] = true;
            if (!visited[neighborId]) {
                visited[neighborId] = true;
                queue.push(neighborId);
            }
        }
    }

    var edgeMap = state._edgePathMap;
    for (var edgeKey in edges) {
        if (edgeMap && edgeMap[edgeKey]) {
            edgeMap[edgeKey].classList.add('mm-hover-line');
        }
    }
}

function createNodeElement(node, container) {
    var el = document.createElement('div');
    el.className = 'mm-node';
    el.setAttribute('data-node-id', node.id);
    el.style.left = node._x + 'px';
    el.style.top = node._y + 'px';
    el.style.width = node._width + 'px';
    el.style.height = node._height + 'px';

    var text = document.createElement('span');
    text.className = 'mm-topic';
    text.textContent = node.topic || '(空)';
    el.appendChild(text);

    // Collapse toggle - left side (linksLeft)
    if (node.linksLeft && node.linksLeft.length > 0) {
        var lc = document.createElement('span');
        lc.className = 'mm-collapse mm-collapse-left';
        lc.textContent = node.leftCollapsed ? '\u25B2' : '\u25C0';
        lc.title = (node.leftCollapsed ? '展开' : '折叠') + '左侧 (' + node.linksLeft.length + ')';
        lc.onclick = function (e) {
            e.stopPropagation();
            e.preventDefault();
            node.leftCollapsed = !node.leftCollapsed;
            if (mindmapState) renderAll(mindmapState);
        };
        el.appendChild(lc);
    }

    // Collapse toggle - right side (linksRight)
    if (node.linksRight && node.linksRight.length > 0) {
        var rc = document.createElement('span');
        rc.className = 'mm-collapse mm-collapse-right';
        rc.textContent = node.rightCollapsed ? '\u25B2' : '\u25B6';
        rc.title = (node.rightCollapsed ? '展开' : '折叠') + '右侧 (' + node.linksRight.length + ')';
        rc.onclick = function (e) {
            e.stopPropagation();
            e.preventDefault();
            node.rightCollapsed = !node.rightCollapsed;
            if (mindmapState) renderAll(mindmapState);
        };
        el.appendChild(rc);
    }

    container.appendChild(el);
    node._el = el;

    el.addEventListener('mouseenter', function () {
        if (mindmapState) handleNodeHover(node, mindmapState);
    });

    el.addEventListener('mouseleave', function () {
        if (!mindmapState) return;
        var c = mindmapState.container;
        var svg = mindmapState.linesSvg;
        var nodes = mindmapState.nodes;

        c.classList.remove('mm-hover');

        for (var nid in nodes) {
            var nn = nodes[nid];
            if (nn._el) nn._el.classList.remove('mm-hover-hi');
        }

        var oldPaths = svg.querySelectorAll('.mm-hover-line');
        for (var pi = 0; pi < oldPaths.length; pi++) {
            oldPaths[pi].classList.remove('mm-hover-line');
        }
    });

    return el;
}

function renderAll(state) {
    var svg = state.linesSvg;
    var nodesContainer = state.nodesDiv;

    var nodesMap = state.nodes;
    if (!nodesMap || Object.keys(nodesMap).length === 0) return;

    state._centerX = state._centerX || DEFAULT_CENTER_X;
    state._centerY = state._centerY || DEFAULT_CENTER_Y;

    computeVisibility(nodesMap, state.expansionBranches);
    calcSizes(nodesMap);

    for (var id in nodesMap) {
        var node = nodesMap[id];
        if (node._visible) {
            if (node._el) {
                node._el.style.left = node._x + 'px';
                node._el.style.top = node._y + 'px';
                node._el.style.width = node._width + 'px';
                node._el.style.height = node._height + 'px';
                var topicSpan = node._el.querySelector('.mm-topic');
                if (topicSpan) {
                    topicSpan.textContent = node.topic || '(空)';
                }
                var leftBtn = node._el.querySelector('.mm-collapse-left');
                if (leftBtn) {
                    leftBtn.textContent = node.leftCollapsed ? '\u25B2' : '\u25C0';
                    leftBtn.title = (node.leftCollapsed ? '展开' : '折叠') + '左侧 (' + (node.linksLeft ? node.linksLeft.length : 0) + ')';
                }
                var rightBtn = node._el.querySelector('.mm-collapse-right');
                if (rightBtn) {
                    rightBtn.textContent = node.rightCollapsed ? '\u25B2' : '\u25B6';
                    rightBtn.title = (node.rightCollapsed ? '展开' : '折叠') + '右侧 (' + (node.linksRight ? node.linksRight.length : 0) + ')';
                }
            } else {
                createNodeElement(node, nodesContainer);
            }
        } else {
            if (node._el) {
                node._el.remove();
                node._el = null;
            }
        }
    }

    svg.innerHTML = '';
    state._edgePathMap = {};
    buildLines(svg, nodesMap, state);
    injectNodeButtons(state);
}

function injectNodeButtons(state) {
    var nodesDiv = state.nodesDiv;
    if (!nodesDiv) return;

    nodesDiv.querySelectorAll('.mm-expand-btn').forEach(function (b) { b.remove(); });
    nodesDiv.querySelectorAll('.mm-reset-btn').forEach(function (b) { b.remove(); });

    var nodeEls = nodesDiv.querySelectorAll('.mm-node');
    nodeEls.forEach(function (el) {
        var nodeId = el.getAttribute('data-node-id');
        if (!nodeId) return;

        // Left expand button
        var lb = document.createElement('button');
        lb.className = 'mm-expand-btn mm-expand-left';
        lb.innerHTML = '&#8592;';
        lb.title = '左扩展（前置知识）';
        lb.onclick = function (e) { e.stopPropagation(); if (state.onExpand) state.onExpand(nodeId, 'left'); };
        el.appendChild(lb);

        // Right expand button
        var rb = document.createElement('button');
        rb.className = 'mm-expand-btn mm-expand-right';
        rb.innerHTML = '&#8594;';
        rb.title = '右扩展（深入探索）';
        rb.onclick = function (e) { e.stopPropagation(); if (state.onExpand) state.onExpand(nodeId, 'right'); };
        el.appendChild(rb);

        // Reset button
        var resb = document.createElement('button');
        resb.className = 'mm-expand-btn mm-reset-btn';
        resb.innerHTML = '<i class="ph-bold ph-arrow-counter-clockwise"></i>';
        resb.title = '重置节点';
        resb.onclick = function (e) { e.stopPropagation(); if (state.onReset) state.onReset(nodeId); };
        el.appendChild(resb);
    });
}

/* ========== Zoom & Pan ========== */

function setupZoomPan(state) {
    var container = state.container;
    var mapEl = state.mapEl;
    var scale = 1;
    var tx = 0, ty = 0;
    var panning = false, px = 0, py = 0;

    function updateTransform() {
        mapEl.style.transform = 'translate(' + tx + 'px, ' + ty + 'px) scale(' + scale + ')';
    }

    container.addEventListener('wheel', function (e) {
        e.preventDefault();
        var ds = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        var ns = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, scale + ds));
        var rect = container.getBoundingClientRect();
        var mx = e.clientX - rect.left;
        var my = e.clientY - rect.top;
        tx -= (mx - tx) * (ns / scale - 1);
        ty -= (my - ty) * (ns / scale - 1);
        scale = ns;
        updateTransform();
    }, { passive: false });

    container.addEventListener('mousedown', function (e) {
        if (e.target.closest('.mm-node') || e.target.closest('button')) return;
        panning = true;
        px = e.clientX - tx;
        py = e.clientY - ty;
        container.style.cursor = 'grabbing';
    });

    state._zoomMoveHandler = function (e) {
        if (!panning) return;
        tx = e.clientX - px;
        ty = e.clientY - py;
        updateTransform();
    };
    window.addEventListener('mousemove', state._zoomMoveHandler);

    state._zoomUpHandler = function () {
        panning = false;
        if (state.container) state.container.style.cursor = '';
    };
    window.addEventListener('mouseup', state._zoomUpHandler);

    state._getTransform = function () { return { scale: scale, tx: tx, ty: ty }; };
    state._setTransform = function (s, x, y) { scale = s; tx = x; ty = y; updateTransform(); };
    state._toCenter = function () {
        var cw = container.clientWidth;
        var ch = container.clientHeight;
        tx = cw / 2 - DEFAULT_CENTER_X * scale;
        ty = ch / 2 - DEFAULT_CENTER_Y * scale;
        updateTransform();
    };
}

/* ========== Undo/Redo ========== */

function pushHistory(state) {
    if (!state._history) state._history = [];
    state._history.push(JSON.parse(JSON.stringify(state.nodes)));
    if (state._history.length > MAX_HISTORY_LENGTH) state._history.shift();
    state._historyIdx = state._history.length - 1;
}

function undo(state) {
    if (!state._history || state._historyIdx <= 0) return false;
    state._historyIdx--;
    state.nodes = JSON.parse(JSON.stringify(state._history[state._historyIdx]));
    return true;
}

function redo(state) {
    if (!state._history || state._historyIdx >= state._history.length - 1) return false;
    state._historyIdx++;
    state.nodes = JSON.parse(JSON.stringify(state._history[state._historyIdx]));
    return true;
}

/* ========== Public API ========== */

function initMindmapRenderer(containerEl, options) {
    if (mindmapState) destroyMindmapRenderer();

    // Handle backward compatibility: old format has 'root', new format has 'nodes'
    var nodesMap = null;
    if (options.nodes) {
        nodesMap = options.nodes;
    } else if (options.root) {
        // Migrate old tree format to DAG nodes map
        nodesMap = migrateOldRootToNodes(options.root);
    } else {
        nodesMap = {};
    }

    var state = {
        container: containerEl,
        nodes: nodesMap,
        expansionBranches: options.expansionBranches || [],
        onNodeClick: options.onNodeClick || null,
        onNodeDblClick: options.onNodeDblClick || null,
        onNodeContextMenu: options.onNodeContextMenu || null,
        onExpand: options.onExpand || null,
        onReset: options.onReset || null,
        _history: [],
        _historyIdx: -1,
        _centerX: DEFAULT_CENTER_X,
        _centerY: DEFAULT_CENTER_Y
    };

    containerEl.innerHTML = '';
    containerEl.style.position = 'relative';
    containerEl.style.overflow = 'hidden';
    containerEl.style.cursor = '';

    var mapEl = document.createElement('div');
    mapEl.className = 'mm-map';
    mapEl.style.position = 'absolute';
    mapEl.style.top = '0';
    mapEl.style.left = '0';
    mapEl.style.width = '100%';
    mapEl.style.height = '100%';
    mapEl.style.transformOrigin = '0 0';

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'mm-lines');
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.pointerEvents = 'none';
    svg.style.overflow = 'visible';

    var nodesDiv = document.createElement('div');
    nodesDiv.className = 'mm-nodes';
    nodesDiv.style.position = 'absolute';
    nodesDiv.style.top = '0';
    nodesDiv.style.left = '0';

    mapEl.appendChild(svg);
    mapEl.appendChild(nodesDiv);
    containerEl.appendChild(mapEl);

    state.mapEl = mapEl;
    state.linesSvg = svg;
    state.nodesDiv = nodesDiv;

    nodesDiv.addEventListener('click', function(e) {
        var nodeEl = e.target.closest('.mm-node');
        if (!nodeEl) return;
        var nodeId = nodeEl.getAttribute('data-node-id');
        if (mindmapState && mindmapState.onNodeClick) mindmapState.onNodeClick(nodeId, e);
    });

    nodesDiv.addEventListener('dblclick', function(e) {
        var nodeEl = e.target.closest('.mm-node');
        if (!nodeEl) return;
        e.stopPropagation();
        var nodeId = nodeEl.getAttribute('data-node-id');
        if (mindmapState && mindmapState.onNodeDblClick) mindmapState.onNodeDblClick(nodeId, e);
    });

    nodesDiv.addEventListener('contextmenu', function(e) {
        var nodeEl = e.target.closest('.mm-node');
        if (!nodeEl) return;
        var nodeId = nodeEl.getAttribute('data-node-id');
        if (mindmapState && mindmapState.onNodeContextMenu) mindmapState.onNodeContextMenu(nodeId, e);
    });

    setupZoomPan(state);

    containerEl.addEventListener('mouseleave', function () {
        containerEl.classList.remove('mm-hover');
    });
    mindmapState = state;

    if (Object.keys(nodesMap).length > 0) {
        state._centerX = containerEl.clientWidth / 2;
        state._centerY = containerEl.clientHeight / 2;
        pushHistory(state);
        renderAll(state);
        state._toCenter();
    }

    return {
        state: state,
        addChild: function (parentId, side, nodeData) {
            var nodes = state.nodes;
            if (!nodes[parentId]) return;

            // Ensure bidirectional link consistency
            if (side === 'right') {
                // parent → newNode (parent left, newNode right)
                if (!nodes[parentId].linksRight) nodes[parentId].linksRight = [];
                nodes[parentId].linksRight.push(nodeData.id);
                if (!nodeData.linksLeft) nodeData.linksLeft = [];
                nodeData.linksLeft.push(parentId);
            } else {
                // newNode → parent (newNode left, parent right)
                if (!nodeData.linksRight) nodeData.linksRight = [];
                nodeData.linksRight.push(parentId);
                if (!nodes[parentId].linksLeft) nodes[parentId].linksLeft = [];
                nodes[parentId].linksLeft.push(nodeData.id);
            }

            nodes[nodeData.id] = nodeData;
            pushHistory(state);
            state._dirty = true;
        },
        removeNode: function (nodeId) {
            if (!state.nodes[nodeId]) return;

            // Check if it's the only root - disallow removal
            var roots = findRootNodes(state.nodes);
            if (roots.length === 1 && roots[0].id === nodeId) return;

            // Remove from nodes map
            delete state.nodes[nodeId];

            // Clean up all link references to this node
            for (var id in state.nodes) {
                var n = state.nodes[id];
                if (n.linksLeft) {
                    n.linksLeft = n.linksLeft.filter(function (lid) { return lid !== nodeId; });
                }
                if (n.linksRight) {
                    n.linksRight = n.linksRight.filter(function (rid) { return rid !== nodeId; });
                }
            }

            pushHistory(state);
            renderAll(state);
        },
        reshapeNode: function (nodeId, patch) {
            var node = state.nodes[nodeId];
            if (!node) return;
            if (patch.topic !== undefined) node.topic = patch.topic;
            if (patch.content !== undefined) node.content = patch.content;
            renderAll(state);
        },
        getData: function () {
            return {
                nodes: JSON.parse(JSON.stringify(state.nodes)),
                expansionBranches: JSON.parse(JSON.stringify(state.expansionBranches || []))
            };
        },
        refresh: function () {
            renderAll(state);
        },
        getNodeById: function (id) {
            return state.nodes[id] || null;
        },
        toCenter: function () {
            state._toCenter();
        }
    };
}

function destroyMindmapRenderer() {
    if (mindmapState) {
        if (mindmapState._zoomMoveHandler) window.removeEventListener('mousemove', mindmapState._zoomMoveHandler);
        if (mindmapState._zoomUpHandler) window.removeEventListener('mouseup', mindmapState._zoomUpHandler);
    }
    mindmapState = null;
}
