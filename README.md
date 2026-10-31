# Discord 忏悔室 · Candidate1

运行于指定 Discord 服务器语音频道中的 Embedded Activity。匿名告解、修女席、实时文字与贴纸、天堂/地狱裁决、三位老板娘的塔罗演出，以及服务端 Bot 执行的临时昵称和装饰身份组。

**当前状态：`CANDIDATE1_IMPLEMENTED / LIVE_DISCORD_QA_PENDING`。** 源码、构建和自动化 QA 已交付；没有 Discord 应用凭据、公开部署域名或真实 Android Discord 测试记录，因此尚不能标记 `CANDIDATE1_READY`。此仓库不包含凭据，也没有生产环境的模拟登录入口。

## 结构

| 部分 | 入口与职责 |
|---|---|
| Activity | `client/main.tsx`、`client/api.ts`；React 19、TypeScript、Vite、Embedded App SDK 2.5.0 |
| Backend | `server/index.ts`；Express 5、OAuth code exchange、guild/member/语音频道校验、匿名会话、服务器权威判决 |
| Realtime | `server/realtime.ts`；经鉴权的 WebSocket、私有订阅、心跳、重连状态快照、修女权限撤销检查 |
| Bot | `server/discord.ts`；discord.js 14.28.0；与 API 同进程，Guilds + GuildVoiceStates intents，真实成员昵称/role API |
| 效果与恢复 | `server/effects.ts`；注册式 effect_key 映射、持久化执行计划、幂等、Unicode 昵称裁剪、安全恢复、退避重试 |
| 数据 | `server/db.ts`、`server/migrations/001.sql`；Node 24 SQLite，WAL，Store 为数据访问边界 |
| 冻结卡池 | `public/config/judgement-manifest.v1.json`；原始 60 张 ID/概率/SSR sequence 未修改 |
| 卡片业务 | `shared/card-details.json`；从 003–005 原文导出的判词/说明，以及独立的结构化 action payload |
| 视觉 | `public/assets/nuns/`、`stickers/`、`icon-*.png`；母图派生运行副本，来源哈希见 `runtime-sources.json` |

机器池顺序固定为：阵营 → 三角色等权 → R/SR/SSR = 60/30/10 → 同子池等权。一次判决的卡片在服务端冻结；五张牌背是同一份冻结命运的选择仪式，点位也由服务端记录，客户端不重新随机。重抽需消耗已有 token，同一判决最多一次，新的牌不能与旧牌相同。

## 在部署主机启动

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

`compose.yaml` 只将端口绑定到主机回环地址；在其前面配置 HTTPS 反向代理。`confessional-data` 卷必须持久化。部署方式和 Portal 配置详见 [部署与实机验收](docs/008_Candidate1_部署与Discord实机验收.md)。

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

Bot 邀请只需本产品所需的 **Manage Nicknames、Manage Roles**，以及查看指定语音频道的可见性。成员需可使用 Activities。不要授予 Administrator。Bot 最高身份组必须高于目标成员和游戏身份组；不能修改服务器所有者昵称。

游戏 role 使用冻结原名；`managed_roles` 表记录由本 Bot 创建的 role ID，充当命名空间。**不按名称接管服务器已有 role**。新 role 创建时权限为空、不可 mention、无 hoist；添加前再次检查无权限及层级。回收只移除 Bot 本次添加的成员关系，不删除 role 定义，不碰用户原有身份组。

昵称执行前保存真实原值（包含 `null`），并先持久化执行意图。只在当前昵称仍等于 applied nickname 时恢复。用户/管理员后来手动改名则标记 `manual_changed`，不覆盖其新昵称。单用户操作与恢复共用锁；新昵称按 SSR > SR > R 决定覆盖，替换前正确结算旧记录。

恢复 worker 每 15 秒运行；失败指数退避，最多 8 次后保留 `restore_blocked` 记录，修复权限后由主机维护者恢复：

```bash
npm run recover -- EFFECT_ID
```

仅在停止主服务或维护窗口使用该命令，避免与运行中的进程并发。可以只查询 effect 的 `id/status/last_error/expires_at` 检查阻塞，不需要输出真实 ID 或聊天文本。数据库包含未完成恢复所需的最少个人信息，应限制主机和备份访问。

进程关闭后不依赖内存定时器；下一次启动重新读取数据库。待结算判决保留 10 分钟，过期后明确显示“未执行”，不会重抽。正在执行的已持久化计划重启后继续；执行已完成的同一 judgment 不会再应用。

**只运行一个应用副本。** 当前 SQLite/进程内锁设计不能以多副本负载均衡方式部署。Discord API 与 SQLite 之间不存在分布式事务；昵称/role 写入采用 durable intent + 当前值校验补偿。Bot 创建 role 与记录 role ID 之间极小的进程崩溃窗口可能留下一个无权限的空 role；不会自动接管或删除它，维护者可在维护窗口核对后处理。

## 匿名、素材与测试

修女快照、消息、队列不包含忏悔者 username、头像、昵称或 user ID。会话关闭立即删除直接身份映射和会话文字；24h 未结束的空闲会话也会清理。执行尚未恢复的昵称/role 单独留有恢复所需记录。请求防重只保存 payload 摘要，避免把完整告解复制到身份审计表。没有公共频道广播、禁言、踢出、封禁或现金机制。

卡面经 `/cloud` 从冻结 GitHub raw 根目录按白名单加载，避免 Discord 沙箱直接阻断外域；无运行时 GitHub 目录扫描。专属 `{card_id}.webp/png/jpg/jpeg` 优先，其后是确定性角色 fallback，再失败显示角色主题卡背。`public/assets/tarot/manifest.json` 为素材启用/成人标记侧表：既有原图不修改，成人素材默认隔离，60 张牌仍全部保留。新专属图同时登记此素材表即可，不需改业务代码。浏览器只逐张加载当前结果，不批量解码整个池。

```bash
npm run check          # TypeScript、生产构建、核心与真实 WS 通道测试
npx playwright install chromium
npm run test:browser   # 360x800 触控浏览器 UI；独立 fake Discord port，不是 Discord 实机验收
npm run format:check
```

`tests/` 中的适配器仅服务自动化，不在生产入口中加载。UI 用真实 React/Service 流程验证 60 张牌共享的逻辑与 6 个 SSR 键；不声称这些测试实际修改过 Discord 成员。完整结论见 [Candidate1 QA](qa/Candidate1.md)。

## 官方技术依据

本次核对日期：2026-10-31。锁定版本见 `package-lock.json`。

- [Discord 官方 Activity 入门](https://docs.discord.com/developers/activities/building-an-activity)
- [Discord 官方 Activity 工作流程与 Entry Point](https://docs.discord.com/developers/activities/how-activities-work)
- [Discord 官方 URL Mapping / 移动端开发](https://docs.discord.com/developers/activities/development-guides/local-development)
- [官方 Embedded App SDK](https://github.com/discord/embedded-app-sdk)
- [Discord 官方权限与层级](https://docs.discord.com/developers/topics/permissions)
- [discord.js](https://discord.js.org/docs/packages/discord.js/main)
