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
        Daily Notes
        <span>Markdown 知识库</span>
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

@media (min-width: 900px) {
  .menu-toggle {
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
