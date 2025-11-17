<script setup lang="ts">
import { ElTree } from 'element-plus';
import 'element-plus/es/components/tree/style/css';
import { ref, watch } from 'vue';
import type { TreeNode } from '@/types/note';
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

const currentKey = ref(props.currentPath);

watch(
  () => props.currentPath,
  (val) => {
    currentKey.value = val;
  }
);

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
    <button class="sidebar-home" :class="{ active: !currentKey }" type="button" @click="handleNavigateHome">
      <span class="sidebar-home-icon">🏠</span>
      <span class="sidebar-home-label">首页</span>
    </button>
    <ElTree
      class="sidebar-tree"
      :data="data"
      :expand-on-click-node="false"
      default-expand-all
      :props="treeProps"
      highlight-current
      node-key="id"
      :current-node-key="currentKey"
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
  gap: 8px;
  border-radius: 12px;
  border: 1px solid var(--panel-border);
  padding: 10px 14px;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  transition: border-color var(--transition-base), background var(--transition-base), color var(--transition-base);
}

.sidebar-home-icon {
  font-size: 18px;
}

.sidebar-home.active {
  background: rgba(96, 165, 250, 0.15);
  border-color: var(--accent);
  color: var(--accent);
}

.sidebar-home:hover {
  border-color: var(--accent);
}

.sidebar-tree {
  --el-tree-node-hover-bg-color: rgba(96, 165, 250, 0.12);
  background: transparent;
  color: var(--text-primary);
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 4px;
  border-radius: 8px;
}

.sidebar-tree :deep(.el-tree-node__content) {
  padding: 4px 8px;
  border-radius: 10px;
}

.sidebar-tree :deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: rgba(96, 165, 250, 0.2);
}

.tree-icon {
  color: var(--text-secondary);
}

.tree-node.type-file .tree-label {
  font-weight: 500;
}
</style>
