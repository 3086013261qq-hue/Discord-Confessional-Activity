# Discord 忏悔室｜Candidate2 多人围观与身份切换补充 v1.0

> 适用分支：`candidate2-real-device-refactor`
> 上位关系：本文件为 `008_给静静的Discord忏悔室_Candidate2实机返工施工单_v1.0.md` 的补充；与 008 冲突时，本文件优先。
> 来源：2026-10-31 第二轮真实 Discord / Android 实机反馈。

## 0. 本轮新增核心方向

Candidate2 不再只是“双人匿名忏悔房间”，而升级为：

**自动排队 + 修女上钟接待 + 多人围观 + 频道投票 + 修女最终裁决 + 修女/忏悔者双身份入口 + 大肥鱼文字 AI 修女**。

保留 Candidate1 的核心资产：匿名编号、60 张牌池、天堂/地狱两阵营、五选一抽牌、卡面、SSR 演出、昵称实体效果与安全恢复。

---

## 1. 入口身份选择

### 1.1 普通用户

普通用户进入 Activity 后默认身份只有：

- `忏悔者`
- `围观者`

选择 `忏悔者` 后立即自动调用排队逻辑，不再要求二次点击“开始排队”。

### 1.2 真人修女

`NUN_USER_IDS` 中的真人修女进入 Activity 时，必须先选择：

- `以修女身份进入`
- `以忏悔者身份进入`
- `只围观`

真人修女选择“忏悔者”后，行为与普通忏悔者完全一致：自动排队，可被另一名真人修女或大肥鱼接待。

身份选择只影响当前 Activity 会话，不改变 Discord 账号永久权限。

### 1.3 大肥鱼

大肥鱼不是 Discord 真人账号，不占 `NUN_USER_IDS`。

大肥鱼只作为 AI 修女入口存在，并且：

- 只走文字对话；
- 不启动语音；
- 不加入 Discord 语音频道；
- 不抢占真人修女普通人工队列；
- 可以接待“向大肥鱼忏悔”的用户。

---

## 2. 自动排队与修女上钟

### 2.1 忏悔者

用户选择“忏悔者”后立刻创建/恢复唯一未关闭 session：

`IDENTITY_SELECT -> QUEUED`

前端显示：

`已进入忏悔队列，等待修女上钟。`

### 2.2 修女

修女席显示当前队列，修女必须主动点击：

`上钟接待`

才能 claim 一名忏悔者。

成功后：

`QUEUED -> MODE_SELECT -> CONFESSING`

修女同一时间只允许接待一个真人会话。

---

## 3. 忏悔者 30 秒模式选择

真人修女 claim 后，忏悔者进入 30 秒选择阶段：

### A. 变声模式

设计目标：经过变声后进行语音忏悔，不暴露本音。

### B. 勇者模式

直接使用 Discord 原生语音，本音忏悔。

### 超时

30 秒内未选择：

**自动选择“变声模式”。**

### 当前 Discord Activity 平台限制（必须保留，不得伪造实现）

截至 2026-10-31，Discord Embedded App SDK 可以读取 Voice State / Speaking Start / Speaking Stop 等事件，但没有向 Activity 提供原始麦克风 PCM/MediaStream，也没有 API 允许 Activity 将自行处理后的语音重新注入 Discord Voice。

同时，Discord Activity iframe 当前不开放 `microphone` permission policy，因此标准 Activity 内不能直接通过 `getUserMedia()` 获得麦克风流来实现实时变声。

因此 Candidate2：

- `勇者模式`：可以真实落地，使用 Discord 原生语音。
- `变声模式`：**不得假装已经实现实时变声**。
- 前端可以保留该产品入口与 30 秒默认逻辑，但必须明确标记当前平台限制；真正实时变声等待 Discord 开放麦克风流能力，或未来单独做外部/桌面端虚拟麦克风方案。
- Android Candidate2 不得因为“变声模式”不存在底层能力而把用户卡死；需要安全降级入口（例如提示改用文字，或切换勇者模式）。

禁止为了实现变声而索取用户 Discord Token、使用非官方客户端注入、Selfbot 或其他违反 Discord 平台规则的方式。

---

## 4. 修女回复模式

真人修女 claim 后，可选择：

- `文字`
- `语音`

修女选择不限制忏悔者自己的表达模式，允许混合：

- 忏悔者语音 + 修女文字；
- 忏悔者语音 + 修女语音；
- 若忏悔者降级为文字，也允许双方纯文字。

大肥鱼固定：

`文字 only`

不得出现大肥鱼语音按钮。

---

## 5. 多人围观

### 5.1 原则

只要用户加入同一 Activity Instance，即可进入“围观席”。

围观者可以看到：

- 当前是否有人正在忏悔；
- 匿名编号，如 `迷途灵魂 #233`；
- 当前阶段；
- 公开的文字忏悔内容；
- 修女回复；
- 最终投票；
- 抽卡与判决演出；
- 最终卡牌结果。

围观者不得看到：

- 忏悔者真实 Discord user id；
- Client Secret / Bot Token / API Key；
- 服务器内部日志；
- 任何未选择公开的账号身份信息。

