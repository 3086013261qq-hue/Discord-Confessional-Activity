# 001｜给静静的 Discord 忏悔室 Activity 正式施工单 v1.0

> 项目：Discord Confessional Activity
>
> 唯一仓库：`3086013261qq-hue/Discord-Confessional-Activity`
>
> branch：`main`
>
> 本施工单冻结基线 HEAD：`d1bdcfc380da10b263c6f11b6104598c76f9a3e1`
>
> 施工原则：**不要重新设计业务，不要改写已拍板玩法，不要把它做成普通文字频道 Bot。它必须是 Discord Activity（Embedded App）+ 后端 Bot 能力的组合。**

---

## 0. 产品一句话定义

这是一个嵌入 Discord 语音频道里的“匿名忏悔室”互动 Activity。

用户进入 `⛪｜忏悔室` 频道后打开 Activity，在应用内部匿名向“修女”忏悔；修女侧看不到真实用户名，只看到临时匿名编号。修女可以回复，并最终裁决“天堂 / 地狱”。裁决后，忏悔者进入塔罗抽卡演出，由三位修女老板娘之一出现，随机抽取对应奖励或刑罚，并可真正执行一部分 Discord 服务器效果（如临时昵称前缀、临时身份组、解除旧刑罚等）。

核心关键词：

- 匿名告解
- 修女审判
- 天堂 / 地狱
- 塔罗抽卡
- 三位修女老板娘
- Discord 实体奖励 / 刑罚
- 哥特教堂视觉
- 表情包互动

---

## 1. 技术形态硬规则

### 1.1 必须使用 Discord Activity

前端必须使用 Discord Embedded App SDK 作为 Activity 运行在 Discord 内部 iframe 中。

官方参考：

- https://discord.com/developers/build
- https://support-dev.discord.com/hc/en-us/articles/21204423970071-Introducing-the-Embedded-App-SDK

不得把主体验改成 Slash Command + Embed 的普通 Bot。

### 1.2 必须有后端 Bot / API

Activity 前端负责：

- UI
- 匿名聊天
- 抽卡演出
- 塔罗卡展示
- 表情包选择器
- 修女席与忏悔者视图

后端负责：

- Discord OAuth / Activity 用户上下文校验
- 匿名会话映射
- WebSocket / SSE 实时消息
- 修女权限校验
- 裁决结果生成
- 随机池
- Discord 昵称 / 身份组实际执行
- 原昵称恢复
- 会话结束清理
- 审计日志（只保留必要字段）

推荐技术栈：

- Frontend：React + TypeScript + Vite
- Activity：`@discord/embedded-app-sdk`
- Backend：Node.js + TypeScript
- Bot：discord.js
- Realtime：WebSocket（优先）
- Storage：SQLite 起步即可，结构必须允许后续换 PostgreSQL

---

## 2. 页面与角色视图

### 2.1 忏悔者视图

进入 Activity 后显示：

1. 哥特教堂入口页
2. `开始忏悔` 按钮
3. 进入匿名会话后显示匿名编号，例如：`迷途灵魂 #042`
4. 中央为聊天区
5. 底部输入框支持：
   - 文字
   - 修女表情包
6. 对方永远只显示“修女”或当前登场修女老板娘，不显示 Discord 真实账号
7. 修女裁决前，忏悔者不知道对方选择天堂还是地狱
8. 裁决后全屏进入抽卡动画

### 2.2 修女视图

只有配置中的“修女管理员”可进入。

显示：

- 等待队列
- 当前匿名灵魂编号
- 对话正文
- `回应`
- `☁️ 天堂`
- `🔥 地狱`
- `结束会话`

修女视图禁止显示：

- Discord username
- display name
- avatar
- user id

后端可以持有短期映射，但 UI 不得泄漏。

---

## 3. 匿名机制

### 3.1 会话编号

每次新忏悔创建新的匿名编号：

`迷途灵魂 #001` ～ `#999`

编号只用于当前会话，不与用户长期绑定。

### 3.2 身份映射

后端临时保存：

`session_id -> discord_user_id -> anonymous_id`

规则：

