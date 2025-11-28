// 支持图片与常见视频格式，便于解析 markdown 中的相对资源路径
const assetModules = import.meta.glob<string>('../pages/**/*.{png,jpg,jpeg,gif,svg,webp,avif,bmp,ico,mp4,webm,ogg,mov,m4v}', {
  eager: true,
  import: 'default'
});

const ASSET_PREFIX = '../pages/';
const assetMap = new Map<string, string>();

Object.entries(assetModules).forEach(([key, value]) => {
  const normalized = key.replace(ASSET_PREFIX, '').replace(/^\//, '');
  assetMap.set(normalized, value);
});

export function resolveNoteAsset(notePath: string, assetRelativePath: string): string | null {
  if (!notePath || !assetRelativePath) {
    return null;
  }
  const normalizedRelative = normalizeRelativePath(notePath, assetRelativePath);
  return assetMap.get(normalizedRelative) ?? null;
}

function normalizeRelativePath(notePath: string, relativePath: string): string {
  const noteSegments = notePath.split('/').slice(0, -1).filter(Boolean);
  const relativeSegments = relativePath.replace(/\\/g, '/').split('/');

  const stack = [...noteSegments];

  relativeSegments.forEach((segment) => {
    if (!segment || segment === '.') {
      return;
    }
    if (segment === '..') {
      stack.pop();
      return;
    }
    stack.push(segment);
  });

  return stack.join('/');
}
