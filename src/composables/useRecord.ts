import type { LoadedNote, NoteFile, TreeNode } from '@/types/note';
import { RECORD_ROUTE_PREFIX } from '@/router';
import { buildTree } from '@/utils/tree';
import recordFileMeta from 'virtual:record-meta';

type MarkdownLoader = () => Promise<{ default: string } | string>;

interface RecordDefinition extends NoteFile {
  loader: MarkdownLoader;
}

// 「技术碎碎念」数据层：与 useNotes 同构，数据源为 src/record 目录
const markdownModules = import.meta.glob<string>('../record/**/*.md', {
  query: '?raw',
  import: 'default'
});

// 文件名或目录名以 `_` 开头的记录为隐藏状态（逻辑删除），与 pages 规范一致
const recordDefinitions: RecordDefinition[] = Object.entries(markdownModules)
  .map(([filePath, loader]) => createRecordDefinition(filePath, loader as MarkdownLoader))
  .filter((record) => !record.segments.some((segment) => segment.startsWith('_')))
  .sort((a, b) => a.path.localeCompare(b.path, 'zh-CN'));

const recordTree: TreeNode[] = buildTree(recordDefinitions);

// 将构建期采集的文件元数据（修改时间/大小）挂到文件节点，供 record 视图列表展示
const attachRecordMeta = (nodes: TreeNode[]): void => {
  nodes.forEach((node) => {
    const meta = node.type === 'file' ? recordFileMeta[node.id] : undefined;
    if (meta) {
      node.mtime = meta.mtime;
      node.size = meta.size;
    }
    if (node.children) {
      attachRecordMeta(node.children);
    }
  });
};
attachRecordMeta(recordTree);
const routeMap = new Map<string, RecordDefinition>(
  recordDefinitions.map((record) => [record.routePath, record])
);
const contentCache = new Map<string, string>();

export function useRecord() {
  const getChildNodes = (segments: string[]): TreeNode[] => {
    let nodes = recordTree;

    for (const segment of segments) {
      const found = nodes.find((node) => node.type === 'folder' && node.label === segment);
      if (!found) {
        return [];
      }
      nodes = found.children ?? [];
    }

    return nodes;
  };

  const resolveEntry = (routePath: string): RecordDefinition | null => {
    return routeMap.get(routePath) ?? null;
  };

  const loadEntry = async (routePath: string): Promise<LoadedNote | null> => {
    const definition = resolveEntry(routePath);
    if (!definition) {
      return null;
    }

    let content = contentCache.get(definition.path);
    if (!content) {
      const mod = await definition.loader();
      const raw = typeof mod === 'string' ? mod : mod?.default;
      content = raw ?? '';
      contentCache.set(definition.path, content);
    }

    const { loader: _loader, ...recordMeta } = definition;

    return {
      ...recordMeta,
      content
    };
  };

  return {
    recordTree,
    getChildNodes,
    resolveEntry,
    loadEntry
  };
}

function createRecordDefinition(filePath: string, loader: MarkdownLoader): RecordDefinition {
  const relative = filePath.replace(/^\.\.\/record\//, '');
  const segments = toSegments(relative);
  const filename = segments[segments.length - 1];
  const routePath = buildRoutePath(segments);

  return {
    id: relative,
    path: relative,
    routePath,
    segments,
    filename,
    title: filename,
    loader
  };
}

function buildRoutePath(segments: string[]): string {
  const encodedSegments = segments.map((segment) => encodeURIComponent(segment));
  return `${RECORD_ROUTE_PREFIX}/${encodedSegments.join('/')}`;
}

function toSegments(relativePath: string): string[] {
  const parts = relativePath.split('/');
  const last = parts.pop() ?? '';
  const filename = last.replace(/\.md$/i, '');
  return [...parts, filename].filter(Boolean);
}
