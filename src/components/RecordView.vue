<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import ContentViewer from './ContentViewer.vue';
import IconDocumentLarge from './icons/IconDocumentLarge.vue';
import IconFolderLarge from './icons/IconFolderLarge.vue';
import { useRecord } from '@/composables/useRecord';
import { RECORD_ROUTE_PREFIX } from '@/router';
import type { LoadedNote, TreeNode } from '@/types/note';

const route = useRoute();
const router = useRouter();
const { getChildNodes, resolveEntry, loadEntry } = useRecord();

const loadedNote = ref<LoadedNote | null>(null);
let loadToken = 0;

const pathSegments = computed(() => {
  if (!route.path.startsWith(RECORD_ROUTE_PREFIX)) {
    return [];
  }
  const relative = route.path.slice(RECORD_ROUTE_PREFIX.length).replace(/^\//, '');
  if (!relative) return [];
  return relative.split('/').map((segment) => decodeURIComponent(segment));
});

const buildRoute = (segments: string[]) =>
  `${RECORD_ROUTE_PREFIX}/${segments.map((segment) => encodeURIComponent(segment)).join('/')}`;

const isFileRoute = computed(() => {
  const segments = pathSegments.value;
  if (!segments.length) return false;
  return Boolean(resolveEntry(buildRoute(segments)));
});

const childNodes = computed(() => (isFileRoute.value ? [] : getChildNodes(pathSegments.value)));

const breadcrumbs = computed(() =>
  pathSegments.value.map((segment, idx) => ({
    label: segment,
    routePath: buildRoute(pathSegments.value.slice(0, idx + 1))
  }))
);

watch(
  () => route.path,
  async () => {
    if (!isFileRoute.value) {
      loadedNote.value = null;
      return;
    }

    const token = ++loadToken;
    const loaded = await loadEntry(buildRoute(pathSegments.value));
    if (token !== loadToken) {
      return;
    }
    if (!loaded) {
      router.replace(RECORD_ROUTE_PREFIX);
      return;
    }
    loadedNote.value = loaded;
  },
  { immediate: true }
);

const handleOpenNode = (node: TreeNode) => {
  if (node.type === 'folder') {
    router.push(buildRoute([...pathSegments.value, node.label]));
    return;
  }
  if (node.path) {
    router.push(node.path);
  }
};

const handleNavigateCrumb = (routePath: string) => {
  router.push(routePath);
};
</script>

<template>
  <ContentViewer v-if="isFileRoute" :note="loadedNote" :navigation="null" :immersive="false" />

  <section v-else class="record-explorer">
    <nav class="record-breadcrumb" aria-label="碎碎念路径">
      <button
        type="button"
        class="record-crumb"
        :class="{ 'is-current': !breadcrumbs.length }"
        @click="handleNavigateCrumb(RECORD_ROUTE_PREFIX)"
      >
        碎碎念
      </button>
      <template v-for="crumb in breadcrumbs" :key="crumb.routePath">
        <span class="record-crumb-separator" aria-hidden="true">/</span>
        <button
          type="button"
          class="record-crumb"
          :class="{ 'is-current': crumb.routePath === route.path }"
          @click="handleNavigateCrumb(crumb.routePath)"
        >
          {{ crumb.label }}
        </button>
      </template>
    </nav>

    <div v-if="childNodes.length" class="record-grid">
      <button
        v-for="node in childNodes"
        :key="node.id"
        type="button"
        class="record-item"
        :class="[`type-${node.type}`]"
        @click="handleOpenNode(node)"
      >
        <IconFolderLarge v-if="node.type === 'folder'" class="record-item__icon" />
        <IconDocumentLarge v-else class="record-item__icon" />
        <span class="record-item__label">{{ node.label }}</span>
      </button>
    </div>

    <p v-else class="record-empty">暂无内容</p>
  </section>
</template>

<style scoped>
.record-explorer {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: auto;
  padding: 18px 26px 30px;
}

.record-breadcrumb {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px;
  padding: 2px 2px 16px;
  color: var(--text-muted);
  font-size: 13px;
}

.record-crumb {
  border: 0;
  border-radius: 4px;
  padding: 2px 6px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  transition:
    background var(--transition-base),
    color var(--transition-base);
}

.record-crumb:hover {
  background: var(--panel-muted);
  color: var(--text-secondary);
}

.record-crumb.is-current {
  color: var(--text-secondary);
  cursor: default;
}

.record-crumb.is-current:hover {
  background: transparent;
}

.record-crumb-separator {
  color: var(--text-muted);
}

.record-grid {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
  gap: 10px;
  align-content: start;
}

.record-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 9px;
  border: 0;
  border-radius: 6px;
  padding: 16px 10px 12px;
  background: transparent;
  cursor: pointer;
  font: inherit;
  transition: background var(--transition-base);
}

.record-item:hover {
  background: var(--panel-muted);
}

.record-item__icon {
  flex: 0 0 auto;
}

.record-item.type-folder .record-item__icon {
  color: #4aa7e8;
}

.record-item.type-file .record-item__icon {
  color: var(--text-muted);
}

.record-item__label {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.4;
  text-align: center;
}

.record-item:hover .record-item__label {
  color: var(--text-primary);
}

.record-empty {
  margin: auto;
  color: var(--text-muted);
  font-size: 14px;
}

@media (max-width: 980px) {
  .record-explorer {
    height: auto;
    min-height: calc(100vh - var(--header-height));
  }
}
</style>
