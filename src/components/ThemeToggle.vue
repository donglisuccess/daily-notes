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
  min-height: 38px;
  padding: 8px 13px;
  border: 1px solid var(--panel-border);
  border-radius: 999px;
  background: var(--panel-bg);
  color: var(--text-primary);
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
  transition: background var(--transition-base), border-color var(--transition-base), color var(--transition-base);
}

.theme-toggle:hover {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--panel-border));
  background: var(--accent-soft);
  color: var(--accent);
}

.theme-toggle:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

@media (max-width: 480px) {
  .theme-toggle {
    width: 38px;
    justify-content: center;
    padding: 8px;
  }

  .theme-toggle span {
    display: none;
  }
}
</style>
