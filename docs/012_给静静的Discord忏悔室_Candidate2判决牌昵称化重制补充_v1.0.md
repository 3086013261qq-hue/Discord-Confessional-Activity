# Discord 忏悔室｜Candidate2 判决牌昵称化重制补充 v1.0

> 唯一仓库：`3086013261qq-hue/Discord-Confessional-Activity`
> 施工分支：`candidate2-real-device-refactor`
> 上位关系：本文件是 `011_给静静的Discord忏悔室_Candidate2最终总施工单_v1.0.md` 的补充。
> 与 011 冲突时，以本文件中“判决牌实体效果与昵称模板”相关条款为最新规则；其他业务仍遵循 011。
> 禁止修改线上 `main` / 腾讯云 Candidate1。

---

## 0. 返工目的

Candidate2 已正确移除 Discord Role 实体玩法，但部分原 Role 牌被直接降级为 Activity 内部 `state` 后，玩家在 Discord 服务器中的可见反馈明显变弱。

本轮目标不是扩充牌池数量，而是：

- **仍保持 60 张牌**；
- 不改 Card ID；
- 不改角色分布；
- 不改 R / SR / SSR 数量与概率；
- 不改天堂/地狱 upright/reversed 结构；
- 不改卡面绑定；
- 不改六套 SSR 主演出；
- 将一批“纯装饰 state”重新设计为**昵称 + state**；
- 保留真正有玩法价值的 token / cleanse / reroll / priority / immunity；
- 让抽卡后的 Discord 实际效果重新具有可见性、社死感、炫耀感与群友传播性。

最终原则：

**机制牌可以只做机制；装饰牌不能只剩后台 state。**

---

# 一、昵称引擎必须升级为模板模式

Candidate1 / Candidate2 当前昵称执行核心按“前缀 + 原昵称”工作，例如：

`被龙卷打屁股的` + `zero`

只能得到：

`被龙卷打屁股的zero`

Candidate2 本轮必须升级为 `{name}` 模板，支持：

```text
{name}的屁股被龙卷踢了
龙卷命令{name}不许顶嘴
{name}今天被山城恋表扬了
{name}还欠李柚巴一笔赌债
```

## 1.1 Action 约定

昵称 Action 的 `value` 允许两种格式：

### 新格式

```json
{"kind":"nickname","value":"{name}的屁股被龙卷踢了","hours":2}
```

### 旧格式兼容

若 `value` 不含 `{name}`，继续按 Candidate1 的“前缀 + 原昵称”逻辑处理，避免旧 judgment / SQLite 数据失效。

## 1.2 安全截断

新增等价于：

```ts
renderNickname(template, original, max = 32)
```

规则：

1. 模板最多允许出现一个 `{name}`。
2. 先计算模板静态部分长度。
3. 只截断原昵称部分，不得截断模板语义。
4. 必须按 grapheme 截断，保留 emoji / 组合字符完整性。
5. 若模板静态部分本身已超过 32 字符，构建 / QA 直接失败。
6. 原昵称被截断时使用 `…`。
7. 不允许通过昵称模板插入 `@everyone` / `@here` 或 Discord mention。
8. 到期仍按原有安全恢复逻辑恢复原昵称。

示例：

原昵称：`zero`

模板：

`{name}的屁股被龙卷踢了`

最终：

`zero的屁股被龙卷踢了`

---

# 二、昵称化总体比例

不要求 60 张牌全部修改昵称。

每个角色 20 张牌目标：

- **至少 10 张**存在“可真实修改 Discord 昵称”的最终路径；
- 其中天堂 / 地狱都必须有可见昵称效果；
- token / reroll / cleanse / immunity 等机制牌可以继续不修改昵称；
- 不能为了凑数量让每一张牌都抢占 nickname slot。

优先昵称化：

1. Candidate1 原本依赖 Role 展示身份的牌；
2. Candidate2 当前只是“纯装饰 state”的牌；
3. 本身文案非常适合变成公开梗的牌。

---

# 三、龙卷牌组昵称化重制

## H-TAT-01｜风暴庇护

当前：纯 state `🌪️ 被龙卷罩着`

改为：

```json
[
  {"kind":"nickname","value":"{name}今天被龙卷罩着","hours":6},
  {"kind":"state","value":"🌪️ 被龙卷罩着","hours":6}
]
```

保留原护盾视觉。

---

## H-TAT-05｜嘴硬的夸奖

当前：纯 state `💚 龙卷今天没骂我`

