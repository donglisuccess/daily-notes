<script setup lang="ts">
import type { OutlineHeading } from '@/types/note';

const props = defineProps<{
  headings: OutlineHeading[];
  activeId: string | null;
}>();

const emit = defineEmits<{ (e: 'navigate', id: string): void }>();

const handleClick = (id: string) => {
  emit('navigate', id);
};
</script>

<template>
  <div class="toc-panel panel">
    <div class="toc-title">文章大纲</div>
    <ul v-if="headings.length" class="toc-list">
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
    <p v-else class="toc-empty">暂无可用标题</p>
  </div>
</template>
