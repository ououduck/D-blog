import { describe, it, expect, beforeEach } from 'vitest';
import {
  getCapsuleState,
  resetCapsuleState,
  restoreFromReadingMode,
  setCapsuleState,
  snapshotForReadingMode,
} from './capsuleState';

describe('capsuleState（胶囊导航状态记忆）', () => {
  beforeEach(() => {
    resetCapsuleState();
  });

  it('默认收缩且未固定', () => {
    expect(getCapsuleState()).toEqual({ pinned: false, userExpanded: false });
  });

  it('setCapsuleState 部分更新并跨调用保持（模拟跨文章导航继承）', () => {
    setCapsuleState({ pinned: true, userExpanded: true });
    expect(getCapsuleState()).toEqual({ pinned: true, userExpanded: true });
  });

  it('专注阅读快照/恢复：进入时保存，退出时还原，无快照时保持现状', () => {
    setCapsuleState({ pinned: true, userExpanded: true });
    snapshotForReadingMode();

    // 阅读模式中状态被收敛
    setCapsuleState({ pinned: false, userExpanded: false });
    expect(getCapsuleState()).toEqual({ pinned: false, userExpanded: false });

    restoreFromReadingMode();
    expect(getCapsuleState()).toEqual({ pinned: true, userExpanded: true });

    // 快照已消费：再次恢复不改状态
    setCapsuleState({ userExpanded: false });
    restoreFromReadingMode();
    expect(getCapsuleState()).toEqual({ pinned: true, userExpanded: false });
  });
});
