// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { flattenSuspenseBoundaries } from './ssg.mjs';

/**
 * 构造 React 19 Fizz 输出的 Suspense 序列化片段。
 * 真实格式（文档序：fallback 最左 → hidden div 居中 → script 最右）：
 *   <!--$?--><template id="B:x">fallback</template><!--/$-->
 *   <div hidden id="S:x">真实内容</div>
 *   <script>$RC=function(b,c){};$RC("B:x","S:x")</script>
 */
const buildHtml = ({ rcCalls = [['B:0', 'S:0']], literalScriptContent = '', includeAllBoundaries = false } = {}) => {
  const allBoundaries = [
    { boundaryId: 'B:0', hiddenId: 'S:0', fallback: 'fallback-outer', content: 'outer-hidden-content' },
    { boundaryId: 'B:1', hiddenId: 'S:1', fallback: 'fallback-inner', content: 'inner-hidden-content' },
  ];
  const boundaries = includeAllBoundaries ? allBoundaries : allBoundaries.slice(0, rcCalls.length);
  const markers = boundaries
    .map(
      (b) =>
        `<!--$?--><template id="${b.boundaryId}">${b.fallback}</template><!--/$-->\n` +
        `<div hidden id="${b.hiddenId}">${b.content}</div>`,
    )
    .join('\n');
  const calls = rcCalls.map(([boundaryId, hiddenId]) => `$RC("${boundaryId}","${hiddenId}")`).join(';');
  return `<html><body><div id="root">\n${markers}\n<script>$RC=function(b,c){};${calls}${literalScriptContent}</script>\n</div></body></html>`;
};

describe('flattenSuspenseBoundaries', () => {
  it('单个 $RC 调用：把 hidden 内容搬到 fallback 位置并清理标记', () => {
    const html = buildHtml({ rcCalls: [['B:0', 'S:0']] });
    const result = flattenSuspenseBoundaries(html);

    expect(result).toContain('<!--$-->outer-hidden-content<!--/$-->');
    expect(result).not.toContain('<!--$?-->');
    expect(result).not.toContain('<template id="B:');
    expect(result).not.toContain('hidden id="S:0"');
    expect(result).not.toContain('$RC("B:0"');
    // script 内的函数定义保留（仅摘除调用文本）。
    expect(result).toContain('$RC=function');
  });

  it('同一 script 内多个 $RC 调用：逐个展平（回归：整段删除 script 只展平首个边界）', () => {
    const html = buildHtml({
      rcCalls: [
        ['B:0', 'S:0'],
        ['B:1', 'S:1'],
      ],
    });
    const result = flattenSuspenseBoundaries(html);

    expect(result).toContain('<!--$-->outer-hidden-content<!--/$-->');
    expect(result).toContain('<!--$-->inner-hidden-content<!--/$-->');
    expect(result).not.toContain('$RC("B:0"');
    expect(result).not.toContain('$RC("B:1"');
    expect(result).not.toContain('hidden id="S:');
    expect(result).not.toContain('<!--$?-->');
    expect(result).not.toContain('<template id="B:');
  });

  it('嵌套边界（B:0 外层先出现）：全部展平且无残留', () => {
    const html = buildHtml({
      rcCalls: [
        ['B:0', 'S:0'],
        ['B:1', 'S:1'],
      ],
    });
    const result = flattenSuspenseBoundaries(html);
    // 展平后的 <!--$-->...<!--/$--> 包装本身含 <!--/$-->，因此只断言
    // 无残留的 <!--$?--> 模板占位与 hidden div。
    expect(result).not.toContain('<!--$?-->');
    expect(result).not.toContain('<template id="B:');
    expect(result).not.toContain('hidden id="S:');
  });

  it('正文中的字面量 $RC 文本不被误展平（只在 script 区域内扫描）', () => {
    const html =
      '<html><body><div id="root">' +
      '<p>讲解 React 水合的代码示例：$RC("B:x","S:x") 是序列化恢复调用。</p>' +
      '<script>window.__APP__ = 1;</script>' +
      '</div></body></html>';
    const result = flattenSuspenseBoundaries(html);
    // 字面量保留，script 保留，无任何改动。
    expect(result).toBe(html);
  });

  it('畸形输出（缺 hidden div）：走防御路径只摘除调用文本，不产生死循环', () => {
    const html =
      '<html><body><div id="root">' +
      '<!--$?--><template id="B:0">fallback</template><!--/$-->' +
      '<script>$RC=function(b,c){};$RC("B:0","S:0")</script>' +
      '</div></body></html>';
    const result = flattenSuspenseBoundaries(html);
    // hidden div 不存在 → 防御路径：仅移除 $RC 调用文本，其余标记保留。
    expect(result).not.toContain('$RC("B:0","S:0")');
    expect(result).toContain('<template id="B:0">');
    expect(result).toContain('<!--$?-->');
  });
});
