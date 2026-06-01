<script setup lang="ts">
import { ElTree } from 'element-plus';
import 'element-plus/es/components/tree/style/css';
import { computed } from 'vue';
import type { TreeNode } from '@/types/note';
import { NOTE_ROUTE_PREFIX } from '@/router';
import IconDocument from './icons/IconDocument.vue';
import IconFolder from './icons/IconFolder.vue';

const props = defineProps<{
  data: TreeNode[];
  currentPath: string;
}>();

const emit = defineEmits<{ (e: 'select', value: string): void }>();

const treeProps = {
  children: 'children',
  label: 'label'
};

const pathSegments = computed(() => {
  if (!props.currentPath || !props.currentPath.startsWith(NOTE_ROUTE_PREFIX)) {
    return [];
  }
  const relative = props.currentPath.slice(NOTE_ROUTE_PREFIX.length).replace(/^\//, '');
  if (!relative) return [];
  return relative.split('/').map((segment) => decodeURIComponent(segment));
});

const currentNodeKey = computed(() => {
  if (pathSegments.value.length === 0) return '';
  return pathSegments.value.join('/');
});

const expandedKeys = computed(() => {
  if (pathSegments.value.length <= 1) return [];
  return pathSegments.value.slice(0, -1).map((_, idx) => pathSegments.value.slice(0, idx + 1).join('/'));
});

const treeRenderKey = computed(() => `${currentNodeKey.value}|${expandedKeys.value.join('|')}`);

const handleNodeClick = (node: TreeNode) => {
  if (node.type === 'file' && node.path) {
    emit('select', node.path);
  }
};

const handleNavigateHome = () => {
  emit('select', '');
};
</script>

<template>
  <div class="sidebar-tree-wrapper">
    <button class="sidebar-home" :class="{ active: !currentNodeKey }" type="button" @click="handleNavigateHome">
      <span class="sidebar-home-mark" aria-hidden="true"></span>
      <span class="sidebar-home-label">首页</span>
    </button>
    <ElTree
      :key="treeRenderKey"
      class="sidebar-tree"
      :data="data"
      :expand-on-click-node="false"
      :default-expand-all="false"
      :default-expanded-keys="expandedKeys"
      :accordion="true"
      :props="treeProps"
      highlight-current
      node-key="id"
      :current-node-key="currentNodeKey"
      @node-click="handleNodeClick"
    >
      <template #default="{ data }">
        <div class="tree-node" :class="[`type-${data.type}`]">
          <component :is="data.type === 'folder' ? IconFolder : IconDocument" class="tree-icon" />
          <span class="tree-label">{{ data.label }}</span>
        </div>
      </template>
    </ElTree>
  </div>
</template>

<style scoped>
.sidebar-tree-wrapper {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sidebar-home {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  padding: 9px 10px;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  font-weight: 600;
  transition: border-color var(--transition-base), background var(--transition-base), color var(--transition-base);
}

.sidebar-home-mark {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--text-muted);
}

.sidebar-home.active {
  background: var(--accent-soft);
  border-color: color-mix(in srgb, var(--accent) 35%, transparent);
  color: var(--accent);
}

.sidebar-home.active .sidebar-home-mark {
  background: var(--accent);
}

.sidebar-home:hover {
  background: var(--panel-muted);
}

.sidebar-tree {
  --el-tree-node-hover-bg-color: var(--panel-muted);
  background: transparent;
  color: var(--text-primary);
  font-size: 14px;
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 5px 2px;
  border-radius: var(--radius-sm);
}

.tree-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar-tree :deep(.el-tree-node__content) {
  min-height: 34px;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
}

.sidebar-tree :deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: var(--accent-soft);
}

.sidebar-tree :deep(.el-tree-node.is-current > .el-tree-node__content .tree-icon),
.sidebar-tree :deep(.el-tree-node.is-current > .el-tree-node__content .tree-label) {
  color: var(--accent);
}

.sidebar-tree :deep(.el-tree-node__expand-icon) {
  color: var(--text-muted);
}

.tree-icon {
  flex: 0 0 auto;
  color: var(--text-muted);
}

.tree-node.type-folder .tree-icon {
  color: color-mix(in srgb, var(--accent) 72%, var(--text-muted));
}

.tree-node.type-file .tree-label {
  font-weight: 520;
}
</style>