### 5.2 权限

围观者为只读：

- 不能 claim；
- 不能代替修女做最终天堂/地狱决定；
- 不能操作忏悔者的五选一抽牌；
- 可以在 Discord 频道原生投票中投票。

---

## 6. “忏悔结束” -> 全服投票 -> 修女拍板

### 6.1 底部主按钮

Candidate1 的底部：

- 天堂
- 地狱

Candidate2 默认改为单一按钮：

`忏悔结束`

### 6.2 修女点击“忏悔结束”后

状态：

`CONFESSING -> COMMUNITY_VOTE`

Bot 向 `CONFESSIONAL_CHANNEL_ID` 对应的 Discord 文字聊天发送一个原生 Poll：

问题：

`这个迷途灵魂应该——`

选项：

- `😇 上天堂`
- `🔥 下地狱`

Poll 用于社区互动和舆论参考，不直接控制抽卡阵营。

Bot 不需要读取历史聊天内容；不依赖 Message Content Intent。

### 6.3 最终决定权

投票出现后，修女端才显示：

- `天堂`
- `地狱`

并明确标注：

`群众意见仅供参考，最终裁决权属于当值修女。`

修女选择后才真正执行原 Candidate1 `verdict`：

- 天堂 -> upright
- 地狱 -> reversed

然后继续原五选一抽牌流程。

### 6.4 投票不阻塞

不要求等待 Poll 正式截止才能裁决。

设计上允许：

- Poll 发出后立刻开放修女最终按钮；
- 群众边投，修女边看；
- 修女任何时候可最终拍板。

判决完成后，可以再在频道发布最终 Embed，并注明：

`最终裁决：天堂/地狱（由当值修女决定）`

---

## 7. AI 修女“大肥鱼”

### 7.1 只允许文字

大肥鱼会话不进入第 3 节的真人语音模式选择。

流程：

`AI_CONFESSION -> TEXT_CONFESSING -> AI_VERDICT_READY -> CARD_CHOICE -> ...`

用户向大肥鱼输入文字，大肥鱼只用文字回复。

### 7.2 DeepSeek

使用官方 API：

- Base URL：`https://api.deepseek.com`
- Model：`deepseek-flash`

截至 2026-10-31，`deepseek-flash` 对应 DeepSeek-V4.1-Flash-1017。

API Key 只放服务器 `.env`。

### 7.3 AI 判决

大肥鱼只负责输出：

```json
{"verdict":"heaven|hell","reason":"..."}
```

AI 不指定具体卡牌，不修改稀有度概率。

判决后仍走原 60 张牌池与五选一。

---

## 8. 会话状态机建议

真人流程：

`IDENTITY_SELECT`
-> `QUEUED`
-> `CLAIMED`
-> `MODE_SELECT`（30s）
-> `CONFESSING`
-> `COMMUNITY_VOTE`
-> `VERDICT_DECIDED`
-> `ANIMATION`
-> `CARD_CHOICE`
-> `REVEALED`
-> `EXECUTING`
-> `SETTLED`
-> `CLOSED`

AI 流程：

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

旁观者不拥有 session，只订阅当前公开会话的 spectator snapshot。

---

## 9. 与 008 的合并规则

008 中以下内容继续有效：

- 去除 Role 实体玩法；
- 中途退出重连宽限；
- 判决结果发 Discord 频道；
- 大肥鱼 AI 修女；
- Candidate1 在线 main 不动；
- Candidate2 分支施工并 QA 后再决定是否上线。

本文件新增并覆盖：

- 修女可以选择以忏悔者身份进入；
- 用户选择忏悔者后自动排队；
- 修女主动上钟；
- 真人忏悔增加 30 秒模式选择；
- 修女选择文字/语音；
- 大肥鱼严格文字 only；
- Activity 多人围观；
- 天堂/地狱按钮改为“忏悔结束 -> Discord Poll -> 修女最终裁决”；
- 变声模式必须遵循当前 Discord Activity 麦克风平台限制。

---

## 10. 新增 QA

1. NUN_USER_IDS 用户可在进入时选择修女 / 忏悔者 / 围观者。
2. 普通用户选忏悔者后自动进入 QUEUED。
3. 修女必须主动“上钟接待”，不能自动抢单。
4. 真人 claim 后显示 30 秒模式倒计时。
5. 30 秒超时自动进入变声模式产品状态，但在底层能力不可用时必须安全提示/降级，不能卡死。
6. 勇者模式不拦截 Discord 原生本音。
7. 大肥鱼永远不出现语音按钮。
8. 围观者可实时看到公开会话，但不能操作 session。
9. 围观 snapshot 不泄露真实 Discord user id。
10. “忏悔结束”只发送一次原生 Poll。
11. Poll 仅作为参考，不自动触发 verdict。
12. 只有当值修女可最终选择天堂/地狱。
13. 最终 verdict 仍准确映射原 60 张牌池 upright/reversed。
14. 修女选择忏悔者后可被另一真人修女或大肥鱼接待。
15. Android 实机多人同时加入 Activity 时，spectator / nun / confessor 状态一致。
