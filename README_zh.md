# Ymind

Ymind 是一款无账户、去中心化的思维导图与笔记应用，内置 AI 头脑风暴功能。你的数据直接通过 IndexedDB 存储在浏览器本地。应用通过 P2P 协议进行同步，无需任何中心化服务器。身份验证完全基于 BIP39 助记词，支持通行密钥（Passkey）以及端到端加密（E2EE）。

## 核心亮点

### 自研 DAG 思维导图
我们从零开发了定制的有向无环图（DAG）渲染引擎。
* **DAG 数据模型**: 节点支持多父节点。这打破了传统树状结构的限制，能构建出复杂的知识图谱。
* **双向 AI 扩展**: 在左侧扩展前置知识，在右侧深入分析特定主题。AI 将自动生成结构化的子节点。
* **路径隔离悬停**: 鼠标悬浮在任何节点上时，利用“兄弟切割”算法，界面会自动让无关节点变暗，仅高亮相连路径。
* **互动设计**: 支持节点左右两侧独立折叠、贝塞尔曲线连接、鼠标滚轮缩放及拖拽平移。
* **撤销与重置**: 提供撤销 AI 扩展的后退按钮。你也可以根据子节点的上下文，让 AI 重新生成当前节点的内容。

### 去中心化同步
Ymind 接入 GenosDB 实现无服务器的 P2P 同步机制。它支持完全离线使用，并在网络恢复后自动合并数据。你可以使用 ACL 共享机制，为不同地址设置独立的读写权限。

### AI 头脑风暴
单端点接入超过 24 家 LLM 服务商（如 DeepSeek, OpenAI, Anthropic, Gemini 等）。在笔记中输入 `?` 并连按两次回车，即可在上下文中唤起 AI 响应。选中特定文本后按下 Ctrl+Enter，能让 AI 专注处理指定区域内容。所有回答均通过 SSE 实时流式传输，并自动保存为链接到父节点的隐藏笔记。

### 基于身份的安全机制
助记词即是你的身份。API 密钥安全存放在 Worker 代理中，永远不会暴露给浏览器。你可以添加 WebAuthn 通行密钥，或者开启 20 万次迭代的 PBKDF2 端到端加密，享受极致的隐私保护。

### Markdown 笔记
支持全功能 Markdown 语法，配有同步滚动的实时预览窗口。你可以通过拖拽来整理文件夹树状结构。同时也支持批量多选、删除、导出及分享多篇笔记。

## 架构与技术栈

前端零框架、零构建步骤。应用完全基于原生 HTML, CSS 和 JS 运行。AI 代理层基于 Vercel Edge Functions（TypeScript）实现。

* **前端**: 原生 JS, marked.js, Phosphor Icons
* **数据库**: GenosDB (CRDT, P2P, WebRTC)
* **后端/代理**: Vercel Edge Functions (TypeScript)
* **加密**: Web Crypto API

## 目录结构

```text
src/
├── index.html            主入口
├── app.js                应用初始化 (ES module, 602 行)
├── state.js              全局状态
├── dom.js                DOM 引用缓存
├── utils.js              加密与拖拽缩放工厂函数
├── constants.js          布局常量与 ACL 角色
├── style.css             全局样式 (1870 行)
└── modules/
    ├── auth.js            身份验证与 E2EE 重新初始化
    ├── notes.js           笔记 CRUD 与文件夹树
    ├── notes-db.js        响应式数据订阅
    ├── batch.js           批量操作控制器
    ├── brainstorm.js      AI 头脑风暴触发器
    ├── ai-fetch.js        SSE 流式请求封装
    ├── settings.js        设置面板
    ├── share.js           ACL 协作共享
    ├── ui.js              Markdown 预览与 Toast 提示
    ├── mindmap.js         思维导图逻辑 (723 行)
    └── mindmap-renderer.js  DAG 渲染引擎 (981 行)
ymind-worker/             Vercel Edge Functions 代理
```

## 快捷键速查表

| 快捷键 | 动作 |
|---|---|
| Enter × 2 | 从上一个 `?` 触发 AI 头脑风暴 |
| Ctrl+Enter | 针对选中区域触发 AI 头脑风暴 |
| Ctrl+S | 打开 AI 历史记录面板 |
| 左/右方向键 | 在历史面板中导航 |
| Escape | 退出批量选择模式 |

## 运行指南

无需编译，直接运行前端。

1. 在项目根目录运行 `npx serve .`。
2. 要开启 AI 功能，请将 `ymind-worker` 目录部署到 Vercel。在 Vercel 中设置你的服务商 API 密钥环境变量。最后，在 `src/utils.js` 中将 `BRAINSTORM_WORKER_URL` 修改为你的专属 Worker 链接。
