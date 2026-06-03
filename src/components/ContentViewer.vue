<script setup lang="ts">
import mermaid from 'mermaid';
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
const lightboxSrc = ref<string | null>(null);
const copyToast = ref('');
const readingTimeLabel = ref('');
const readingProgress = ref(0);
const showBackToTop = ref(false);
let hasImageListener = false;
let hasScrollListener = false;
let hasWindowScrollListener = false;
let scrollFrame: number | undefined;
let copyToastTimer: number | undefined;
let mermaidBlockSequence = 0;
let mermaidRenderTimer: number | undefined;
let mermaidRenderToken = 0;
let themeObserver: MutationObserver | undefined;
let activeHeadingId: string | null = null;

const breadcrumb = computed(() => {
  const segments = props.note?.segments;
  if (!segments) {
    return '';
  }
  return segments.slice(0, -1).join(' / ');
});

const readingProgressWidth = computed(() => `${Math.round(readingProgress.value * 100)}%`);
const headingCountLabel = computed(() => `${headingsCache.value.length} 个小节`);

watch(
  () => props.note?.content,
  async (value) => {
    mermaidRenderToken += 1;
    lightboxSrc.value = null;
    activeHeadingId = null;
    readingProgress.value = 0;
    showBackToTop.value = false;
    if (!value) {
      htmlContent.value = '';
      headingsCache.value = [];
      readingTimeLabel.value = '';
      emit('update:headings', []);
      emit('active-heading-change', null);
      await nextTick();
      resetScrollPosition();
      return;
    }

    readingTimeLabel.value = getReadingTimeLabel(value);

    let source = value;
    if (props.note?.path) {
      source = injectNoteAssets(source, props.note.path);
    }

    const { html, headings } = renderMarkdown(source);
    htmlContent.value = html;
    headingsCache.value = headings;
    emit('update:headings', headings);

    await nextTick();
    resetScrollPosition();
    ensureImageListener();
    ensureScrollListener();
    await renderMermaidDiagrams();
    syncReadingState();
  },
  { immediate: true }
);

function resetScrollPosition() {
  const container = scrollRef.value;
  if (container) {
    container.scrollTop = 0;
  }
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0 });
  }
}

function ensureScrollListener() {
  const container = scrollRef.value;
  if (container && !hasScrollListener) {
    container.addEventListener('scroll', handleContentScroll, { passive: true });
    hasScrollListener = true;
  }

  if (typeof window !== 'undefined' && !hasWindowScrollListener) {
    window.addEventListener('scroll', handleContentScroll, { passive: true });
    window.addEventListener('resize', handleContentScroll);
    hasWindowScrollListener = true;
  }
}

function cleanupScrollListener() {
  if (hasScrollListener && scrollRef.value) {
    scrollRef.value.removeEventListener('scroll', handleContentScroll);
  }
  hasScrollListener = false;
  if (hasWindowScrollListener && typeof window !== 'undefined') {
    window.removeEventListener('scroll', handleContentScroll);
    window.removeEventListener('resize', handleContentScroll);
  }
  hasWindowScrollListener = false;
  if (scrollFrame !== undefined && typeof window !== 'undefined') {
    window.cancelAnimationFrame(scrollFrame);
  }
  scrollFrame = undefined;
}

function handleContentScroll() {
  if (typeof window === 'undefined' || scrollFrame !== undefined) {
    return;
  }
  scrollFrame = window.requestAnimationFrame(() => {
    scrollFrame = undefined;
    syncReadingState();
  });
}

function syncReadingState() {
  updateReadingProgress();
  updateActiveHeading();
}

function updateReadingProgress() {
  const container = scrollRef.value;
  if (!container || !props.note) {
    readingProgress.value = 0;
    showBackToTop.value = false;
    return;
  }

  const maxScroll = getReadableMaxScroll(container);
  const currentScroll = getReadableScrollTop(container);
  readingProgress.value = maxScroll > 8 ? clamp(currentScroll / maxScroll) : 1;
  showBackToTop.value = currentScroll > 260;
}

