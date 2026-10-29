import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import fs from 'node:fs';
import path from 'node:path';

// 「碎碎念」文件元数据虚拟模块：import.meta.glob 不携带修改时间/大小，构建期扫描 src/record 生成
const RECORD_DIR = 'src/record';
const VIRTUAL_RECORD_META_ID = 'virtual:record-meta';

function collectRecordMeta(): Record<string, { mtime: number; size: number }> {
  const root = path.resolve(__dirname, RECORD_DIR);
  const meta: Record<string, { mtime: number; size: number }> = {};
  if (!fs.existsSync(root)) {
    return meta;
  }

  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.isFile() || !/\.md$/i.test(entry.name)) {
        continue;
      }
      // key 与 TreeNode.id 一致：去掉 .md 后缀、统一正斜杠的相对路径
      const key = path
        .relative(root, fullPath)
        .replace(/\.md$/i, '')
        .split(path.sep)
        .join('/');
      const { mtimeMs, size } = fs.statSync(fullPath);
      meta[key] = { mtime: mtimeMs, size };
    }
  };

  walk(root);
  return meta;
}

function recordMetaPlugin(): Plugin {
  const resolvedId = `\0${VIRTUAL_RECORD_META_ID}`;
  return {
    name: 'record-meta',
    resolveId(id) {
      if (id === VIRTUAL_RECORD_META_ID) {
        return resolvedId;
      }
    },
    load(id) {
      if (id === resolvedId) {
        return `export default ${JSON.stringify(collectRecordMeta())};`;
      }
    },
    configureServer(server) {
      // 开发模式下 record 目录文件变动时刷新元数据
      const invalidate = (file: string): void => {
        if (!file.replace(/\\/g, '/').includes(`${RECORD_DIR}/`)) {
          return;
        }
        const mod = server.moduleGraph.getModuleById(resolvedId);
        if (mod) {
          server.moduleGraph.invalidateModule(mod);
        }
      };
      server.watcher.on('change', invalidate);
      server.watcher.on('add', invalidate);
      server.watcher.on('unlink', invalidate);
    }
  };
}

export default defineConfig({
  plugins: [vue(), recordMetaPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  base: './'
});
