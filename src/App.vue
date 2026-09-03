<script setup lang="ts">
import { ElDrawer } from 'element-plus';
import 'element-plus/es/components/drawer/style/css';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import AppHeader from './components/AppHeader.vue';
import ContentViewer from './components/ContentViewer.vue';
import SidebarTree from './components/SidebarTree.vue';
import TocSidebar from './components/TocSidebar.vue';
import { useNotes } from './composables/useNotes';
import { NOTE_ROUTE_PREFIX } from './router';
import type { LoadedNote, OutlineHeading } from './types/note';

type ResizeTarget = 'sidebar' | 'toc';

const DEFAULT_SIDEBAR_WIDTH = 282;
const DEFAULT_TOC_WIDTH = 330;
const MIN_SIDEBAR_WIDTH = 180;
const MAX_SIDEBAR_WIDTH = 520;
const MIN_TOC_WIDTH = 220;
const MAX_TOC_WIDTH = 520;
const MIN_CONTENT_WIDTH = 420;
const RESIZER_WIDTH = 4;

const notes = useNotes();
const route = useRoute();
const router = useRouter();
const currentNote = ref<LoadedNote | null>(null);
const headings = ref<OutlineHeading[]>([]);
const activeHeading = ref<string | null>(null);
const isMobileNavOpen = ref(false);
const isImmersiveReading = ref(false);
const layoutRef = ref<HTMLElement>();
const sidebarWidth = ref(DEFAULT_SIDEBAR_WIDTH);
const tocWidth = ref(DEFAULT_TOC_WIDTH);
const activeResizeTarget = ref<ResizeTarget | null>(null);
const currentPath = computed(() => (route.path.startsWith(NOTE_ROUTE_PREFIX) ? route.path : ''));
let loadToken = 0;
let activePointerId: number | null = null;
const isImmersiveActive = computed(() => Boolean(currentNote.value && isImmersiveReading.value));
const noteNavigation = computed(() =>
  currentNote.value ? notes.getNoteNavigation(currentNote.value.routePath) : null
);
const layoutStyle = computed<Record<string, string>>(() => ({
  '--app-sidebar-width': `${sidebarWidth.value}px`,
  '--app-toc-width': `${tocWidth.value}px`
}));

watch(
  () => currentPath.value,
  async (value) => {
    if (!value) {
      loadToken += 1;
      currentNote.value = null;
      isImmersiveReading.value = false;
      notes.rememberRoute('');
      return;
    }

    if (!notes.isValidRoute(value)) {
      loadToken += 1;
      router.replace('/');
      return;
    }

    const token = ++loadToken;
    const loaded = await notes.loadNote(value);
    if (token !== loadToken) {
      return;
    }
    if (!loaded) {
      router.replace('/');
      return;
    }
    currentNote.value = loaded;
    notes.rememberRoute(value);
  },
  { immediate: true }
);

const handleHeadingsUpdate = (value: OutlineHeading[]) => {
  headings.value = value;
};

const handleActiveHeading = (value: string | null) => {
  activeHeading.value = value;
};

const handleNavigate = (id: string) => {
  if (typeof document === 'undefined') return;
  const target = document.getElementById(id);
  target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const clampWidth = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getMaxSidebarWidth = () => {
  const rect = layoutRef.value?.getBoundingClientRect();
  if (!rect) {
    return MAX_SIDEBAR_WIDTH;
  }

  const reservedRight = currentNote.value ? tocWidth.value + RESIZER_WIDTH * 2 : RESIZER_WIDTH;
  return Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, rect.width - reservedRight - MIN_CONTENT_WIDTH));
};

const getMaxTocWidth = () => {
  const rect = layoutRef.value?.getBoundingClientRect();
  if (!rect) {
    return MAX_TOC_WIDTH;
  }

  return Math.max(MIN_TOC_WIDTH, Math.min(MAX_TOC_WIDTH, rect.width - sidebarWidth.value - RESIZER_WIDTH * 2 - MIN_CONTENT_WIDTH));
};

const updateResizeValue = (target: ResizeTarget, clientX: number) => {
  const rect = layoutRef.value?.getBoundingClientRect();
  if (!rect) {
    return;
  }

  if (target === 'sidebar') {
    sidebarWidth.value = clampWidth(clientX - rect.left, MIN_SIDEBAR_WIDTH, getMaxSidebarWidth());
    return;
  }

  tocWidth.value = clampWidth(rect.right - clientX, MIN_TOC_WIDTH, getMaxTocWidth());
};

const cleanupResize = () => {
  activePointerId = null;
  activeResizeTarget.value = null;
  window.removeEventListener('pointermove', handleResizeMove);
  window.removeEventListener('pointerup', handleResizeEnd);
  window.removeEventListener('pointercancel', handleResizeEnd);
  document.body.classList.remove('is-layout-resizing');
};

const handleResizeMove = (event: PointerEvent) => {
  if (!activeResizeTarget.value || event.pointerId !== activePointerId) {
    return;
  }

  event.preventDefault();
  updateResizeValue(activeResizeTarget.value, event.clientX);
};

const handleResizeEnd = (event: PointerEvent) => {
  if (activePointerId !== null && event.pointerId !== activePointerId) {
    return;
  }

  cleanupResize();
};

