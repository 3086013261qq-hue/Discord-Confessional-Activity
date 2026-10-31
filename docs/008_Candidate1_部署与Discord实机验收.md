# Candidate1 部署与 Discord 实机验收

007 为业务最高优先级；本文只说明工程部署和验收，不修改首发规则。

## 当前入口状态

尚未部署公开服务；没有可直接进入的 Activity 链接或已经配置的 Application ID。代码可由 `npm ci && npm run build && npm start` 在配置完 `.env` 的 Node 24 主机启动。此阶段是 `LIVE_DISCORD_QA_PENDING`，不得改写为实机 PASS。

正式入口是 **Discord 指定服务器 → `⛪｜忏悔室` 语音频道 → Apps / Activities → 本应用的 Launch**。普通外链不替代内嵌 Activity；在普通浏览器打开部署域名会提示从 Discord Activity 进入。

## Discord Developer Portal 手动配置

1. 打开 [Developer Portal](https://discord.com/developers/applications)，创建/选择同一 Application。上传 `public/assets/icon-512.png` 作为 App Icon，名称填写“忏悔室”。
2. 从 General Information / OAuth2 / Bot 取得 Client ID、Client Secret、Bot Token；仅在部署主机 `.env` 中设置。不要将 secret 交给前端或提交仓库。
3. OAuth2 配置一个有效 Redirect URI；按照官方 Embedded App SDK 的 confidential-client code exchange 方案，SDK 的 authorize RPC 负责返回 Activity。项目仅申请 `identify`。不要为了运行本应用改成 Public Client，也不需要另外搭建浏览器跳转登录页。Redirect URI 可使用部署域名的 HTTPS 地址（如 `https://你的域名/`）。
4. Activities → URL Mappings 添加 **Prefix `/`，Target `你的HTTPS域名`**。Target 不含 `https://`，不指向单个 HTML 文件。前后端与 WS 同源，不需要额外给 raw GitHub 域名做映射；`/cloud` 是本后端的白名单中继。
5. Activities → Settings 启用 Activity，Supported Platforms 勾选 **Web / Android**；需要 iOS 时再明确启用。保留 Discord 创建的默认 `Launch` Entry Point，其 handler 是 Discord Launch Activity；没有自建 Slash Bot 主体验或 Interactions Endpoint 的要求。
6. 在安装设置中启用 Guild Install，通过官方安装链接加入测试服务器。邀请 Bot 勾选 **Manage Nicknames / Manage Roles**，可查看目标频道；不要勾 Administrator、Kick、Ban、Moderate Members。应用安装可包含 `bot` 与 `applications.commands` scope，Activity 用户授权仍只请求 `identify`。
7. 将 Bot 最高身份组拖到测试用户与游戏身份组上方。不要使用服务器所有者做昵称成功用例。为参与成员保留查看/加入目标语音频道与 Use Activities 的权限。应用无须读取消息内容，也不需要 Message Content 或 Guild Members privileged intent；服务使用 Guilds 与 GuildVoiceStates。
8. 未发布应用先为测试账号配置应用团队/测试资格。若 Activity 不出现在 Android 启动器，先检查 Android supported platform、测试者资格、服务器安装与客户端版本。
9. 在部署 `.env` 填写唯一 `DISCORD_GUILD_ID`、`CONFESSIONAL_CHANNEL_ID`、`NUN_USER_IDS` 或 `NUN_ROLE_IDS`、随机 Session Secret、HTTPS Public Origin、SQLite 路径。两个测试账号都要真实进入这个语音频道。

## 部署主机

单个 Node 24 进程同时提供 Activity 静态资源、Backend 与 Bot。采用可持续运行的 VM/容器服务，持久化 `/app/data`；不能部署成纯静态页面或多个无状态副本。

HTTPS 反向代理需支持：

- `/`、`/assets/`、`/api/`、`/cloud/` 到本服务；
- `/ws` 的 WebSocket Upgrade 与长连接；
- 不缓存 `/api/*` 或带身份的响应；
- 不开启会记录请求正文、Authorization 或 WS 帧内容的调试日志；
- Bot 对 Discord Gateway/API 与后端对 GitHub raw 的出站网络。

部署后检查 `https://你的域名/api/health` 返回 `ok: true`。`PUBLIC_ORIGIN` 必须精确匹配页面源。反向代理不要附加 `X-Frame-Options: DENY/SAMEORIGIN`；如果配置 CSP frame-ancestors，需允许 Discord 官方 Activity 容器。

## Android 优先验收步骤

使用修女账号 A 和普通成员账号 B；B 优先用真实 Android Discord，A 可用桌面 Discord。都加入配置的语音频道并通过 Launch 打开同一 Activity。

| 测试 | 操作 | 应观察到 |
|---|---|---|
| 启动/鉴权 | 两个账号启动 | SDK ready 后进入对应视图；错误服务器/频道不能通过后端校验 |
| 匿名 | B 开始，A 接待 | A 只见迷途灵魂 #NNN，不见 B 的头像/名称/ID；B 不会看见其他灵魂 |
| 文字/贴纸 | 双方各发文字和 16 张贴纸 | 同一私有 WS 通道及时到达，修女的系统贴纸也能显示 |
| 裁决 | A 点击天堂或地狱，快速重复点击 | 一次 judgment；天堂只正位，地狱只逆位 |
| 抽卡 | B 完整观看后手点五牌之一 | 全屏教堂演出、三角色风格、稀有度预告；文字不随逆位图倒转 |
| SSR | 测试服正常抽取并记录对应六张结果 | 六个 manifest animation key 对应不同演出；生产没有 forced-card 接口 |
| 昵称 | 抽到昵称牌，以普通成员执行 | Discord 真实昵称有前缀；结算明确成功；不是只看 Activity badge |
| role | 抽到 role 牌 | 成员真实获得无权限的装饰 role；同名原有 role 不被接管 |
| 恢复 | 等到卡面真实时长到期 | 只在 current==applied 时恢复原昵称；移除 Bot 添加的临时 role |
| 自行改名 | 效果期间手动改名再等到期 | 新昵称保留；数据库标为 manual_changed |
| 无权限 | 测试服移除 Manage Nicknames/Manage Roles 或降低 Bot 层级 | 明确显示服务器效果未执行/已降级，不假报成功 |
| 重复/重连 | 翻牌前后刷新、开关网络、关闭重开 Activity | 相同 judgment/card；点位固定；执行不重复；待结算窗口 10 分钟 |
| 重启 | 效果生效后重启 Backend/Bot | 原数据库恢复调度继续；不重抽、不叠前缀、不再加同一 role |
| 特殊牌 | 测免罚/净化/重抽/三次确认/求饶/翻倍 | 一次性状态正确消耗，副牌不递归，翻倍显示 50/50 且后端判定；15 秒超时采用基础刑罚 |
| Android | 竖屏、软键盘、贴纸网格、弱网、切后台 | 主按钮和五牌热区 >=44px、不横向溢出；减少动态/静音可用 |
| 卡面故障 | 临时阻断 `/cloud` | 自动改用角色主题卡背，不阻塞结算 |

普通自动化不替代以上实机记录。请记录测试客户端版本、Application/Guild 的测试环境标识、日期、预期与实际行为；不要在公开 QA 中贴真实用户 ID 或完整告解。

测试服需要缩短效果时长时，应在独立的未部署生产测试夹具中控制时钟；不能在生产添加任意改卡/改时长 API。当前自动化使用注入时钟覆盖到期与重启，实机验证使用真实卡面时长。

## 恢复故障与已知工程限制

- SQLite 单进程：升级前停止服务并一致性备份数据库/卷；不要只复制仍在写入的 `.sqlite` 而漏掉 WAL。
- `restore_blocked`：在主机查询 effect ID、错误和状态，修复权限后停止主服务，运行 `npm run recover -- EFFECT_ID`，再启动。不会因前端关闭而丢弃恢复计划。
- 角色创建与数据库写入不能跨 Discord/SQLite 原子提交；极端崩溃可能留下无权限的空 role。不能按名称盲目自动接管或删除，需维护者核对。
- 当前未实现 PostgreSQL、多副本和成人模式；这些不是本次首发卡池的新玩法。
- 本轮没有可使用的 Discord 凭据或部署域名，真实修改、真实 Android、Gateway 语音上下文与 Portal 配置仍必须在部署后验证。
