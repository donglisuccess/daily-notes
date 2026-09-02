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
const currentTime = ref(new Date());
const goalAnimationRatio = ref(0);
let hasImageListener = false;
let hasScrollListener = false;
let hasWindowScrollListener = false;
let scrollFrame: number | undefined;
let copyToastTimer: number | undefined;
let currentTimeTimer: number | undefined;
let goalAnimationFrame: number | undefined;
let mermaidBlockSequence = 0;
let mermaidRenderTimer: number | undefined;
let mermaidRenderToken = 0;
let themeObserver: MutationObserver | undefined;
let activeHeadingId: string | null = null;

const DAY_MS = 24 * 60 * 60 * 1000;
const GOAL_ANIMATION_DURATION = 1100;

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
const primaryNote = computed(() => noteFiles[0] ?? null);
const featuredNotes = computed(() => noteFiles.slice(0, 3));
const categoryPreviewItems = computed(() => {
  const counts = new Map<string, number>();

  noteFiles.forEach((note) => {
    const root = note.segments[0] || '未分类';
    counts.set(root, (counts.get(root) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN'))
    .slice(0, 4)
    .map(([name, count], index) => ({
      name,
      count,
      tone: ['red', 'green', 'blue', 'gold'][index] ?? 'red'
    }));
});
const goalProgressItems = computed(() =>
  [
    {
      key: 'first',
      label: '100 篇目标进度',
      target: 100,
      targetDate: new Date(2026, 11, 31),
      targetDateLabel: '12月31日'
    },
    {
      key: 'second',
      label: '150 篇目标进度',
      target: 150,
      targetDate: new Date(2027, 1, 5),
      targetDateLabel: '2027年2月5日'
    },
    {
      key: 'third',
      label: '200 篇目标进度',
      target: 200,
      targetDate: new Date(2027, 5, 15),
      targetDateLabel: '2027年6月15日'
    }
  ].map((goal) => {
    const rawPercent = (articleCount.value / goal.target) * 100;
    const progressValue = Number((clamp(rawPercent / 100) * 100).toFixed(1));
    const animatedPercentValue = rawPercent * goalAnimationRatio.value;
    const animatedProgressValue = Number((progressValue * goalAnimationRatio.value).toFixed(1));
    const animatedArticleCount = Math.round(articleCount.value * goalAnimationRatio.value);
    const remainingDays = getRemainingDays(goal.targetDate);

    return {
      ...goal,
      percentLabel: `${animatedPercentValue.toFixed(1)}%`,
      progressValue,
      animatedProgressValue,
      progressWidth: `${animatedProgressValue}%`,
      animatedArticleCount,
      remainingDays,
      remainingLabel: `剩余 ${remainingDays} 天`
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

watch(
  articleCount,
  () => {
    animateGoalProgress();
  }
);

watch(
  () => props.note,
  async (note, previousNote) => {
    if (!note && previousNote) {
      await nextTick();
      animateGoalProgress();
    }
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

function getStartOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function getRemainingDays(targetDate: Date) {
  const today = getStartOfLocalDay(currentTime.value);
  const targetDay = getStartOfLocalDay(targetDate);
  return Math.max(0, Math.ceil((targetDay.getTime() - today.getTime()) / DAY_MS));
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

function shouldReduceMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function stopGoalProgressAnimation() {
  if (goalAnimationFrame === undefined || typeof window === 'undefined') {
    return;
  }
  window.cancelAnimationFrame(goalAnimationFrame);
  goalAnimationFrame = undefined;
}

function animateGoalProgress() {
  if (typeof window === 'undefined') {
    goalAnimationRatio.value = 1;
    return;
  }

  stopGoalProgressAnimation();

  if (shouldReduceMotion()) {
    goalAnimationRatio.value = 1;
    return;
  }

  const startTime = window.performance.now();
  goalAnimationRatio.value = 0;

  const tick = (time: number) => {
    const progress = clamp((time - startTime) / GOAL_ANIMATION_DURATION);
    goalAnimationRatio.value = easeOutCubic(progress);

    if (progress < 1) {
      goalAnimationFrame = window.requestAnimationFrame(tick);
      return;
    }

    goalAnimationRatio.value = 1;
    goalAnimationFrame = undefined;
  };

  goalAnimationFrame = window.requestAnimationFrame(tick);
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

function handleStartReading() {
  if (!primaryNote.value) {
    return;
  }

  handleNavigateNote(primaryNote.value.routePath);
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
  currentTime.value = new Date();
  currentTimeTimer = window.setInterval(() => {
    currentTime.value = new Date();
  }, 60 * 1000);
  if (!props.note) {
    animateGoalProgress();
  } else {
    goalAnimationRatio.value = 1;
  }
  ensureImageListener();
  ensureScrollListener();
  setupThemeObserver();
  window.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  cleanupScrollListener();
  cleanupImageListener();
  cleanupThemeObserver();
  stopGoalProgressAnimation();
  window.clearInterval(currentTimeTimer);
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
        <section id="home-overview" class="intro-hero" aria-labelledby="intro-title">
          <div class="intro-hero__copy">
            <div class="intro-hero__badge">
              <img src="/favicon.svg" alt="" aria-hidden="true" />
              <span>Local Markdown Workspace</span>
            </div>
            <h1 id="intro-title" class="intro-hero__title">Daily Notes</h1>
            <p class="intro-motto">知不足而奋进，望远山而前行</p>
            <p class="intro-description">
              面向工程学习、AI 实践、运维部署与投资复盘的个人知识库。
            </p>

            <div class="intro-hero__actions">
              <button
                v-if="primaryNote"
                class="intro-cta intro-cta--primary"
                type="button"
                @click="handleStartReading"
              >
                <span>开始阅读</span>
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M5 12h14" />
                  <path d="m13 6 6 6-6 6" />
                </svg>
              </button>
              <button
                v-if="featuredNotes[1]"
                class="intro-cta intro-cta--ghost"
                type="button"
                @click="handleNavigateNote(featuredNotes[1].routePath)"
              >
                <span>随便看看</span>
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            </div>

            <section class="intro-stats" aria-label="知识库概览">
              <div class="intro-stat">
                <span class="intro-stat__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7Z" />
                    <path d="M14 2v5h5" />
                    <path d="M9 13h6" />
                    <path d="M9 17h4" />
                  </svg>
                </span>
                <span class="intro-stat__value">{{ articleCount }}</span>
                <span class="intro-stat__label">文章总数</span>
              </div>
              <div class="intro-stat">
                <span class="intro-stat__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
                    <path d="M8 13h8" />
                  </svg>
                </span>
                <span class="intro-stat__value">{{ categoryCount }}</span>
                <span class="intro-stat__label">分类目录</span>
              </div>
              <div class="intro-stat">
                <span class="intro-stat__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4 19.5V5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-1.5Z" />
                    <path d="M8 7h6" />
                    <path d="M8 11h8" />
                    <path d="M8 15h5" />
                  </svg>
                </span>
                <span class="intro-stat__value">MD</span>
                <span class="intro-stat__label">内容格式</span>
              </div>
            </section>
          </div>

          <aside class="intro-visual" aria-label="知识库预览">
            <div class="intro-visual__bar">
              <span class="intro-window-dot"></span>
              <span class="intro-window-dot"></span>
              <span class="intro-window-dot"></span>
              <strong>daily-notes</strong>
            </div>
            <div class="intro-visual__body">
              <div class="intro-console">
                <span class="intro-console__label">workspace</span>
                <strong>{{ articleCount }} notes indexed</strong>
                <p>{{ categoryCount }} categories · markdown source · local assets</p>
              </div>
              <h2 id="home-categories" class="home-section-title">全部文章分类</h2>
              <div class="intro-category-strip" aria-label="分类概览">
                <span
                  v-for="category in categoryPreviewItems"
                  :key="category.name"
                  class="intro-category"
                  :class="`intro-category--${category.tone}`"
                >
                  <strong>{{ category.name }}</strong>
                  <small>{{ category.count }} 篇</small>
                </span>
              </div>
              <h2 id="home-recent" class="home-section-title">最近整理</h2>
              <div class="intro-note-stack">
                <button
                  v-for="noteItem in featuredNotes"
                  :key="noteItem.routePath"
                  class="intro-note-card"
                  type="button"
                  @click="handleNavigateNote(noteItem.routePath)"
                >
                  <span>{{ noteItem.segments.slice(0, -1).join(' / ') || 'Daily Notes' }}</span>
                  <strong>{{ noteItem.title }}</strong>
                </button>
              </div>
            </div>
          </aside>
        </section>

        <h2 id="home-progress" class="home-section-title">写作进度</h2>
        <section class="intro-goals" aria-label="写作目标进度">
          <article
            v-for="goal in goalProgressItems"
            :key="goal.key"
            class="intro-goal"
            :class="`intro-goal--${goal.key}`"
          >
            <div class="intro-goal__header">
              <span class="intro-goal__label">{{ goal.label }}</span>
              <span class="intro-goal__date">目标 {{ goal.targetDateLabel }}</span>
            </div>
            <div class="intro-goal__summary">
              <strong class="intro-goal__percent">{{ goal.percentLabel }}</strong>
              <span class="intro-goal__remaining">{{ goal.remainingLabel }}</span>
            </div>
            <div
              class="intro-goal__track"
              role="progressbar"
              :aria-label="goal.label"
              :aria-valuenow="goal.animatedProgressValue"
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <span :style="{ width: goal.progressWidth }"></span>
            </div>
            <div class="intro-goal__meta">
              <span>已完成 {{ goal.animatedArticleCount }} 篇</span>
              <span>{{ goal.target }} 篇</span>
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
              <h3>界面布局</h3>
              <p>左侧文章列表、中间标题大纲、右侧正文内容，保持固定的工作区阅读结构。</p>
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
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
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
  color: #f4f4f7;
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
  width: 100%;
  max-width: 1280px;
  min-height: 100%;
  margin: 0 auto;
  padding: 28px clamp(12px, 3vw, 40px) 56px;
  position: relative;
  display: grid;
  grid-template-columns: 1fr;
  gap: 22px;
  color: #f4f4f7;
}

.intro-hero {
  min-height: 560px;
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 0.98fr) minmax(360px, 0.86fr);
  align-items: center;
  gap: 44px;
  overflow: hidden;
}

.intro-hero::before {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 74, 61, 0.75), transparent);
  opacity: 0.72;
}

.intro-hero__copy {
  min-width: 0;
  position: relative;
  z-index: 1;
}

.intro-hero__badge {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  width: fit-content;
  margin-bottom: 22px;
  padding: 7px 18px 7px 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(244, 244, 247, 0.68);
  font-size: 13px;
  font-weight: 600;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.intro-hero__badge img {
  width: 24px;
  height: 24px;
  border-radius: 7px;
  box-shadow: 0 0 18px rgba(255, 74, 61, 0.32);
}

@keyframes pulse-dot {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.55;
    transform: scale(0.82);
  }
}

.intro-hero__title {
  margin: 0;
  max-width: 720px;
  font-size: 76px;
  line-height: 0.96;
  letter-spacing: 0;
  color: #fff;
  font-weight: 860;
  text-shadow: 0 0 34px rgba(255, 74, 61, 0.2);
}

.intro-hero__title-line--accent {
  color: #ff4a3d;
  font-weight: 700;
}

.intro-motto {
  max-width: 680px;
  margin: 22px 0 0;
  color: #fff;
  font-size: 22px;
  font-weight: 720;
  line-height: 1.6;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.96), #ff7a52, rgba(255, 255, 255, 0.92));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.intro-description {
  max-width: 600px;
  margin: 14px 0 0;
  color: rgba(244, 244, 247, 0.66);
  font-size: 17px;
  line-height: 1.7;
}

.intro-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 30px;
}

.intro-cta {
  min-height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border-radius: 8px;
  padding: 0 24px;
  border: 1px solid transparent;
  cursor: pointer;
  font: inherit;
  font-size: 15px;
  font-weight: 760;
  line-height: 1;
  transition:
    transform 0.24s ease,
    box-shadow 0.24s ease,
    border-color 0.24s ease,
    background 0.24s ease;
}

.intro-cta svg {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
}

.intro-cta--primary {
  background: linear-gradient(135deg, #ff3b30, #ff715d);
  color: #fff;
  box-shadow: 0 10px 32px rgba(255, 59, 48, 0.32);
}

.intro-cta--ghost {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.14);
  color: #f4f4f7;
}

.intro-cta:hover {
  transform: translateY(-2px);
}

.intro-cta--primary:hover {
  box-shadow: 0 14px 38px rgba(255, 59, 48, 0.4);
}

.intro-cta--ghost:hover {
  border-color: rgba(255, 255, 255, 0.28);
  background: rgba(255, 255, 255, 0.1);
}

.intro-cta:focus-visible,
.intro-note-card:focus-visible {
  outline: 2px solid #ff715d;
  outline-offset: 3px;
}

/* Stats bar */
.intro-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 34px;
  max-width: 620px;
}

.intro-stat {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 7px;
  min-height: 116px;
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0.02));
  text-align: left;
  transition:
    border-color 0.24s ease,
    box-shadow 0.24s ease,
    transform 0.24s ease;
}

.intro-stat:hover {
  border-color: rgba(255, 74, 61, 0.3);
  box-shadow: 0 16px 42px rgba(0, 0, 0, 0.28);
  transform: translateY(-3px);
}

.intro-stat__icon {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: rgba(255, 74, 61, 0.12);
  color: #ff715d;
}

.intro-stat__icon svg {
  width: 18px;
  height: 18px;
}

.intro-stat__value {
  font-size: 24px;
  font-weight: 820;
  color: #fff;
  line-height: 1.25;
}

.intro-stat__label {
  font-size: 12px;
  color: rgba(244, 244, 247, 0.48);
  font-weight: 600;
}

.intro-visual {
  position: relative;
  min-width: 0;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(255, 74, 61, 0.12), transparent 48%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.075), rgba(255, 255, 255, 0.025));
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.42);
  backdrop-filter: blur(16px);
}

.intro-visual::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08), transparent),
    linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px);
  background-size: 100% 100%, 100% 34px;
  opacity: 0.48;
}

