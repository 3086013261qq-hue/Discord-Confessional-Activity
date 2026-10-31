# Discord 忏悔室｜Candidate2 纯昵称判决最终修订 v1.0

> 唯一仓库：`3086013261qq-hue/Discord-Confessional-Activity`
> 施工分支：`candidate2-real-device-refactor`
> 上位关系：本文件是 `012_给静静的Discord忏悔室_Candidate2判决牌昵称化重制补充_v1.0.md` 的最新修订。
> 与 008～012 冲突时，本文件关于“卡牌实体效果 / state / nickname / token”部分优先级最高。
> 禁止修改线上 `main` / 腾讯云 Candidate1。

---

## 0. 最终产品决定

Candidate2 正式取消“内部状态 / 状态称号”玩法。

**所有玩家可见、可持续的判决效果只保留 Discord 昵称。**

不再存在：

- `kind: state` 装饰状态；
- “被龙卷罩着 / 修女长的宠儿 / 赌债未清”等后台状态称号；
- 状态栏、状态徽章、状态持续时间展示；
- 依赖装饰 state 才有存在感的牌面设计。

保留：

- nickname：唯一持续可见的实体判决；
- token：只允许作为不可见的一次性玩法能力，例如重抽、免罚、优先排队；
- cleanse / reroll / immunity / priority 等一次性机制；
- interaction：牌面仪式、50/50 赌局、求饶、确认等交互；
- 60 张牌池、卡图、SSR 演出、概率与角色结构。

一句话：

**看得见的持续效果只有昵称；机制可以存在，但不能再包装成“状态玩法”。**

---

# 一、运行时必须移除 `state`

## 1.1 新判决

Candidate2 新生成的任何 judgment plan 中：

- 禁止产生 `kind: state`；
- 禁止向 `active_effects` 新写入 `kind='state'`；
- 禁止在结算页展示 state；
- 禁止在频道 Embed 中展示 state。

## 1.2 旧 Candidate2 / Candidate1 数据兼容

现有 SQLite 中历史 `active_effects(kind='state')`：

- 启动时不得报错；
- 不再继续执行；
- 不再续期；
- 不再显示；
- 可标记为 legacy / restored / ignored；
- 不要求删除表或破坏已有数据库结构。

旧 judgment plan 中若仍有 `kind:'role'` 或 `kind:'state'`：

- `role` 不得再映射成 `state`；
- 对已结算历史只兼容读取；
- 对尚未结算、确实需要可见结果的牌，应按 Card ID 映射到本文件定义的 nickname 模板；
- 不能让未结算牌因为历史格式而变成空牌。

---

# 二、Nickname = 唯一持续实体效果

继续执行 012 的 `{name}` 模板引擎。

示例：

```text
{name}的屁股被龙卷踢了
龙卷命令{name}不许顶嘴
{name}今天被山城恋表扬了
{name}还欠李柚巴一笔赌债
```

原昵称 `zero`：

```text
zero的屁股被龙卷踢了
龙卷命令zero不许顶嘴
zero今天被山城恋表扬了
zero还欠李柚巴一笔赌债
```

必须保留：

- 32 字符 Discord 昵称上限；
- grapheme 安全截断；
- 只截断 `{name}` 部分；
- 旧前缀格式兼容；
- 到期恢复原昵称；
- 手工改名保护；
- 昵称优先级与 supersede 安全逻辑。

---

# 三、牌面设计总原则

60 张牌不扩容。

每张牌最终只能属于以下三类之一：

### A. 昵称牌

直接修改 Discord 昵称，是主要牌型。

### B. 纯机制牌

仅提供一次性 token / reroll / cleanse / immunity / priority / interaction，不产生持续状态。

### C. 复合牌

`昵称 + 一次性机制`。

禁止第四类“纯装饰 state 牌”。

若一张牌原本只是装饰 Role / state：

**必须改成昵称牌。**

如果一张牌本身已有真正有价值的机制，可以保留机制，不强行添加第二个状态。

---

# 四、龙卷牌组最终修订

以下覆盖 012 中“nickname + state”的设计：state 全删，只留 nickname / token / interaction。

## 天堂

