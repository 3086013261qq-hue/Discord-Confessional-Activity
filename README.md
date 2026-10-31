# Discord 忏悔室 · Candidate2

运行于指定 Discord 服务器语音频道中的 Embedded Activity。匿名告解、修女席、实时文字与贴纸、天堂/地狱裁决、三位老板娘的塔罗演出，以及服务端 Bot 执行的临时昵称与内部状态。

**当前分支：`candidate2-real-device-refactor`。Candidate2 实机验收待完成；线上 main / 腾讯云 Candidate1 保持不动。未经用户明确授权不得合并或部署。** 011 为最高优先级，旧文档中的 Role 玩法已被覆盖。

## 结构

| 部分 | 入口与职责 |
|---|---|
| Activity | `client/main.tsx`、`client/api.ts`；React 19、TypeScript、Vite、Embedded App SDK 2.5.0 |
| Backend | `server/index.ts`；Express 5、OAuth code exchange、guild/member/语音频道校验、匿名会话、服务器权威判决 |
| Realtime | `server/realtime.ts`；经鉴权的 WebSocket、同 Instance 公开会话订阅、心跳、重连状态快照、修女权限撤销检查 |
| Bot | `server/discord.ts`；discord.js 14.28.0；与 API 同进程，Guilds + GuildVoiceStates intents，真实成员昵称、原生 Poll 与 Embed API |
| 效果与恢复 | `server/effects.ts`；注册式 effect_key 映射、持久化执行计划、幂等、Unicode 昵称裁剪、安全恢复、退避重试 |
| 数据 | `server/db.ts`、`server/migrations/001.sql`；Node 24 SQLite，WAL，Store 为数据访问边界 |
| 冻结卡池 | `public/config/judgement-manifest.v1.json`；原始 60 张 ID/概率/SSR sequence 未修改 |
| 卡片业务 | `shared/card-details.json`；从 003–005 原文导出的判词/说明，以及独立的结构化 action payload |
| 视觉 | `public/assets/nuns/`、`stickers/`、`icon-*.png`；母图派生运行副本，来源哈希见 `runtime-sources.json` |

机器池顺序固定为：阵营 → 三角色等权 → R/SR/SSR = 60/30/10 → 同子池等权。一次判决的卡片在服务端冻结；五张牌背是同一份冻结命运的选择仪式，点位也由服务端记录，客户端不重新随机。重抽需消耗已有 token，同一判决最多一次，新的牌不能与旧牌相同。

## 独立 Candidate2 测试环境启动（获得测试环境授权后）

要求 Node.js 24+、HTTPS 域名、持久磁盘，以及能连接 Discord API/Gateway 和 GitHub raw 的主机。**需要长期运行的 Node 服务；GitHub Pages 或纯静态托管不足以运行本项目。**

```bash
npm ci
cp .env.example .env
# 在部署主机填写 .env，不要在聊天或 GitHub 粘贴 token
npm run check
npm start
```

后端默认 `3001`，同时提供 `dist/` 前端、`/api`、`/ws` 与 `/cloud` 卡面中继。反向代理将域名的所有路径转发给此端口，并启用 WebSocket Upgrade。生产环境必须先 `npm run build`。

也可使用：

```bash
docker compose up -d --build
```

`compose.yaml` 只将端口绑定到主机回环地址；在其前面配置 HTTPS 反向代理。`confessional-data` 卷必须持久化。Candidate2 的完整实机项目与权限以 [Candidate2 QA](qa/Candidate2.md) 为准；旧 Candidate1 部署文档只作历史参考。

开发时运行两个终端：`npm run server` 与 `npm run dev`。把 Vite 的 HTTPS 隧道域名加入 `ALLOWED_ORIGINS`，并在 Portal 将 `/` 映射至隧道域名。Vite 转发 `/api`、`/ws`、`/cloud` 到后端。开发仍需真实 Discord 应用配置，生产没有 forced-card 或伪造身份 API。

## 必填配置

复制 [.env.example](.env.example)。