.intro-visual__bar {
  position: relative;
  z-index: 1;
  min-height: 46px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(244, 244, 247, 0.58);
  font-size: 12px;
}

.intro-visual__bar strong {
  margin-left: 6px;
  color: rgba(244, 244, 247, 0.78);
  font-size: 13px;
}

.intro-window-dot {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: #ff5f57;
}

.intro-window-dot:nth-child(2) {
  background: #ffbd2e;
}

.intro-window-dot:nth-child(3) {
  background: #28c840;
}

.intro-visual__body {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 16px;
  padding: 20px;
}

.intro-console {
  border-radius: 8px;
  padding: 18px;
  background: rgba(0, 0, 0, 0.26);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.intro-console__label {
  display: inline-flex;
  width: fit-content;
  margin-bottom: 10px;
  padding: 4px 9px;
  border-radius: 6px;
  background: rgba(255, 74, 61, 0.1);
  border: 1px solid rgba(255, 74, 61, 0.18);
  color: #ff715d;
  font-size: 11px;
  font-weight: 700;
}

.intro-console strong {
  display: block;
  color: #fff;
  font-size: 28px;
  line-height: 1.15;
}

.intro-console p {
  margin: 8px 0 0;
  color: rgba(244, 244, 247, 0.52);
  font-size: 13px;
  line-height: 1.5;
}

.intro-category-strip {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.intro-category {
  --category-color: #ff715d;
  min-width: 0;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  border-radius: 8px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.055);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.intro-category::before {
  content: '';
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: var(--category-color);
  box-shadow: 0 0 16px color-mix(in srgb, var(--category-color) 70%, transparent);
}

.intro-category--green {
  --category-color: #48d597;
}

.intro-category--blue {
  --category-color: #55b7ff;
}

.intro-category--gold {
  --category-color: #f5c84b;
}

.intro-category strong {
  min-width: 0;
  overflow: hidden;
  color: rgba(244, 244, 247, 0.86);
  font-size: 13px;
  font-weight: 720;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.intro-category small {
  flex: 0 0 auto;
  color: var(--category-color);
  font-size: 12px;
  font-weight: 720;
}

.intro-note-stack {
  display: grid;
  gap: 10px;
}

.intro-note-card {
  display: grid;
  gap: 6px;
  width: 100%;
  min-height: 72px;
  padding: 13px 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.045);
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition:
    border-color 0.24s ease,
    background 0.24s ease,
    transform 0.24s ease;
}

.intro-note-card:hover {
  border-color: rgba(255, 74, 61, 0.32);
  background: rgba(255, 74, 61, 0.08);
  transform: translateX(4px);
}

.intro-note-card span,
.intro-note-card strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.intro-note-card span {
  color: rgba(244, 244, 247, 0.42);
  font-size: 12px;
  font-weight: 650;
}

.intro-note-card strong {
  color: #fff;
  font-size: 14px;
  font-weight: 720;
}

/* Goal progress */
.intro-goals {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-top: 0;
}

.intro-goal {
  --goal-color: #ff715d;
  --goal-glow: rgba(255, 74, 61, 0.1);
  position: relative;
  isolation: isolate;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--goal-color) 26%, rgba(255, 255, 255, 0.08));
  border-radius: 8px;
  padding: 18px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--goal-color) 14%, transparent) 0%, transparent 60%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0.018));
  box-shadow: 0 18px 42px var(--goal-glow);
  transition:
    border-color 0.24s ease,
    box-shadow 0.24s ease,
    transform 0.24s ease;
}

