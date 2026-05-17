# Ymind

Ymind is a zero-account, decentralized mindmap and notes application featuring AI brainstorming. Your data lives directly in your browser using IndexedDB. It syncs peer-to-peer without any central server. Identity relies on a BIP39 mnemonic phrase with optional passkey support and E2EE encryption.

## Key Features

### Custom DAG Mindmap
We built a custom Directed Acyclic Graph renderer from scratch. 
* **DAG Data Model**: Nodes can have multiple parents. This creates complex knowledge graphs instead of simple trees.
* **Bidirectional AI Expansion**: Expand left for prerequisite knowledge or right for deep-dive topics. The AI generates structured child nodes.
* **Path-Isolation Hover**: Hover over any node to dim everything except its connected path using a sibling-cut algorithm.
* **Interactive Design**: Features independent left and right collapse toggles, bezier curve connections, scroll zoom, and mouse pan.
* **Undo & Reset**: Step-by-step back button for AI expansions. You can also regenerate node content based on child context.

### Decentralized Sync
Ymind uses GenosDB for serverless P2P syncing. It works fully offline and auto-merges data when you reconnect. You can set granular read and write permissions per address using ACL sharing.

### AI Brainstorming
Access over 24 different LLM providers like DeepSeek, OpenAI, Anthropic, and Gemini. Type `?` in your note and hit Enter twice to trigger an AI response with full context. Select text and press Ctrl+Enter to focus the AI on a specific region. All responses stream live via SSE and save automatically as hidden linked notes. 

### Identity-Based Security
Your identity is your mnemonic phrase. API keys stay securely in the worker proxy and never reach the browser. Add optional WebAuthn passkeys or enable PBKDF2 encryption with 200,000 iterations for total privacy.

### Markdown Notes
Write in full Markdown with a live scroll-synced split preview. Organize everything in a drag-and-drop folder tree. You can batch select, delete, export, or share multiple notes at once.

## Architecture & Tech Stack

The frontend uses zero frameworks and requires zero build steps. It runs on Vanilla HTML, CSS, and JS. The AI proxy runs on Vercel Edge Functions in TypeScript. 

* **Frontend**: Vanilla JS, marked.js, Phosphor Icons
* **Database**: GenosDB (CRDT, P2P, WebRTC)
* **Worker**: Vercel Edge Functions (TypeScript)
* **Crypto**: Web Crypto API

## File Structure

```text
src/
    index.html            Main entry
    app.js                App init (ES module, 602 lines)
    state.js              Global state
    dom.js                DOM ref cache
    utils.js              Crypto, drag/resize factory
    constants.js          Layout, ACL roles
    style.css             All styles (1870 lines)
    modules/
        auth.js            Auth + E2EE reinit
        notes.js           Note CRUD + folder tree
        notes-db.js        Reactive subscriptions
        batch.js           Batch selector
        brainstorm.js      AI brainstorm trigger
        ai-fetch.js        SSE streaming wrapper
        settings.js        Settings panel
        share.js           ACL collaboration
        ui.js              Markdown preview + toast
        mindmap.js         Mindmap logic (723 lines)
        mindmap-renderer.js  DAG renderer (981 lines)
    ymind-worker/         Vercel Edge Functions
```

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| Enter × 2 | Trigger AI brainstorm from last `?` |
| Ctrl+Enter | Trigger AI brainstorm on specific region |
| Ctrl+S | Open AI history |
| Left/Right Arrow | Navigate chat history |
| Escape | Exit batch selection mode |

## How to Run

You can run the frontend immediately without compiling anything.

1. Open `src/index.html` directly in your browser or run `npx serve .` in the project root.
2. To enable AI features, deploy the `ymind-worker` directory to Vercel. Set your provider API keys in the Vercel environment variables. Finally, configure `BRAINSTORM_WORKER_URL` in `src/utils.js` to point to your new worker URL.