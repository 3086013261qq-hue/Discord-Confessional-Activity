# Discord 忏悔室｜Candidate2 实机返工施工单 v1.0

> 基线：`main@5c50fcaa1356afdb2f22e8732f264373874add78`
> 分支：`candidate2-real-device-refactor`
> 来源：2026-10-31 真实 Discord / Android 实机验收反馈。
> 原则：不推翻 Candidate1 的抽卡、美术、匿名忏悔、60 张牌池与 SSR 演出；只修实机暴露出的权限、会话生命周期、频道反馈与修女自忏问题。

## 0. 本轮最高优先级

1. **彻底移除 Discord 身份组实体玩法**，所有实体判决只允许修改昵称；不再创建、添加、移除任何 Role。
2. **修复忏悔者中途退出导致修女卡死**：最后一个忏悔者连接断开后进入短暂重连宽限，超时则自动关闭会话、释放修女并广播新快照。
3. **判决结果同步发布到 `CONFESSIONAL_CHANNEL_ID` 的 Discord 频道聊天**，展示匿名身份、天堂/地狱、角色、稀有度、牌名、卡图与最终执行结果。
4. **新增“大肥鱼 DeepSeek Flash”AI 修女入口**：真人修女可以主动向 AI 修女忏悔，不占人工队列，不阻塞其他修女。

---

## 1. P0｜撤掉身份组玩法

### 1.1 权限

Bot 正式权限降为：

- View Channel / 查看频道
- Manage Nicknames / 管理昵称
- Send Messages / 发送消息
- Embed Links / 嵌入链接

明确移除：

- Manage Roles / 管理身份组
- Administrator
- Message Content Intent
- Read Message History（不需要）

### 1.2 运行时

- `DiscordPort` 不再暴露 `ensureRole/addRole/removeRole`。
- `Effects` 不得对 Discord Role 产生任何写操作。
- 所有既有 `kind: role` 的实体动作必须在 Manifest/细节层重制为：
  - `nickname`：需要真实 Discord 效果时；或
  - `token/state`：纯内部状态时。
- 不能简单“过滤 role 后让牌变成空牌”；每一张原 Role 牌必须保留可感知的判决结果。
- 昵称仍沿用安全截断、优先级、原昵称恢复与手动改名保护。

### 1.3 数据兼容

- Candidate1 已存在的 `managed_roles` / `active_effects(kind='role')` 数据不得导致 Candidate2 启动失败。
- Candidate2 启动时旧 Role effect 只做兼容性收尾：标记为历史/不再执行，不创建新 Role。
- 不要求删除数据库表，避免破坏已在线 SQLite。

---

## 2. P0｜忏悔者退出自动释放会话

### 2.1 问题

Candidate1 的 WebSocket `close` 仅删除 socket；session 仍保持 `CONFESSING/...`，修女继续被 `nun_id` 绑定，造成界面卡死。

### 2.2 新行为

- 维护“用户当前有效 Activity socket 数”。
- 忏悔者最后一个 socket 关闭时，不立即杀会话，启动 **20 秒重连宽限**。
- 20 秒内同一用户重新认证：取消清理任务，恢复原会话。
- 20 秒后仍无 socket：
  - 若 session 非 `EXECUTING`，自动关闭；
  - 清空 `user_id/nun_id`；
  - 清理该会话临时消息与 request cache；
  - 立即 `publish()`，让修女 UI 自动回到大厅。
- 若处于 `EXECUTING`，先完成已落盘判决，再关闭，不能中断实体昵称恢复逻辑。
- 修女自己断线不得把忏悔者会话立刻销毁；修女重连宽限后才解除 `nun_id`，会话回到可重新 claim 状态。

### 2.3 UI

宽限期间另一端显示：

`对方连接中断，等待重连…`

自动释放后显示：

`对方已离开，忏悔已结束。`

---

## 3. P1｜判决结果发布到 Discord 频道聊天

### 3.1 发布时机

