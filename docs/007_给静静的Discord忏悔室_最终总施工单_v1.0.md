# 007｜给静静的 Discord 忏悔室最终总施工单 v1.0

> 项目：Discord Confessional Activity
>
> 唯一仓库：`3086013261qq-hue/Discord-Confessional-Activity`
>
> branch：`main`
>
> 本总施工单冻结基线 HEAD：`0be7c41b9bef4ababf40650def32e72c5fd9d10d`
>
> 当前阶段：**正式进入应用施工，不再重新设计业务。**

---

# 0. 优先级与施工原则

本文件是当前最高优先级总施工单。

执行优先级：

1. `docs/007_给静静的Discord忏悔室_最终总施工单_v1.0.md`
2. `docs/006_统一判决Manifest与卡面绑定规范_v1.0.md`
3. `docs/003_龙卷判决牌组_20张正式设计_v1.0.md`
4. `docs/004_山城恋判决牌组_20张正式设计_v1.0.md`
5. `docs/005_李柚巴判决牌组_20张正式设计_v1.0.md`
6. `docs/002_核心抽卡动画与Discord实体判决系统设计_v1.0.md`
7. `docs/001_给静静的Discord忏悔室_Activity正式施工单_v1.0.md`
8. `public/config/judgement-manifest.v1.json` 为机器可读卡池真源。

若旧文档与本文件冲突，以 007 为准；若卡片 ID / 稀有度 /角色池与机器配置冲突，以 `judgement-manifest.v1.json` 为准。

禁止：

- 从零重做产品设计；
- 把它改成普通文字频道 Bot；
- 擅自增加第四位修女老板娘；
- 擅自删除或重写已经冻结的 60 张首发判决牌；
- 改变天堂=正位、地狱=逆位；
- 改变三角色等权与 R/SR/SSR = 60/30/10；
- 为了方便施工而取消匿名、抽卡演出、Discord 实体昵称/身份组执行；
- 把昵称/身份组刑罚变成真实禁言、踢出、封禁或频道权限处罚。

施工目标不是 Demo，而是可以真实在 Discord 中运行并可实机验收的 Candidate1。

---

# 1. 产品定义

这是一个运行在 Discord 语音频道中的 Embedded Activity：**“忏悔室”**。

玩家进入忏悔室 Activity，以临时匿名身份向“修女”告解；修女管理员在独立视图中回复、发送表情贴纸，并最终做出：

- `☁️ 天堂`
- `🔥 地狱`

之一的判决。

随后忏悔者进入全屏塔罗抽卡演出：

1. 服务器先冻结判决阵营；
2. 等权选择龙卷 / 山城恋 / 李柚巴之一；
3. 按 R 60% / SR 30% / SSR 10% 抽稀有度；
4. 在对应子池抽卡；
5. 前端播放老板娘专属召唤 + 天堂/地狱动画；
6. 五张牌背展开，忏悔者必须亲手选择一张；
7. 翻牌；
8. 显示卡面、牌名、判词；
9. 后端执行昵称 / 临时身份组 / Activity 状态等真实效果；
10. 到期后安全恢复。

首发角色只有：

- 龙卷｜THE TEMPEST｜风暴
- 山城恋｜THE DOMINION｜支配
- 李柚巴｜THE WAGER｜赌局

首发牌共 60 张。

---

# 2. 技术形态

必须使用当前 Discord 官方稳定方案实现：

- Frontend：React + TypeScript + Vite 或等价现代前端；
- Discord Activity：当前官方 Embedded App SDK；
- Backend：Node.js + TypeScript；
- Bot：discord.js 当前稳定版或等价官方支持方式；
- Realtime：WebSocket 优先；
- Storage：开发期 SQLite 可接受，但数据层需可替换为 PostgreSQL；
- 动画：CSS / Web Animations / Canvas /轻量 WebGL 均可组合，不得因炫技牺牲 Android 性能。

