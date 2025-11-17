import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import diff from 'highlight.js/lib/languages/diff';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import python from 'highlight.js/lib/languages/python';
import shell from 'highlight.js/lib/languages/shell';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';

import type { OutlineHeading } from '@/types/note';
import { createSlugGenerator } from './slugify';

const highlightLanguages = [
  ['bash', bash],
  ['css', css],
  ['diff', diff],
  ['javascript', javascript],
  ['json', json],
  ['markdown', markdown],
  ['python', python],
  ['shell', shell],
  ['typescript', typescript],
  ['xml', xml],
  ['yaml', yaml]
] as const;

highlightLanguages.forEach(([name, loader]) => {
  hljs.registerLanguage(name, loader);
});

interface RenderResult {
  html: string;
  headings: OutlineHeading[];
}

// 渲染 Markdown 同时生成标题大纲信息
export function renderMarkdown(source: string): RenderResult {
  const headings: OutlineHeading[] = [];
  const slugger = createSlugGenerator();
  const md = createRenderer(slugger, headings);

  return {
    html: md.render(source),
    headings
  };
}

function createRenderer(slugger: (value: string) => string, headings: OutlineHeading[]) {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true
  });

  // 将高亮器单独设置，使用实例的 utils.escapeHtml 避免深层路径导入
  md.options.highlight = function (str: string, lang: string) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang }).value;
      } catch (error) {
        console.warn('highlight error', error);
      }
    }
    // 使用实例上的工具函数进行 HTML 转义
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (md as any).utils?.escapeHtml ? (md as any).utils.escapeHtml(str) : str;
  };

  const defaultHeadingRule = md.renderer.rules.heading_open;

  // 在渲染 heading 标签时为其添加 id，方便左侧内容和右侧大纲联动
  md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const titleToken = tokens[idx + 1];
    const text = titleToken?.content ?? '';
    const level = Number(token.tag.replace('h', ''));

    const slug = slugger(text);
    token.attrSet('id', slug);

    if (level <= 3) {
      headings.push({ id: slug, text, level });
    }

    if (defaultHeadingRule) {
      return defaultHeadingRule(tokens, idx, options, env, self);
    }
    return self.renderToken(tokens, idx, options);
  };

  return md;
}
