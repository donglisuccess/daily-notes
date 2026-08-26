<script setup lang="ts">
import mermaid from 'mermaid';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { LoadedNote, NoteLink, NoteNavigation, OutlineHeading } from '@/types/note';
import { resolveNoteAsset } from '@/utils/assets';
import { renderMarkdown } from '@/utils/markdown';
import { useNotes } from '@/composables/useNotes';

const props = defineProps<{
  note: LoadedNote | null;
  navigation: NoteNavigation | null;
  immersive: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:headings', value: OutlineHeading[]): void;
  (e: 'active-heading-change', value: string | null): void;
  (e: 'navigate-note', value: string): void;
  (e: 'exit-immersive'): void;
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
const { noteFiles } = useNotes();

const relatedNotes = computed(() => props.navigation?.related ?? []);
const isImmersiveArticle = computed(() => Boolean(props.note && props.immersive));
const contentShellClasses = computed(() => ({
  'content-shell--home': !props.note,
  'content-shell--immersive': isImmersiveArticle.value
}));
const contentScrollClasses = computed(() => ({
  'content-scroll--home': !props.note,
  'content-scroll--immersive': isImmersiveArticle.value
}));

const articleCount = computed(() => noteFiles.length);
const categoryCount = computed(() => {
  const roots = new Set(noteFiles.map((n) => n.segments[0]));
  return roots.size;
});
const goalProgressItems = computed(() =>
  [
    {
      key: 'short',
      label: '短期目标进度',
      target: 200,
      caption: '阶段写作里程碑'
    },
    {
      key: 'long',
      label: '长期目标进度',
      target: 1000,
      caption: '长期知识库目标'
    }
  ].map((goal) => {
    const rawPercent = (articleCount.value / goal.target) * 100;
    const progressValue = Number((clamp(rawPercent / 100) * 100).toFixed(1));

    return {
      ...goal,
      percentLabel: `${rawPercent.toFixed(1)}%`,
      progressValue,
      progressWidth: `${progressValue}%`
    };
  })
);
const hasArticleNavigation = computed(() =>
  Boolean(props.navigation?.previous || props.navigation?.next || relatedNotes.value.length)
);

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

watch(
  () => props.immersive,
  async () => {
    await nextTick();
    syncReadingState();
  }
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

function getLinkBreadcrumb(note: NoteLink) {
  return note.segments.slice(0, -1).join(' / ') || 'Daily Notes';
}

function handleNavigateNote(routePath: string) {
  emit('navigate-note', routePath);
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

const handleExitImmersive = () => {
  emit('exit-immersive');
};

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Escape') {
    return;
  }

  if (lightboxSrc.value) {
    closeLightbox();
    return;
  }

  if (props.immersive && props.note) {
    emit('exit-immersive');
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
  <div class="content-shell panel" :class="contentShellClasses">
    <div v-if="note" class="reading-progress" aria-hidden="true">
      <span :style="{ width: readingProgressWidth }"></span>
    </div>
    <div ref="scrollRef" class="content-scroll" :class="contentScrollClasses">
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
          <footer v-if="hasArticleNavigation" class="article-navigation" aria-label="文章导航">
            <div
              v-if="navigation?.previous || navigation?.next"
              class="article-navigation__pair"
            >
              <button
                v-if="navigation?.previous"
                class="article-nav-link article-nav-link--previous"
                type="button"
                @click="handleNavigateNote(navigation.previous.routePath)"
              >
                <span class="article-nav-link__label">上一篇</span>
                <strong>{{ navigation.previous.title }}</strong>
                <span class="article-nav-link__meta">{{ getLinkBreadcrumb(navigation.previous) }}</span>
              </button>

              <button
                v-if="navigation?.next"
                class="article-nav-link article-nav-link--next"
                type="button"
                @click="handleNavigateNote(navigation.next.routePath)"
              >
                <span class="article-nav-link__label">下一篇</span>
                <strong>{{ navigation.next.title }}</strong>
                <span class="article-nav-link__meta">{{ getLinkBreadcrumb(navigation.next) }}</span>
              </button>
            </div>

            <section v-if="relatedNotes.length" class="related-notes">
              <div class="related-notes__header">
                <span>相关文章</span>
                <small>继续沿着这个主题读下去</small>
              </div>

              <div class="related-notes__grid">
                <button
                  v-for="related in relatedNotes"
                  :key="related.routePath"
                  class="related-note"
                  type="button"
                  @click="handleNavigateNote(related.routePath)"
                >
                  <span class="related-note__path">{{ getLinkBreadcrumb(related) }}</span>
                  <strong>{{ related.title }}</strong>
                </button>
              </div>
            </section>
          </footer>
        </div>
      </template>
      <div v-else class="intro-panel">
        <section class="intro-hero">
          <div class="intro-hero__badge">
            <span class="intro-hero__dot" aria-hidden="true"></span>
            {{ articleCount }} 篇文章 · {{ categoryCount }} 个分类
          </div>
          <h1 class="intro-hero__title">
            <span class="intro-hero__title-line">一处安静的</span>
            <span class="intro-hero__title-line intro-hero__title-line--accent">Markdown 知识库</span>
          </h1>
          <p class="intro-motto">知不足而奋进，望远山而前行</p>
          <p class="intro-description">
            用本地 Markdown 管理文章、学习记录和工程笔记。<br />左侧选择文档，右侧自动生成大纲，阅读时保持轻盈、清晰和专注。
          </p>
          <div class="intro-hero__actions">
            <span class="intro-hero__hint">← 从左侧目录开始阅读</span>
          </div>

          <section class="intro-stats" aria-label="知识库概览">
            <div class="intro-stat">
              <span class="intro-stat__icon" aria-hidden="true">📄</span>
              <span class="intro-stat__value">{{ articleCount }}</span>
              <span class="intro-stat__label">文章总数</span>
            </div>
            <div class="intro-stat">
              <span class="intro-stat__icon" aria-hidden="true">📁</span>
              <span class="intro-stat__value">{{ categoryCount }}</span>
              <span class="intro-stat__label">分类目录</span>
            </div>
            <div class="intro-stat">
              <span class="intro-stat__icon" aria-hidden="true">🔖</span>
              <span class="intro-stat__value">Markdown</span>
              <span class="intro-stat__label">纯文本格式</span>
            </div>
          </section>
        </section>

        <section class="intro-goals" aria-label="写作目标进度">
          <article
            v-for="goal in goalProgressItems"
            :key="goal.key"
            class="intro-goal"
            :class="`intro-goal--${goal.key}`"
          >
            <div class="intro-goal__header">
              <span class="intro-goal__label">{{ goal.label }}</span>
              <strong class="intro-goal__percent">{{ goal.percentLabel }}</strong>
            </div>
            <div
              class="intro-goal__track"
              role="progressbar"
              :aria-label="goal.label"
              :aria-valuenow="goal.progressValue"
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <span :style="{ width: goal.progressWidth }"></span>
            </div>
            <div class="intro-goal__meta">
              <span>{{ articleCount }} / {{ goal.target }} 篇</span>
              <span>{{ goal.caption }}</span>
            </div>
          </article>
        </section>

        <div class="intro-grid">
          <section class="intro-card">
            <span class="intro-card__icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                <line x1="12" y1="11" x2="12" y2="17"/>
                <line x1="9" y1="14" x2="15" y2="14"/>
              </svg>
            </span>
            <div class="intro-card__body">
              <h3>内容组织</h3>
              <p>根据 <code>pages/</code> 目录自动生成树形导航，文件夹就是分类，文件名就是入口。</p>
            </div>
          </section>

          <section class="intro-card">
            <span class="intro-card__icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
            </span>
            <div class="intro-card__body">
              <h3>阅读体验</h3>
              <p>Markdown、代码块、表格、图片和视频都按文章阅读场景优化，适合长期维护。</p>
            </div>
          </section>

          <section class="intro-card">
            <span class="intro-card__icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            </span>
            <div class="intro-card__body">
              <h3>主题切换</h3>
              <p>浅色是温和纸张质感，深色保留暖色调，夜间阅读也不会过分刺眼。</p>
            </div>
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
      v-if="note && immersive"
      class="immersive-exit"
      type="button"
      aria-label="退出沉浸式阅读"
      title="退出沉浸式阅读"
      @click="handleExitImmersive"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 3v3a2 2 0 0 1-2 2H3" />
        <path d="M16 3v3a2 2 0 0 0 2 2h3" />
        <path d="M8 21v-3a2 2 0 0 0-2-2H3" />
        <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
      </svg>
      <span>退出沉浸</span>
    </button>

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

.content-shell--home {
  height: auto;
  max-height: none;
  min-height: calc(100vh - var(--header-height) - 44px);
  overflow: visible;
}

.content-shell--immersive {
  height: 100vh;
  max-height: 100vh;
  min-height: 100vh;
  padding: 0;
  border: 0;
  border-radius: 0;
  background:
    linear-gradient(
      90deg,
      color-mix(in srgb, var(--app-bg) 96%, transparent) 0%,
      color-mix(in srgb, var(--panel-bg) 96%, var(--app-bg)) 50%,
      color-mix(in srgb, var(--app-bg) 96%, transparent) 100%
    );
  box-shadow: none;
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

.content-shell--immersive .reading-progress {
  position: fixed;
  z-index: 30;
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

.content-scroll--home {
  height: auto;
  overflow: visible;
  padding-right: 0;
}

.content-scroll--immersive {
  height: 100vh;
  max-height: 100vh;
  overflow-y: auto;
  padding-right: 0;
}

.content-inner {
  max-width: 850px;
  margin: 0 auto;
  padding: 10px clamp(4px, 2vw, 22px) 74px;
}

.content-shell--immersive .content-inner {
  max-width: min(860px, calc(100vw - 80px));
  padding: clamp(42px, 7vh, 78px) 0 108px;
}

.content-meta {
  margin-bottom: 28px;
  padding-bottom: 22px;
  border-bottom: 1px solid var(--divider-color);
}

.content-shell--immersive .content-meta {
  margin-bottom: 36px;
  padding-bottom: 26px;
}

.content-breadcrumb {
  display: block;
  margin: 0 0 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.content-shell--immersive .content-title {
  font-size: clamp(34px, 4.2vw, 46px);
  line-height: 1.14;
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

.immersive-exit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid color-mix(in srgb, var(--accent) 34%, var(--panel-border));
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent-soft) 36%, var(--panel-bg));
  color: var(--accent);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
  transition:
    background var(--transition-base),
    border-color var(--transition-base),
    box-shadow var(--transition-base),
    transform var(--transition-base);
}

.immersive-exit svg {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
}

.immersive-exit:hover {
  border-color: color-mix(in srgb, var(--accent) 58%, var(--panel-border));
  background: var(--accent-soft);
  box-shadow: 0 10px 26px rgba(62, 49, 38, 0.12);
  transform: translateY(-1px);
}

.immersive-exit:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

.immersive-exit {
  position: fixed;
  top: 18px;
  right: 18px;
  z-index: 40;
  min-height: 38px;
  padding: 0 15px;
  background: color-mix(in srgb, var(--panel-bg) 88%, transparent);
  box-shadow: 0 16px 38px rgba(62, 49, 38, 0.16);
  backdrop-filter: blur(14px);
}

.markdown-body {
  padding-bottom: 40px;
}

.content-shell--immersive .markdown-body {
  font-size: 17px;
  line-height: 1.86;
}

.content-shell--immersive .markdown-body :deep(p),
.content-shell--immersive .markdown-body :deep(li) {
  line-height: 1.9;
}

.content-shell--immersive .markdown-body :deep(h1),
.content-shell--immersive .markdown-body :deep(h2),
.content-shell--immersive .markdown-body :deep(h3),
.content-shell--immersive .markdown-body :deep(h4),
.content-shell--immersive .markdown-body :deep(h5),
.content-shell--immersive .markdown-body :deep(h6) {
  scroll-margin-top: 54px;
}

.article-navigation {
  margin-top: 42px;
  padding-top: 26px;
  border-top: 1px solid var(--divider-color);
}

.article-navigation__pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.article-nav-link,
.related-note {
  border: 1px solid var(--panel-border);
  background: color-mix(in srgb, var(--panel-bg) 82%, var(--panel-muted));
  color: var(--text-primary);
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition:
    background var(--transition-base),
    border-color var(--transition-base),
    transform var(--transition-base),
    box-shadow var(--transition-base);
}

.article-nav-link {
  min-height: 126px;
  border-radius: var(--radius-md);
  padding: 18px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 12px;
  position: relative;
  overflow: hidden;
}

.article-nav-link::before {
  position: absolute;
  top: 18px;
  color: var(--accent);
  font-size: 20px;
  line-height: 1;
  opacity: 0.86;
}

.article-nav-link--previous {
  padding-left: 42px;
}

.article-nav-link--previous::before {
  content: '←';
  left: 18px;
}

.article-nav-link--next {
  padding-right: 42px;
  text-align: right;
}

.article-nav-link--next::before {
  content: '→';
  right: 18px;
}

.article-nav-link:hover,
.related-note:hover {
  border-color: color-mix(in srgb, var(--accent) 42%, var(--panel-border));
  background: color-mix(in srgb, var(--accent-soft) 42%, var(--panel-bg));
  box-shadow: 0 14px 32px rgba(62, 49, 38, 0.11);
  transform: translateY(-2px);
}

.article-nav-link:focus-visible,
.related-note:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

.article-nav-link__label,
.article-nav-link__meta,
.related-note__path {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 650;
}

.article-nav-link__label {
  color: var(--accent);
}

.article-nav-link strong,
.related-note strong {
  color: var(--text-primary);
  line-height: 1.42;
}

.article-nav-link strong {
  display: block;
  font-size: 17px;
}

.article-nav-link__meta,
.related-note__path {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.related-notes {
  margin-top: 26px;
}

.related-notes__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.related-notes__header span {
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 700;
}

.related-notes__header small {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
}

.related-notes__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.related-note {
  min-height: 112px;
  border-radius: var(--radius-md);
  padding: 15px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 12px;
}

.related-note strong {
  display: -webkit-box;
  overflow: hidden;
  font-size: 15px;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
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
  max-width: 1120px;
  min-height: 100%;
  margin: 0 auto;
  padding: clamp(20px, 3vh, 32px) clamp(8px, 3vw, 36px);
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(320px, 0.92fr);
  grid-template-areas:
    'hero goals'
    'features features';
  gap: clamp(20px, 3.4vw, 36px);
  align-content: center;
}

.intro-hero {
  grid-area: hero;
  max-width: none;
  padding: 0;
  position: relative;
  z-index: 1;
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
}

.intro-hero__badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: fit-content;
  margin-bottom: 14px;
  padding: 6px 16px 6px 12px;
  border: 1px solid var(--panel-border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--panel-bg) 82%, var(--panel-muted));
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 600;
}

.intro-hero__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  display: inline-block;
  animation: pulse-dot 2.4s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.55; transform: scale(0.82); }
}

.intro-hero__title {
  margin: 0;
  max-width: 680px;
  font-size: clamp(34px, 4.5vw, 52px);
  line-height: 1.12;
  letter-spacing: 0;
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.intro-hero__title-line--accent {
  color: var(--accent);
  font-weight: 700;
}

.intro-motto {
  max-width: 680px;
  margin: 14px 0 0;
  padding-left: 14px;
  border-left: 3px solid var(--accent);
  color: var(--text-primary);
  font-size: clamp(16px, 1.7vw, 20px);
  font-weight: 650;
  line-height: 1.6;
}

.intro-description {
  max-width: 680px;
  margin: 14px 0 0;
  color: var(--text-secondary);
  font-size: 16px;
  line-height: 1.7;
}

.intro-hero__actions {
  margin-top: 14px;
}

.intro-hero__hint {
  display: inline-block;
  padding: 8px 18px;
  border-radius: 999px;
  border: 1px dashed var(--panel-border);
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
}

/* Stats bar */
.intro-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 26px;
  max-width: 620px;
}

.intro-stat {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 14px 15px;
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--panel-bg) 72%, transparent);
  text-align: left;
  transition: border-color var(--transition-base), box-shadow var(--transition-base);
}

