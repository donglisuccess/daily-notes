export type NoteNodeType = 'folder' | 'file';

export interface NoteFile {
  id: string;
  path: string;
  routePath: string;
  segments: string[];
  filename: string;
  title: string;
}

export interface LoadedNote extends NoteFile {
  content: string;
}

export interface TreeNode {
  id: string;
  label: string;
  type: NoteNodeType;
  path?: string;
  children?: TreeNode[];
}

export interface OutlineHeading {
  id: string;
  text: string;
  level: number;
}
