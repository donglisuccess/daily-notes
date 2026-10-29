// 虚拟模块由 vite.config.ts 中的 record-meta 插件生成：
// key 为去掉 .md 后缀、统一正斜杠的相对路径（与 TreeNode.id 一致）
declare module 'virtual:record-meta' {
  interface RecordMetaEntry {
    /** 文件修改时间（ms 时间戳） */
    mtime: number;
    /** 文件大小（字节） */
    size: number;
  }

  const recordFileMeta: Record<string, RecordMetaEntry>;
  export default recordFileMeta;
}