.intro-goal--second {
  --goal-color: #48d597;
  --goal-glow: rgba(72, 213, 151, 0.08);
}

.intro-goal--third {
  --goal-color: #55b7ff;
  --goal-glow: rgba(85, 183, 255, 0.08);
}

.intro-goal::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 4px;
  background: linear-gradient(180deg, var(--goal-color), color-mix(in srgb, var(--goal-color) 46%, #fff));
}

.intro-goal::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background: linear-gradient(120deg, transparent 0%, color-mix(in srgb, var(--goal-color) 9%, transparent) 44%, transparent 78%);
  opacity: 0;
  transition: opacity 0.24s ease;
}

.intro-goal:hover {
  border-color: color-mix(in srgb, var(--goal-color) 48%, rgba(255, 255, 255, 0.1));
  box-shadow: 0 22px 54px color-mix(in srgb, var(--goal-color) 14%, transparent);
  transform: translateY(-4px);
}

.intro-goal:hover::after {
  opacity: 1;
}

.intro-goal__header,
.intro-goal__summary,
.intro-goal__meta {
  display: flex;
  justify-content: space-between;
  gap: 8px 12px;
}

.intro-goal__header {
  align-items: center;
  flex-direction: row;
}

.intro-goal__label {
  color: #fff;
  font-size: 13px;
  font-weight: 700;
}

