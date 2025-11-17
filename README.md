# 日常笔记 / 博客

使用 **Vue 3 + TypeScript + Vite + Element Plus** 打造的前端笔记系统，通过本地 `src/pages` 目录下的 Markdown 文件自动生成导航与正文展示。

## 开发启动

```bash
pnpm install # 或 npm/yarn 安装依赖
pnpm dev
```

### 主要脚本

- `pnpm dev` — 启动本地开发环境
- `pnpm build` — 构建生产包
- `pnpm preview` — 预览构建产物
- `pnpm type-check` — 仅运行类型检查

## 目录说明

- `src/pages`：所有 Markdown 文章，保持多层目录结构即可自动生成菜单
- `src/components`：布局三栏、目录树、正文渲染、文章大纲等 UI 模块
- `src/composables`：笔记数据、Markdown 解析等核心逻辑
- `src/styles`：全局基础样式与代码高亮主题

## 路由与懒加载

- 访问 `/` 进入首页简介；每篇 Markdown 会对应 `/notes/...` 路由，路径与 `src/pages` 目录结构一致
- 通过 `import.meta.glob` 的按需导入机制，Markdown 内容会在进入对应路由时才被加载，实现真正的路由懒加载
- 支持直接在地址栏粘贴 `/notes/分类/文章` 进行跳转，并会自动记住上次浏览的文章路径

## Markdown 规范

1. 在 `src/pages` 中按照你想要的分类创建子目录，如 `前端/`、`后端/`、`运维/`、`算法/`
2. 每篇文章即一个 `.md` 文件，建议首个一级标题 (`# 标题`) 作为文章标题
3. 保存即可，前端会自动更新目录树与正文

## SVG 图标

项目使用内置的 SVG 组件（文件夹、文档等）来渲染目录树图标，避免字体图标依赖。

## 文章大纲

右侧大纲栏根据 Markdown 的 h1-h3 标题自动生成，点击可定位到正文对应内容，滚动阅读时自动高亮当前章节。
