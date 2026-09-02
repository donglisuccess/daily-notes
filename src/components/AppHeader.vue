<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { useNotes } from '@/composables/useNotes';
import IconMenu from './icons/IconMenu.vue';

defineProps<{
  showImmersiveButton?: boolean;
}>();

const emit = defineEmits<{
  (e: 'toggle-immersive'): void;
  (e: 'toggle-menu'): void;
  (e: 'navigate-home'): void;
}>();

const { noteFiles } = useNotes();
const router = useRouter();

const searchQuery = ref('');
const searchVisible = ref(false);
const searchInputRef = ref<HTMLInputElement>();
const activeIndex = ref(-1);

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
  }
}

function handleSelectNote(routePath: string) {
  router.push(routePath);
  hideSearch();
}

function handleSearchInput() {
  activeIndex.value = -1;
}

function handleInputKeydown(event: KeyboardEvent) {
  switch (event.key) {
    case 'Escape':
      event.stopPropagation();
      hideSearch();
      break;
    case 'ArrowDown':
      event.stopPropagation();
      event.preventDefault();
      activeIndex.value = Math.min(activeIndex.value + 1, filteredNotes.value.length - 1);
      break;
    case 'ArrowUp':
      event.stopPropagation();
      event.preventDefault();
      activeIndex.value = Math.max(activeIndex.value - 1, -1);
      break;
    case 'Enter':
      if (activeIndex.value >= 0) {
        event.stopPropagation();
        event.preventDefault();
        const selected = filteredNotes.value[activeIndex.value];
        if (selected) {
          router.push(selected.routePath);
          hideSearch();
        }
      }
      break;
    default:
      event.stopPropagation();
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <header class="app-header">
    <div class="header-left">
      <button class="menu-toggle" type="button" aria-label="展开目录" @click="emit('toggle-menu')">
        <IconMenu />
      </button>
      <button class="app-title" type="button" @click="emit('navigate-home')">
        <span class="app-title__name">Daily Notes</span>
        <span class="app-title__meta">Markdown 知识库</span>
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
            placeholder="搜索文章"
            autocomplete="off"
            @focus="showSearch"
            @input="handleSearchInput"
            @keydown="handleInputKeydown"
          />
          <kbd class="search-kbd">Ctrl K</kbd>
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

    <div class="header-actions">
      <button
        v-if="showImmersiveButton"
        class="header-immersive-toggle"
        type="button"
        aria-label="进入沉浸阅读"
        title="进入沉浸阅读"
        @click="emit('toggle-immersive')"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 3H5a2 2 0 0 0-2 2v3" />
          <path d="M16 3h3a2 2 0 0 1 2 2v3" />
          <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
          <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
        </svg>
        <span>沉浸阅读</span>
      </button>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  min-height: var(--header-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  border-bottom: 1px solid var(--panel-border);
  background: #181818;
  position: relative;
  z-index: 10;
}

.header-left,
.header-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.header-actions {
  flex: 0 0 auto;
  min-width: 110px;
  justify-content: flex-end;
}

.menu-toggle,
.header-immersive-toggle {
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font: inherit;
  transition:
    background var(--transition-base),
    border-color var(--transition-base),
    color var(--transition-base);
}

.menu-toggle {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.menu-toggle:hover,
.header-immersive-toggle:hover {
  background: var(--panel-muted);
  border-color: var(--panel-border);
  color: var(--text-primary);
}

.app-title {
  min-width: 0;
  display: inline-flex;
  align-items: baseline;
  gap: 10px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
}

.app-title__name {
  font-size: 14px;
  font-weight: 650;
  line-height: 1;
}

.app-title__meta {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 500;
}

.header-immersive-toggle {
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 10px;
  border-radius: 4px;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}

.header-immersive-toggle svg {
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
}

.app-title:focus-visible,
.menu-toggle:focus-visible,
.header-immersive-toggle:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.header-center {
  flex: 1;
  display: flex;
  justify-content: center;
  min-width: 0;
  padding: 0 clamp(12px, 4vw, 32px);
}

.search-box {
  position: relative;
  width: min(460px, 100%);
}

.search-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.search-input {
  width: 100%;
  height: 30px;
  padding: 0 58px 0 34px;
  box-sizing: border-box;
  border: 1px solid #3c3c3c;
  border-radius: 4px;
  outline: none;
  background: #252526;
  color: var(--text-primary);
  font-size: 13px;
  appearance: none;
  -webkit-appearance: none;
  transition:
    border-color var(--transition-base),
    box-shadow var(--transition-base);
}

.search-input::placeholder {
  color: var(--text-muted);
}

.search-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

.search-input-wrap::before {
  content: '';
  position: absolute;
  left: 12px;
  top: 50%;
  width: 12px;
  height: 12px;
  border: 1.8px solid var(--text-muted);
  border-radius: 50%;
  transform: translateY(-50%);
  pointer-events: none;
}

.search-input-wrap::after {
  content: '';
  position: absolute;
  left: 22px;
  top: calc(50% + 5px);
  width: 6px;
  height: 1.8px;
  background: var(--text-muted);
  transform: translateY(-50%) rotate(45deg);
  pointer-events: none;
}

.search-kbd {
  position: absolute;
  right: 7px;
  top: 50%;
  transform: translateY(-50%);
  padding: 2px 5px;
  border: 1px solid #3c3c3c;
  border-radius: 3px;
  background: #1f1f1f;
  color: var(--text-muted);
  font-family: inherit;
  font-size: 10px;
  line-height: 1.2;
  pointer-events: none;
  white-space: nowrap;
}

.search-results,
.search-empty {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 100;
  border: 1px solid var(--panel-border);
  border-radius: 4px;
  background: #252526;
  box-shadow: 0 18px 36px rgba(0, 0, 0, 0.34);
}

.search-results {
  list-style: none;
  margin: 0;
  padding: 5px;
  overflow: hidden;
}

.search-result {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 8px 9px;
  border-radius: 3px;
  cursor: pointer;
  transition: background var(--transition-base);
}

.search-result__path {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
}

.search-result__title {
  overflow: hidden;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-result:hover,
.search-result--active {
  background: var(--panel-muted);
}

.search-result--active .search-result__title {
  color: #ffffff;
}

.search-empty {
  padding: 12px;
  color: var(--text-muted);
  font-size: 13px;
  text-align: center;
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

  .header-actions {
    min-width: auto;
  }
}

@media (max-width: 600px) {
  .app-header {
    padding: 0 10px;
  }

  .app-title {
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }

  .app-title__meta {
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .header-immersive-toggle {
    width: 34px;
    min-width: 34px;
    height: 34px;
    padding: 0;
  }

  .header-immersive-toggle span {
    display: none;
  }
}
</style>
