<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { LoadedNote, OutlineHeading } from '@/types/note';
import { resolveNoteAsset } from '@/utils/assets';
import { renderMarkdown } from '@/utils/markdown';

const props = defineProps<{ note: LoadedNote | null }>();

const emit = defineEmits<{
  (e: 'update:headings', value: OutlineHeading[]): void;
  (e: 'active-heading-change', value: string | null): void;
}>();

const htmlContent = ref('');
const headingsCache = ref<OutlineHeading[]>([]);
const scrollRef = ref<HTMLElement>();
const observer = ref<IntersectionObserver>();
const lightboxSrc = ref<string | null>(null);
let hasImageListener = false;

const breadcrumb = computed(() => {
  const segments = props.note?.segments;
  if (!segments) {
    return '';
  }
  return segments.slice(0, -1).join(' / ');
});

watch(
  () => props.note?.content,
  async (value) => {
    cleanupObserver();
    lightboxSrc.value = null;
    if (!value) {
      htmlContent.value = '';
      headingsCache.value = [];
      emit('update:headings', []);
      emit('active-heading-change', null);
      lightboxSrc.value = null;
      return;
    }
    let source = value;
    if (props.note?.path) {
      source = injectNoteAssets(source, props.note.path);
    }

    const { html, headings } = renderMarkdown(source);
    htmlContent.value = html;
    headingsCache.value = headings;
    emit('update:headings', headings);

    await nextTick();
    ensureImageListener();
    setupObserver();
    if (headings.length > 0) {
      emit('active-heading-change', headings[0].id);
    } else {
      emit('active-heading-change', null);
    }
  },
  { immediate: true }
);

function setupObserver() {
  const container = scrollRef.value;
  if (!container || headingsCache.value.length === 0) {
    return;
  }

  observer.value = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.target.getBoundingClientRect().top - b.target.getBoundingClientRect().top);
      if (visible.length > 0) {
        emit('active-heading-change', visible[0].target.id);
      }
    },
    {
      root: container,
      threshold: [0.1, 0.3, 1],
      rootMargin: '0px 0px -60% 0px'
    }
  );

  headingsCache.value.forEach((heading) => {
    const selector = `#${escapeCss(heading.id)}`;
    const el = container.querySelector(selector);
    if (el) {
      observer.value?.observe(el);
    }
  });
}

function cleanupObserver() {
  observer.value?.disconnect();
  observer.value = undefined;
}

