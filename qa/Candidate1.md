# Candidate1 QA · 2026-10-31

状态：**CANDIDATE1_IMPLEMENTED / LIVE_DISCORD_QA_PENDING**。不是 `CANDIDATE1_READY`，不是 `REAL_ANDROID_DISCORD_PASS`。

唯一仓库 `3086013261qq-hue/Discord-Confessional-Activity`，main 施工基线 `be24dc5123e416758b9e38a1f6e16020172548b1`。007–001 和统一 manifest 按冻结优先级读取。基线已有 30 个受版本管理文件逐字节保持一致，未更改原卡面或冻结设计。

## 已完成检查

| 检查 | 结果与证据 |
|---|---|
| TypeScript / 生产构建 | PASS，`npm run build`；React + SDK 生产 JS 约 392kB，gzip 约 122kB；无前端 Bot Token |
| 核心与实时自动化 | **19/19 PASS**，`npm test` |
| 60 卡完整性 | PASS，60 个唯一 ID；三角色各 10 正位 + 10 逆位，每子池 5R/4SR/1SSR |
| 概率 | PASS，80,000 次抽样，阵营无串池，60 张全部可达；角色占比偏差 <2%，稀有度与 60/30/10 偏差 <2% |
| 文案/业务 | PASS，60 张均有冻结判词、正文与 handler/action 数据；免罚、净化、重抽、优先告解、命令、翻倍和副牌入口均覆盖 |
| SSR | PASS，6 个 animation_key 与 sequence 由原 manifest 读取；浏览器覆盖 6 个 SSR 的呈现与结算，求饶分支可操作 |
| 匿名 | PASS，队列/消息/快照没有真实 user ID/用户名/头像/昵称；越权会话拒绝；结束删除映射与文字；请求缓存不复制告解正文 |
| WebSocket | PASS，测试调用生产 `attachRealtime`；Origin、auth、私有订阅、文字/贴纸、断开重连、冻结结果、会话关闭清订阅、权限撤销 |
| 幂等 | PASS，15 次并发裁决只创建一个 judgment，重复选择固定点位，重复 execute 不重复写成员；执行意图在写后崩溃可校验补偿 |
| 昵称引擎 | PASS（注入 Discord adapter）；真实 port 调用边界、null 原值、Unicode/grapheme 安全裁剪、优先级、替换前恢复、手动改名不覆盖 |
| role 引擎 | PASS（注入 Discord adapter）；已有 role 不回收、由数据库 role ID 管理、到期回收；生产创建参数固定 permissions=[]、mentionable=false |
| 恢复/重启 | PASS，关闭并重新打开真实 SQLite 文件后继续到期恢复；净化恢复失败在原到期前退避重试，不依赖 Activity 持续在线 |
| 权限失败 | PASS（注入缺权限/层级错误）；状态 degraded，明确服务器效果未执行，不假报成功；恢复阻塞保留记录 |
| 特殊机制 | PASS，R 免罚不越级，SSR 不被普通保护取消；token 消耗；重抽最多一次；15s 超时基础刑罚；一次求饶；副牌仅 R，无递归追加 |
| 图标/立绘/贴纸 | PASS，母图未改，3 规格 icon + 3 立绘 WebP + 16 独立贴纸 + 来源哈希 |
| 云端素材 | 三角色各一次 GitHub raw GET 均为 HTTP 200 / image/jpeg；12 个角色素材存在；默认隔离 4 个成人素材，构建时从部署静态目录排除，开发服务与云端中继均拒绝加载；全部 60 张牌保留 |
| 卡图降级 | PASS，浏览器主动让 `/cloud` 返回 404，逐级失败后角色主题占位，抽卡与结算继续 |
| 窄屏 UI | PASS，Headless Chromium 153，360×800、触控、Reduced Motion；五张按钮每个 >=44px，结果无横向溢出，无 pageerror |
| 代码样式 | PASS，`npm run format:check`；`git diff --check` |

自动化 DiscordPort 是测试替身，只在 `tests/` 使用；生产入口只创建真实 DiscordBot。不得把上述适配器 PASS 称为真实 Discord 成员已被修改或真实手机已通过。

浏览器逐项记录见 [browser-results.json](browser-results.json)，冻结文件与素材统计见 [source-assets.json](source-assets.json)。截图用于本地视觉检查，不作为 Discord 实机证据。视觉检查补充了测试容器缺失的中文字体；产品使用设备字体，不依赖该测试字体目录。

## 必须部署后完成的实机门槛

1. Developer Portal 配置 Application / URL Mapping / Redirect URI / Android Supported Platforms / Guild Install / 测试账号。
2. HTTPS Node 主机、持久数据库、Bot Token / Client Secret / Guild 和 Channel ID 配好后，从真实 Discord 启动 Activity，验证 SDK、OAuth、Gateway 语音上下文。
3. 真实 Android 与桌面两个账号完成匿名聊天、16 贴纸、天堂/地狱演出和亲手选牌。
4. 用普通成员验证 Discord 真实昵称和 role 修改、真实到期恢复、手动改名保护、权限和层级失败、Bot 重启、弱网与切后台。
5. 真机检查三老板娘与六 SSR 动画的流畅性、声音和触控；浏览器触控仿真不能证明 Android Discord WebView 性能。

缺少以上应用凭据、主机域名和真机记录，本轮无法创建一个已经可启动的 Discord 入口，也不能封为 READY。操作说明见 [部署与实机验收](../docs/008_Candidate1_部署与Discord实机验收.md)。

## 已知工程限制

- 单 Node 进程 + SQLite；没有 PostgreSQL 驱动或多副本分布式锁。迁移时需替换数据访问与锁层。
- 恢复连续失败退避最多 8 次，保留 `restore_blocked`；主机维护者修复权限后用维护命令继续，不会悄悄宣称已恢复。
- Discord role 创建和本地记录之间极端崩溃可能留下无权限空 role；不会按名称自动接管或删除。
- 游戏 role 首次需要时按冻结原名创建、数据库标记归属；未提前批量创建全部 role。
- 成年/公开贴纸分享扩展默认关闭，Candidate1 不启用；原始素材不删除。
- 生产无绕过 SDK 的模拟登录、forced-card、任意昵称/role 直写或现金接口。