function updateActiveHeading() {
  const container = scrollRef.value;
  const headings = headingsCache.value;
  if (!container || headings.length === 0) {
    if (activeHeadingId !== null) {
      activeHeadingId = null;
      emit('active-heading-change', null);
    }
    return;
  }

  const containerScrollable = isContainerScrollable(container);
  const containerTop = container.getBoundingClientRect().top;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : container.clientHeight;
  const activationTop = containerScrollable
    ? containerTop + Math.min(container.clientHeight * 0.28, 180)
    : Math.min(viewportHeight * 0.28, 180);
  let current = headings[0].id;

  for (const heading of headings) {
    const el = container.querySelector<HTMLElement>(`#${escapeCss(heading.id)}`);
    if (!el) {
      continue;
    }
    if (el.getBoundingClientRect().top <= activationTop) {
      current = heading.id;
    } else {
      break;
    }
  }

  if (getReadableScrollTop(container) + getReadableViewportHeight(container) >= getReadableScrollHeight(container) - 12) {
    current = headings[headings.length - 1].id;
  }

  if (current !== activeHeadingId) {
    activeHeadingId = current;
    emit('active-heading-change', current);
  }
}

function isContainerScrollable(container: HTMLElement) {
  return container.scrollHeight - container.clientHeight > 8;
}

function getReadableScrollTop(container: HTMLElement) {
  if (isContainerScrollable(container) || typeof window === 'undefined') {
    return container.scrollTop;
  }
  return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
}

function getReadableMaxScroll(container: HTMLElement) {
  return getReadableScrollHeight(container) - getReadableViewportHeight(container);
}

function getReadableViewportHeight(container: HTMLElement) {
  if (isContainerScrollable(container) || typeof window === 'undefined') {
    return container.clientHeight;
  }
  return window.innerHeight;
}

function getReadableScrollHeight(container: HTMLElement) {
  if (isContainerScrollable(container) || typeof document === 'undefined') {
    return container.scrollHeight;
  }
  return Math.max(
    document.documentElement.scrollHeight,
    document.body.scrollHeight,
    document.documentElement.offsetHeight,
    document.body.offsetHeight
  );
}

async function renderMermaidDiagrams() {
  const container = scrollRef.value;
  if (!container || typeof window === 'undefined') {
    return;
  }

  const blocks = Array.from(container.querySelectorAll<HTMLElement>('[data-mermaid-block]'));
  if (blocks.length === 0) {
    return;
  }

  const token = ++mermaidRenderToken;
  configureMermaid();

  await Promise.all(
    blocks.map(async (block) => {
      const source = getMermaidSource(block);
      if (!source.trim()) {
        return;
      }

      block.dataset.mermaidSource = source;
      block.classList.remove('mermaid-block--error');
      block.setAttribute('aria-busy', 'true');

      try {
        const { svg, bindFunctions } = await mermaid.render(`mermaid-diagram-${++mermaidBlockSequence}`, source);
        if (token !== mermaidRenderToken) {
          return;
        }

        block.innerHTML = svg;
        block.querySelector('svg')?.setAttribute('role', 'img');
        bindFunctions?.(block);
      } catch (error) {
        if (token !== mermaidRenderToken) {
          return;
        }

        console.warn('mermaid render failed', error);
        block.classList.add('mermaid-block--error');
        renderMermaidSourceFallback(block, source);
      } finally {
        if (token === mermaidRenderToken) {
          block.removeAttribute('aria-busy');
        }
      }
    })
  );
}

function configureMermaid() {
  if (typeof window === 'undefined') {
    return;
  }

  const styles = window.getComputedStyle(document.documentElement);
  const readColor = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
  const panelBg = readColor('--panel-bg', '#fffaf2');
  const panelMuted = readColor('--panel-muted', '#f0e9dd');
  const panelBorder = readColor('--divider-color', 'rgba(87, 70, 54, 0.14)');
  const textPrimary = readColor('--text-primary', '#2f261f');
  const textSecondary = readColor('--text-secondary', '#6d6258');
  const accent = readColor('--accent', '#c96442');
  const codeBg = readColor('--code-bg', '#ede5d8');

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    themeVariables: {
      background: 'transparent',
      mainBkg: panelBg,
      primaryColor: panelBg,
      primaryTextColor: textPrimary,
      primaryBorderColor: accent,
      secondaryColor: panelMuted,
      secondaryTextColor: textPrimary,
      secondaryBorderColor: panelBorder,
      tertiaryColor: codeBg,
      tertiaryTextColor: textPrimary,
      tertiaryBorderColor: panelBorder,
      lineColor: textSecondary,
      clusterBkg: panelMuted,
      clusterBorder: panelBorder,
      edgeLabelBackground: panelBg,
      nodeTextColor: textPrimary,
      noteBkgColor: panelMuted,
      noteTextColor: textPrimary,
      noteBorderColor: panelBorder,
      fontFamily: "'Inter', 'Noto Sans SC', 'Microsoft YaHei', sans-serif"
    }
  });
}

