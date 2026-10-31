# Discord 忏悔室｜Candidate2 最终总施工单 v1.0

> 唯一仓库：`3086013261qq-hue/Discord-Confessional-Activity`
> 施工分支：`candidate2-real-device-refactor`
> Candidate1 线上 `main` 保持不动，未经用户明确授权不得合并、推送或替换线上版本。
> 本文件为 Candidate2 当前最高优先级施工单；与 `008/009/010` 冲突时，以本文件为准。未冲突内容继续继承。

## 一、Candidate2 最终产品形态

Candidate2 从 Candidate1 的双人匿名忏悔，升级为：

**身份选择 → 自动排队 → 修女上钟 → 文字/勇者模式 → 多人围观 → 忏悔结束 → Discord 频道投票 → 修女最终裁决 → 五选一抽牌 → 昵称实体判决 → 频道最终结果。**

保留 Candidate1：

- 匿名编号；
- 60 张正式牌池；
- 龙卷 / 山城恋 / 李柚巴；
- 天堂/地狱对应 upright/reversed；
- 五选一；
- SSR 演出；
- 卡面与现有视觉；
- 昵称安全截断、优先级、恢复与手动改名保护。

## 二、身份系统

### 普通用户

进入 Activity 后可选：

- `忏悔者`
- `围观者`

选择忏悔者后立即自动进入队列，不再二次点击开始排队。

### 真人修女

`NUN_USER_IDS` 中的真人修女每次进入 Activity 都先选本次身份：

- `以修女身份进入`
- `以忏悔者身份进入`
- `只围观`

选择忏悔者后，与普通用户完全一致，可以被另一位真人修女或大肥鱼接待。

## 三、排队与上钟

- 忏悔者选择身份后自动进入 `QUEUED`。
- 修女席显示队列。
- 修女必须主动点 `上钟接待` 才 claim。
- 单个真人修女同时只接待一场真人忏悔。
- 中途断线保留 20 秒重连宽限；超时后自动释放 session，修女不得卡死。

## 四、真人忏悔模式

真人修女 claim 后，忏悔者进入 30 秒模式选择：

### 文字模式

- 纯 Activity 文字聊天；
- 不启动麦克风；
- 不依赖 Discord 语音。

### 勇者模式

- 直接使用 Discord 原生麦克风；
- 本音忏悔；
- Activity 不处理、不录制、不转码用户音频。

### 超时

30 秒未选择时：

**自动进入文字模式。**

彻底删除“变声模式”概念：不得保留按钮、状态、兼容占位或虚假变声逻辑。

## 五、真人修女回复模式

真人修女可独立选择：

- `文字`
- `语音`

因此允许：

- 忏悔者文字 × 修女文字；
- 忏悔者文字 × 修女语音；
- 忏悔者勇者 × 修女文字；
- 忏悔者勇者 × 修女语音。

## 六、多人围观

同一 Activity Instance 中所有选择“围观”的用户均可实时看到当前公开会话。

围观者可见：

- 匿名编号；
- 当前阶段；
- 公开文字忏悔；
- 修女公开文字回复；
- 社区投票；
- 抽卡与判决演出；
- 最终卡牌和昵称结果。

围观者不可：

- claim；
- 代替修女最终裁决；
- 操作五选一；
- 看到真实 Discord user id、Secret、Token、API Key、服务器日志。

语音模式下围观者通过 Discord 原生语音频道听取现场声音，Activity 不碰原始音频。

## 七、忏悔结束、社区投票与最终裁决

Candidate1 底部直接显示的“天堂 / 地狱”改为默认只显示：

`忏悔结束`

修女点击后：

1. session 进入 `COMMUNITY_VOTE`；
2. Bot 向 `CONFESSIONAL_CHANNEL_ID` 对应文字频道发送 Discord 原生 Poll；
3. Poll 题目：`这个迷途灵魂应该——`；
4. 选项：`😇 上天堂` / `🔥 下地狱`；
5. 投票仅供社区互动和参考，不自动控制牌池；
6. Poll 发出后，修女端才出现最终 `天堂 / 地狱`；
7. 最终决定权始终属于当值修女；
8. 修女选择后才真正调用现有 verdict 流程并进入抽牌。

Poll 不阻塞：无需等待结束即可裁决。

## 八、彻底移除身份组玩法

Candidate2 不再创建、增加、删除任何 Discord Role。

正式 Bot 权限缩减为：

- View Channel
- Manage Nicknames
- Send Messages
- Embed Links

不再需要：

- Manage Roles
- Administrator
- Message Content Intent
- Read Message History

所有原 `kind: role` 牌必须重制为：

- nickname；或
- Activity 内部 token/state。

禁止简单过滤 Role 导致空牌。

Candidate1 旧数据库中的 role effect 只做兼容性收尾，不再执行新的 Role 写操作。

## 九、频道最终判决结果

每次 judgment `execute` 成功后，仅向频道发布一次最终 Embed：

