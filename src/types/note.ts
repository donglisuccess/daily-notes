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

export interface NoteLink {
  path: string;
  routePath: string;
  segments: string[];
  title: string;
}

export interface NoteNavigation {
  previous: NoteLink | null;
  next: NoteLink | null;
  related: NoteLink[];
}

export interface TreeNode {
  id: string;
  label: string;
  type: NoteNodeType;
  path?: string;
  children?: TreeNode[];
  /** 文件节点附加元数据（仅 record 视图使用）：修改时间戳（ms）与文件大小（字节） */
  mtime?: number;
  size?: number;
}

export interface OutlineHeading {
  id: string;
  text: string;
  level: number;
}