- 结束会话后删除可直接识别身份的映射
- 不在普通日志打印真实 user id + 忏悔内容组合
- 审判记录只保留匿名编号、结果、卡牌、执行状态

### 3.3 修女自身例外

配置中的修女账号进入时识别为 `confessor_admin`，不分配匿名编号。

---

## 4. 三位修女老板娘（第一期只做三位）

第一期不得擅自增加第四角色。

### 4.1 龙卷｜THE TEMPEST / 风暴

核心气质：

- 嘴毒
- 没耐心
- 傲娇式训诫
- 强势保护

天堂流派：赦免、庇护、霸道宠爱、免罚。

地狱流派：训诫、罚站、社死昵称、风暴式追加刑罚。

实体例：

- `被龙卷打屁股的zero`
- 临时身份组：`🌪️ 正在反省`
- SSR：本次刑罚 ×2 / 追加一次地狱牌

### 4.2 山城恋｜THE DOMINION / 支配

核心气质：

- 从容
- 高高在上
- 命令感
- 修女长 / 总组长风格

天堂流派：嘉奖、宠爱、特权、乖孩子称号。

地狱流派：服从、命令、羞耻称号、指定挑战。

实体例：

- `正在服从山城恋命令的zero`
- 临时身份组：`👑 修女长的宠儿`
- 三选一执行：诚恳道歉 / 羞耻赞美 / 接受随机昵称

### 4.3 李柚巴｜THE WAGER / 赌局

核心气质：

- 爱玩
- 赌徒气质
- 坏笑
- 看热闹不嫌事大

天堂流派：幸运、翻倍、大奖、重抽、解除旧刑罚。

地狱流派：赌债、翻倍处罚、二次抽签。

专属交互：

`Double or Nothing / 翻倍或归零`

- 50% 刑罚取消
- 50% 刑罚翻倍

SSR：`梭哈`，用老虎机 / 三张塔罗滚动表现。

---

## 5. 裁决与抽卡主流程

固定流程：

1. 忏悔者完成忏悔
2. 修女点击 `天堂` 或 `地狱`
3. 服务端锁定 alignment：
   - heaven = 正位池
   - hell = 逆位池
4. 忏悔者画面熄灭
5. 教堂钟声 / 光效
6. 三位修女老板娘随机抽取 1 位
7. 出现 3～5 张背面塔罗牌
8. 忏悔者亲手点击一张
9. 翻牌
10. 显示：角色、牌名、稀有度、判词、奖励 / 刑罚
11. 若属于实体执行，后端立即执行 Discord 动作
12. 显示执行成功 / 失败原因
13. 允许：
    - `接受审判`
    - `请求减刑`（地狱可选）
    - `再赌一次`（仅李柚巴特定卡）

注意：

- 天堂不能抽到地狱刑罚。
- 地狱不能抽到普通天堂奖励。
- 李柚巴的“翻倍或归零”属于地狱结果内部二次概率，不算越池。

---

## 6. 抽卡演出视觉

可以参考主流二次元抽卡“流星 -> 稀有度光 -> 翻牌”的节奏，但禁止逐帧复制任何现成商业游戏 UI、字体、图标、星级样式。

我们自己的视觉主题必须固定为：

**哥特教堂 × 塔罗 × 彩窗 × 圣光 / 深渊**

### 天堂

- 白金光
- 羽毛
- 彩窗
- 钟声
- 金色粒子

### 地狱

- 暗红
- 黑烟
- 火星
- 烛火骤灭
- 红色裂纹

### 三位角色专属

- 龙卷：绿色念动力把卡“扯”到中央
- 山城恋：牌安静悬浮后缓慢翻面，强调压迫与支配
- 李柚巴：像扑克 / 赌局一样甩出多张牌，让用户选

---

## 7. 稀有度

第一版使用三档：

- R：70%
- SR：25%
- SSR：5%

所有概率放配置，不得硬编码进组件。

结构示例：

```json
{
  "rarity": {
    "R": 0.70,
    "SR": 0.25,
    "SSR": 0.05
  }
}
```

同一用户同一次会话内，不允许连续抽到完全相同的 `card_id`。

---

## 8. 卡面云端素材规则