开工时先查当前 Discord 官方 Embedded App SDK / OAuth / Activity / Bot 权限文档，禁止照搬过期 API。

前端不得持有可直接执行 Discord 管理操作的 Bot Token。

---

# 3. 当前视觉母素材

所有非卡面视觉母素材仍以 ChatGPT Library 为真源，不把 Library 当普通临时文件夹删除或覆盖。

当前资料库路径：

`/Discord忏悔室/视觉素材/`

已冻结素材：

- `修女视觉概念图.png`
- `Discord忏悔室频道参考.jpg`
- `哥特修女多姿态贴纸集.png`
- `哥特修女十六表情贴纸合集.png`
- `应用封面图标_黑白祈祷修女.png`

三位修女老板娘：

`/Discord忏悔室/视觉素材/三位修女老板娘/`

- `龙卷_修女老板娘.png`
- `山城恋_修女老板娘.png`
- `李柚巴_修女老板娘.png`

施工时：

- 不修改母图；
- 可以生成运行时优化副本；
- 可以裁切 / 压缩 / 转 WebP 作为构建产物；
- 原母图继续留在资料库；
- 若需要把运行副本加入应用部署目录，应保留可追溯命名与来源说明。

## 3.1 应用封面 / App Icon

正式母图：

`/Discord忏悔室/视觉素材/应用封面图标_黑白祈祷修女.png`

视觉硬规则：

- 黑白；
- 可爱小修女；
- 闭眼；
- 双手合十祈祷；
- 高对比剪影 / 图标感；
- 不添加文字；
- 小尺寸下必须仍能辨认。

从母图输出 Discord / Web 所需规格的优化副本，不重新设计图标。

---

# 4. GitHub 云端卡面素材

真正运行时的塔罗角色卡面由 GitHub 云端加载。

根目录：

`public/assets/tarot/`

角色素材池：

- `public/assets/tarot/characters/龙卷/`
- `public/assets/tarot/characters/山城恋/`
- `public/assets/tarot/characters/李柚巴/`

专属卡面覆盖目录：

`public/assets/tarot/cards/`

专属卡面优先规则：

`{card_id}.webp/png/jpg/jpeg`

例如：

- `H-TAT-10.webp`
- `P-REN-10.webp`
- `H-LYB-10.webp`

若无专属卡面，则按 `judgement-manifest.v1.json` 中的角色 art_pool 与 deterministic hash fallback 选择角色图。

不得因李柚巴图片较多而改变她被抽中的概率。

---

# 5. 统一卡池与服务端随机

唯一机器配置：

`public/config/judgement-manifest.v1.json`

抽取顺序固定：

1. 修女选择天堂 / 地狱；
2. 天堂 -> upright；地狱 -> reversed；
3. 服务端三角色等权随机；
4. 服务端抽稀有度：R 60%、SR 30%、SSR 10%；
5. 同角色 + 同阵营 + 同稀有度内等权抽一张；
6. 服务端生成并持久化 `judgment_id`；
7. 前端只消费结果并播放动画，前端不得重新随机。

至少记录：

- `judgment_id`
- `session_id`
- `discord_user_id`（只在受控后端表中）
- `anonymous_id`
- `verdict`
- `character`
- `rarity`
- `card_id`
- `rng_value / equivalent audit value`
- `created_at`
- `execution_status`

随机不得因刷新页面、断线重连、动画重播而重新生成。

---

# 6. 匿名忏悔系统

Activity 内用户只显示：

`迷途灵魂 #NNN`

修女 UI 严禁显示：

- username
- global display name
- server nickname
- avatar
- user id

后端允许临时持有 `session_id <-> discord_user_id <-> anonymous_id` 映射，以便发送结果与执行服务器效果。

忏悔文本与真实 Discord ID 不应同时写入普通可读日志。

会话结束后删除不再需要的直接身份映射；审计层只保留执行判决所需的最少字段。

---

# 7. 修女席与忏悔者视图

## 忏悔者

页面流程：