function getMermaidSource(block: HTMLElement) {
  return block.dataset.mermaidSource ?? block.querySelector<HTMLElement>('[data-mermaid-source]')?.textContent ?? '';
}

function renderMermaidSourceFallback(block: HTMLElement, source: string) {
  const pre = document.createElement('pre');
  pre.className = 'mermaid-source';
  pre.textContent = source;
  block.replaceChildren(pre);
}

function setupThemeObserver() {
  if (themeObserver || typeof MutationObserver === 'undefined') {
    return;
  }

  themeObserver = new MutationObserver((records) => {
    const hasThemeChange = records.some((record) => record.attributeName === 'data-theme');
    if (hasThemeChange) {
      scheduleMermaidRender();
    }
  });

  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });
}

function scheduleMermaidRender() {
  if (typeof window === 'undefined') {
    return;
  }

  window.clearTimeout(mermaidRenderTimer);
  mermaidRenderTimer = window.setTimeout(() => {
    void renderMermaidDiagrams();
  }, 0);
}

function cleanupThemeObserver() {
  themeObserver?.disconnect();
  themeObserver = undefined;
  window.clearTimeout(mermaidRenderTimer);
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

function getReadingTimeLabel(source: string) {
  const codeBlocks = source.match(/```[\s\S]*?```/g) ?? [];
  const codeLineCount = codeBlocks.reduce((total, block) => {
    const code = block.replace(/^```[^\r\n]*(?:\r?\n)?/, '').replace(/\r?\n```$/, '');
    return total + code.split(/\r?\n/).filter((line) => line.trim()).length;
  }, 0);
  const text = source
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_`~|{}()[\]-]/g, ' ');
  const cjkCount = text.match(/[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/g)?.length ?? 0;
  const latinText = text.replace(/[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/g, ' ');
  const latinWordCount = latinText.match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g)?.length ?? 0;
  const minutes = Math.max(1, Math.ceil(cjkCount / 300 + latinWordCount / 160 + codeLineCount / 16));
  return `约 ${minutes} 分钟阅读`;
}

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}

function escapeCss(value: string) {
  if (typeof window !== 'undefined' && window.CSS?.escape) {
    return window.CSS.escape(value);
  }
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function handleContentClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  if (!target) {
    return;
  }

  const copyButton = target.closest<HTMLElement>('[data-copy-code]');
  if (copyButton) {
    void handleCopyCode(copyButton);
    return;
  }

  if (!(target instanceof HTMLImageElement)) {
    return;
  }

  const src = target.currentSrc || target.src;
  if (src) {
    lightboxSrc.value = src;
  }
}

async function handleCopyCode(button: HTMLElement) {
  const codeBlock = button.closest('.code-block');
  const code = codeBlock?.querySelector('pre code')?.textContent ?? '';
  if (!code) {
    return;
  }

  try {
    await copyToClipboard(code);
    copyToast.value = '复制成功';
    button.textContent = '已复制';
    window.clearTimeout(copyToastTimer);
    copyToastTimer = window.setTimeout(() => {
      copyToast.value = '';
      button.textContent = '复制';
    }, 1600);
  } catch (error) {
    console.warn('copy code failed', error);
    copyToast.value = '复制失败';
    window.clearTimeout(copyToastTimer);
    copyToastTimer = window.setTimeout(() => {
      copyToast.value = '';
    }, 1600);
  }
}

async function copyToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

const closeLightbox = () => {
  lightboxSrc.value = null;
};

const handleBackToTop = () => {
  const container = scrollRef.value;
  if (!container) {
    return;
  }
  if (isContainerScrollable(container) || typeof window === 'undefined') {
    container.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
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
  container.addEventListener('click', handleContentClick);
  hasImageListener = true;
}

function cleanupImageListener() {
  if (hasImageListener && scrollRef.value) {
    scrollRef.value.removeEventListener('click', handleContentClick);
  }
  hasImageListener = false;
}

onMounted(() => {
  ensureImageListener();
  ensureScrollListener();
  setupThemeObserver();
  window.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  cleanupScrollListener();
  cleanupImageListener();
  cleanupThemeObserver();
  window.clearTimeout(copyToastTimer);
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <div class="content-shell panel">
    <div v-if="note" class="reading-progress" aria-hidden="true">
      <span :style="{ width: readingProgressWidth }"></span>
    </div>
    <div ref="scrollRef" class="content-scroll">
      <template v-if="note">
        <div class="content-inner">
          <header class="content-meta">
            <p v-if="breadcrumb" class="content-breadcrumb">{{ breadcrumb }}</p>
            <h1 class="content-title">{{ note.title }}</h1>
            <div class="content-stats">
              <span>{{ readingTimeLabel }}</span>
              <span v-if="headingsCache.length">{{ headingCountLabel }}</span>
            </div>
          </header>
          <article class="markdown-body" v-html="htmlContent" />
        </div>
      </template>
      <div v-else class="intro-panel">
        <section class="intro-hero">
          <p class="intro-eyebrow">Daily Notes</p>
          <h1>一处安静的 Markdown 知识库</h1>
          <p class="intro-description">
            用本地 Markdown 管理文章、学习记录和工程笔记。左侧选择文档，右侧自动生成大纲，阅读时保持轻盈、清晰和专注。
          </p>
        </section>

        <div class="intro-grid">
          <section class="intro-card">
            <h3>内容组织</h3>
            <p>根据 <code>pages/</code> 目录自动生成树形导航，文件夹就是分类，文件名就是入口。</p>
          </section>

          <section class="intro-card">
            <h3>阅读体验</h3>
            <p>Markdown、代码块、表格、图片和视频都按文章阅读场景优化，适合长期维护。</p>
          </section>

          <section class="intro-card">
            <h3>主题切换</h3>
            <p>浅色是温和纸张质感，深色保留暖色调，夜间阅读也不会过分刺眼。</p>
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
        关闭
      </button>
    </div>

    <div v-if="copyToast" class="copy-toast" role="status" aria-live="polite">
      {{ copyToast }}
    </div>

    <button
      v-if="showBackToTop"
      class="back-top"
      type="button"
      aria-label="回到顶部"
      title="回到顶部"
      @click="handleBackToTop"
    >
      ↑
    </button>
  </div>
</template>

<style scoped>
.content-shell {
  height: calc(100vh - var(--header-height) - 44px);
  max-height: calc(100vh - var(--header-height) - 44px);
  display: flex;
  min-width: 0;
  width: 100%;
  position: relative;
  overflow: hidden;
}

.reading-progress {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  z-index: 2;
  background: color-mix(in srgb, var(--panel-muted) 42%, transparent);
}

.reading-progress span {
  display: block;
  height: 100%;
  width: 0;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 62%, var(--text-primary)));
  transition: width 0.12s ease;
}

.content-scroll {
  overflow-y: auto;
  width: 100%;
  padding-right: 10px;
  height: 100%;
  min-width: 0;
}

.content-inner {
  max-width: 850px;
  margin: 0 auto;
  padding: 10px clamp(4px, 2vw, 22px) 74px;
}

.content-meta {
  margin-bottom: 28px;
  padding-bottom: 22px;
  border-bottom: 1px solid var(--divider-color);
}

.content-breadcrumb {
  margin: 0 0 10px;
  text-transform: uppercase;
  font-size: 12px;
  color: var(--text-muted);
  letter-spacing: 0;
  font-weight: 650;
}

.content-title {
  margin: 0;
  font-size: clamp(30px, 4vw, 38px);
  line-height: 1.16;
  color: var(--text-primary);
  font-weight: 680;
  letter-spacing: 0;
}

.content-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  margin-top: 14px;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
}

.content-stats span + span {
  position: relative;
}

.content-stats span + span::before {
  content: '';
  position: absolute;
  top: 50%;
  left: -8px;
  width: 3px;
  height: 3px;
  border-radius: 999px;
  background: currentColor;
  transform: translateY(-50%);
}

.markdown-body {
  padding-bottom: 40px;
}

.markdown-body :deep(video),
.markdown-body :deep(source),
.markdown-body :deep(p > video),
.markdown-body :deep(figure video),
.markdown-body :deep(iframe) {
  width: 100% !important;
  max-width: 100% !important;
  height: auto !important;
  display: block !important;
  box-sizing: border-box !important;
  margin: 1.2em 0 !important;
}

.markdown-body :deep(video) {
  background: #000;
  border-radius: var(--radius-md);
  overflow: hidden;
  object-fit: contain;
}

.intro-panel {
  max-width: 980px;
  margin: 0 auto;
  padding: clamp(24px, 5vw, 56px) clamp(4px, 3vw, 28px) 72px;
}

.intro-hero {
  max-width: 760px;
  padding: 0 0 34px;
  border-bottom: 1px solid var(--divider-color);
}

.intro-eyebrow {
  margin: 0 0 12px;
  color: var(--accent);
  font-size: 13px;
  font-weight: 700;
}

.intro-hero h1 {
  margin: 0;
  max-width: 680px;
  font-size: clamp(36px, 6vw, 64px);
  line-height: 1.05;
  letter-spacing: 0;
  color: var(--text-primary);
}

.intro-description {
  max-width: 680px;
  margin: 20px 0 0;
  color: var(--text-secondary);
  font-size: 18px;
  line-height: 1.75;
}

.intro-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-top: 26px;
}

.intro-card {
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-md);
  padding: 20px;
  background: color-mix(in srgb, var(--panel-bg) 72%, transparent);
}

.intro-card h3 {
  margin: 0 0 10px;
  font-size: 16px;
  color: var(--text-primary);
}

.intro-card p {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.7;
}

.intro-card code {
  background: var(--code-bg);
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  padding: 1px 5px;
  color: var(--code-text-strong);
}

.markdown-body :deep(img) {
  cursor: zoom-in;
  transition: box-shadow 0.2s ease, filter 0.2s ease;
  border-radius: var(--radius-md);
  border: 1px solid var(--panel-border);
  background: var(--panel-muted);
}

.markdown-body :deep(img:hover) {
  box-shadow: 0 14px 34px rgba(62, 49, 38, 0.16);
  filter: saturate(1.02);
}

.image-lightbox {
  position: fixed;
  inset: 0;
  background: rgba(38, 34, 29, 0.82);
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
  background: #211d19;
}

.image-lightbox__close {
  position: absolute;
  top: 18px;
  right: 18px;
  border: 1px solid rgba(255, 250, 242, 0.22);
  border-radius: 999px;
  padding: 8px 14px;
  background: rgba(255, 250, 242, 0.1);
  color: #fffaf2;
  cursor: pointer;
  font-size: 13px;
}

.copy-toast {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 2100;
  border: 1px solid var(--panel-border);
  border-radius: 999px;
  padding: 10px 14px;
  background: var(--panel-bg);
  color: var(--text-primary);
  box-shadow: 0 14px 34px rgba(62, 49, 38, 0.18);
  font-size: 14px;
  font-weight: 650;
}

.back-top {
  position: absolute;
  right: 22px;
  bottom: 22px;
  z-index: 3;
  width: 42px;
  height: 42px;
  border: 1px solid var(--panel-border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--panel-bg) 92%, transparent);
  color: var(--accent);
  box-shadow: 0 14px 34px rgba(62, 49, 38, 0.18);
  cursor: pointer;
  font-size: 20px;
  font-weight: 700;
  line-height: 1;
  transition: background var(--transition-base), border-color var(--transition-base), transform var(--transition-base);
}

.back-top:hover {
  border-color: color-mix(in srgb, var(--accent) 48%, var(--panel-border));
  background: var(--accent-soft);
  transform: translateY(-2px);
}

.back-top:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
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

  .back-top {
    position: fixed;
    right: 16px;
    bottom: 18px;
  }

  .intro-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .content-scroll {
    padding-right: 0;
  }

  .content-inner {
    padding: 2px 0 48px;
  }

  .content-stats {
    font-size: 12px;
  }

  .content-meta {
    margin-bottom: 22px;
    padding-bottom: 18px;
  }

  .intro-panel {
    padding: 22px 0 48px;
  }

  .intro-description {
    font-size: 16px;
  }

  .copy-toast {
    right: 50%;
    bottom: 18px;
    transform: translateX(50%);
  }
}
</style>
