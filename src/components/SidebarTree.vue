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
    <div class="sidebar-section-title">全部文章</div>
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
  gap: 4px;
}

.sidebar-section-title {
  height: 28px;
  display: flex;
  align-items: center;
  padding: 0 8px;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0;
}

.sidebar-home {
  width: 100%;
  min-height: 28px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 4px;
  border: 1px solid transparent;
  padding: 4px 8px;
  background: transparent;
  color: #cccccc;
  cursor: pointer;
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  text-align: left;
  transition:
    background var(--transition-base),
    color var(--transition-base);
}

.sidebar-home-mark {
  width: 12px;
  height: 12px;
  border: 2px solid #cccccc;
  border-radius: 50%;
}

.sidebar-home.active {
  background: #37373d;
  color: #ffffff;
}

.sidebar-home.active .sidebar-home-mark {
  border-color: #ffffff;
  background: #ffffff;
}

.sidebar-home:hover {
  background: var(--panel-muted);
}

.sidebar-tree {
  --el-tree-node-hover-bg-color: #2a2d2e;
  background: transparent;
  color: #cccccc;
  font-size: 14px;
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  padding: 3px 2px;
  border-radius: 4px;
}

.tree-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar-tree :deep(.el-tree-node__content) {
  min-height: 28px;
  padding: 1px 6px;
  border-radius: 4px;
  color: #cccccc;
}

.sidebar-tree :deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: #37373d;
}

.sidebar-tree :deep(.el-tree-node.is-current > .el-tree-node__content .tree-icon),
.sidebar-tree :deep(.el-tree-node.is-current > .el-tree-node__content .tree-label) {
  color: #ffffff;
}

.sidebar-tree :deep(.el-tree-node__expand-icon) {
  color: #858585;
}

.tree-icon {
  flex: 0 0 auto;
  color: #c5c5c5;
}

.tree-node.type-folder .tree-icon {
  color: #dcb67a;
}

.tree-node.type-file .tree-label {
  font-weight: 520;
}
</style>
