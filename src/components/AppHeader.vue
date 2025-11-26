<script setup lang="ts">
import ThemeToggle from './ThemeToggle.vue';
import IconMenu from './icons/IconMenu.vue';

defineProps<{ theme: 'light' | 'dark' }>();
const emit = defineEmits<{
  (e: 'toggle-theme'): void;
  (e: 'toggle-menu'): void;
  (e: 'navigate-home'): void;
}>();
</script>

<template>
  <header class="app-header">
    <div class="header-left">
      <button class="menu-toggle" type="button" aria-label="展开目录" @click="emit('toggle-menu')">
        <IconMenu />
      </button>
      <button class="app-title" type="button" @click="emit('navigate-home')">
        日常笔记
        <span>Markdown 驱动的个人知识库</span>
      </button>
    </div>
    <ThemeToggle :theme="theme" @toggle="emit('toggle-theme')" />
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 32px;
  border-bottom: 1px solid var(--panel-border);
  background: var(--panel-bg);
  backdrop-filter: blur(12px);
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
  width: 40px;
  height: 40px;
  border-radius: 12px;
  border: 1px solid var(--panel-border);
  background: var(--panel-bg);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-primary);
  cursor: pointer;
  transition: border-color var(--transition-base), transform var(--transition-base);
}

.menu-toggle:hover {
  border-color: var(--accent);
  transform: translateY(-1px);
}

.app-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
}

.app-title span {
  font-size: 13px;
  color: var(--text-secondary);
}

.app-title:focus-visible,
.menu-toggle:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

@media (min-width: 900px) {
  .menu-toggle {
    display: none;
  }
}
</style>