const handleResizeStart = (target: ResizeTarget, event: PointerEvent) => {
  if (event.button !== 0) {
    return;
  }

  event.preventDefault();
  activePointerId = event.pointerId;
  activeResizeTarget.value = target;
  document.body.classList.add('is-layout-resizing');
  updateResizeValue(target, event.clientX);
  window.addEventListener('pointermove', handleResizeMove, { passive: false });
  window.addEventListener('pointerup', handleResizeEnd);
  window.addEventListener('pointercancel', handleResizeEnd);
};

const handleResizerKeydown = (target: ResizeTarget, event: KeyboardEvent) => {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
    return;
  }

  event.preventDefault();
  const step = event.shiftKey ? 32 : 12;
  const direction = event.key === 'ArrowRight' ? 1 : -1;

  if (target === 'sidebar') {
    sidebarWidth.value = clampWidth(sidebarWidth.value + direction * step, MIN_SIDEBAR_WIDTH, getMaxSidebarWidth());
    return;
  }

  tocWidth.value = clampWidth(tocWidth.value - direction * step, MIN_TOC_WIDTH, getMaxTocWidth());
};

const handleResizerReset = (target: ResizeTarget) => {
  if (target === 'sidebar') {
    sidebarWidth.value = DEFAULT_SIDEBAR_WIDTH;
    return;
  }

  tocWidth.value = DEFAULT_TOC_WIDTH;
};

onBeforeUnmount(() => {
  cleanupResize();
});

const handleOpenMobileNav = () => {
  isMobileNavOpen.value = true;
};

const handleCloseMobileNav = () => {
  isMobileNavOpen.value = false;
};

const handleSelectNote = (path: string) => {
  if (!path) {
    router.push('/');
  } else {
    router.push(path);
  }
  handleCloseMobileNav();
};

const handleNavigateHome = () => {
  router.push('/');
  isImmersiveReading.value = false;
  handleCloseMobileNav();
};

const handleToggleImmersive = () => {
  if (!currentNote.value) {
    return;
  }
  isImmersiveReading.value = !isImmersiveReading.value;
  if (isImmersiveReading.value) {
    handleCloseMobileNav();
  }
};

const handleExitImmersive = () => {
  isImmersiveReading.value = false;
};
</script>

<template>
  <div class="app-shell" :class="{ 'app-shell--immersive': isImmersiveActive }">
    <AppHeader
      v-if="!isImmersiveActive"
      :show-immersive-button="Boolean(currentNote)"
      @toggle-immersive="handleToggleImmersive"
      @toggle-menu="handleOpenMobileNav"
      @navigate-home="handleNavigateHome"
    />

    <div
      ref="layoutRef"
      class="layout"
      :style="layoutStyle"
      :class="{
        'layout--immersive': isImmersiveActive,
        'layout--home': !currentNote
      }"
    >
      <section v-if="!isImmersiveActive" class="sidebar-panel panel">
        <div class="sidebar-scroll">
          <SidebarTree
            :data="notes.treeData"
            :current-path="currentPath"
            @select="handleSelectNote"
          />
        </div>
      </section>

      <div
        v-if="!isImmersiveActive"
        class="layout-resizer layout-resizer--sidebar"
        :class="{ 'is-active': activeResizeTarget === 'sidebar' }"
        role="separator"
        aria-orientation="vertical"
        aria-label="调整文章列表宽度"
        :aria-valuemin="MIN_SIDEBAR_WIDTH"
        :aria-valuemax="getMaxSidebarWidth()"
        :aria-valuenow="Math.round(sidebarWidth)"
        tabindex="0"
        @pointerdown="handleResizeStart('sidebar', $event)"
        @keydown="handleResizerKeydown('sidebar', $event)"
        @dblclick="handleResizerReset('sidebar')"
      />

      <ContentViewer
        :note="currentNote"
        :navigation="noteNavigation"
        :immersive="isImmersiveActive"
        @update:headings="handleHeadingsUpdate"
        @active-heading-change="handleActiveHeading"
        @navigate-note="handleSelectNote"
        @exit-immersive="handleExitImmersive"
      />

      <div
        v-if="currentNote && !isImmersiveActive"
        class="layout-resizer layout-resizer--toc"
        :class="{ 'is-active': activeResizeTarget === 'toc' }"
        role="separator"
        aria-orientation="vertical"
        aria-label="调整文章大纲宽度"
        :aria-valuemin="MIN_TOC_WIDTH"
        :aria-valuemax="getMaxTocWidth()"
        :aria-valuenow="Math.round(tocWidth)"
        tabindex="0"
        @pointerdown="handleResizeStart('toc', $event)"
        @keydown="handleResizerKeydown('toc', $event)"
        @dblclick="handleResizerReset('toc')"
      />

      <TocSidebar
        v-if="currentNote && !isImmersiveActive"
        title="文章大纲"
        :headings="headings"
        :active-id="activeHeading"
        @navigate="handleNavigate"
      />
    </div>

    <ElDrawer
      v-if="!isImmersiveActive"
      v-model="isMobileNavOpen"
      direction="ltr"
      size="min(88vw, 340px)"
      :with-header="false"
      custom-class="mobile-nav-drawer"
    >
      <SidebarTree
        :data="notes.treeData"
        :current-path="currentPath"
        @select="handleSelectNote"
      />
    </ElDrawer>
  </div>
</template>