- H-TAT-01《风暴庇护》：昵称 `{name}今天被龙卷罩着` · 6h。
- H-TAT-02《勉强合格》：昵称 `{name}被龙卷勉强认可了` · 3h。
- H-TAT-03《小小赦免》：纯机制，解除 1 个 R 昵称刑罚；若无则发放一次隐藏免罚 token。
- H-TAT-04《念动力牵引》：纯机制 `priority_confession`。
- H-TAT-05《嘴硬的夸奖》：昵称 `龙卷今天居然夸了{name}` · 4h。
- H-TAT-06《不许欺负她》：昵称 `{name}是龙卷护着的人` · 8h。
- H-TAT-07《风暴偏爱》：昵称 `龙卷今天偏心{name}` · 8h。
- H-TAT-08《强制免罪》：纯机制，清除 R 级昵称刑罚。
- H-TAT-09《风暴重抽》：纯机制 `hell_reroll_token`。
- H-TAT-10《暴风眼的庇护》：昵称 `{name}今天站在龙卷身后` · 12h + 隐藏 `storm_protection` token。

## 地狱

- P-TAT-01《念动力罚站》：`{name}正在被龙卷罚站` · 2h。
- P-TAT-02《屁股训诫》：`{name}的屁股被龙卷踢了` · 2h。
- P-TAT-03《拎起来训话》：`{name}被龙卷拎起来训话了` · 3h。
- P-TAT-04《不许顶嘴》：`龙卷命令{name}不许顶嘴` · 2h。
- P-TAT-05《笨蛋信徒》：`{name}被龙卷认证为笨蛋` · 2h。
- P-TAT-06《风暴训诫》：`{name}正在接受龙卷训诫` · 6h。
- P-TAT-07《三连警告》：完成三次 `我知道错了` 后昵称 `{name}被龙卷警告了三次` · 6h。
- P-TAT-08《风暴债务》：`{name}还欠龙卷一次反省` · 8h。
- P-TAT-09《风暴公开处刑》：`{name}正在被龙卷公开训话` · 8h。
- P-TAT-10《暴风眼》：`{name}被龙卷列为重点观察对象` · 12h；保留原 SSR 演出与副抽逻辑，但副抽只允许触发 interaction / token，不再叠第二个 state。

---

# 五、山城恋牌组最终修订

## 天堂

- H-REN-01《许可》：`山城恋允许{name}今天任性一次` · 4h。
- H-REN-02《乖孩子认证》：`{name}是山城恋认证的乖孩子` · 3h。
- H-REN-03《优先召见》：纯机制 `priority_confession`。
- H-REN-04《修女长的夸奖》：`{name}今天被山城恋表扬了` · 6h。
- H-REN-05《今日免礼》：纯机制 `command_skip_token`。
- H-REN-06《修女长的宠儿》：`{name}今天坐在山城恋身边` · 8h。
- H-REN-07《御前嘉奖》：`{name}被山城恋亲自嘉奖了` · 8h。
- H-REN-08《撤销命令》：纯机制，解除 1 个山城恋 R/SR 昵称刑罚。
- H-REN-09《第二次机会》：纯机制 `judgment_redraw_token`。
- H-REN-10《王座之侧》：`{name}今天站在山城恋王座旁` · 12h + 隐藏 `ren_protection` token。

## 地狱

- P-REN-01《听话》：`{name}今天必须听山城恋的话` · 2h。
- P-REN-02《低头反省》：`{name}正在向山城恋反省` · 2h。
- P-REN-03《口头命令》：确认 `我知道错了` 后昵称 `{name}刚向山城恋认错了` · 2h。
- P-REN-04《笨蛋信徒》：`{name}是山城恋认证的笨蛋信徒` · 2h。
- P-REN-05《值日生》：`{name}今天负责打扫忏悔室` · 3h。
- P-REN-06《绝对命令》：保留三选一 interaction；无论选项，最终昵称 `山城恋刚刚命令了{name}` · 6h；若选择“随机昵称”，则改为随机 R 级山城恋昵称之一。
- P-REN-07《乖狗狗认证》：`{name}被山城恋认证为乖狗狗` · 6h。
- P-REN-08《服从记录》：`山城恋把{name}记在小本本上了` · 8h。
- P-REN-09《御前反省》：`{name}正在山城恋面前反省` · 8h。
- P-REN-10《伏首》：接受审判时 `山城恋命令{name}乖乖低头` · 12h；求饶成功则降级到 P-REN-07 8h。

---

# 六、李柚巴牌组最终修订

## 天堂