改为：

```json
[
  {"kind":"nickname","value":"龙卷今天居然夸了{name}","hours":4},
  {"kind":"state","value":"💚 龙卷今天没骂我","hours":4}
]
```

---

## H-TAT-06｜不许欺负她

当前：纯 state `🌪️ 风暴保护对象`

改为：

```json
[
  {"kind":"nickname","value":"{name}是龙卷护着的人","hours":8},
  {"kind":"state","value":"🌪️ 风暴保护对象","hours":12}
]
```

昵称可见 8h；保护状态仍 12h。

---

## H-TAT-10｜暴风眼的庇护（SSR）

保留：清除 R/SR 刑罚 + `storm_protection` 24h。

新增可见奖励：

```json
{"kind":"nickname","value":"{name}今天站在龙卷身后","hours":12}
```

不能因为新增昵称破坏原 protection token。

---

## P-TAT-01｜念动力罚站

当前：纯 state。

改为：

```json
[
  {"kind":"nickname","value":"{name}正在被龙卷罚站","hours":2},
  {"kind":"state","value":"🌪️ 风暴训诫中","hours":2}
]
```

---

## P-TAT-02｜屁股训诫

当前：`被龙卷打屁股的{name}` 风格。

按用户实机确认的新文案重制为：

```json
{"kind":"nickname","value":"{name}的屁股被龙卷踢了","hours":2}
```

这是本轮昵称模板代表案例，QA 必须实际验证：

`zero -> zero的屁股被龙卷踢了`

---

## P-TAT-03｜拎起来训话

优化句式：

```json
{"kind":"nickname","value":"{name}被龙卷拎起来训话了","hours":3}
```

---

## P-TAT-04｜不许顶嘴

当前：纯 state。

改为：

```json
[
  {"kind":"nickname","value":"龙卷命令{name}不许顶嘴","hours":2},
  {"kind":"state","value":"🤐 不许顶嘴","hours":2}
]
```

不得真的禁言。

---

## P-TAT-05｜笨蛋信徒

优化为完整句：

```json
{"kind":"nickname","value":"{name}是龙卷认证的笨蛋","hours":2}
```

---

## P-TAT-07｜三连警告

保留三次 `我知道错了` 交互。

完成第三次确认后执行：

```json
[
  {"kind":"nickname","value":"{name}被龙卷警告了三次","hours":4},
  {"kind":"state","value":"⚠️ 被龙卷警告三次","hours":6}
]
```

昵称必须在三次确认完成后才应用。

---

## P-TAT-08｜风暴债务

当前：纯 state 24h。

改为：

```json
[
  {"kind":"nickname","value":"{name}还欠龙卷一次反省","hours":6},
  {"kind":"state","value":"🌪️ 欠龙卷一次反省","hours":24}
]
```

入口“龙卷还记得你”机制继续保留 24h。

---

## P-TAT-09 / P-TAT-10

保留现有机制与等级，仅把句式改成 `{name}` 模板风格：

- P-TAT-09：`{name}正在被龙卷公开训话`
- P-TAT-10：`{name}被暴风眼盯上了`

---

# 四、山城恋牌组昵称化重制

## H-REN-01｜许可

当前纯 state。

改为：

```json
[
  {"kind":"nickname","value":"山城恋今天准{name}任性","hours":4},
  {"kind":"state","value":"👑 修女长许可","hours":4}
]
```

---

## H-REN-02｜乖孩子认证

优化为：

```json
{"kind":"nickname","value":"{name}是山城恋认证的乖孩子","hours":3}
```

---

## H-REN-04｜修女长的夸奖

当前纯 state。

改为：

```json
[
  {"kind":"nickname","value":"{name}今天被山城恋表扬了","hours":6},
  {"kind":"state","value":"🌹 得到山城恋表扬","hours":6}
]
```

---

## H-REN-06｜修女长的宠儿

当前纯 state。

改为：

```json
[
  {"kind":"nickname","value":"{name}是山城恋今天的宠儿","hours":8},
  {"kind":"state","value":"👑 修女长的宠儿","hours":12}
]
```

---

## H-REN-10｜王座之侧（SSR）

保留原清除效果与 `ren_protection`。

新增：

```json
{"kind":"nickname","value":"{name}今天站在山城恋身边","hours":12}
```

---

## P-REN-01｜听话

当前纯 state。

改为：

```json
[
  {"kind":"nickname","value":"山城恋让{name}今天听话","hours":2},
  {"kind":"state","value":"🖤 今天要听修女长的话","hours":2}
]
```

