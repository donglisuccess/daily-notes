<script setup lang="ts">
import { computed } from 'vue';

import IconMoon from './icons/IconMoon.vue';
import IconSun from './icons/IconSun.vue';

const props = defineProps<{ theme: 'light' | 'dark' }>();
const emit = defineEmits<{ (e: 'toggle'): void }>();

const label = computed(() => (props.theme === 'dark' ? '切换为浅色主题' : '切换为深色主题'));
</script>

<template>
  <button class="theme-toggle" :aria-label="label" type="button" @click="emit('toggle')">
    <IconSun v-if="theme === 'dark'" />
    <IconMoon v-else />
    <span>{{ theme === 'dark' ? '深色' : '浅色' }}</span>
  </button>
</template>

<style scoped>
.theme-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: 1px solid var(--panel-border);
  border-radius: 999px;
  background: var(--panel-bg);
  color: var(--text-primary);
  cursor: pointer;
  font-weight: 500;
  transition: transform var(--transition-base), border-color var(--transition-base);
}

.theme-toggle:hover {
  border-color: var(--accent);
  transform: translateY(-1px);
}

.theme-toggle:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