.intro-goal__date,
.intro-goal__remaining {
  border-radius: 999px;
  background: color-mix(in srgb, var(--goal-color) 13%, rgba(255, 255, 255, 0.04));
  color: var(--goal-color);
  font-size: 12px;
  font-weight: 760;
  line-height: 1;
  white-space: nowrap;
}

.intro-goal__date {
  padding: 6px 9px;
}

.intro-goal__summary {
  align-items: flex-end;
  margin-top: 14px;
}

.intro-goal__percent {
  color: var(--goal-color);
  font-size: 42px;
  font-weight: 820;
  line-height: 1;
  letter-spacing: 0;
  white-space: nowrap;
}

.intro-goal__remaining {
  padding: 7px 10px;
  margin-bottom: 3px;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--goal-color) 20%, transparent);
}

.intro-goal__track {
  position: relative;
  height: 10px;
  margin-top: 16px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--goal-color) 24%, rgba(255, 255, 255, 0.08));
  border-radius: 999px;
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.025));
}

.intro-goal__track span {
  display: block;
  height: 100%;
  width: 0;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--goal-color), color-mix(in srgb, var(--goal-color) 58%, #fff));
  box-shadow: 0 0 18px color-mix(in srgb, var(--goal-color) 34%, transparent);
}

.intro-goal__meta {
  align-items: baseline;
  margin-top: 10px;
  color: rgba(244, 244, 247, 0.44);
  font-size: 12px;
  font-weight: 650;
}