---

## P-REN-02｜低头反省

优化为：

```json
{"kind":"nickname","value":"{name}正在向山城恋反省","hours":2}
```

---

## P-REN-03｜口头命令

保留 `我知道错了` 按钮。

按钮确认后新增：

```json
[
  {"kind":"nickname","value":"{name}刚向山城恋认错了","hours":2},
  {"kind":"state","value":"📜 已接受修女长口头命令","hours":2}
]
```

---

## P-REN-04｜笨蛋信徒

优化为：

```json
{"kind":"nickname","value":"{name}是山城恋认证的笨蛋信徒","hours":2}
```

---

## P-REN-05｜值日生

当前纯 state。

改为：

```json
[
  {"kind":"nickname","value":"{name}今天给忏悔室值日","hours":3},
  {"kind":"state","value":"🕯️ 忏悔室值日生","hours":3}
]
```

---

## P-REN-06｜绝对命令

保留三选一，但让三条选择都产生可感知结果：

### 认真道歉

提交合法道歉后：

`{name}刚向修女长认真道歉`

持续 3h。

### 称赞修女长

完成随机赞美后：

`{name}刚刚夸完修女长`

持续 3h。

### 接受随机昵称

继续沿用原逻辑：从 P-REN-02 / P-REN-04 等 R 级昵称刑罚中随机抽取。

三条分支继续保留 `👑 已执行绝对命令` state 6h。

---

## P-REN-07｜乖狗狗认证

优化句式：

```json
{"kind":"nickname","value":"{name}被山城恋认证成乖狗狗","hours":6}
```

保持轻度玩笑边界，不增加色情内容。

---

## P-REN-08｜服从记录

当前纯 state 24h。

新增昵称：

```json
[
  {"kind":"nickname","value":"山城恋已经把{name}记账了","hours":6},
  {"kind":"state","value":"📖 山城恋已记账","hours":24}
]
```

原“修女长还记得上一次”继续按 state 生命周期判断。

---

## P-REN-09 / P-REN-10

优化模板：

- P-REN-09：`{name}正在山城恋面前反省`
- P-REN-10：`{name}正在服从山城恋的命令`

其余交互与 SSR 不变。

---

# 五、李柚巴牌组昵称化重制

## H-LYB-01｜庄家心情不错

当前纯 state。

改为：

```json
[
  {"kind":"nickname","value":"李柚巴今天放过了{name}","hours":4},
  {"kind":"state","value":"🎲 庄家放你一马","hours":4}
]
```

---

## H-LYB-02｜小赢一把

优化为：

`{name}今天被李柚巴夸走运`

持续 3h。

---

## H-LYB-05｜幸运客人

当前纯 state。

改为：

```json
[
  {"kind":"nickname","value":"{name}是李柚巴今天的幸运客人","hours":6},
  {"kind":"state","value":"🍀 李柚巴的幸运客人","hours":6}
]
```

---

## H-LYB-08｜庄家偏爱

优化为：

`{name}今天被李柚巴偏爱了`

保留 `♥️ 庄家偏爱` state。

---

## H-LYB-10｜JACKPOT（SSR）

保留 cleanse 与 `jackpot_protection`。

新增：

```json
{"kind":"nickname","value":"{name}被李柚巴封为JACKPOT","hours":12}
```

---

## P-LYB-01｜小输一把

改为自然句式：

```json
{"kind":"nickname","value":"{name}刚刚输给李柚巴","hours":2}
```

---

## P-LYB-02｜赌债未清

当前纯 state。

改为：

```json
[
  {"kind":"nickname","value":"{name}还欠李柚巴一笔赌债","hours":4},
  {"kind":"state","value":"🎲 赌债未清","hours":6}
]
```

入口“李柚巴还记得这笔账”继续依赖 state。

---

## P-LYB-03｜嘴硬

优化为：

`{name}赌输了还在嘴硬`

持续 3h。

---

## P-LYB-04｜好运没收

保留优先移除 lucky token 的机制。

只有在**没有任何可移除 lucky token** 时，原 fallback 从纯 state 改为：

```json
[
  {"kind":"nickname","value":"{name}的好运被李柚巴没收了","hours":3},
  {"kind":"state","value":"🪙 今日手气欠佳","hours":3}
]
```

若成功移除了 token，不额外强加昵称。

---

## P-LYB-05｜再来一局

### 选择“我怂了”

原纯 state 改为：