- `DISCORD_CLIENT_ID`、`DISCORD_CLIENT_SECRET`、`DISCORD_BOT_TOKEN`：同一个 Discord Application；后两者只在后端。
- `DISCORD_GUILD_ID`、`CONFESSIONAL_CHANNEL_ID`：唯一允许的服务器与语音频道。后端检查 OAuth 身份、真实 guild member 和 Gateway 语音状态。
- `NUN_USER_IDS` / `NUN_ROLE_IDS`：逗号分隔；满足任意一项可进入修女席。ID 不发送给其他参与者。
- `SESSION_SECRET`：至少 32 字符的随机秘密；会话 token 仅存内存，数据库仅存加盐摘要。修改此值使旧登录失效。
- `DATABASE_URL=sqlite:data/confessional.sqlite`：SQLite 文件路径。当前只实现 SQLite 驱动；迁移 PostgreSQL 时替换 Store、SQL 方言及单进程锁，不可直接把 URL 改成 postgres。
- `PUBLIC_ORIGIN`：HTTPS 页面源；`ALLOWED_ORIGINS` 可附加受信开发源。API/WS 使用同源路径，`API_ORIGIN` / `WEBSOCKET_ORIGIN` 为后续拆分部署预留，不需要填写。
- `ADULT_MODE=false`、`ALLOW_PUBLIC_STICKER_SHARE=false`：Candidate1 固定不启用这两个扩展能力。

## 真实实体效果与安全恢复

Bot 所需权限：**View Channel、Manage Nicknames、Send Messages、Embed Links、Send Polls**。Send Polls 是原生 Poll 的 Discord 平台权限，011 的四项权限列表遗漏此项。无需 Manage Roles、Administrator、Message Content Intent 或 Read Message History。Bot 最高身份组仍须高于需要修改昵称的目标成员，不能修改服务器所有者昵称。

原 Role actions 全部等值改为带时限的内部 state，牌数、概率、判词、卡图与 SSR key 保留。旧 `managed_roles` 表保留；旧 role effects 标为 `legacy_retired`，不会创建、增删、回收任何 Discord Role。内部 state 参与保护、赦免、清除与到期结算。

昵称执行前保存真实原值（包含 `null`），并先持久化执行意图。只在当前昵称仍等于 applied nickname 时恢复。用户/管理员后来手动改名则标记 `manual_changed`，不覆盖其新昵称。单用户操作与恢复共用锁；新昵称按 SSR > SR > R 决定覆盖，替换前正确结算旧记录。

恢复 worker 每 15 秒运行；失败指数退避，最多 8 次后保留 `restore_blocked` 记录，修复权限后由主机维护者恢复：

```bash
npm run recover -- EFFECT_ID
```

仅在停止主服务或维护窗口使用该命令，避免与运行中的进程并发。可以只查询 effect 的 `id/status/last_error/expires_at` 检查阻塞，不需要输出真实 ID 或聊天文本。数据库包含未完成恢复所需的最少个人信息，应限制主机和备份访问。

进程关闭后不依赖内存定时器；下一次启动重新读取数据库。待结算判决保留 10 分钟，过期后明确显示“未执行”，不会重抽。正在执行的已持久化计划重启后继续；执行已完成的同一 judgment 不会再应用。

**只运行一个应用副本。** SQLite/进程锁不支持多副本。昵称使用落盘意图与当前值校验恢复。频道发送以 DB metadata + Discord nonce 防重；已确认的 4xx 拒绝可在修好权限后重试；网络结果不明或发送时崩溃，保留 `sending/uncertain`，禁止盲目自动重发。管理员必须核对频道后用 `npm run recover:channel -- KEY MESSAGE_ID` 记录既有消息，或在确认没有发送时用 `--not-sent` 清除意图，再重试。维护操作只在停止测试服务后进行，不读取历史 API、不需要 Read Message History。

## Candidate2 会话

