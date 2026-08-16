/**
 * remark 插件：把围栏代码块的 info 字符串（如 ```ts title="app.ts"）透传到
 * code 元素的 data-meta 属性。
 *
 * remark-parse 会把 ```lang key="value"``` 中的 "key=value" 部分存进 mdast
 * code 节点的 meta 字段，但 react-markdown 的 mdast→hast 转换默认丢弃它
 * （组件的 node 上也没有 meta），导致前端无法读取。这里把 meta 写进
 * hProperties，让最终渲染的 <code> 携带 data-meta 属性，供 PreBlock 解析
 * 出文件名等信息。
 */
import { visit } from 'unist-util-visit';
import type { Root } from 'mdast';

export const remarkCodeMeta = () => (tree: Root) => {
  visit(tree, 'code', (node) => {
    if (!node.meta) return;
    node.data = node.data || {};
    node.data.hProperties = node.data.hProperties || {};
    (node.data.hProperties as Record<string, unknown>)['data-meta'] = node.meta;
  });
};