.intro-goal__meta span:first-child {
  color: rgba(244, 244, 247, 0.72);
}

/* Feature cards */
.intro-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-top: 0;
}

.intro-card {
  position: relative;
  overflow: hidden;
  min-height: 154px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 22px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.018));
  display: flex;
  flex-direction: column;
  gap: 18px;
  align-items: flex-start;
  transition:
    border-color 0.24s ease,
    box-shadow 0.24s ease,
    transform 0.24s ease;
}

.intro-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 18px;
  right: 18px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 113, 93, 0.75), transparent);
  opacity: 0;
  transition: opacity 0.24s ease;
}

.intro-card:hover {
  border-color: rgba(255, 74, 61, 0.24);
  box-shadow: 0 20px 56px rgba(0, 0, 0, 0.28);
  transform: translateY(-4px);
}

.intro-card:hover::before {
  opacity: 1;
}

.intro-card__icon {
  flex-shrink: 0;
  width: 46px;
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: rgba(255, 74, 61, 0.12);
  color: #ff715d;
  transition:
    background 0.24s ease,
    transform 0.24s ease;
}

.intro-card:hover .intro-card__icon {
  background: rgba(255, 74, 61, 0.2);
  transform: scale(1.04);
}

.intro-card__body {
  min-width: 0;
}

