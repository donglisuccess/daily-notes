# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

daily-notes 是一个基于 Vue 3 的本地 Markdown 博客系统。`src/pages` 目录下的 Markdown 文件通过 `import.meta.glob` 懒加载，自动生成导航树与正文展示，无需数据库或 API。

## 常用命令

```bash
pnpm install   # 安装依赖
pnpm dev       # 启动开发服务器
pnpm build     # 构建生产包（含 TypeScript 类型检查）
pnpm preview   # 预览构建产物
pnpm type-check # 仅运行 TypeScript 类型检查
```

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