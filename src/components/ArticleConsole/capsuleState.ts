/**
 * 胶囊导航状态记忆（模块级，页面生命周期内生效）：
 * - 用户固定（pinned）/手动展开（userExpanded）跨文章导航继承（SPA 同一会话
 *   内连续阅读下一篇文章时保持阅读工具状态），不写入 localStorage（任务约束：
 *   会话级 UI 状态不长期持久化）；
 * - 进入专注阅读时快照，退出时恢复；
 * - 不保存任何敏感信息。
 */

export interface CapsuleState {
  /** 用户固定：本次阅读生命周期内不自动收起。 */
  pinned: boolean;
  /** 用户手动展开（点击/Esc 收起可重置）。 */
  userExpanded: boolean;
}

let capsuleState: CapsuleState = { pinned: false, userExpanded: false };
let readingModeSnapshot: CapsuleState | null = null;

export const getCapsuleState = (): CapsuleState => capsuleState;

export const setCapsuleState = (next: Partial<CapsuleState>) => {
  capsuleState = { ...capsuleState, ...next };
};

export const resetCapsuleState = () => {
  capsuleState = { pinned: false, userExpanded: false };
  readingModeSnapshot = null;
};

/** 进入专注阅读：快照当前状态（退出时恢复）。 */
export const snapshotForReadingMode = () => {
  readingModeSnapshot = { ...capsuleState };
};

/** 退出专注阅读：恢复进入前的状态；无快照时保持现状。 */
export const restoreFromReadingMode = () => {
  if (readingModeSnapshot) {
    capsuleState = { ...readingModeSnapshot };
    readingModeSnapshot = null;
  }
};