- H-LYB-01《庄家心情不错》：`李柚巴今天放{name}一马` · 4h。
- H-LYB-02《小赢一把》：`{name}刚从李柚巴手里赢了一把` · 3h。
- H-LYB-03《好运筹码》：纯机制 `lucky_chip`。
- H-LYB-04《自由换牌》：纯机制 `free_reroll`。
- H-LYB-05《幸运客人》：`{name}是李柚巴今天的幸运客人` · 6h。
- H-LYB-06《赔率翻倍》：纯机制；翻倍当前昵称奖励持续时间，上限 12h；无可翻倍奖励则转 `free_reroll`。
- H-LYB-07《赢回来》：纯机制，解除 1 个 R/SR 昵称刑罚。
- H-LYB-08《庄家偏爱》：`李柚巴今天偏心{name}` · 8h。
- H-LYB-09《再送一次》：额外抽 1 张李柚巴 R 天堂牌；若副牌为昵称，则只保留更高优先级昵称；不叠 state。
- H-LYB-10《JACKPOT》：`{name}中了李柚巴的JACKPOT` · 12h + 隐藏 `jackpot_protection` token。

## 地狱

- P-LYB-01《小输一把》：`{name}刚刚输给李柚巴` · 2h。
- P-LYB-02《赌债未清》：`{name}还欠李柚巴一笔赌债` · 6h。
- P-LYB-03《嘴硬》：`{name}赌输了还在嘴硬` · 3h。
- P-LYB-04《庄家抽成》：若可移除 luck/reroll token 则纯机制移除；若无 token，则昵称 `{name}今天的手气被李柚巴收走了` · 3h。
- P-LYB-05《再来一局》：选“我怂了” -> `李柚巴认证{name}怂了` · 2h；赌输 -> `{name}又输给李柚巴一次` · 3h；赌赢无昵称刑罚。
- P-LYB-06《翻倍还是归零》：选择算了 -> `{name}还欠李柚巴一笔赌债` · 4h；翻倍输 -> `{name}连续输给李柚巴两次` · 6h；翻倍赢无昵称刑罚。
- P-LYB-07《庄家抽成》：纯机制，削减一个 R/SR 天堂昵称奖励剩余时长；若无可削减对象，则昵称 `李柚巴没收了{name}今天的好运` · 3h。
- P-LYB-08《公开处刑》：`{name}成了李柚巴牌桌上的反面教材` · 8h。
- P-LYB-09《全押全输》：`{name}梭哈以后输光了` · 8h。
- P-LYB-10《HOUSE WINS》：`{name}被李柚巴通吃了` · 12h；求饶成功缩短为 8h。

---

# 七、频道判决消息同步修订

最终 Discord Embed 中不再显示任何内部 state。

只显示：

- 匿名编号；
- 天堂 / 地狱；
- 判决者；
- 角色；
- 稀有度；
- 牌名；
- 卡图；
- **最终昵称结果与持续时间**；
- 若为纯机制牌，则显示机制结果，如“获得一次地狱重抽”“解除一次昵称刑罚”。

禁止出现“内部状态：xxx”。

---

# 八、前端 UI 清理

删除 / 隐藏：

- 状态栏；
- 状态徽章；
- active state 列表；
- state 剩余时长；
- “当前状态”之类文案。

保留：

- 当前昵称判决；
- 昵称剩余时间（如果当前 UI 有合理位置）；
- 可用的一次性机制能力，例如重抽次数，但显示为“可用机会”而不是“状态”。

---

# 九、QA

Candidate2 必须新增 / 修改测试：

1. 60 张牌保持 60 张。
2. 新 judgment plan 中 `kind:'state'` 数量必须为 0。
3. 新 judgment plan 中 `kind:'role'` 数量必须为 0。
4. 所有原纯装饰 Role/state 牌都拥有 nickname 路径。
5. 机制牌允许只含 token / cleanse / interaction，但不得创建 state。
6. `zero` + P-TAT-02 必须得到 `zero的屁股被龙卷踢了`。
7. 昵称模板超过 32 字符时只截断 `{name}` 部分。
8. 历史 SQLite state 数据存在时服务仍可启动。
9. 历史 state 不再显示、不再续期、不再执行。
10. 频道最终 Embed 不包含 state 字段。
11. 前端不再显示状态栏。
12. Bot 仍只需要 Manage Nicknames，不需要 Manage Roles。
13. `npm run check` 全绿。
14. Android / Discord 实机抽取三角色各至少 1 张 nickname 牌验证改名与恢复。

---

# 十、施工边界

- 不新增第 61 张牌；
- 不改抽卡概率；
- 不改角色；
- 不改卡面；
- 不重做 SSR 主动画；
- 不改 AI 大肥鱼业务；
- 不改排队 / 围观 / Poll / 身份切换；
- 不碰线上 main；
- 不部署腾讯云。

本轮只完成：

**状态玩法退出历史舞台，昵称成为唯一持续判决效果。**
