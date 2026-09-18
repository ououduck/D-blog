/**
 * remark 插件：裸 http(s) URL 的友好链接化后处理。
 *
 * remark-gfm 的 autolink literal 在解析期就会把裸 URL 变成链接节点，但其
 * URL 边界判定不认识中文全角标点（`https://x.com，欢迎` 会整体入链），且
 * 展示文本保留协议前缀不够友好。本插件在 mdast 上二次处理：
 *  1. 对 gfm 生成的 autolink 链接（单 text 子节点且以 http(s) 开头）按
 *     中文标点感知的 URL 正则重新切分，重建 text/link/text 序列；
 *  2. 链接展示文本去掉协议前缀（友好显示），href 保持完整 URL；
 *  3. 极少数未走 gfm 的 text 节点同样自动成链；已有 Markdown 显式链接、
 *     行内代码内的文本不处理。
 * 仅允许 http/https，rel/target 由组件层补充。
 */

import { visit } from 'unist-util-visit';
import type { Root, Text, Parent, Link } from 'mdast';

// URL 之外的字符：空白、包裹符号、全角标点（含中文常用句读）。
const URL_PATTERN = /https?:\/\/[^\s<>()[\]{}"'\u3000-\u303F，。！？；：、）】」』《》…]+/g;

const makeDisplayText = (url: string): string => url.replace(/^https?:\/\//, '');

type Part = Text | Link;

/** 把含 URL 的纯文本切分为 text/link 序列；无 URL 返回 null。 */
const splitTextIntoParts = (value: string): Part[] | null => {
  URL_PATTERN.lastIndex = 0;
  const parts: Part[] = [];
  let lastIndex = 0;
  for (const match of value.matchAll(URL_PATTERN)) {
    const url = match[0];
    const start = match.index ?? 0;
    if (start > lastIndex) {
      parts.push({ type: 'text', value: value.slice(lastIndex, start) });
    }
    parts.push({ type: 'link', url, children: [{ type: 'text', value: makeDisplayText(url) }] });
    lastIndex = start + url.length;
  }
  if (parts.length === 0) {
    return null;
  }
  if (lastIndex < value.length) {
    parts.push({ type: 'text', value: value.slice(lastIndex) });
  }
  return parts;
};

export const remarkAutolinkHttp = () => (tree: Root) => {
  // 1) gfm autolink literal 产生的链接：单 text 子节点 + http(s) 文本 → 重切边界。
  visit(tree, 'link', (node: Link, index, parent: Parent | undefined) => {
    if (!parent || index === undefined) {
      return;
    }
    if (!/^https?:\/\//i.test(node.url) || node.children.length !== 1) {
      return;
    }
    const child = node.children[0];
    if (child.type !== 'text' || !/https?:\/\//.test(child.value)) {
      return;
    }
    // 显式 Markdown 链接（[文本](url)）的展示文本与 URL 不同，保留原样；
    // gfm autolink literal 的展示文本与 URL 相同，需要重切。
    if (child.value !== node.url) {
      return;
    }
    const parts = splitTextIntoParts(child.value);
    if (!parts) {
      return;
    }
    parent.children.splice(index, 1, ...parts);
    return index + parts.length;
  });

  // 2) 尚未成链的 text 节点（gfm 未覆盖的边缘场景）自动成链。
  visit(tree, 'text', (node: Text, index, parent: Parent | undefined) => {
    if (!parent || index === undefined) {
      return;
    }
    if (parent.type === 'link' || !/https?:\/\//.test(node.value)) {
      return;
    }
    const parts = splitTextIntoParts(node.value);
    if (!parts) {
      return;
    }
    parent.children.splice(index, 1, ...parts);
    return index + parts.length;
  });
};