- 教堂入口
- 开始忏悔
- 等待 / 排队
- 匿名对话
- 裁决锁屏
- 抽卡演出
- 五牌选择
- 翻牌
- 判决执行
- 结算

## 修女管理员

必须配置允许进入修女席的 Discord user id / role id，后端校验。

修女席功能：

- 查看匿名队列；
- 选择当前匿名灵魂；
- 收发文字；
- 发送修女表情贴纸；
- `☁️ 天堂`；
- `🔥 地狱`；
- 结束当前会话。

裁决一旦服务端确认，不允许双击产生两次判决。

---

# 8. 修女表情包正式功能

这不是装饰层，而是正式消息类型。

母素材：

- `哥特修女多姿态贴纸集.png`
- `哥特修女十六表情贴纸合集.png`

运行时要求：

- 从 16 格母图切出独立 sticker 资源；
- 推荐命名 `nun_01` ~ `nun_16`；
- 聊天输入区提供表情按钮；
- 点击打开 4×4 表情选择器；
- 修女管理员与忏悔者双方都可发送；
- 表情消息作为 `message_type: sticker` 走实时消息通道；
- 表情消息不得附带用户真实 Discord 身份；
- 部分判决牌会自动触发指定/随机修女表情，必须支持系统消息来源。

表情发送失败不得阻塞整个聊天。

---

# 9. 抽卡动画是核心，不得简化成弹窗

固定主题：

**哥特教堂 × 塔罗 × 彩窗 × 烛火 × 天堂/地狱 × 三位老板娘。**

## 9.1 天堂

- 屏幕压暗；
- 白金彩窗圣光；
- 羽毛 / 光尘；
- 白金命运流星；
- 五张牌浮现；
- SSR 双钟 + 白闪。

## 9.2 地狱

- 烛火熄灭；
- 暗红裂纹；
- 黑雾；
- 红黑命运流星；
- 逆位纹章 / 裂痕；
- SSR 黑屏 + 角色剪影 / 眼光。

## 9.3 三老板娘专属召唤

### 龙卷

- 翡翠绿念动力；
- 卡牌被强行“拽”进中央；
- 碎片悬浮；
- 强烈、干脆。

### 山城恋

- 仪式轴线；
- 王座；
- 卡牌整齐列阵；
- 慢节奏、压迫式翻牌。

### 李柚巴

- 扑克牌 / 筹码；
- 洗牌；
- 抛牌；
- 赌博式二次选择；
- 但绝不接入真钱或现金等价物。

SSR 的 6 套动画键与 sequence 读取 manifest，不另造名称。

动画必须有：

- 可跳过选项（首次完整播放后允许）；
- Reduced Motion 模式；
- Android 性能降级；
- 音效静音开关；
- 页面切后台 / 恢复时不重复执行判决。

---

# 10. Discord 昵称实体判决

这是核心功能，不能假装成功。

执行流程：

1. 后端读取目标 member 当前服务器昵称；
2. 保存 `original_nickname`；
3. 根据 card effect 生成 `applied_nickname`；
4. 检查长度并安全截断原昵称部分；
5. 执行昵称修改；
6. 保存 effect record；
7. 到期恢复。

关键安全恢复规则：

- 恢复时只有 `current_nickname == applied_nickname` 才自动恢复 `original_nickname`；
- 如果用户期间自行改了昵称，Bot 不得覆盖用户的新昵称；
- 不允许靠“删除前缀字符串”恢复，必须保存真实原昵称；
- 同一用户同时只允许一个主动昵称效果；
- 新效果覆盖旧效果时先正确结算旧记录；
- 执行、恢复都要幂等；
- 重启后依赖数据库 effect record 继续调度恢复。

若 Bot 无权限修改该成员昵称：

- 标记实体执行失败；
- Activity 显示降级称号；
- 不得显示“已执行成功”。

所需 Discord 权限与 Bot role hierarchy 必须在 README / 部署文档明确检查。

---

# 11. 临时身份组实体判决

