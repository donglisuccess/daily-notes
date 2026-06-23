# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

daily-notes 是一个基于 Vue 3 的本地 Markdown 博客系统。`src/pages` 目录下的 Markdown 文件通过 `import.meta.glob` 懒加载，自动生成导航树与正文展示，无需数据库或 API。

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Vue 3.5 + Vue Router 4 |
| 构建 | Vite 5 + TypeScript 5 |
| UI 组件库 | Element Plus 2 |
| Markdown 渲染 | markdown-it + highlight.js + mermaid |
| 包管理器 | pnpm |

## 常用命令

```bash
pnpm install     # 安装依赖
pnpm dev         # 启动开发服务器
pnpm build       # 构建生产包（含 TypeScript 类型检查）
pnpm preview     # 预览构建产物
pnpm type-check  # 仅运行 TypeScript 类型检查
```

**注意**：项目中未配置测试框架和 Lint 工具，无 `test` 和 `lint` 命令。每次修改后手动运行 `pnpm type-check` 进行类型检查。

## 技术架构

### 核心数据流

```
src/pages/**/*.md  (Vite glob 懒加载)
  → useNotes.noteFiles[] + treeData[]
  → SidebarTree → App.vue 路由
  → loadNote(routePath) 加载原始 Markdown
  → ContentViewer (markdown-it 渲染) + TocSidebar
```

### 路由设计

- Hash 模式：`createWebHashHistory`
- `/` → 空组件（自动恢复上次阅读路径）
- `/notes/:notePath(.*)*` → 文章路由，路径与 `src/pages` 目录结构一一对应
- 笔记路由通过 `NOTE_ROUTE_PREFIX = '/notes'` 和 `buildRoutePath()` 构建，目录层级编码到路径中

### 状态管理

无 Vuex/Pinia，使用 Composables：

| 文件 | 职责 |
|------|------|
| `src/composables/useNotes.ts` | 笔记加载、目录树构建、路由验证、上一篇/下一篇/相关文章 |
| `src/composables/useTheme.ts` | light/dark 主题切换，持久化到 localStorage |

### Markdown 渲染

`src/utils/markdown.ts` — `markdown-it` 实例：

- 注册语言：bash/css/diff/javascript/json/markdown/python/shell/typescript/xml/yaml
- ` ```mermaid ` 代码块被标记为 `data-mermaid-block`，由前端 later 渲染
- 所有代码块包装在 `data-code-lang` 的 `div` 中，右上角有"复制"按钮
- h1-h3 标题提取到 `OutlineHeading[]`，供右侧文章大纲使用

### 目录树构建

`src/utils/tree.ts` — `buildTree()` 将 `NoteFile[]` 转为 Element Plus `TreeNode[]`：

- 按目录层级递归构建，文件夹排在文件前面
- 同类型节点按中文 locale 排序

### 相关文章推荐算法

`useNotes.ts` 中 `getRelatedNotes()` 按以下权重评分：

- 共同目录层级 × 12
- 同一文件夹 +48
- 同一根分类 +10
- 位置邻近度 + `max(0, 6 - |index差|)`

## Markdown 写作规范

- 文件放在 `src/pages/` 下任意子目录，自动生成菜单
- 首个一级标题 `#` 作为文章标题
- 保存即更新，无需手动注册路由

## 代码复制功能

代码块的"复制"按钮是纯前端实现，`ContentViewer.vue` 中通过 `data-copy-code` 属性选择器绑定点击事件，读取 `data-mermaid-source` 或相邻的 `pre` 标签内容。

## 主题机制

`useTheme()` 将主题写入 `document.documentElement` 的 `data-theme` 属性，CSS 通过 `data-theme="light|dark"` 属性选择器切换变量，无需 class 切换。

## 开发规范

### 修改代码前必须先解释影响范围

在修改任何代码之前，先向用户说明：
- 这次修改涉及哪些文件
- 可能会影响哪些现有功能
- 是否会破坏向后兼容性

### 不要重写无关代码

只修改与目标相关的代码，不要趁机重构无关模块、不要改无关变量的命名、不要调整无关的文件结构。如果发现其他问题，另起任务处理。

### UI 修改要保持现有风格

修改 UI 组件时：
- 保持现有布局结构、间距、内边距不变
- 保持现有色彩使用方式（通过 CSS 变量而非硬编码颜色）
- 保持现有交互行为（点击、悬停、过渡等）
- 不随意改变字体、字号、行高

### 修复 Bug 时要先分析原因，再给补丁

发现 Bug 时：
1. 先分析根本原因（root cause），而不是表象
2. 向用户解释清楚原因后再给修复补丁
3. 补丁要精准，只改有问题的部分，不引入额外变化
4. 如果有多个可能的修复方案，说明利弊再让用户选择

###每次修改后要运行必要的检查命令

每次代码修改后，必须运行：

```bash
pnpm type-check
```

确认无 TypeScript 类型错误后再结束。如修改涉及构建相关内容，还需运行：

```bash
pnpm build
```

确认构建成功。

## 文章修改工作流

### 标准流程

当用户提出新增、修改、删除、优化文章时，严格按以下步骤执行：

1. **拉取最新代码**：从 main 分支拉取最新代码
   ```bash
   git checkout main && git pull origin main
   ```
2. **创建新分支**：按分支命名规范创建新分支
3. **完成修改**：只修改目标文件，不修改其他文件
4. **查看 diff**：展示修改内容供用户确认
   ```bash
   git diff
   ```
5. **提交并推送**：
   ```bash
   git add <修改的文件>
   git commit -m "<type>: <description>"
   git push origin <branch-name>
   ```
6. **创建 PR**（当 `GITHUB_TOKEN` 环境变量存在时）：通过 `gh pr create` 创建 Pull Request

### 分支命名规范

| 前缀 | 用途 | 示例 |
|------|------|------|
| `docs/` | 文章新增、修改、删除、优化 | `docs/add-react-note` |
| `feature/` | 新功能开发 | `feature/add-search` |
| `fix/` | Bug 修复 | `fix/sidebar-overflow` |

### Commit Message 规范

遵循简洁的 `<type>: <description>` 格式：

| type | 用途 |
|------|------|
| `docs` | 文章相关变更（新增、修改、删除、优化） |
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `chore` | 构建、依赖、配置等杂项 |

示例：
```
docs: add React best practices note
feat: add full-text search
fix: fix sidebar collapse animation
chore: update Element Plus to 2.x
```

### 安全边界

以下操作**必须禁止或事先询问用户**，不得自行执行：

| 禁止/询问操作 | 策略 |
|---------------|------|
| `git reset --hard` | 禁止 |
| `git clean -fd` | 禁止 |
| `git push --force` / `--force-with-lease` | 禁止 |
| `sudo` 命令 | 禁止 |
| `rm -rf` 递归删除 | 询问确认 |
| 修改 `.env` / `.env.local` | 询问确认 |
| 修改系统目录（`/etc`、`/usr` 等） | 禁止 |

### 完成输出

每次任务完成后，必须输出以下信息：

- **修改的文件**：列出所有修改的文件路径
- **分支名**：`<branch-name>`
- **Commit Hash**：`<commit-hash>`
- **PR 地址**：PR 链接（已创建时）或 PR 创建链接（未创建时提供 GitHub PR 创建 URL）