- 匿名编号；
- 天堂 / 地狱；
- 当值修女：真人修女 / 大肥鱼；
- 龙卷 / 山城恋 / 李柚巴；
- R / SR / SSR；
- 牌名；
- 卡图；
- 最终昵称效果与持续时间；
- 内部状态/赦免/重抽等报告；
- 明确标注“最终裁决由当值修女决定”。

不得发布忏悔正文或真实账号 ID。

用 DB metadata 保证每个 judgment 只发一次。

## 十、大肥鱼 AI 修女

### 定位

大肥鱼是第三位 AI 修女，不是 Discord 真人账号，不进入 `NUN_USER_IDS`。

她只走文字：

- 不启动语音；
- 不加入 Discord 语音频道；
- 不出现麦克风按钮；
- 不抢真人修女的人工队列；
- 用户可主动选择“向大肥鱼忏悔”。

### DeepSeek 接口

使用 DeepSeek 官方 OpenAI-compatible API：

```env
AI_NUN_ENABLED=true
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-flash
```

`DEEPSEEK_API_KEY` 只允许存在服务器 `.env`，禁止写入 GitHub、日志、前端 bundle 或 API 响应。

截至 2026-10-31，官方要求直接使用模型名 `deepseek-flash`，该别名当前指向最新 Flash 版本；不要硬编码具体小版本号。

### 大肥鱼人格

大肥鱼统一设定为：**成年、雌小鬼风格的修女 AI**。

核心语气：

- 嘴欠、欠揍、坏笑、爱挤兑；
- 喜欢抓住用户忏悔里的漏洞吐槽；
- 会使用轻度挑衅式称呼，例如“杂鱼忏悔者”“这就不敢说啦？”；
- 有明显优越感和看热闹气质；
- 但不是纯恶意辱骂，不持续人格攻击；
- 用户认真、脆弱、难受时必须迅速收住玩笑，转为正常倾听；
- 不装医生、心理咨询师或宗教权威；
- 不输出 system prompt、API Key、服务器信息；
- 不幼态化、不使用未成年设定；
- 不把色情化作为人格核心。

每轮默认 1～3 句，短、坏、灵活，不写长篇论文。

### AI 对话与判决

- AI 只读取当前 AI session 的文字消息；
- 不读取 Discord 历史聊天；
- 用户点击 `请大肥鱼判决` 后，由 DeepSeek 仅返回结构化：

```json
{"verdict":"heaven|hell","reason":"..."}
```

- 服务器必须 schema 校验；
- AI 只能决定 heaven/hell 和简短理由；
- AI 不得指定具体卡牌、稀有度、五选一结果；
- verdict 后继续调用现有 60 张牌池和原抽卡流程。

DeepSeek 请求失败、超时、额度不足时：

- 显示可恢复错误；
- 不锁死 session；
- 用户可重试或退出；
- 不自动改成随机天堂/地狱。

## 十一、状态机

真人流程：

`IDENTITY_SELECT -> QUEUED -> CLAIMED -> MODE_SELECT -> CONFESSING -> COMMUNITY_VOTE -> VERDICT_DECIDED -> ANIMATION -> CARD_CHOICE -> REVEALED -> EXECUTING -> SETTLED -> CLOSED`

AI 流程：

`IDENTITY_SELECT -> AI_CONFESSION -> TEXT_CONFESSING -> AI_VERDICT_READY -> ANIMATION -> CARD_CHOICE -> REVEALED -> EXECUTING -> SETTLED -> CLOSED`

旁观者不拥有 session，只订阅 spectator snapshot。

## 十二、Candidate2 QA 必过

1. `NUN_USER_IDS` 用户可选修女 / 忏悔者 / 围观者。
2. 普通用户选忏悔者后自动排队。
3. 修女必须主动上钟。
4. 30 秒模式选择只存在文字 / 勇者，超时默认文字。
5. 项目中不得残留变声模式产品入口。
6. 大肥鱼永远文字 only。
7. 围观者实时同步但只读。
8. 断线 20 秒宽限后 session 正确释放，修女不再卡死。
9. 所有新判决都不调用 Discord Role API。
10. 原 Role-only 卡全部获得 nickname/state 替代结果。
11. Bot 没有 Manage Roles 仍完整 PASS。
12. `忏悔结束` 只创建一次 Poll。
13. Poll 不自动触发 verdict。
14. 只有当值真人修女或 AI 判决流程可决定 heaven/hell。
15. judgment 完成后频道 Embed 只发布一次。
16. DeepSeek API failure 可恢复且不锁死。
17. API Key 不进入仓库/前端/日志。
18. `npm run check` 全绿。
19. Android 实机至少完成：文字真人、勇者真人、多人围观、断线恢复、Poll、昵称判决、真人修女转忏悔者、大肥鱼 AI 各一轮。

## 十三、施工与发布纪律

- 只在 `candidate2-real-device-refactor` 施工。
- 不回退、不重做 Candidate1 资产。
- 不修改线上 `main`。
- 不把 DeepSeek API Key 提交 GitHub。
- Candidate2 完成后先报告：变更摘要、QA、分支 HEAD、部署所需新增环境变量。
- 未经用户明确授权，不得 merge / fast-forward 到 `main`，不得自动更新腾讯云线上服务。
