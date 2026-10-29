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

// 文件夹保持图标平铺样式，文件以详细信息列表展示
const folderNodes = computed(() => childNodes.value.filter((node) => node.type === 'folder'));
const fileNodes = computed(() => childNodes.value.filter((node) => node.type === 'file'));

const formatDateTime = (value?: number): string => {
  if (!value) return '—';
  const date = new Date(value);
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const formatSize = (value?: number): string => {
  if (typeof value !== 'number') return '—';
  return `${Math.max(1, Math.ceil(value / 1024))} KB`;
};

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

    <div v-if="folderNodes.length" class="record-grid">
      <button
        v-for="node in folderNodes"
        :key="node.id"
        type="button"
        class="record-item type-folder"
        @click="handleOpenNode(node)"
      >
        <IconFolderLarge class="record-item__icon" />
        <span class="record-item__label">{{ node.label }}</span>
      </button>
    </div>

    <div v-if="fileNodes.length" class="record-list">
      <div class="record-list__header" aria-hidden="true">
        <span class="record-list__name">名称</span>
        <span class="record-list__meta-group">
          <span>修改日期</span>
          <span class="record-list__type">类型</span>
          <span class="record-list__size">大小</span>
        </span>
      </div>
      <button
        v-for="node in fileNodes"
        :key="node.id"
        type="button"
        class="record-list__row"
        @click="handleOpenNode(node)"
      >
        <span class="record-list__name">
          <span class="record-list__badge">
            <IconDocumentLarge class="record-list__icon" />
          </span>
          <span class="record-list__label">{{ node.label }}</span>
        </span>
        <span class="record-list__meta-group">
          <span class="record-list__meta">{{ formatDateTime(node.mtime) }}</span>
          <span class="record-list__meta record-list__type record-list__tag">MD</span>
          <span class="record-list__meta record-list__size">{{ formatSize(node.size) }}</span>
        </span>
      </button>
    </div>

    <p v-if="!childNodes.length" class="record-empty">暂无内容</p>
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

.record-list {
  flex: 0 0 auto;
  overflow: hidden;
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  background: var(--panel-bg);
  font-size: 13px;
}

.record-grid + .record-list {
  margin-top: 16px;
}

.record-list__header,
.record-list__row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 14px;
}

.record-list__header {
  padding-top: 9px;
  padding-bottom: 9px;
  border-bottom: 1px solid var(--panel-border);
  color: var(--text-muted);
  font-size: 11px;
  letter-spacing: 1px;
}

.record-list__row {
  /* button 的外层 display 无法块级化，需显式宽度才能撑满整行，保证右侧列对齐 */
  width: 100%;
  min-height: 40px;
  border: 0;
  background: transparent;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  text-align: left;
  color: var(--text-secondary);
  transition:
    background var(--transition-base),
    box-shadow var(--transition-base);
}

.record-list__row:hover {
  background: var(--panel-muted);
  box-shadow: inset 2px 0 0 var(--accent);
}

.record-list__row:focus-visible {
  outline: 1px solid var(--accent);
  outline-offset: -1px;
}

.record-list__name {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.record-list__meta-group {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: 150px 44px 56px;
  gap: 14px;
  align-items: center;
}

.record-list__badge {
  flex: 0 0 auto;
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: var(--accent-soft);
}

.record-list__badge .record-list__icon {
  width: 15px;
  height: 15px;
  color: #4aa7e8;
}

.record-list__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-secondary);
  transition: color var(--transition-base);
}

.record-list__row:hover .record-list__label {
  color: var(--text-primary);
}

.record-list__meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.record-list__tag {
  justify-self: start;
  padding: 1px 7px;
  border: 1px solid var(--panel-border);
  border-radius: 3px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.5px;
  font-variant-numeric: normal;
}

.record-list__size {
  text-align: right;
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

@media (max-width: 600px) {
  .record-list__meta-group {
    grid-template-columns: 118px 52px;
    gap: 10px;
  }

  .record-list__type {
    display: none;
  }
}
</style>