.intro-stat:hover {
  border-color: color-mix(in srgb, var(--accent) 32%, var(--panel-border));
  box-shadow: 0 8px 24px rgba(62, 49, 38, 0.08);
}

.intro-stat__icon {
  font-size: 20px;
  line-height: 1;
}

.intro-stat__value {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.25;
}

.intro-stat__label {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 600;
}

/* Goal progress */
.intro-goals {
  grid-area: goals;
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  margin-top: 0;
  align-content: center;
}

.intro-goal {
  --goal-color: var(--accent);
  --goal-glow: rgba(62, 49, 38, 0.12);
  position: relative;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--goal-color) 36%, var(--panel-border));
  border-radius: var(--radius-md);
  padding: 22px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--goal-color) 12%, var(--panel-bg)) 0%, color-mix(in srgb, var(--panel-bg) 82%, transparent) 100%);
  box-shadow: 0 16px 36px var(--goal-glow);
}

.intro-goal--long {
  --goal-color: color-mix(in srgb, var(--accent) 54%, var(--hljs-addition));
}

.intro-goal::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--goal-color), color-mix(in srgb, var(--goal-color) 48%, var(--text-primary)));
}

.intro-goal__header,
.intro-goal__meta {
  display: flex;
  justify-content: space-between;
  gap: 8px 12px;
}