所有游戏身份组都由 Bot 管理，并有统一前缀 / metadata 标识。

只允许作为装饰身份组。

禁止：

- 管理员权限；
- 禁言权限；
- 踢出 / 封禁；
- 实际锁频道；
- 真实惩罚性权限剥夺。

必须支持：

- 自动创建缺失的游戏装饰身份组，或在启动时同步；
- 添加；
- 到期回收；
- 覆盖 / 清除；
- Bot 重启后继续恢复；
- 只移除本 Bot 自己管理的临时 role，不碰用户原有 role。

首发牌组中已有的 role 名称不得自行改写。

---

# 12. 60 张牌必须完整落地

按 003 / 004 / 005 与 manifest 实现全部牌。

不得只做几张 Demo。

每张卡至少要可表达：

- `card_id`
- `character`
- `alignment`
- `rarity`
- `title`
- `quote / judgment text`
- `effect_type[]`
- `duration`
- `role_name / nickname_template / activity_state`（按需）
- `animation_key`（按需）
- `sticker_hook`（按需）
- `reroll / protection / cleanse / double-or-nothing` 等特殊机制（按需）

所有特殊牌的递归必须有上限：

- 副抽不能无限触发副抽；
- Double or Nothing 不能递归调用自身；
- 追加刑罚不得无限链；
- SSR 副刑罚要遵循各牌文档的降级规则。

---

# 13. 数据模型最低要求

建议至少：

## sessions

- id
- anonymous_id
- discord_user_id
- status
- created_at
- closed_at

## messages

- id
- session_id
- sender_type: `confessor | nun | system`
- type: `text | sticker | system`
- content / sticker_key
- created_at

## judgments

- id
- session_id
- verdict
- character
- rarity
- card_id
- rng audit field
- created_at
- execution_status

## active_effects

- id
- discord_user_id
- judgment_id
- effect_type
- original_value
- applied_value
- expires_at
- status
- last_error

不把完整忏悔文本长期与可识别 Discord ID 绑定。

---

# 14. 实时状态机

服务端权威状态建议：

`IDLE`
-> `QUEUED`
-> `CONFESSING`
-> `VERDICT_LOCKED`
-> `JUDGMENT_CREATED`
-> `ANIMATION`
-> `CARD_CHOICE`
-> `REVEALED`
-> `EXECUTING`
-> `SETTLED`
-> `CLOSED`

重要要求：

- 客户端刷新后从服务端状态恢复；
- 断线重连不能重抽；
- 已执行的昵称/role effect 不能因前端重复请求再次执行；
- 任一步失败可恢复到可解释状态；
- 所有判决动作需要 request id / idempotency key 或等价机制。

---

# 15. UI / 视觉

整体：

- 黑 / 白 / 金为基础；
- 天堂：象牙白 / 金；
- 地狱：黑 / 暗红；
- 龙卷：翡翠绿；
- 山城恋：深紫 / 暗红；
- 李柚巴：酒红 / 金 / 少量青绿；
- 教堂拱门、彩窗、烛火、十字、塔罗纹章为主要视觉语言。

禁止：

- 默认 Discord 蓝风格套壳；
- 普通管理后台式 UI；
- 把抽卡做成简单 modal；
- 直接复制其他游戏抽卡 UI / 图标 / 字体 /动画素材。

移动端优先，Android 触控热区至少约 44px。

---

# 16. 第一版部署配置

至少提供 `.env.example`，包含但不限于：

- Discord Application / Client ID
- Bot Token（仅后端环境）
- Discord Guild ID
- Target Activity / channel config
- Nun admin user ids / role ids
- Database URL
- Session secret
- Public origin / API origin / WebSocket origin

不得把 token / secret 提交 GitHub。

README 中写清楚 Discord Developer Portal 需要配置的：

- Activity URL / URL Mapping；
- OAuth redirect / origins（按当前官方方案）；
- Bot 邀请权限；
- Manage Nicknames；
- Manage Roles（仅用于游戏临时身份组）；
- Bot role hierarchy 必须位于目标用户 / 游戏 role 上方。

