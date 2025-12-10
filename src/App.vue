<script setup lang="ts">
import { ElDrawer } from 'element-plus';
import 'element-plus/es/components/drawer/style/css';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import AppHeader from './components/AppHeader.vue';
import ContentViewer from './components/ContentViewer.vue';
import SidebarTree from './components/SidebarTree.vue';
import TocSidebar from './components/TocSidebar.vue';
import { useNotes } from './composables/useNotes';
import { useTheme } from './composables/useTheme';
import { NOTE_ROUTE_PREFIX } from './router';
import type { LoadedNote, OutlineHeading } from './types/note';

const notes = useNotes();
const route = useRoute();
const router = useRouter();
const { theme, toggleTheme } = useTheme();

const currentNote = ref<LoadedNote | null>(null);
const headings = ref<OutlineHeading[]>([]);
const activeHeading = ref<string | null>(null);
const isMobileNavOpen = ref(false);
const currentPath = computed(() => (route.path.startsWith(NOTE_ROUTE_PREFIX) ? route.path : ''));
let loadToken = 0;
const showToc = computed(() => Boolean(currentNote.value));

watch(
  () => currentPath.value,
  async (value) => {
    if (!value) {
      currentNote.value = null;
      notes.rememberRoute('');
      return;
    }

    if (!notes.isValidRoute(value)) {
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

onMounted(() => {
  if (route.path === '/') {
    const saved = notes.getSavedRoute();
    if (saved) {
      router.replace(saved);
    }
  }
});

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
  handleCloseMobileNav();
};
</script>

<template>
  <div class="app-shell">
    <AppHeader
      :theme="theme"
      @toggle-theme="toggleTheme"
      @toggle-menu="handleOpenMobileNav"
      @navigate-home="handleNavigateHome"
    />

    <div class="layout" :class="{ 'layout--no-toc': !showToc }">
      <section class="sidebar-panel panel">
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
        @update:headings="handleHeadingsUpdate"
        @active-heading-change="handleActiveHeading"
      />

      <TocSidebar
        v-if="showToc"
        :headings="headings"
        :active-id="activeHeading"
        @navigate="handleNavigate"
      />
    </div>

    <ElDrawer
      v-model="isMobileNavOpen"
      direction="ltr"
      size="78%"
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
