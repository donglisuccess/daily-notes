import type { LoadedNote, NoteFile, NoteLink, NoteNavigation, TreeNode } from '@/types/note';
import { NOTE_ROUTE_PREFIX } from '@/router';
import { buildTree } from '@/utils/tree';

type MarkdownLoader = () => Promise<{ default: string } | string>;

interface NoteDefinition extends NoteFile {
  loader: MarkdownLoader;
}

const markdownModules = import.meta.glob<string>('../pages/**/*.md', {
  query: '?raw',
  import: 'default'
});

const noteDefinitions: NoteDefinition[] = Object.entries(markdownModules)
  .map(([filePath, loader]) => createNoteDefinition(filePath, loader as MarkdownLoader))
  .sort((a, b) => a.path.localeCompare(b.path, 'zh-CN'));

const noteFiles: NoteFile[] = noteDefinitions.map(({ loader, ...note }) => note);
const treeData: TreeNode[] = buildTree(noteFiles);
const routeMap = new Map<string, NoteDefinition>(noteDefinitions.map((note) => [note.routePath, note]));
const contentCache = new Map<string, string>();
const CURRENT_ROUTE_KEY = 'daily-notes-current-route';

export function useNotes() {
  const loadNote = async (routePath: string): Promise<LoadedNote | null> => {
    const definition = routeMap.get(routePath);
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

    const { loader: _loader, ...noteMeta } = definition;

    return {
      ...noteMeta,
      content
    };
  };

  const isValidRoute = (routePath: string) => routeMap.has(routePath);

  const rememberRoute = (routePath: string) => {
    if (typeof window === 'undefined') {
      return;
    }
    if (!routePath) {
      window.localStorage.removeItem(CURRENT_ROUTE_KEY);
      return;
    }
    window.localStorage.setItem(CURRENT_ROUTE_KEY, routePath);
  };

  const getSavedRoute = () => {
    if (typeof window === 'undefined') {
      return '';
    }
    const saved = window.localStorage.getItem(CURRENT_ROUTE_KEY);
    if (saved && isValidRoute(saved)) {
      return saved;
    }
    return '';
  };

  const getNoteNavigation = (routePath: string, relatedLimit = 3): NoteNavigation => {
    const index = noteFiles.findIndex((note) => note.routePath === routePath);
    if (index === -1) {
      return {
        previous: null,
        next: null,
        related: []
      };
    }

    return {
      previous: noteFiles[index - 1] ? toNoteLink(noteFiles[index - 1]) : null,
      next: noteFiles[index + 1] ? toNoteLink(noteFiles[index + 1]) : null,
      related: getRelatedNotes(noteFiles[index], relatedLimit)
    };
  };

  return {
    noteFiles,
    treeData,
    loadNote,
    isValidRoute,
    rememberRoute,
    getSavedRoute,
    getNoteNavigation
  };
}

function getRelatedNotes(current: NoteFile, limit: number): NoteLink[] {
  const currentIndex = noteFiles.findIndex((note) => note.routePath === current.routePath);
  const currentParents = getParentSegments(current);

  return noteFiles
    .map((note, index) => {
      if (note.routePath === current.routePath) {
        return null;
      }

      const parents = getParentSegments(note);
      const commonDepth = getCommonDepth(currentParents, parents);
      const sameFolder = commonDepth === currentParents.length && commonDepth === parents.length;
      const sameRoot = currentParents[0] && currentParents[0] === parents[0];
      const nearbyScore = currentIndex >= 0 ? Math.max(0, 6 - Math.abs(index - currentIndex)) : 0;
      const score = commonDepth * 12 + (sameFolder ? 48 : 0) + (sameRoot ? 10 : 0) + nearbyScore;

      if (score <= 0) {
        return null;
      }

      return {
        note,
        score
      };
    })
    .filter((item): item is { note: NoteFile; score: number } => Boolean(item))
    .sort((a, b) => b.score - a.score || a.note.path.localeCompare(b.note.path, 'zh-CN'))
    .slice(0, limit)
    .map(({ note }) => toNoteLink(note));
}

function getParentSegments(note: NoteFile): string[] {
  return note.segments.slice(0, -1);
}

function getCommonDepth(left: string[], right: string[]): number {
  const max = Math.min(left.length, right.length);
  let depth = 0;
  while (depth < max && left[depth] === right[depth]) {
    depth += 1;
  }
  return depth;
}

function toNoteLink(note: NoteFile): NoteLink {
  return {
    path: note.path,
    routePath: note.routePath,
    segments: note.segments,
    title: note.title
  };
}

function createNoteDefinition(filePath: string, loader: MarkdownLoader): NoteDefinition {
  const relative = filePath.replace(/^\.\.\/pages\//, '');
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
  return `${NOTE_ROUTE_PREFIX}/${encodedSegments.join('/')}`;
}

function toSegments(relativePath: string): string[] {
  const parts = relativePath.split('/');
  const last = parts.pop() ?? '';
  const filename = last.replace(/\.md$/i, '');
  return [...parts, filename].filter(Boolean);
}
