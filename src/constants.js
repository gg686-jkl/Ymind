/* ========== Application Constants ========== */

/* --- Mindmap Rendering --- */
var NODE_PADDING_X = 16;
var NODE_PADDING_Y = 6;
var NODE_FONT_SIZE = 14;
var NODE_MIN_WIDTH = 60;
var LEVEL_GAP_X = 100;
var SIBLING_GAP_Y = 20;
var NODE_HEIGHT = 36;

/* --- Zoom & Pan --- */
var ZOOM_MIN = 0.2;
var ZOOM_MAX = 2;
var ZOOM_STEP = 0.1;

/* --- Layout Defaults --- */
var DEFAULT_CENTER_X = 400;
var DEFAULT_CENTER_Y = 300;
var CTRL_OFFSET_FACTOR = 0.4;
var STROKE_WIDTH = 1.5;

/* --- History --- */
var MAX_HISTORY_LENGTH = 50;

/* --- Trash --- */
var MAX_TRASH_ITEMS = 5;

/* --- Access Control --- */
var CUSTOM_ROLES = {
    superadmin: { can: ["assignRole", "delete", "write"], inherits: ["admin"] },
    admin: { can: ["delete"], inherits: ["user"] },
    user: { can: ["write"], inherits: ["guest"] },
    guest: { can: ["read", "write", "sync"] },
};

var SUPERADMIN_ADDRESSES = CONFIG.SUPERADMIN_ADDRESSES;