function injectNoteAssets(content: string, notePath: string) {
  let transformed = content.replace(/!\[([^\]]*)\]\(((?:\.\.?\/)[^)]+)\)/gu, (match, alt, rawPath) => {
    const assetUrl = resolveRelativeAsset(notePath, String(rawPath));
    if (!assetUrl) {
      return match;
    }
    return `![${alt}](${assetUrl})`;
  });

  transformed = transformed.replace(
    /<img([^>]+)src=(['"])((?:\.\.?\/)[^'">]+)\2([^>]*)>/gu,
    (match, before, quote, rawPath, after) => {
      const assetUrl = resolveRelativeAsset(notePath, String(rawPath));
      if (!assetUrl) {
        return match;
      }
      return `<img${before}src=${quote}${assetUrl}${quote}${after}>`;
    }
  );

  // Resolve <video src="../..."> attributes so markdown HTML 中的视频可以正确加载
  transformed = transformed.replace(
    /<video([^>]*?)src=(['"])((?:\.\.?\/)[^'">]+)\2([^>]*)>/gu,
    (match, before, quote, rawPath, after) => {
      const assetUrl = resolveRelativeAsset(notePath, String(rawPath));
      if (!assetUrl) {
        return match;
      }
      return `<video${before}src=${quote}${assetUrl}${quote}${after}>`;
    }
  );

  // Resolve <source src="../..."> inside <video>
  transformed = transformed.replace(
    /<source([^>]+)src=(['"])((?:\.\.?\/)[^'">]+)\2([^>]*)>/gu,
    (match, before, quote, rawPath, after) => {
      const assetUrl = resolveRelativeAsset(notePath, String(rawPath));
      if (!assetUrl) {
        return match;
      }
      return `<source${before}src=${quote}${assetUrl}${quote}${after}>`;
    }
  );

  return transformed;
}

function resolveRelativeAsset(notePath: string, rawPath: string) {
  return resolveNoteAsset(notePath, rawPath);
}

function escapeCss(value: string) {
  if (typeof window !== 'undefined' && window.CSS?.escape) {
    return window.CSS.escape(value);
  }
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function handleImageClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  if (!target || !(target instanceof HTMLImageElement)) {
    return;
  }
  const src = target.currentSrc || target.src;
  if (!src) {
    return;
  }
  lightboxSrc.value = src;
}

const closeLightbox = () => {
  lightboxSrc.value = null;
};

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    closeLightbox();
  }
};

function ensureImageListener() {
  const container = scrollRef.value;
  if (!container || hasImageListener) {
    return;
  }
  container.addEventListener('click', handleImageClick);
  hasImageListener = true;
}

function cleanupImageListener() {
  if (hasImageListener && scrollRef.value) {
    scrollRef.value.removeEventListener('click', handleImageClick);
  }
  hasImageListener = false;
}

onMounted(() => {
  ensureImageListener();
  window.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  cleanupObserver();
  cleanupImageListener();
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <div class="content-shell panel">
    <div ref="scrollRef" class="content-scroll">
      <template v-if="note">
        <header class="content-meta">
          <p class="content-breadcrumb">{{ breadcrumb }}</p>
          <h3 class="content-title">{{ note.title }}</h3>
        </header>
        <article class="markdown-body" v-html="htmlContent" />
      </template>
      <div v-else class="intro-panel">
        <div class="intro-hero">
          <p class="intro-eyebrow">Daily Notes — 你的日常知识记录系统</p>
          <h1>欢迎来到 Daily Notes！</h1>
          <p class="intro-description">
            这是一个基于 Vue3 + TypeScript + Element Plus 构建的现代化个人笔记系统，专为喜欢在本地以 Markdown 管理知识的人设计。
          </p>
          <p class="intro-description">无需后端、无需数据库，一切从 Markdown 开始。</p>
          <div class="intro-highlights">
            <div class="intro-highlight">
              <span class="intro-highlight-icon">📝</span>
              <div>
                <strong>Markdown 驱动</strong>
                <p>只需在 <code>pages/</code> 目录中维护文件，前端自动加载、展示与生成大纲。</p>
              </div>
            </div>
            <div class="intro-highlight">
              <span class="intro-highlight-icon">🌲</span>
              <div>
                <strong>目录即结构</strong>
                <p>以文件夹构建分类，左侧目录树与右侧大纲时刻陪伴。</p>
              </div>
            </div>
          </div>
        </div>

        <div class="intro-grid">
          <section class="intro-card">
            <h3><span>✨</span> 你可以用它做什么？</h3>
            <ul>
              <li>记录日常笔记、工作日志、学习资料；</li>
              <li>构建自己的知识体系（前端 / 后端 / 运维 / 算法……）；</li>
              <li>以文件夹的形式构建分类，页面自动读取结构；</li>
              <li>展示 Markdown 内容、自动生成大纲、代码高亮；</li>
              <li>切换深浅主题，让你的阅读更舒适；</li>
              <li>将你的知识库持久保存到 Gitee 仓库中随时查看。</li>
            </ul>
          </section>

          <section class="intro-card">
            <h3><span>🧭</span> 如何开始？</h3>
            <ol>
              <li>在 <code>pages/</code> 目录中添加或编辑 Markdown 文件；</li>
              <li>使用左侧目录选择页面，右侧会自动生成大纲；</li>
              <li>随时切换浅色 / 深色主题，保持舒适的阅读体验。</li>
            </ol>
          </section>

          <section class="intro-card intro-tip-card">
            <h3><span>💡</span> 最佳实践</h3>
            <p>按照主题创建子文件夹，善用文件名排序，结构将始终清晰。</p>
            <p>配合 Git / Gitee 同步仓库，让你的知识库随时随地可查阅。</p>
          </section>
        </div>
      </div>
    </div>

    <div
      v-if="lightboxSrc"
      class="image-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="图片预览"
      @click="closeLightbox"
    >
      <img :src="lightboxSrc" alt="放大图片" @click.stop />
      <button class="image-lightbox__close" type="button" aria-label="关闭预览" @click.stop="closeLightbox">
        Close
      </button>
    </div>
  </div>
</template>

<style scoped>
.content-shell {
  height: calc(100vh - var(--header-height) - 52px);
  max-height: calc(100vh - var(--header-height) - 52px);
  display: flex;
  min-width: 0;
  width: 100%;
}

.content-scroll {
  overflow-y: auto;
  width: 100%;
  padding-right: 12px;
  height: 100%;
  min-width: 0;
}

.content-meta {
  margin-bottom: 24px;
}

.content-breadcrumb {
  margin: 0;
  text-transform: uppercase;
  font-size: 12px;
  color: var(--text-secondary);
  letter-spacing: 0.08em;
}

.content-title {
  margin: 10px 0 0;
  font-size: 28px;
  color: var(--text-primary);
}

.markdown-body {
  padding-bottom: 80px;
}

/* 视频样式：保证嵌入的视频自适应宽度并保持高度比例
   使用 ::v-deep 作用于由 v-html 插入的元素（scoped 样式默认无法匹配 v-html 生成的节点） */
.markdown-body ::v-deep video,
.markdown-body ::v-deep source,
.markdown-body ::v-deep p > video,
.markdown-body ::v-deep figure video,
.markdown-body ::v-deep iframe {
  /* 强制视频/iframe 宽度占满父容器（中间内容区域） */
  width: 100% !important;
  max-width: 100% !important;
  height: auto !important;
  display: block !important;
  box-sizing: border-box !important;
  margin: 0 !important;
}

.markdown-body ::v-deep video {
  background: #000;
  border-radius: var(--radius-sm);
  overflow: hidden;
  object-fit: contain;
}

.intro-panel {
  display: flex;
  flex-direction: column;
  gap: 32px;
  padding-right: 12px;
}

.intro-hero {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 32px;
  border: 1px dashed var(--panel-border);
  border-radius: var(--radius-lg);
  background: linear-gradient(135deg, rgba(96, 165, 250, 0.18), rgba(34, 197, 94, 0.14));
}

.intro-eyebrow {
  margin: 0;
  color: var(--accent);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 14px;
}

.intro-hero h1 {
  margin: 0;
  font-size: 34px;
}

.intro-description {
  margin: 0;
  color: var(--text-secondary);
}

.intro-highlights {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 12px;
}

.intro-highlight {
  display: flex;
  gap: 12px;
  padding: 16px;
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid var(--panel-border);
  flex: 1 1 260px;
}

.intro-highlight-icon {
  font-size: 22px;
}

.intro-highlight strong {
  display: block;
  margin-bottom: 4px;
}

.intro-highlight p {
  margin: 0;
  color: var(--text-secondary);
}

.intro-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 20px;
}

.intro-card {
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-lg);
  padding: 24px;
  background: var(--panel-bg);
  box-shadow: var(--shadow-soft);
}

.intro-card h3 {
  margin-top: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 18px;
}

.intro-card ul,
.intro-card ol {
  margin: 16px 0 0;
  padding-left: 18px;
  color: var(--text-secondary);
}

.intro-card li + li {
  margin-top: 8px;
}

.intro-tip-card {
  grid-column: span 2;
}

.markdown-body ::v-deep img {
  cursor: zoom-in;
  transition: transform 0.15s ease, box-shadow 0.2s ease;
  border-radius: var(--radius-md);
}

.markdown-body ::v-deep img:hover {
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
}

.image-lightbox {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  z-index: 2000;
}

.image-lightbox img {
  max-width: min(92vw, 1200px);
  max-height: 88vh;
  border-radius: var(--radius-lg);
  box-shadow: 0 16px 60px rgba(0, 0, 0, 0.35);
  background: #0f172a;
}

.image-lightbox__close {
  position: absolute;
  top: 18px;
  right: 18px;
  border: 1px solid var(--panel-border);
  border-radius: 999px;
  padding: 8px 14px;
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  cursor: pointer;
  font-size: 13px;
  letter-spacing: 0.02em;
}

@media (max-width: 768px) {
  .intro-grid {
    grid-template-columns: 1fr;
  }

  .intro-tip-card {
    grid-column: span 1;
  }

  .intro-hero {
    padding: 24px;
  }
}

@media (max-width: 900px) {
  .content-shell {
    height: auto;
    max-height: none;
  }

  .content-scroll {
    height: auto;
    max-height: none;
  }
}

@media (max-width: 600px) {
  .content-scroll {
    padding-right: 0;
  }

  .intro-panel {
    padding-right: 0;
  }
}
</style>