.intro-goal__header {
  align-items: baseline;
  flex-direction: row;
}

.intro-goal__label {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 700;
}

.intro-goal__percent {
  color: var(--goal-color);
  font-size: clamp(30px, 3.4vw, 40px);
  font-weight: 760;
  line-height: 1;
  letter-spacing: 0;
  white-space: nowrap;
}

.intro-goal__track {
  height: 11px;
  margin-top: 18px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--goal-color) 24%, var(--panel-border));
  border-radius: 999px;
  background: color-mix(in srgb, var(--panel-muted) 74%, transparent);
}

.intro-goal__track span {
  display: block;
  height: 100%;
  width: 0;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--goal-color), color-mix(in srgb, var(--goal-color) 58%, var(--text-primary)));
  box-shadow: 0 0 18px color-mix(in srgb, var(--goal-color) 34%, transparent);
  transition: width 0.24s ease;
}

.intro-goal__meta {
  flex-wrap: wrap;
  align-items: baseline;
  margin-top: 12px;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 650;
}

/* Feature cards */
.intro-grid {
  grid-area: features;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: clamp(18px, 3vw, 32px);
  margin-top: 0;
  padding-top: 20px;
  border-top: 1px solid var(--divider-color);
}

.intro-card {
  border: 0;
  border-radius: 0;
  padding: 0;
  background: transparent;
  display: flex;
  flex-direction: row;
  gap: 14px;
  align-items: flex-start;
  transition: color var(--transition-base);
}