---

# 17. Candidate1 施工顺序

严格推荐顺序：

### P0｜骨架

- Activity 能启动；
- SDK ready；
- 后端 auth；
- WebSocket；
- Discord guild/member context；
- 数据库 migration。

### P1｜匿名忏悔

- 匿名编号；
- 修女队列；
- 双向文字；
- sticker；
- session close。

### P2｜判决核心

- 天堂 / 地狱服务端锁定；
- manifest 解析；
- 角色/稀有度/卡牌服务端随机；
- judgment persistence；
- 刷新/重连恢复。

### P3｜抽卡演出

- heaven / hell base animation；
- 3 character summon；
- 5-card choice；
- R / SR / SSR reveal；
- 6 SSR sequences；
- reduced motion / skip / sound toggle。

### P4｜实体效果

- nickname engine；
- role engine；
- scheduler；
- idempotency；
- safe restore；
- permission fallback。

### P5｜60 卡特殊逻辑

- cleanse；
- protection；
- reroll；
- priority confession；
- command interactions；
- Double or Nothing；
- Jackpot；
- secondary draw recursion guard；
- sticker hooks。

### P6｜视觉接入

- App Icon；
- 三位老板娘立绘；
- 修女 sticker；
- GitHub tarot art；
- loading / fallback / cache。

### P7｜QA / Candidate1

- desktop Discord；
- Android Discord；
- 弱网；
- 刷新；
- 断线重连；
- Bot 重启；
- 权限不足；
- role hierarchy 不足；
- nickname 长度极限；
- 多用户并发；
- 同用户重复裁决防重；
- effect 到期恢复。

---

# 18. Candidate1 验收硬门槛

全部通过才可称 Candidate1：

1. Activity 真正在 Discord 内嵌打开，不是外链网页替代；
2. 修女与忏悔者可匿名实时聊天；
3. 双方可以发送修女贴纸；
4. 修女 UI 不泄漏忏悔者真实 Discord 身份；
5. 天堂/地狱能进入完整抽卡演出；
6. 三位老板娘召唤风格可明确区分；
7. 五张牌必须由忏悔者亲手点选；
8. 60 张牌全部可抽到，概率逻辑符合 manifest；
9. SSR 六套专属动画可触发；
10. 昵称刑罚可真实修改并安全恢复；
11. 临时身份组可真实添加并安全回收；
12. 用户期间自行改昵称后，Bot 不覆盖其新昵称；
13. Bot 无权限时明确降级，不假报成功；
14. 重启/刷新/断线不重抽、不重复执行；
15. Android 可用，不卡死，主要按钮可点；
16. App Icon 使用黑白祈祷修女母图派生；
17. GitHub 角色卡面可云端加载并有 fallback；
18. 不存在真实赌博 / 付费抽卡 / 现金等价兑换；
19. 不存在真实禁言、踢出、封禁等惩罚；
20. secrets 不进入仓库。

---

# 19. 交付物

静静完成 Candidate1 后至少提交：

- frontend 源码；
- backend / bot 源码；
- 数据库 migrations；
- `README.md`；
- `.env.example`；
- Activity / Bot 部署说明；
- asset manifest /运行副本说明；
- 自动化或脚本级 QA；
- Candidate1 QA 报告；
- 当前已知限制；
- 可供真实 Discord Android 实机测试的部署地址 / 测试步骤（若环境允许）。

不要为了“看起来完成”把核心功能 mock 掉。

---

# 20. 最终冻结语

本项目最核心的体验只有一句：

**“塔罗判决不只告诉你命运，它会真的在 Discord 里执行。”**

因此施工优先级必须始终是：

**匿名感 > 抽卡仪式感 > 三位老板娘角色差异 > Discord 实体执行 > 安全恢复 > 视觉细节。**

其中任何一项不得以“实现复杂”为理由直接删除。