.intro-card h3 {
  margin: 0 0 8px;
  font-size: 16px;
  color: #fff;
  font-weight: 760;
}

.intro-card p {
  margin: 0;
  color: rgba(244, 244, 247, 0.6);
  line-height: 1.65;
  font-size: 13px;
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
    align-content: start;
  }

  .intro-hero {
    min-height: auto;
    grid-template-columns: 1fr;
    gap: 28px;
  }

  .intro-visual {
    max-width: 760px;
  }

  .intro-goals {
    grid-template-columns: repeat(3, minmax(0, 1fr));
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

  .intro-goals,
  .intro-grid {
    grid-template-columns: 1fr;
  }

  .intro-hero__title {
    font-size: 58px;
  }

  .intro-card {
    align-items: flex-start;
    text-align: left;
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
    padding: 18px 0 44px;
    gap: 22px;
  }

  .intro-hero {
    gap: 22px;
  }

  .intro-hero__title {
    font-size: 42px;
  }

  .intro-motto {
    font-size: 18px;
  }

  .intro-description {
    font-size: 15px;
  }

  .intro-hero__actions {
    flex-direction: column;
  }

  .intro-cta {
    width: 100%;
  }

  .intro-stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .intro-stat {
    min-height: 104px;
    padding: 12px 10px;
  }

  .intro-stat__icon {
    width: 30px;
    height: 30px;
  }

  .intro-stat__value {
    font-size: 20px;
  }

  .intro-stat__label {
    font-size: 11px;
  }

  .intro-visual__body {
    padding: 14px;
  }

  .intro-console strong {
    font-size: 22px;
  }

  .intro-category-strip {
    grid-template-columns: 1fr;
  }

  .intro-goal {
    padding: 16px;
  }

  .intro-goal__header,
  .intro-goal__summary,
  .intro-goal__meta {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
  }

  .intro-goal__summary {
    margin-top: 12px;
  }

  .intro-goal__percent {
    font-size: 32px;
  }

  .copy-toast {
    right: 50%;
    bottom: 18px;
    transform: translateX(50%);
  }
}

/* Dark workspace layout */
.content-shell {
  height: 100%;
  max-height: 100%;
  min-height: 0;
  display: flex;
  min-width: 0;
  width: 100%;
  position: relative;
  overflow: hidden;
  background: var(--app-bg);
}

.content-shell--home {
  height: 100%;
  max-height: 100%;
  min-height: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: var(--app-bg);
  box-shadow: none;
  overflow: hidden;
}

.content-shell--immersive {
  height: 100vh;
  max-height: 100vh;
  min-height: 100vh;
  background: var(--app-bg);
}