.intro-card:hover {
  color: var(--accent);
}

.intro-card__icon {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--accent-soft) 60%, var(--panel-muted));
  color: var(--accent);
  transition: background var(--transition-base), transform var(--transition-base);
}

.intro-card:hover .intro-card__icon {
  background: var(--accent-soft);
  transform: scale(1.06);
}

.intro-card__body {
  min-width: 0;
}

.intro-card h3 {
  margin: 0 0 6px;
  font-size: 15px;
  color: var(--text-primary);
}

.intro-card p {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.55;
  font-size: 13px;
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

@media (max-width: 1100px) {
  .intro-panel {
    grid-template-columns: 1fr;
    grid-template-areas:
      'hero'
      'goals'
      'features';
    align-content: start;
  }

  .intro-goals {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .content-shell {
    height: auto;
    max-height: none;
  }

  .content-shell--immersive {
    height: 100vh;
    max-height: 100vh;
    min-height: 100vh;
  }

  .content-scroll {
    height: auto;
    max-height: none;
  }

  .content-scroll--immersive {
    height: 100vh;
    max-height: 100vh;
  }

  .content-shell--immersive .content-inner {
    max-width: min(760px, calc(100vw - 44px));
    padding-top: 56px;
  }

  .back-top {
    position: fixed;
    right: 16px;
    bottom: 18px;
  }

  .intro-stats,
  .intro-goals,
  .intro-grid {
    grid-template-columns: 1fr;
  }

  .intro-hero__title {
    font-size: clamp(28px, 7vw, 42px);
  }

  .intro-card {
    flex-direction: column;
    align-items: center;
    gap: 12px;
    text-align: center;
  }

  .intro-card__body {
    width: 100%;
  }

  .article-navigation__pair,
  .related-notes__grid {
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

  .content-shell--immersive .content-inner {
    max-width: none;
    padding: 54px 18px 84px;
  }

  .content-shell--immersive .markdown-body {
    font-size: 16px;
  }

  .immersive-exit {
    top: 12px;
    right: 12px;
    min-height: 36px;
    padding: 0 12px;
  }

  .content-stats {
    font-size: 12px;
  }

  .content-meta {
    margin-bottom: 22px;
    padding-bottom: 18px;
  }

  .article-navigation {
    margin-top: 32px;
    padding-top: 22px;
  }

  .article-nav-link {
    min-height: 116px;
    padding: 16px;
  }

  .article-nav-link--previous {
    padding-left: 38px;
  }

  .article-nav-link--next {
    padding-right: 38px;
  }

  .related-notes__header {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
  }

  .intro-panel {
    padding: 22px 0 48px;
    gap: 22px;
  }

  .intro-hero__title {
    font-size: clamp(24px, 7vw, 32px);
    gap: 4px;
  }

  .intro-description {
    font-size: 15px;
  }

  .intro-stats {
    gap: 10px;
  }

  .intro-stat {
    padding: 16px 10px 14px;
  }

  .intro-stat__value {
    font-size: 18px;
  }

  .intro-goal {
    padding: 16px;
  }

  .intro-goal__header,
  .intro-goal__meta {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
  }

  .intro-goal__percent {
    font-size: 28px;
  }

  .copy-toast {
    right: 50%;
    bottom: 18px;
    transform: translateX(50%);
  }
}
</style>