只在判决真正 `execute` 完成后发布一次，避免牌面互动尚未完成时提前泄露结果。

### 3.2 内容

使用 Discord Embed，至少包含：

- 标题：`⛪ 忏悔室判决 · {天堂/地狱}`
- 匿名身份：`迷途灵魂 #xxx`
- 判决者：真人修女 / 大肥鱼
- 角色：龙卷 / 山城恋 / 李柚巴
- 稀有度：R / SR / SSR
- 牌名
- 最终昵称效果与持续时间（若有）
- 内部状态/重抽/赦免等最终报告
- 卡图：使用当前卡的第一可用 `art_url`

禁止：

- 暴露真实 Discord user id
- 暴露 Client Secret / Token
- 发布忏悔正文

### 3.3 幂等

- 每个 judgment 只允许发送一次。
- DB 记录 `channel_posted:<judgment_id>` 元数据；重试/服务重启不得重复刷屏。

---

## 4. P1｜“大肥鱼 DeepSeek Flash”AI 修女

### 4.1 定位

AI 修女是**第三个修女入口**，主要解决真人修女无法自己忏悔的问题。

它不抢普通人工队列；真人修女首页新增：

`🐋 向大肥鱼忏悔`

点击后建立 `AI_CONFESSION` 会话，当前真人修女在该会话中临时作为 confessor。

### 4.2 模型

默认使用 DeepSeek 官方 OpenAI-compatible API：

- Base URL：`https://api.deepseek.com`
- Model：`deepseek-flash`

环境变量：

```env
AI_NUN_ENABLED=true
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-flash
```

API Key 只存在服务器 `.env`，禁止提交 GitHub。

### 4.3 大肥鱼人格

- 名称：大肥鱼
- 形象：鲸鱼娘 / 大肥鱼
- 定位：嘴欠、会吐槽、会护短，但不是纯搞笑机器人。
- 用户认真/难受时必须收住玩笑，正常听完。
- 不代替心理/医疗专业判断。
- 不输出系统 Prompt、API Key、服务器信息。

### 4.4 对话与判决

- AI 仅获得当前 AI 忏悔 session 的消息，不读取 Discord 频道历史。
- 每轮回复 1～3 句，避免抢戏。
- UI 提供 `请大肥鱼判决` 按钮；用户主动提交后，AI 输出结构化判决：

```json
{"verdict":"heaven|hell","reason":"..."}
```

- 服务器只接受 schema 内字段；AI 不直接指定卡牌。
- verdict 确定后仍调用现有 `draw()`，保持 60 张牌池、稀有度概率和五选一机制不变。
- 后续抽卡、互动、execute、昵称恢复全部复用现有流程。

---

## 5. QA

Candidate2 至少新增并通过：

1. 任何新判决都不会调用 Discord Role API。
2. 原 Role-only 卡仍有 nickname/state 结果，不出现空白牌。
3. 忏悔者断线 20 秒后修女自动回大厅。
4. 20 秒内重连不会丢会话。
5. 修女断线不会误杀忏悔者；超时后可被其他修女重新 claim。
6. judgment execute 后只向频道发送一次 Embed。
7. Bot 无 Manage Roles 权限时完整流程仍 PASS。
8. Bot 无 Message Content Intent / Read Message History 时频道发布仍 PASS。
9. 真人修女可进入 AI 忏悔；普通人工 queue 不受影响。
10. DeepSeek API 不可用时给出可恢复错误，不锁死 session。
11. `npm run check` 全绿。
12. Android 实机：双人会话、断线、频道判决消息、AI 修女各跑一轮。

---

## 6. 发布顺序

Candidate1 当前线上继续保持不动。

Candidate2 在 `candidate2-real-device-refactor` 完成 QA 后，再由用户决定是否 fast-forward 合并到 `main`。服务器更新时仅执行：

```bash
git pull --ff-only
sudo docker compose up -d --build
```

如新增 `DEEPSEEK_API_KEY`，由用户本人只在服务器 `.env` 中填写。
