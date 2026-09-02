<script setup lang="ts">
import { ElDrawer } from 'element-plus';
import 'element-plus/es/components/drawer/style/css';
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import AppHeader from './components/AppHeader.vue';
import ContentViewer from './components/ContentViewer.vue';
import SidebarTree from './components/SidebarTree.vue';
import TocSidebar from './components/TocSidebar.vue';
import { useNotes } from './composables/useNotes';
import { NOTE_ROUTE_PREFIX } from './router';
import type { LoadedNote, OutlineHeading } from './types/note';

const notes = useNotes();
const route = useRoute();
const router = useRouter();
const currentNote = ref<LoadedNote | null>(null);
const headings = ref<OutlineHeading[]>([]);
const activeHeading = ref<string | null>(null);
const isMobileNavOpen = ref(false);
const isImmersiveReading = ref(false);
const currentPath = computed(() => (route.path.startsWith(NOTE_ROUTE_PREFIX) ? route.path : ''));
let loadToken = 0;
const isImmersiveActive = computed(() => Boolean(currentNote.value && isImmersiveReading.value));
const noteNavigation = computed(() =>
  currentNote.value ? notes.getNoteNavigation(currentNote.value.routePath) : null
);

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
      class="layout"
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

      <ContentViewer
        :note="currentNote"
        :navigation="noteNavigation"
        :immersive="isImmersiveActive"
        @update:headings="handleHeadingsUpdate"
        @active-heading-change="handleActiveHeading"
        @navigate-note="handleSelectNote"
        @exit-immersive="handleExitImmersive"
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
