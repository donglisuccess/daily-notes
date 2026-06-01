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
const observer = ref<IntersectionObserver>();
const lightboxSrc = ref<string | null>(null);
const copyToast = ref('');
let hasImageListener = false;
let copyToastTimer: number | undefined;
let mermaidBlockSequence = 0;
let mermaidRenderTimer: number | undefined;
let mermaidRenderToken = 0;
let themeObserver: MutationObserver | undefined;

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
    mermaidRenderToken += 1;
    lightboxSrc.value = null;
    if (!value) {
      htmlContent.value = '';
      headingsCache.value = [];
      emit('update:headings', []);
      emit('active-heading-change', null);
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
    await renderMermaidDiagrams();
    setupObserver();
    emit('active-heading-change', headings.length > 0 ? headings[0].id : null);
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
  setupThemeObserver();
  window.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  cleanupObserver();
  cleanupImageListener();
  cleanupThemeObserver();
  window.clearTimeout(copyToastTimer);
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <div class="content-shell panel">
    <div ref="scrollRef" class="content-scroll">
      <template v-if="note">
        <div class="content-inner">
          <header class="content-meta">
            <p v-if="breadcrumb" class="content-breadcrumb">{{ breadcrumb }}</p>
            <h1 class="content-title">{{ note.title }}</h1>
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
  </div>
</template>

<style scoped>
.content-shell {
  height: calc(100vh - var(--header-height) - 44px);
  max-height: calc(100vh - var(--header-height) - 44px);
  display: flex;
  min-width: 0;
  width: 100%;
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

@media (max-width: 900px) {
  .content-shell {
    height: auto;
    max-height: none;
  }

  .content-scroll {
    height: auto;
    max-height: none;
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