正式运行时卡面位于 GitHub：

```text
public/assets/tarot/characters/
├── 龙卷/
├── 山城恋/
└── 李柚巴/
```

当前三个目录已经存在，且用户已经上传真实图片素材。

禁止：

- 删除用户上传素材
- 重压缩原图
- 改写原文件
- 擅自重命名造成引用失效

需要新增：

```text
public/assets/tarot/manifest.json
```

manifest 必须显式记录：

- `character`
- `asset_id`
- `path`
- `alignment`（heaven / hell / both）
- `rarity`
- `enabled`
- `adult_only`

不要依赖“运行时读取 GitHub 目录列表”作为唯一发现机制；生产环境以 manifest 为准。

卡面使用 raw/static URL 云端加载，并做 preload + fallback。

---

## 9. 表情包系统（必须做）

我们已经生成一组“哥特修女十六表情贴纸合集”，母图保存在资料库。

第一版必须支持在匿名聊天中发送这组表情包。

### 9.1 运行时处理

施工时将母图切为独立透明 / 白底贴纸资源，命名：

```text
public/assets/stickers/nun/
├── nun_01.png
├── nun_02.png
...
└── nun_16.png
```

并新增：

```text
public/assets/stickers/manifest.json
```

母图继续作为资料库母素材；GitHub 只存为 Activity 运行所需的切片副本。

### 9.2 UI

聊天输入框右侧增加 `😼 / sticker` 按钮。

点击后弹出 4×4 表情选择器。

发送后：

- 在 Activity 匿名聊天内显示贴纸消息
- 不暴露发送者 Discord 身份
- 修女与忏悔者双方都可发送

消息结构：

```ts
{
  type: "sticker",
  stickerId: "nun_07",
  senderRole: "soul" | "nun",
  timestamp: number
}
```

表情消息必须和文字消息走同一个实时会话通道。

### 9.3 可选公开分享

第一版可以保留一个 feature flag：

`ALLOW_PUBLIC_STICKER_SHARE=false`

默认关闭。

不得默认把匿名忏悔中的表情包直接发送到公开 Discord 频道，否则会破坏匿名体验。

---

## 10. Discord 实体奖励 / 刑罚执行

必须由后端 Bot 执行。

### 10.1 昵称刑罚

示例：

原昵称：`zero`

执行后：`被龙卷打屁股的zero`

必须保存原昵称快照：

```ts
originalNickname
punishedNickname
startedAt
expiresAt
```

恢复时必须恢复完整原昵称，不允许通过字符串删除前缀猜测原昵称。

### 10.2 时效

每条实体卡定义 duration：

- 1h
- 6h
- 12h
- 24h
- until_next_heaven

### 10.3 身份组

允许临时授予专属角色，例如：

- `🌪️ 正在反省`
- `👑 修女长的宠儿`
- `🎲 赌局输家`

结束后自动移除。

### 10.4 Discord 权限失败

若 Bot 权限或角色层级不足：

- 不得让整次抽卡失败
- UI 显示“实体刑罚未执行，判决仍成立”
- 记录 `execution_status=permission_denied`

### 10.5 昵称长度

Discord 显示名 / server nickname 需要遵循平台长度与内容限制。

生成前缀时必须检查最终长度，超长则：

1. 保留刑罚前缀
2. 截短原昵称
3. 不切断 emoji surrogate / Unicode grapheme

不得生成明显违反 Discord Community Guidelines 的昵称。

---

## 11. 判决数据结构

建议：

```ts
type JudgmentCard = {
  cardId: string
  character: "tatsumaki" | "ren" | "yuzuha"
  alignment: "heaven" | "hell"
  rarity: "R" | "SR" | "SSR"
  title: string
  subtitle?: string
  quote: string
  assetId: string
  effectType: "text" | "nickname" | "role" | "reroll" | "double_or_nothing" | "clear_punishment"
  effectPayload: Record<string, unknown>
  duration?: string
  weight: number
  adultOnly: boolean
}
```

牌面数据与程序逻辑分离。

必须新增：

```text
src/config/cards/
├── tatsumaki.json
├── ren.json
└── yuzuha.json
```

