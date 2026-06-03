<script setup lang="ts">
import { ref } from 'vue';
import type { OutlineHeading } from '@/types/note';

defineProps<{
  headings: OutlineHeading[];
  activeId: string | null;
}>();

const emit = defineEmits<{ (e: 'navigate', id: string): void }>();
const isCollapsed = ref(false);

const handleClick = (id: string) => {
  emit('navigate', id);
};
</script>

<template>
  <div class="toc-panel panel" :class="{ 'is-collapsed': isCollapsed }">
    <div class="toc-header">
      <div class="toc-title">文章大纲</div>
      <button
        v-if="headings.length"
        class="toc-toggle"
        type="button"
        :aria-expanded="!isCollapsed"
        :aria-label="isCollapsed ? '展开文章大纲' : '收起文章大纲'"
        @click="isCollapsed = !isCollapsed"
      >
        {{ isCollapsed ? '展开' : '收起' }}
      </button>
    </div>
    <ul v-if="headings.length && !isCollapsed" class="toc-list">
      <li
        v-for="heading in headings"
        :key="heading.id"
        class="toc-item"
        :class="[
          `level-${heading.level}`,
          { active: heading.id === activeId }
        ]"
        @click="handleClick(heading.id)"
      >
        <span class="toc-text" :title="heading.text">{{ heading.text }}</span>
      </li>
    </ul>
    <p v-else-if="!isCollapsed" class="toc-empty">暂无可用标题</p>
  </div>
</template>

<style scoped>
.toc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.toc-toggle {
  flex: 0 0 auto;
  border: 1px solid var(--panel-border);
  border-radius: 999px;
  padding: 4px 9px;
  background: var(--panel-bg);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 650;
  transition: background var(--transition-base), border-color var(--transition-base), color var(--transition-base);
}

.toc-toggle:hover {
  border-color: color-mix(in srgb, var(--accent) 44%, var(--panel-border));
  background: var(--accent-soft);
  color: var(--accent);
}

.toc-toggle:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.toc-panel.is-collapsed {
  gap: 0;
}
</style>