- 每次 OAuth 进入先选择本次身份；普通用户：忏悔者/围观者，授权真人修女额外可选修女。忏悔者自动排队，修女主动上钟；大肥鱼入口直接进入独立文字会话，不占人工队列。
- 真人 claim 后 30 秒文字/勇者选择，超时默认文字。修女回复可独立选择文字/语音。语音依赖 Discord 原生控件，不申请或处理麦克风流。
- 同 Activity Instance 围观者只读；公开文字、动画、卡牌、执行报告同步。真实 Discord user id 不进入围观数据。
- 忏悔结束后发送一次频道 Poll；当值修女随后决定天堂/地狱，无需等待 Poll 截止。群众投票不驱动卡池。
- 最后一个有效 socket 断开启动 20 秒宽限；重连保留同一会话与抽卡。忏悔者超时关闭并释放修女；执行中先完成落盘计划。修女超时则重新开放未裁决会话，已裁决会话由忏悔者继续完成。
- 结算后只发布一次最终 Embed；不发送告解正文或真实账号 ID。最终昵称是产品要求的公开结果，参与者应知悉昵称本身可能被同服成员认出。

## 大肥鱼 · DeepSeek

新增服务器环境变量：

```env
AI_NUN_ENABLED=true
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-flash
```

启用开关和 Key 均就绪才开放入口；Key 只由维护者在测试主机 `.env` 填写。前端、API 响应和日志不包含 Key；请求不跟随重定向，仅允许官方 HTTPS Base URL。模型别名按 011 使用，不固定小版本。

人格为成年雌小鬼修女，嘴欠、坏笑、抓漏洞，通常 1～3 句；用户认真或难受时收住玩笑、正常倾听。仅传当前 AI session 最近 30 条文字，不读 Discord 历史。裁决严格校验 `{verdict,reason}`，不允许 AI 指定牌或稀有度。超时/额度/服务错误可重试或退出，绝不随机裁决兜底。

## 匿名、素材与测试

修女快照、消息、队列不包含忏悔者 username、头像、昵称或 user ID。会话关闭立即删除直接身份映射和会话文字；24h 未结束的空闲会话也会清理。执行尚未恢复的昵称 单独留有恢复所需记录。请求防重只保存 payload 摘要，避免把完整告解复制到身份审计表。只有匿名 Poll 和最终判决 Embed 发布至频道；没有禁言、踢出、封禁或现金机制。

卡面经 `/cloud` 从冻结 GitHub raw 根目录按白名单加载，避免 Discord 沙箱直接阻断外域；无运行时 GitHub 目录扫描。专属 `{card_id}.webp/png/jpg/jpeg` 优先，其后是确定性角色 fallback，再失败显示角色主题卡背。`public/assets/tarot/manifest.json` 为素材启用/成人标记侧表：既有原图不修改，成人素材默认隔离，60 张牌仍全部保留。新专属图同时登记此素材表即可，不需改业务代码。浏览器只逐张加载当前结果，不批量解码整个池。

```bash
npm run check          # TypeScript、生产构建、核心与真实 WS 通道测试
npx playwright install chromium
npm run test:browser   # 360x800 触控浏览器 UI；独立 fake Discord port，不是 Discord 实机验收
npm run format:check
```

`tests/` 中的适配器仅服务自动化，不在生产入口中加载。UI 用真实 React/Service 流程验证 60 张牌共享的逻辑与 6 个 SSR 键；不声称这些测试实际修改过 Discord 成员。完整结论见 [Candidate2 QA](qa/Candidate2.md)。

## 官方技术依据

本次核对日期：2026-10-31。锁定版本见 `package-lock.json`。

- [Discord 官方 Activity 入门](https://docs.discord.com/developers/activities/building-an-activity)
- [Discord 官方 Activity 工作流程与 Entry Point](https://docs.discord.com/developers/activities/how-activities-work)
- [Discord 官方 URL Mapping / 移动端开发](https://docs.discord.com/developers/activities/development-guides/local-development)
- [官方 Embedded App SDK](https://github.com/discord/embedded-app-sdk)
- [Discord 官方权限与层级](https://docs.discord.com/developers/topics/permissions)
- [discord.js](https://discord.js.org/docs/packages/discord.js/main)

- [Discord 原生 Poll](https://docs.discord.com/developers/resources/poll)
- [DeepSeek Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/)
