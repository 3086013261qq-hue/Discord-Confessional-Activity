# Discord 忏悔室｜Candidate2 文字与勇者模式最终修订 v1.0

> 适用分支：`candidate2-real-device-refactor`
> 上位关系：本文件为 `009_给静静的Discord忏悔室_Candidate2多人围观与身份切换补充_v1.0.md` 的最终模式修订；与 008 / 009 冲突时，本文件优先。
> 来源：2026-10-31 第三轮产品确认。

## 1. 删除变声模式

Candidate2 不再设计、保留或展示任何“变声模式”。

明确删除：

- 变声模式入口；
- 变声模式 30 秒默认逻辑；
- 变声能力探测；
- 平台限制提示；
- 虚拟麦克风/外部变声降级文案；
- 与变声有关的状态字段、按钮、占位 UI 与 QA。

不得实现假变声、伪装变声或仅改 UI 文案但底层仍保留该模式。

---

## 2. 真人忏悔者模式只保留两种

真人修女 `claim` 后，忏悔者进入 30 秒选择阶段：

### A. 文字模式

- Activity 内纯文字忏悔；
- 不要求用户开麦；
- 忏悔正文通过当前 session 的 Activity 消息系统发送；
- 围观席可按 009 的公开规则实时看到文字内容。

### B. 勇者模式

- 直接使用 Discord 原生语音；
- 用户使用本音；
- Activity 不处理、不转码、不录制、不转写麦克风音频；
- Activity 只负责显示当前模式、会话状态和 speaking / mute 等可用状态。

### 超时

30 秒内未选择：

**自动进入“文字模式”。**

理由：文字模式不依赖麦克风权限，跨 Android / iOS / Web 最稳，不会因为用户未开麦而卡住会话。

---

## 3. 修女回复模式

真人修女仍可自由选择：

- `文字`
- `语音`

允许混合组合：

- 忏悔者文字 + 修女文字；
- 忏悔者文字 + 修女语音；
- 忏悔者勇者模式 + 修女文字；
- 忏悔者勇者模式 + 修女语音。

修女的语音同样直接使用 Discord 原生语音，不由 Activity 处理音频。

大肥鱼继续严格：

`文字 only`

不得出现语音按钮，也不得自动加入任何 Discord 语音频道。

---

## 4. 状态机修订

真人流程：

`IDENTITY_SELECT`
-> `QUEUED`
-> `CLAIMED`
-> `MODE_SELECT`（30s）
-> `CONFESSING_TEXT | CONFESSING_VOICE`
-> `COMMUNITY_VOTE`
-> `VERDICT_DECIDED`
-> `ANIMATION`
-> `CARD_CHOICE`
-> `REVEALED`
-> `EXECUTING`
-> `SETTLED`
-> `CLOSED`

其中：

- 文字模式 -> `CONFESSING_TEXT`
- 勇者模式 -> `CONFESSING_VOICE`
- 30 秒超时 -> `CONFESSING_TEXT`

AI 流程保持 009：

`IDENTITY_SELECT`
-> `AI_CONFESSION`
-> `TEXT_CONFESSING`
-> `AI_VERDICT_READY`
-> `ANIMATION`
-> `CARD_CHOICE`
-> `REVEALED`
-> `EXECUTING`
-> `SETTLED`
-> `CLOSED`

---

## 5. 与 008 / 009 的合并规则

008 / 009 以下内容继续有效：

- 去除 Discord Role 实体玩法，只保留昵称/内部状态；
- 忏悔者中途退出有重连宽限并自动释放修女；
- 判决结果发布到 Discord 文字频道；
- 大肥鱼为文字 AI 修女；
- 普通用户选择忏悔者后自动排队；
- 真人修女进入 Activity 可选修女 / 忏悔者 / 围观者；
- 修女主动“上钟接待”；
- 所有加入 Activity 的用户均可进入围观席；
- 底部默认按钮为“忏悔结束”；
- 结束后 Bot 在频道发天堂/地狱 Poll；
- Poll 只供群众互动参考；
- 最终天堂/地狱决定权始终属于当值修女；
- 最终 verdict 继续驱动原 60 张牌池与五选一抽牌。

本文件只覆盖并最终冻结“真人忏悔表达模式”：

**文字模式 / 勇者模式（本音）**。

---

## 6. QA 修订

Candidate2 必须新增并通过：

1. `MODE_SELECT` 只显示“文字模式 / 勇者模式”。
2. 前后端不存在可触发的“变声模式”状态或按钮。
3. 30 秒不选择时自动进入文字模式。
4. 文字模式完全不依赖麦克风权限。
5. 勇者模式不处理音频，只使用 Discord 原生语音。
6. 修女可独立选择文字或语音，不受忏悔者模式限制。
7. 大肥鱼固定文字 only。
8. Android / Web / iOS 在用户拒绝麦克风权限时仍可通过文字模式完成完整忏悔、投票、裁决、抽牌和昵称执行链。
