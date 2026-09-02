<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { OutlineHeading } from '@/types/note';

const props = withDefaults(
  defineProps<{
    title?: string;
    headings: OutlineHeading[];
    activeId: string | null;
  }>(),
  {
    title: '文章大纲'
  }
);

const emit = defineEmits<{ (e: 'navigate', id: string): void }>();
const collapsedIds = ref<Set<string>>(new Set());

const visibleHeadings = computed(() => {
  const hiddenAncestorLevels: number[] = [];

  return props.headings
    .map((heading, index) => {
      while (
        hiddenAncestorLevels.length &&
        heading.level <= hiddenAncestorLevels[hiddenAncestorLevels.length - 1]
      ) {
        hiddenAncestorLevels.pop();
      }

      const visible = hiddenAncestorLevels.length === 0;
      const hasChildren = Boolean(props.headings[index + 1] && props.headings[index + 1].level > heading.level);
      const collapsed = collapsedIds.value.has(heading.id);

      if (visible && hasChildren && collapsed) {
        hiddenAncestorLevels.push(heading.level);
      }

      return {
        ...heading,
        hasChildren,
        collapsed,
        visible
      };
    })
    .filter((heading) => heading.visible);
});

watch(
  () => props.headings.map((heading) => heading.id).join('|'),
  () => {
    collapsedIds.value = new Set();
  }
);

const handleClick = (id: string) => {
  emit('navigate', id);
};

const handleToggle = (id: string) => {
  const next = new Set(collapsedIds.value);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  collapsedIds.value = next;
};
</script>

<template>
  <aside class="toc-panel panel">
    <div class="toc-header">
      <div class="toc-title">{{ title }}</div>
    </div>
    <TransitionGroup v-if="visibleHeadings.length" name="toc-outline" tag="ul" class="toc-list">
      <li
        v-for="heading in visibleHeadings"
        :key="heading.id"
        class="toc-item"
        :class="[
          `level-${heading.level}`,
          { active: heading.id === activeId }
        ]"
      >
        <button
          v-if="heading.hasChildren"
          class="toc-expander"
          :class="{ 'is-collapsed': heading.collapsed }"
          type="button"
          :aria-label="heading.collapsed ? `展开 ${heading.text}` : `收起 ${heading.text}`"
          :aria-expanded="!heading.collapsed"
          @click.stop="handleToggle(heading.id)"
        >
          <span class="toc-expander__icon" aria-hidden="true"></span>
        </button>
        <span v-else class="toc-expander toc-expander--placeholder" aria-hidden="true"></span>
        <button class="toc-link" type="button" @click="handleClick(heading.id)">
          <span class="toc-text" :title="heading.text">{{ heading.text }}</span>
        </button>
      </li>
    </TransitionGroup>
    <p v-else class="toc-empty">暂无可用标题</p>
  </aside>
</template>

<style scoped>
.toc-header {
  flex: 0 0 auto;
  padding: 18px 16px 8px;
}
</style>
