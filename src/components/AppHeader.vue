<script setup lang="ts">
import ThemeToggle from './ThemeToggle.vue';
import IconMenu from './icons/IconMenu.vue';

const props = defineProps<{ theme: 'light' | 'dark'; isPersonalMode: boolean }>();
const emit = defineEmits<{
  (e: 'toggle-theme'): void;
  (e: 'toggle-menu'): void;
  (e: 'navigate-home'): void;
  (e: 'enter-personal-mode'): void;
  (e: 'exit-personal-mode'): void;
}>();

const handlePersonalModeClick = () => {
  if (props.isPersonalMode) {
    emit('exit-personal-mode');
    return;
  }
  emit('enter-personal-mode');
};
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
    <div class="header-actions">
      <button class="personal-mode-btn" type="button" @click="handlePersonalModeClick">
        {{ props.isPersonalMode ? '退出个人模式' : '个人模式' }}
      </button>
      <ThemeToggle :theme="props.theme" @toggle="emit('toggle-theme')" />
    </div>
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
  gap: 12px;
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.personal-mode-btn {
  border: 1px solid var(--panel-border);
  border-radius: 999px;
  background: var(--panel-bg);
  color: var(--text-primary);
  padding: 10px 18px;
  font-weight: 500;
  cursor: pointer;
  transition: border-color var(--transition-base), transform var(--transition-base),
    color var(--transition-base);
}

.personal-mode-btn:hover {
  border-color: var(--accent);
  transform: translateY(-1px);
  color: var(--accent);
}

.personal-mode-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

@media (max-width: 600px) {
  .app-header {
    padding: 14px 16px;
  }

  .header-actions {
    gap: 8px;
  }

  .personal-mode-btn {
    padding: 6px 12px;
    font-size: 13px;
  }

  :deep(.theme-toggle) {
    padding: 6px 12px;
    font-size: 13px;
  }

  :deep(.theme-toggle span) {
    font-size: 12px;
  }
}

@media (min-width: 900px) {
  .menu-toggle {
    display: none;
  }
}
</style>