.content-scroll,
.content-scroll--home,
.content-scroll--immersive {
  width: 100%;
  height: 100%;
  max-height: 100%;
  min-width: 0;
  overflow-y: auto;
  padding-right: 0;
  background: var(--app-bg);
}

.content-inner {
  max-width: min(1240px, calc(100% - 112px));
  margin: 0 auto;
  padding: 24px 0 74px;
}

.content-shell--immersive .content-inner {
  max-width: min(920px, calc(100vw - 96px));
  padding: 56px 0 108px;
}

.content-meta {
  margin: 0 0 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--divider-color);
}

.content-breadcrumb {
  margin: 0 0 9px;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0;
  text-transform: none;
}

.content-title {
  margin: 0;
  color: #e5e5e5;
  font-size: 25px;
  font-weight: 700;
  line-height: 1.28;
  letter-spacing: 0;
}

.content-stats {
  margin-top: 10px;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
}

.markdown-body {
  padding-bottom: 36px;
  color: var(--text-primary);
}

.markdown-body :deep(img) {
  border: 1px solid #333333;
  border-radius: 0;
  background: #242424;
  box-shadow: none;
}

.markdown-body :deep(img:hover) {
  box-shadow: none;
  filter: none;
}

.article-navigation {
  margin-top: 38px;
  padding-top: 22px;
  border-top: 1px solid var(--divider-color);
}

.article-navigation__pair {
  gap: 10px;
}

.article-nav-link,
.related-note {
  border: 1px solid #333333;
  border-radius: 4px;
  background: #242424;
  color: var(--text-primary);
  box-shadow: none;
}

.article-nav-link {
  min-height: 102px;
  padding: 14px;
}

.article-nav-link--previous {
  padding-left: 34px;
}

.article-nav-link--next {
  padding-right: 34px;
}

.article-nav-link::before {
  top: 14px;
  color: #c5c5c5;
  font-size: 16px;
}

.article-nav-link--previous::before {
  left: 12px;
}

.article-nav-link--next::before {
  right: 12px;
}

.article-nav-link:hover,
.related-note:hover {
  border-color: #4a4a4a;
  background: #2a2d2e;
  box-shadow: none;
  transform: none;
}

.article-nav-link__label {
  color: #9cdcfe;
}

.article-nav-link__meta,
.related-note__path {
  color: var(--text-muted);
}

.article-nav-link strong,
.related-note strong {
  color: #e5e5e5;
}

.related-notes__header span {
  color: #e5e5e5;
}

.related-notes__header small {
  color: var(--text-muted);
}

/* Simple homepage document */
.intro-panel {
  width: 100%;
  max-width: min(1240px, calc(100% - 112px));
  min-height: auto;
  margin: 0 auto;
  padding: 28px 0 74px;
  display: block;
  color: var(--text-primary);
}

.intro-hero {
  min-height: 0;
  display: block;
  overflow: visible;
}

.intro-hero::before,
.intro-hero__badge,
.intro-hero__actions,
.intro-visual__bar,
.intro-console,
.intro-grid {
  display: none;
}

.intro-hero__copy {
  position: static;
}

.intro-hero__title {
  max-width: none;
  margin: 0;
  color: #e5e5e5;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: 0;
  text-shadow: none;
}

.intro-motto {
  max-width: 820px;
  margin: 12px 0 0;
  color: #d4d4d4;
  background: none;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.7;
  -webkit-background-clip: initial;
  background-clip: initial;
  -webkit-text-fill-color: currentColor;
}

.intro-description {
  max-width: 820px;
  margin: 8px 0 0;
  color: var(--text-secondary);
  font-size: 15px;
  line-height: 1.75;
}

.home-section-title {
  margin: 28px 0 12px;
  color: #e5e5e5;
  font-size: 21px;
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: 0;
  scroll-margin-top: 20px;
}

