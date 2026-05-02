# Ymind

> 一个 HTML，零账户，无限脑洞。笔记和 AI 都在你手里，不在云上。去中心化就是你的隐私通行证。AI 陪你想，Ymind = Your Mind。

## 演示图

![登录页](images/login.png)
![主页](images/main.png)

## 功能

### 去中心化同步（GenosDB）
- [GenosDB](https://github.com/estebanrfp/gdb) 让设备之间直接同步，走的 CRDT，不经过任何服务器
- 笔记存在 IndexedDB 里，你的助记词就是加密钥匙
- 通过 ACL 分享笔记：按地址给读写权限，给谁不给谁你说了算
- 浏览器标签页之间实时同步，靠 GenosDB 的订阅 API
- 加载一次就能离线用，网络恢复后自动补上

### AI 头脑风暴
- 在笔记里打 `?`，按两下 `Enter`，`?` 前面的内容就是上下文，AI 直接回
- `Ctrl+Enter` → 把上一个 `?` 到当前 `?` 的区域发给 AI
- `Ctrl+S` → 打开历史面板，`←` `→` 翻看 AI 说过的
- AI 输出存成隐藏笔记，用 `parentNoteId` 关联回父笔记
- 任意 LLM 都能接：DeepSeek、OpenAI、Anthropic、Google Gemini……

### 基于身份的安全
- 用助记词当身份（BIP39 词表）
- 支持 Passkey 设备认证
- 没有用户名密码，你的身份就是钥匙
- API key 到不了浏览器（走 Vercel Edge Functions 代理）

### 批量操作
- 多选笔记，一次删除、导出或分享
- 文件夹整理

## 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `Enter` + `Enter` | 把文本（从上一个 `?` 到光标）发给 AI |
| `Ctrl` + `Enter` | 把上一个区域的内容发给当前区域 |
| `Ctrl` + `S` | 打开 AI 输出历史 |
| `←` `→` | 历史面板打开时，翻看 AI 历史 |

## 使用方式

### 方式一：本地用（不带 AI）

启动本地服务器，浏览器打开 Ymind.html 就行：

```bash
# 方法1: 使用 npx（需要 Node.js）
npx serve .

# 方法2: 使用 Python（需要 Python 3）
python -m http.server 8080

# 然后在浏览器中打开 http://localhost:5000（或 8080）
```

### 方式二：开 AI 头脑风暴

#### 第 1 步：把 LLM 代理部署到 Vercel

```bash
cd ymind-worker
vercel deploy --prod
```

Vercel 会给你一个地址，类似 `https://ymind-worker-xxx.vercel.app`。

#### 第 2 步：添加环境变量

```bash
# 生成随机 token
vercel env add WORKER_ACCESS_TOKEN
# 输入: openssl rand -hex 32 的输出结果

# 添加 DeepSeek API key
vercel env add DEEPSEEK_API_KEY
# 输入: 你的 DeepSeek API key

# （可选）添加其他服务商的 API key
vercel env add OPENAI_API_KEY
vercel env add ANTHROPIC_API_KEY
```

#### 第 3 步：改 Ymind.html 里的 API_URL

打开 Ymind.html，找到这行：

```javascript
const API_URL = '...';
```

改成你的 Vercel 地址：

```javascript
const API_URL = 'https://your-vercel-url.vercel.app/api/chat?key=YOUR_TOKEN';
```

#### 第 4 步：启动本地服务器

```bash
npx serve .   # 或 python -m http.server 8080
```

然后浏览器打开显示的地址就行（或者 `http://localhost:8080`）。

### 用自定义域名

#### 第 1 步：在 Vercel 添加域名

```bash
vercel domains add your-domain.com
```

#### 第 2 步：在域名管理后台加 DNS 记录

Vercel 会告诉你要加什么记录（一般是 CNAME 或 A 记录），去你的域名管理后台配上就行。

#### 第 3 步：改 Ymind.html 里的 API_URL

```javascript
const API_URL = 'https://your-domain.com/api/chat?key=YOUR_TOKEN';
```

### 安全说明

为什么要走 Edge Functions 代理？

- **API key 保护**：密钥只存在 Vercel 环境变量里，不会发给浏览器
- **Token 认证**：请求要带 `?key=TOKEN`，有速率限制，防暴力破解
- **速率限制**：每个 IP 每分钟最多 20 次请求，失败 3 次封 1 小时

## 技术栈

- **前端**：原生 HTML/CSS/JS（零框架）
- **数据库**：[GenosDB](https://github.com/estebanrfp/gdb) - 带身份安全的 IndexedDB，支持点对点同步
- **Markdown**：[marked.js](https://marked.js.org/)
- **图标**：[Phosphor Icons](https://phosphoricons.com/)
- **LLM 代理**：Vercel Edge Functions，TypeScript

## 致谢

- **[GenosDB](https://github.com/estebanrfp/gdb)** by Esteban Fuster Pozzi - 基于身份安全的 IndexedDB，支持 CRDT 同步和 ACL 系统。本项目基于 GenosDB 示例模板构建，借助其安全管理器实现助记词/Passkey 认证，利用其 map/subscribe API 实现响应式数据，并通过其点对点同步能力实现设备间同步。

- **[marked.js](https://marked.js.org/)** - Markdown 解析

- **[Phosphor Icons](https://phosphoricons.com/)** - 图标库

- **[Vercel](https://vercel.com/)** - 用于安全 LLM 代理的 Edge Functions
