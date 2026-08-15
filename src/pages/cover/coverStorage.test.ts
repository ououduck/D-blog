import { describe, it, expect, beforeEach } from 'vitest';
import { readDraft, writeDraft, readPresets, writePreset, deletePreset } from './coverStorage';
import type { CoverDraft } from './coverStorage';

const makeDraft = (overrides: Partial<CoverDraft> = {}): CoverDraft =>
  ({
    version: 1,
    leftText: '标题',
    rightText: '副标题',
    layoutMode: 'stacked',
    ...overrides,
  }) as CoverDraft;

describe('coverStorage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('写入并读回草稿', () => {
    expect(writeDraft(makeDraft())).toBe(true);
    const draft = readDraft();
    expect(draft?.leftText).toBe('标题');
    expect(draft?.version).toBe(1);
  });

  it('无草稿时返回 null', () => {
    expect(readDraft()).toBeNull();
  });

  it('损坏的草稿数据回退为 null', () => {
    window.localStorage.setItem('d-blog-cover-draft-v1', 'not-json');
    expect(readDraft()).toBeNull();
  });

  it('版本不匹配的草稿回退为 null', () => {
    window.localStorage.setItem('d-blog-cover-draft-v1', JSON.stringify({ ...makeDraft(), version: 999 }));
    expect(readDraft()).toBeNull();
  });

  it('写入预设并读取（按名称去重）', () => {
    const first = writePreset('我的预设', makeDraft());
    expect(first).toHaveLength(1);
    const again = writePreset('我的预设', makeDraft({ leftText: '新标题' }));
    expect(again).toHaveLength(1);
    expect(readPresets()).toHaveLength(1);
    expect(readPresets()[0].state.leftText).toBe('新标题');
  });

  it('空名称预设回退为未命名', () => {
    writePreset('   ', makeDraft());
    expect(readPresets()[0].name).toBe('未命名预设');
  });

  it('预设最多保留 20 个', () => {
    for (let i = 0; i < 25; i += 1) {
      writePreset(`预设${i}`, makeDraft());
    }
    expect(readPresets()).toHaveLength(20);
  });

  it('删除预设', () => {
    writePreset('待删除', makeDraft());
    const next = deletePreset('待删除');
    expect(next).toHaveLength(0);
    expect(readPresets()).toHaveLength(0);
  });
});
