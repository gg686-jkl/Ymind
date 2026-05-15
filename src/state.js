/* ========== Global State ========== */

let db;
let currentUserAddress = null;
let activeNoteId = null;
let myNotesUnsubscribe = null;
let sharedNotesUnsubscribe = null;
let folderNotesUnsubscribe = null;
let mindmapUnsubscribe = null;
const notesCache = new Map();
let noteViewMode = 'edit'; // 'edit' | 'preview'
let noteOrder = [];
let batchMode = false;
let splitRatio = parseFloat(localStorage.getItem('ymind_split_ratio')) || 0.55;
const selectedNotes = new Set();
let batchShareNoteIds = null;

/* ========== Brainstorm State ========== */

let brainstormAbortController = null;
let brainstormResultText = '';
let lastEnterTime = 0;
let currentProvider = 'deepseek';
let currentModel = 'deepseek-v4-flash';
let bubbleViewMode = 'preview';
let currentAiIndex = -1;
let currentAiOutputs = [];

/* ========== Mindmap State ========== */
let currentMindmapId = null;
let mindmapRenderer = null;
let mindmapTrash = []; // {id, nodeData, deletedAt} max 5
let currentView = 'notes'; // 'notes' | 'mindmaps'
let editingNodeId = null; // 当前编辑的节点ID
let contextMenuNodeId = null; // 当前右键菜单对应的节点ID
let nodeEditViewMode = 'edit'; // 'edit' | 'preview' | 'raw'
let mindmapLeftPrePrompt = '';
let mindmapRightPrePrompt = '';
let mindmapResetPrePrompt = '';
let isExpandingNode = false;
let expansionBranches = [];
