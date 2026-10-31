# Candidate2 纯昵称判决 QA

- 基线：`3d14ae5af31b7af5a4a291863f4e04c6b442a3b3`
- 施工分支：`candidate2-real-device-refactor`
- 规则：013 > 012 > 011。
- `npm run check`：PASS（TypeScript / Vite build、42 tests、资产冻结检查）。
- 60 张牌 ID、角色、稀有度、天堂地狱、权重、SSR 动画、卡图文件与分配不变；content_version 更新为 `0.2.1-nickname-only`，缓存版本不改变卡图选择。

## 昵称执行路径

| 角色 | 可执行昵称路径 | 总牌数 |
| --- | ---: | ---: |
| 龙卷 | 16 | 20 |
| 山城恋 | 16 | 20 |
| 李柚巴 | 16 | 20 |

以上为隔离数据库中逐卡真实调用 DiscordPort.nickname 的自动化统计，含条件分支。李柚巴的 16 张包含：无 token 时 P-LYB-04、无可削减奖励时 P-LYB-07、赌输/退缩分支 P-LYB-05/06、抽到昵称副牌时 H-LYB-09。不是所有抽取结果都必然改名。三角色天堂/地狱均有昵称牌。

## 已验证

- 新 Action 类型只有 nickname/token；全部 60 张牌生成计划和执行数据库记录无 role/state。
- `{name}` 开头/中间/结尾渲染；zero → zero的屁股被龙卷踢了。
- 32 UTF-16 单元的保守长度预算，仅在完整 grapheme 边界截断用户昵称，保留固定语义和省略号；覆盖中文、组合音标、肤色 emoji 和 ZWJ emoji。
- 固定模板超长、多占位符、模板 mention 注入报错；原昵称 mention 字符安全替换；旧 prefix plan 实际执行及恢复通过。
- 三连/单次确认完成前不可执行昵称；绝对命令三分支只写一次昵称；50/50 赢不写刑罚昵称。
- 旧 role/state SQLite 非破坏迁移可重复启动；历史实体不执行、不展示；未结算旧计划按 Card ID 映射，不变成空牌。
- nickname 到期恢复、null 原昵称恢复、重启恢复、manual_changed 保护、优先级、supersede 与断点幂等通过。
- 重抽、免罚、保护、优先排队、cleanse、奖励翻倍/削减及 fallback 回归通过。
- 无 Role 写接口的 FakeDiscord 完成全部 60 张牌；生产代码无 Manage Roles 依赖。
- 前端不展示装饰状态；Embed 展示实际执行昵称与时长、机制结果，过滤历史装饰状态报告。
- 现有身份切换、排队/上钟、围观、文字/勇者、投票、AI、断线释放与 WebSocket 测试通过。

## 待真实设备验收

本轮未连接真实 Discord Bot 或 Android，自动化通过不代表实机通过。

1. Android Discord Activity：龙卷/山城恋/李柚巴天堂与地狱昵称牌，确认服务器实际改名及最终 Embed 一致。
2. 超长中文、组合字符/emoji 昵称，确认 Discord 接受且展示完整；到期恢复与手动改名后不覆盖。
3. 三连确认、山城恋三选一、李柚巴赌局与 fallback、SSR 副抽/保护、重抽/免罚/清除/优先排队。
4. Bot 仅有 View Channel、Manage Nicknames、Send Messages、Embed Links，无 Manage Roles，完整走通忏悔→抽牌→结算。
5. 在隔离测试数据副本验证旧 role/state 未结算判决升级，确认无状态栏与 state Embed。

未修改 main，未合并，未部署腾讯云。Candidate1 保持独立。
