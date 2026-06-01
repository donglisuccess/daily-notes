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

  md.options.highlight = function (str: string, lang: string) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang }).value;
      } catch (error) {
        console.warn('highlight error', error);
      }
    }

    return md.utils.escapeHtml(str);
  };

  const defaultHeadingRule = md.renderer.rules.heading_open;
  const defaultFenceRule = md.renderer.rules.fence;

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

  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const info = token.info ? token.info.trim() : '';
    const lang = info ? info.split(/\s+/g)[0] : 'text';

    if (lang.toLowerCase() === 'mermaid') {
      return [
        '<div class="mermaid-block" data-mermaid-block>',
        `<pre class="mermaid-source" data-mermaid-source>${md.utils.escapeHtml(token.content)}</pre>`,
        '</div>'
      ].join('');
    }

    const rendered = defaultFenceRule
      ? defaultFenceRule(tokens, idx, options, env, self)
      : `<pre><code>${md.utils.escapeHtml(token.content)}</code></pre>`;

    return [
      `<div class="code-block" data-code-lang="${md.utils.escapeHtml(lang)}">`,
      '<div class="code-block__bar">',
      `<span class="code-block__lang">${md.utils.escapeHtml(lang)}</span>`,
      '<button class="code-copy" type="button" data-copy-code aria-label="复制代码">复制</button>',
      '</div>',
      rendered,
      '</div>'
    ].join('');
  };

  return md;
}