或等价结构。

---

## 12. 第一版牌池内容目标

第一版至少：

- 龙卷：10 天堂 + 10 地狱
- 山城恋：10 天堂 + 10 地狱
- 李柚巴：10 天堂 + 10 地狱

总计 >= 60 个 JudgmentCard。

其中实体执行型卡牌建议占 25%～40%，不能所有结果都改昵称，否则很快腻。

类型要混合：

- 纯文字判词
- 昵称
- 身份组
- 免罚
- 解除旧刑罚
- 重抽
- 二选一 / 三选一
- 李柚巴翻倍或归零

---

## 13. 成人 / 禁忌模式

项目允许存在“暧昧、羞耻、服从感”的成人向牌组，但必须：

- 默认关闭
- 仅在服务器明确开启后使用
- 只使用明确成年角色
- 不将未成年角色加入成人 / 情色池
- `adult_only=true` 的卡只在 adult mode 生效

成人向卡面素材与普通素材必须可由 manifest 明确区分。

禁止把成人模式作为普通用户第一次进入时的默认体验。

---

## 14. 修女老板娘立绘与运行素材

三位修女老板娘的正式母立绘保存在资料库：

```text
/Discord忏悔室/视觉素材/三位修女老板娘/
├── 龙卷_修女老板娘.png
├── 山城恋_修女老板娘.png
└── 李柚巴_修女老板娘.png
```

这些是视觉母版。

若 Activity 运行需要，生成 / 导出 runtime copy 到：

```text
public/assets/nuns/
├── tatsumaki.png
├── ren.png
└── yuzuha.png
```

不得覆盖资料库母图。

---

## 15. UI 视觉规范

整体：黑 / 白 / 金 / 酒红。

风格：

- 哥特教堂
- 彩窗
- 烛火
- 银十字
- 塔罗纹样
- 少量粒子

禁止：

- 默认 Discord 蓝紫风大面积覆盖
- 普通 SaaS Dashboard 风
- 纯 Bootstrap 表格感
- 把它做成管理后台

移动端必须优先适配 Android Discord。

触控目标至少 44×44 CSS px。

核心画面必须支持窄屏竖屏。

---

## 16. 建议项目目录

```text
/
├── docs/
├── public/
│   └── assets/
│       ├── tarot/
│       │   ├── manifest.json
│       │   ├── characters/
│       │   │   ├── 龙卷/
│       │   │   ├── 山城恋/
│       │   │   └── 李柚巴/
│       │   ├── backs/
│       │   └── effects/
│       ├── nuns/
│       └── stickers/
│           ├── manifest.json
│           └── nun/
├── client/
│   └── src/
│       ├── activity/
│       ├── components/
│       ├── scenes/
│       ├── chat/
│       ├── gacha/
│       └── styles/
├── server/
│   └── src/
│       ├── discord/
│       ├── sessions/
│       ├── judgments/
│       ├── executions/
│       └── realtime/
└── shared/
    └── types/
```

可以在不改变职责边界的前提下调整工程目录。

---

## 17. 实时会话状态机

```text
IDLE
 -> WAITING_FOR_NUN
 -> CONFESSING
 -> JUDGMENT_LOCKED
 -> GACHA
 -> RESULT
 -> EXECUTED
 -> CLOSED
```

任何状态只能由服务器确认推进。

客户端动画结束不等于服务端状态推进。

禁止客户端自己决定抽卡结果。

---

## 18. 随机公平性

随机结果必须由服务器生成。

服务端返回：

```ts
{
  judgmentId,
  alignment,
  character,
  cardId,
  rarity,
  nonce
}
```

前端只负责演出，不得在动画过程中重新 roll。

开发模式允许固定 seed / forced card 方便 QA，但生产必须关闭。

---

## 19. 安全与隐私

必须做到：

- 前端不拿 Bot Token
- Discord Bot Token 只在后端环境变量
- 不把真实 user id 放在前端匿名消息 payload
- 会话关闭后删除可识别映射
- 对修女管理 API 做服务端权限校验
- WebSocket 必须绑定 session auth
- 所有昵称 / 角色执行做 guild allowlist
- 不允许 Activity 被别的服务器安装后自动获得本项目服务器的管理能力