```json
[
  {"kind":"nickname","value":"{name}在李柚巴面前怂了","hours":2},
  {"kind":"state","value":"😼 李柚巴认证·怂了","hours":2}
]
```

### 选择“再赌一次”且输

执行昵称：

`{name}又输给李柚巴了`

2h + `🎲 赌债未清` 3h。

赢则仍取消实体刑罚。

---

## P-LYB-06｜翻倍还是归零

### 选择“算了”

保持 `🎲 赌债未清` state，不额外改昵称，作为玩家主动保守选择的区别。

### 选择“翻倍”且输

昵称：

`{name}连续输给李柚巴两次`

持续 6h，同时 `🎲 双倍赌债` 6h。

赢则实体刑罚归零。

---

## P-LYB-08｜公开处刑

优化：

`{name}成了李柚巴牌桌上的反面教材`

8h。

---

## P-LYB-09｜全押全输

优化：

`{name}梭哈失败，筹码全没了`

8h。

---

## P-LYB-10｜HOUSE WINS（SSR）

优化：

`{name}被李柚巴一把通吃了`

12h；求饶后仍按原机制缩短至 8h。

---

# 六、明确保留为纯机制牌的类型

以下类型不要为了昵称化而强塞 nickname：

- `priority_confession`
- `hell_reroll_token`
- `free_reroll`
- `judgment_redraw_token`
- `command_skip_token`
- cleanse / immunity 本身
- 50/50 成功导致“刑罚归零”的分支
- 保护 token 消耗本身

这些牌的“爽点”来自真实玩法收益，不属于空卡。

---

# 七、频道最终判决 Embed 同步

Candidate2 已新增最终判决频道 Embed。

昵称模板重制后，Embed 的“最终效果”不得只显示模板字符串，例如：

`{name}的屁股被龙卷踢了`

必须显示真正执行后的结果，例如：

`zero的屁股被龙卷踢了 · 2h`

如果原昵称因 32 字符限制被截断，则 Embed 显示实际 applied value，而不是未截断理论值。

---

# 八、数据兼容

- 不改 Card ID。
- 不改旧 judgment 主键。
- 已落盘的旧 `plan` 继续按旧值执行，不强制回写为新昵称模板。
- 新 judgment 才使用新 `card-details.json`。
- Candidate1 遗留的 role/state 数据继续按 011 的兼容规则处理。
- 不删除 `managed_roles` 表，仅停止新 Role 行为。

---

# 九、Manifest / 版本

本轮属于牌面执行语义调整：

- `schema_version` 不必因结构未变而升级；
- 必须 bump `content_version`（若当前无则新增），用于前端/卡面缓存失效；
- 卡图 asset mapping 不得变化；
- 60 张 Card ID 全部保持原样。

---

# 十、QA

新增必须通过：

1. `{name}` 在昵称开头、中间、结尾均可正确渲染。
2. `zero + {name}的屁股被龙卷踢了` => `zero的屁股被龙卷踢了`。
3. 超长用户名只截断 name 段，模板固定文本不破坏。
4. emoji / CJK / 组合字符不被切半。
5. 旧式无 `{name}` nickname action 仍兼容 prefix 模式。
6. 60 张牌数量不变。
7. Card ID / rarity / alignment / character distribution 不变。
8. 不出现任何新 Discord Role API 调用。
9. 每个角色至少 10 张牌存在 nickname 最终路径。
10. token / reroll / cleanse 牌原机制不被昵称化重制破坏。
11. P-TAT-07 必须在三次确认完成后才改昵称。
12. P-REN-06 三个分支均有明确结果且不重复叠加昵称。
13. P-LYB-04 只有无 lucky token 时才执行昵称 fallback。
14. P-LYB-05 / P-LYB-06 的 50/50 胜利仍真正归零，不残留昵称。
15. 最终 Discord Embed 显示实际 applied nickname。
16. 昵称到期恢复 / 手工改名保护继续 PASS。
17. `npm run check` 全绿。
18. Android / Discord 实机至少抽测：龙卷、山城恋、李柚巴各 1 张新昵称牌。

---

# 十一、施工边界

本轮只修改 Candidate2 分支。

禁止：

- 合并 main；
- 自动更新腾讯云 Candidate1；
- 改牌池数量；
- 改抽卡概率；
- 改卡图；
- 改 SSR 主演出；
- 恢复 Role 权限玩法。

完成后只提交到 `candidate2-real-device-refactor`，等待用户实机验收与明确部署授权。