.intro-stats {
  max-width: 760px;
  margin-top: 22px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.intro-stat {
  min-height: 82px;
  padding: 13px 14px;
  border: 1px solid #333333;
  border-radius: 4px;
  background: #242424;
  box-shadow: none;
  transform: none;
}

.intro-stat:hover {
  border-color: #4a4a4a;
  box-shadow: none;
  transform: none;
}

.intro-stat__icon {
  display: none;
}

.intro-stat__value {
  color: #e5e5e5;
  font-size: 22px;
  font-weight: 700;
}

.intro-stat__label {
  color: var(--text-muted);
  font-size: 12px;
}

.intro-visual {
  margin-top: 28px;
  overflow: visible;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
}

.intro-visual::after {
  display: none;
}

.intro-visual__body {
  display: block;
  padding: 0;
}

.intro-category-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  scroll-margin-top: 20px;
}

.intro-category {
  min-height: 42px;
  border: 1px solid #333333;
  border-radius: 4px;
  padding: 9px 10px;
  background: #242424;
}

.intro-category::before {
  width: 6px;
  height: 6px;
  box-shadow: none;
}

.intro-category strong {
  color: #d4d4d4;
  font-size: 13px;
  font-weight: 600;
}

.intro-category small {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
}

.intro-note-stack {
  margin-top: 24px;
  display: grid;
  gap: 8px;
  scroll-margin-top: 20px;
}

.intro-note-card {
  min-height: 56px;
  padding: 10px 12px;
  border: 1px solid #333333;
  border-radius: 4px;
  background: #242424;
  box-shadow: none;
  transform: none;
}

.intro-note-card:hover {
  border-color: #4a4a4a;
  background: #2a2d2e;
  transform: none;
}

.intro-note-card span {
  color: var(--text-muted);
  font-size: 12px;
}

.intro-note-card strong {
  color: #e5e5e5;
  font-size: 14px;
  font-weight: 600;
}

.intro-goals {
  margin-top: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  scroll-margin-top: 20px;
}

.intro-goal {
  padding: 14px;
  border: 1px solid #333333;
  border-radius: 4px;
  background: #242424;
  box-shadow: none;
  transform: none;
}

.intro-goal::before,
.intro-goal::after {
  display: none;
}

.intro-goal:hover {
  border-color: #4a4a4a;
  box-shadow: none;
  transform: none;
}

.intro-goal__label {
  color: #e5e5e5;
  font-size: 13px;
  font-weight: 600;
}

.intro-goal__date,
.intro-goal__remaining {
  border-radius: 4px;
  background: #2a2d2e;
  color: #9cdcfe;
  box-shadow: none;
  font-size: 12px;
}

.intro-goal__percent {
  color: #e5e5e5;
  font-size: 24px;
  font-weight: 700;
}

.intro-goal__track {
  height: 6px;
  margin-top: 12px;
  border: 0;
  border-radius: 999px;
  background: #333333;
}

.intro-goal__track span {
  background: #007acc;
  box-shadow: none;
}

.intro-goal__meta {
  color: var(--text-muted);
  font-size: 12px;
}

.intro-goal__meta span:first-child {
  color: #c5c5c5;
}

.image-lightbox {
  background: rgba(0, 0, 0, 0.78);
}

.image-lightbox img {
  border-radius: 4px;
  background: #1e1e1e;
  box-shadow: 0 18px 64px rgba(0, 0, 0, 0.48);
}

.image-lightbox__close,
.copy-toast,
.back-top,
.immersive-exit {
  border-color: #333333;
  border-radius: 4px;
  background: #252526;
  color: #d4d4d4;
  box-shadow: none;
}

.back-top:hover,
.immersive-exit:hover {
  border-color: #4a4a4a;
  background: #2a2d2e;
  color: #ffffff;
  transform: none;
}

@media (max-width: 980px) {
  .content-shell,
  .content-shell--home {
    min-height: calc(100vh - var(--header-height));
    height: auto;
    max-height: none;
  }

  .content-scroll,
  .content-scroll--home {
    height: auto;
    max-height: none;
    overflow: visible;
  }
}

@media (max-width: 760px) {
  .content-inner,
  .intro-panel {
    max-width: none;
    padding: 20px 16px 58px;
  }

  .content-shell--immersive .content-inner {
    max-width: none;
    padding: 54px 18px 84px;
  }

  .intro-stats,
  .intro-category-strip,
  .intro-goals {
    grid-template-columns: 1fr;
  }

  .intro-goal__header,
  .intro-goal__summary,
  .intro-goal__meta {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