---

## 20. 配置项

建议 `.env`：

```env
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_BOT_TOKEN=
DISCORD_GUILD_ID=
CONFESSIONAL_CHANNEL_ID=
NUN_USER_IDS=
ADULT_MODE=false
ALLOW_PUBLIC_STICKER_SHARE=false
```

不要提交 secret。

新增 `.env.example`。

---

## 21. QA 必须项

### 匿名

- 修女前端看不到真实昵称 / 头像 / user id
- 忏悔者之间不可互相看到
- 断线重连不会串会话

### 抽卡

- 天堂只进入 heaven 池
- 地狱只进入 hell 池
- 三角色均可正常抽出
- 稀有度配置生效
- 卡图加载失败有 fallback

### 实体执行

- 改昵称成功
- 角色层级不足时优雅失败
- 自动恢复原昵称
- 多个刑罚叠加时不丢原始昵称
- until_next_heaven 可以正确解除

### 表情包

- 16 个贴纸均可打开
- Android 触控可用
- 发送后双方实时收到
- 贴纸不会暴露真实身份

### Activity

- Android Discord 可正常打开
- 桌面 Discord 可正常打开
- 竖屏不溢出
- 关闭 / 重开 Activity 可恢复当前会话或安全结束

---

## 22. 开发阶段顺序

### P0｜骨架

1. 初始化 Activity 前端
2. 初始化 Bot / API
3. OAuth / Activity auth
4. WebSocket
5. 双角色视图

### P1｜匿名忏悔

6. 会话队列
7. 匿名编号
8. 文字聊天
9. 修女回应
10. 表情包切片 + sticker picker

### P2｜审判

11. 天堂 / 地狱锁定
12. 三位老板娘
13. 60 张 JudgmentCard 数据
14. gacha 状态机
15. 塔罗翻牌演出

### P3｜实体效果

16. nickname executor
17. role executor
18. duration / restore worker
19. 李柚巴 Double or Nothing
20. 减刑 / 重抽逻辑

### P4｜视觉与 QA

21. Android 优化
22. 动画性能
23. asset preload / fallback
24. QA
25. 部署文档

---

## 23. 本轮禁止事项

- 不得增加第四位修女老板娘
- 不得改成普通 Discord Bot 主体验
- 不得公开忏悔者身份
- 不得把真实 user id 显示给修女
- 不得删改用户当前上传的三角色卡面素材
- 不得把客户端随机当最终结果
- 不得写死卡牌概率
- 不得把全部刑罚都做成改昵称
- 不得默认公开发送匿名会话内容
- 不得把 adult 模式默认开启
- 不得在代码库提交 Bot Token / Client Secret

---

## 24. 验收定义

第一版完成必须至少满足：

1. 能从 Discord `⛪｜忏悔室` 启动 Activity。
2. 忏悔者进入后获得匿名编号。
3. 修女可以匿名回复。
4. 双方可以在 Activity 里发送修女表情包。
5. 修女可以选择天堂 / 地狱。
6. 忏悔者看到完整抽卡动画，并亲手选塔罗牌。
7. 三位修女老板娘都能随机出现。
8. GitHub 云端卡面可以通过 manifest 正常加载。
9. 至少一种昵称刑罚、至少一种身份组效果、至少一种纯文字效果成功运行。
10. 到期后原昵称能准确恢复。
11. Android Discord 实机通过。

只有以上全部完成，才算 `CANDIDATE1_READY`。

---

## 25. 给静静的最终执行说明

以本施工单为唯一业务设计基线直接施工。

允许你做工程实现层面的技术决策，但禁止重新设计产品玩法。

先完整读取仓库现有 `public/assets/tarot/` 结构和用户已上传的三角色素材，再初始化工程。

施工过程中不要删除 / 重压缩 / 重命名用户卡面原素材。

开发完成后输出：

- 最终 HEAD
- Activity 启动 / 部署方式
- `.env.example`
- 卡面 manifest
- sticker manifest
- 60 张第一版 JudgmentCard 数据
- QA 报告
- Android / Desktop 验收清单

