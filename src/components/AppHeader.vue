<script setup lang="ts">
import ThemeToggle from './ThemeToggle.vue';
import IconMenu from './icons/IconMenu.vue';
import { useNotes } from '@/composables/useNotes';
import { useRouter } from 'vue-router';
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

defineProps<{ theme: 'light' | 'dark' }>();
const emit = defineEmits<{
  (e: 'toggle-theme'): void;
  (e: 'toggle-menu'): void;
  (e: 'navigate-home'): void;
}>();

const { noteFiles } = useNotes();
const router = useRouter();

const searchQuery = ref('');
const searchVisible = ref(false);
const searchInputRef = ref<HTMLInputElement>();
const activeIndex = ref(-1);
let searchFrame: number | undefined;

const filteredNotes = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) {
    return [];
  }
  return noteFiles
    .filter((note) => note.title.toLowerCase().includes(q))
    .slice(0, 8);
});

function showSearch() {
  searchVisible.value = true;
  nextTick(() => searchInputRef.value?.focus());
}

function hideSearch() {
  searchVisible.value = false;
  searchQuery.value = '';
  activeIndex.value = -1;
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'k' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    if (searchVisible.value) {
      hideSearch();
    } else {
      showSearch();
    }
    return;
  }

  if (!searchVisible.value) {
    return;
  }

  if (event.key === 'Escape') {
    hideSearch();
    return;
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    activeIndex.value = Math.min(activeIndex.value + 1, filteredNotes.value.length - 1);
    return;
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    activeIndex.value = Math.max(activeIndex.value - 1, -1);
    return;
  }

  if (event.key === 'Enter' && activeIndex.value >= 0) {
    event.preventDefault();
    const selected = filteredNotes.value[activeIndex.value];
    if (selected) {
      router.push(selected.routePath);
      hideSearch();
    }
    return;
  }
}

function handleSelectNote(routePath: string) {
  router.push(routePath);
  hideSearch();
}

function handleSearchInput() {
  activeIndex.value = -1;
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
  if (searchFrame !== undefined) {
    window.cancelAnimationFrame(searchFrame);
  }
});
</script>

<template>
  <header class="app-header">
    <div class="header-left">
      <button class="menu-toggle" type="button" aria-label="展开目录" @click="emit('toggle-menu')">
        <IconMenu />
      </button>
      <button class="app-title" type="button" @click="emit('navigate-home')">
        Daily Notes
        <span>Markdown 知识库</span>
      </button>
    </div>

    <div class="header-center">
      <div class="search-box" :class="{ 'search-box--active': searchVisible }">
        <div class="search-input-wrap">
          <input
            ref="searchInputRef"
            v-model="searchQuery"
            class="search-input"
            type="search"
            placeholder="搜索文章…"
            autocomplete="off"
            @input="handleSearchInput"
            @keydown.stop
          />
          <kbd class="search-kbd">⌘K</kbd>
        </div>
        <ul v-if="searchVisible && filteredNotes.length" class="search-results" role="listbox">
          <li
            v-for="(note, idx) in filteredNotes"
            :key="note.routePath"
            class="search-result"
            :class="{ 'search-result--active': idx === activeIndex }"
            role="option"
            @click="handleSelectNote(note.routePath)"
            @mouseenter="activeIndex = idx"
          >
            <span class="search-result__path">{{ note.segments.slice(0, -1).join(' / ') }}</span>
            <span class="search-result__title">{{ note.title }}</span>
          </li>
        </ul>
        <div v-else-if="searchVisible && searchQuery.trim()" class="search-empty">
          未找到匹配文章
        </div>
      </div>
    </div>

    <ThemeToggle :theme="theme" @toggle="emit('toggle-theme')" />
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px clamp(16px, 4vw, 40px);
  border-bottom: 1px solid var(--panel-border);
  background: color-mix(in srgb, var(--app-bg) 86%, transparent);
  backdrop-filter: blur(18px);
  position: sticky;
  top: 0;
  z-index: 10;
  min-height: var(--header-height);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.menu-toggle {
  width: 38px;
  height: 38px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--panel-border);
  background: var(--panel-bg);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-primary);
  cursor: pointer;
  transition: border-color var(--transition-base), background var(--transition-base);
}

.menu-toggle:hover {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--panel-border));
  background: var(--accent-soft);
}

.app-title {
  font-size: 18px;
  font-weight: 650;
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
}

.app-title span {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 500;
}

.app-title:focus-visible,
.menu-toggle:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

/* Search */
.header-center {
  flex: 1;
  display: flex;
  justify-content: center;
  padding: 0 clamp(12px, 4vw, 32px);
}

.search-box {
  position: relative;
  width: 100%;
  max-width: 440px;
}

.search-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.search-input {
  width: 100%;
  height: 36px;
  padding: 0 48px 0 36px;
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-sm);
  background: var(--panel-bg);
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
  transition: border-color var(--transition-base), box-shadow var(--transition-base);
  box-sizing: border-box;
  appearance: none;
  -webkit-appearance: none;
}

.search-input::placeholder {
  color: var(--text-muted);
}

.search-input:focus {
  border-color: color-mix(in srgb, var(--accent) 55%, var(--panel-border));
  box-shadow: 0 0 0 3px var(--accent-soft);
}

/* Search icon via background pseudo-element */
.search-input-wrap::before {
  content: '';
  position: absolute;
  left: 11px;
  top: 50%;
  transform: translateY(-50%);
  width: 15px;
  height: 15px;
  background: transparent;
  border: 2px solid var(--text-muted);
  border-radius: 50%;
  pointer-events: none;
}

.search-input-wrap::after {
  content: '';
  position: absolute;
  left: 23px;
  top: calc(50% + 2px);
  transform: translateY(-50%) rotate(45deg);
  width: 6px;
  height: 2px;
  background: var(--text-muted);
  pointer-events: none;
}

.search-kbd {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  padding: 2px 6px;
  border: 1px solid var(--panel-border);
  border-radius: 5px;
  background: var(--panel-muted);
  color: var(--text-muted);
  font-size: 11px;
  font-family: inherit;
  line-height: 1.4;
  pointer-events: none;
  white-space: nowrap;
}

.search-results {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-md);
  box-shadow: 0 18px 45px rgba(62, 49, 38, 0.14);
  list-style: none;
  margin: 0;
  padding: 6px;
  z-index: 100;
  overflow: hidden;
}

.search-result {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition-base);
}

.search-result__path {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 600;
}

.search-result__title {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-result:hover,
.search-result--active {
  background: var(--accent-soft);
}

.search-result--active .search-result__title {
  color: var(--accent);
}

.search-empty {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  padding: 14px 12px;
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-md);
  box-shadow: 0 18px 45px rgba(62, 49, 38, 0.14);
  color: var(--text-muted);
  font-size: 13px;
  text-align: center;
  z-index: 100;
}

@media (min-width: 900px) {
  .menu-toggle {
    display: none;
  }
}

@media (max-width: 900px) {
  .header-center {
    display: none;
  }
}

@media (max-width: 600px) {
  .app-header {
    padding: 10px 12px;
  }

  .header-left {
    min-width: 0;
  }

  .app-title {
    min-width: 0;
    font-size: 16px;
  }

  .app-title span {
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>