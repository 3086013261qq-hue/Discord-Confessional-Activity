# Candidate2 QA · 2026-10-31

分支：`candidate2-real-device-refactor`，施工基线 `c922d64f1b76341d91489eeb9553caa95f6d1bf3`。

状态：`CANDIDATE2_IMPLEMENTED / REAL_ANDROID_DISCORD_QA_PENDING`。

线上 `main@5c50fcaa1356afdb2f22e8732f264373874add78` 与腾讯云 Candidate1 不改动，不合并、不部署。规范优先级：011 > 010 > 009 > 008 > 007。

## 自动化

| 验证 | 结果 |
|---|---|
| `npm run check` | PASS：TypeScript、生产构建、36 个服务/核心/WS 测试、素材核验 |
| Candidate2 专项 | PASS：16 个测试，身份与自动排队、主动 claim、两种模式/30 秒默认、独立回复模式、只读/匿名/Instance 隔离、20 秒宽限/多 socket/重连/释放、执行中退出与重启、Poll/Embed 防重、旧库迁移、全部 60 张牌不调用 Role API、AI 失败/结构校验/密钥边界 |
| 真实 WebSocket 协议测试 | PASS：鉴权/消息/订阅/权限撤回，以及真实 socket 最后连接关闭、重连取消清理、超时后修女解除绑定广播 |
| `npm run test:browser` | PASS：Headless Chromium 153，360×800 触控/减少动态；三客户端文字与贴纸、围观只读、五张牌 >=44px、手动选牌/刷新幂等、六套 SSR、勇者原生语音 UI、修女独立回复模式、真人修女转 AI 忏悔者并走完原抽卡结算 |
| `npm run format:check` / `git diff --check` | PASS |
| 母素材与冻结配置 | PASS：29 个原冻结文件字节保留；Manifest 只允许 011 授权的 role → state 描述替换；60 牌、16 贴纸、6 SSR 不变；成人素材不进产物 |
| 秘密与音频边界 | PASS：Key 仅服务器变量；无前端 Key/录音/采集音频代码，无 Discord Role 写 API；生产入口不引用测试适配器 |

浏览器证据见 `browser-results.json`。页面中文检查使用测试环境临时字体；产品继续使用设备字体。测试用 Discord 与 DeepSeek 替身只在 tests，不代表 Discord API、真实麦克风音质或付费 DeepSeek 请求已验收。当前没有实际调用用户的 Discord/DeepSeek 凭据。

## 主要实现

- 所有旧 role actions 等值转换为定时内部 state，保留牌、概率、效果键、美术和演出。旧 role effects 标记历史，不执行 Role API；已有昵称安全恢复不变。
- 每次登录先选身份；新的 OAuth token 重新选择相同身份后可以恢复未结束会话。真人修女可作忏悔者，大肥鱼直达入口不占人工队列或消费人工优先 token。
- 人工上钟后 30 秒文字/勇者选择，超时文字。真人修女回复独立选择；AI 只文字，无麦克风入口。
- 同 Instance 围观公开快照，多个公开会话可切换；服务端拒绝所有围观修改操作，不只是禁用按钮。
- 最后 socket 断开后 20 秒宽限；恢复连接取消释放。忏悔者超时清空身份映射、消息和 request cache，修女回大厅；执行中等待持久化计划结算。修女断开超时重新开放未判决队列。
- “忏悔结束”创建原生 Poll，只有发送确认后开放修女最终裁决；群众票不控制结果。裁决之后复用原卡池/五选一/SSR/昵称执行。
- execute 完成后最终 Embed 包含匿名编号、判决者、阵营、角色、稀有度、牌名、可用卡图、昵称效果/时长与内部报告。不发告解正文、真实 user id。
- 大肥鱼按成年雌小鬼修女人格发送当前 AI 会话文字；结构化裁决严格限定 verdict/reason，API 失败保留会话，可重试/退出，绝不随机判决。

## 新增环境与权限

```env
AI_NUN_ENABLED=true
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-flash
```

`AI_NUN_ENABLED=true` 且 Key 非空才开放入口。Key 由维护者本人只放测试主机 `.env`。

Bot：View Channel / Manage Nicknames / Send Messages / Embed Links。**另需 Send Polls**：这是 Discord 原生 Poll 的实际权限要求，011 的四项权限列表遗漏；已依据官方文档补入工程说明。无需 Manage Roles、Administrator、Message Content Intent、Read Message History。

- 官方权限：<https://docs.discord.com/developers/topics/permissions>
- 官方 Poll：<https://docs.discord.com/developers/resources/poll>
- DeepSeek 接口：<https://api-docs.deepseek.com/api/create-chat-completion/>

## 交付限制与恢复

SQLite 单进程；不得多副本部署。频道发送先落盘 intent，使用稳定 nonce 和 enforceNonce；确认成功后落盘 message id。Discord 与 SQLite 没有跨系统原子事务，不能假称任意断电/网络分区下具有数学意义的 exactly-once。

明确 4xx 拒绝可以修复权限后重试。请求结果不明/发送中崩溃时保留 sending/uncertain，停止自动重发以避免重复消息；需管理员核对频道后在停服维护期运行 `npm run recover:channel -- KEY MESSAGE_ID`，或确认无消息后用 `--not-sent` 再重试。此路径不能标记已成功。旧 Candidate1 已结算判决迁移时跳过，不补发历史刷屏。

## Android / Discord 仍须实测

1. 独立 Candidate2 测试环境启动 Activity/OAuth，多个客户端加入同 Instance；新登录身份选择与重开恢复。
2. 文字真人：自动排队 → 修女上钟 → 文字/30 秒默认 → 贴纸/回复 → Poll → 最终裁决 → 五选一/SSR → 昵称 → 最终 Embed。
3. 勇者真人：Discord 原生本音、修女文字/语音独立切换；拒绝麦克风时文字仍可完整结算。
4. 至少一位围观者实时跟随公开消息、阶段、演出、结果；不能操作会话或五选一，不出现真实 user id。
5. 双方分别退出、弱网/切后台，20 秒内恢复与超时释放；多个 socket、执行中退出、Bot 重启。
6. 原生 Poll 确实可投票，双击不重复，投票不替代修女裁决；最终 Embed 只发一次、卡图可加载、无正文与账号 ID。
7. Bot 无 Manage Roles、无消息内容/历史读取权限时完整运行；昵称真实变化、到期恢复、手动改名保护、层级不足的真实降级。
8. 真人修女以忏悔者身份被另一真人修女接待；再向大肥鱼文字忏悔并完整结算。验证真人格短回复、难受时收住玩笑、真实 DeepSeek Key/模型可用、超时/额度错误可恢复。

以上全部为 `PENDING`，不能把本地模拟触控、假 Bot 或假 AI 通过写成真实 Android/Discord/DeepSeek PASS。
