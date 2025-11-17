import type { NoteFile, TreeNode } from '@/types/note';

// 将文件路径片段转为 Element Plus Tree 可直接使用的数据格式
export function buildTree(notes: NoteFile[]): TreeNode[] {
  const root: TreeNode[] = [];
  const index = new Map<string, TreeNode>();

  notes.forEach((note) => {
    let parentCollection = root;
    let chain = '';

    note.segments.forEach((segment, idx) => {
      const isLast = idx === note.segments.length - 1;
      const key = chain ? `${chain}/${segment}` : segment;
      let node = index.get(key);

      if (!node) {
        node = {
          id: key,
          label: segment,
          type: isLast ? 'file' : 'folder',
          ...(isLast ? { path: note.routePath } : { children: [] })
        };
        index.set(key, node);
        parentCollection.push(node);
      }

      if (isLast) {
        node.type = 'file';
        node.path = note.routePath;
        delete node.children;
      } else {
        node.type = 'folder';
        node.children = node.children ?? [];
      }

      parentCollection = node.children ?? [];
      chain = key;
    });
  });

  sortTreeNodes(root);
  return root;
}

export function sortTreeNodes(nodes: TreeNode[]): void {
  nodes.sort((a, b) => {
    if (a.type === b.type) {
      return a.label.localeCompare(b.label, 'zh-CN');
    }
    return a.type === 'folder' ? -1 : 1;
  });

  nodes.forEach((node) => {
    if (node.children) {
      sortTreeNodes(node.children);
    }
  });
}
