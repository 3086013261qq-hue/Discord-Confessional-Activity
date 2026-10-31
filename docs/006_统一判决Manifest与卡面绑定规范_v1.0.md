# 006｜统一判决 Manifest 与卡面绑定规范 v1.0

> 项目：Discord Confessional Activity
>
> 上位文档：001 / 002 / 003 / 004 / 005
>
> 机器可读配置：`public/config/judgement-manifest.v1.json`
>
> 本文冻结首发 60 张牌的统一加载、抽取、卡面绑定、稀有度、SSR 动画资源和扩展规则。静静不得另造第二套卡池逻辑。

---

## 1. 首发卡池结构

首发总计 60 张：

- 龙卷：10 天堂正位 + 10 地狱逆位
- 山城恋：10 天堂正位 + 10 地狱逆位
- 李柚巴：10 天堂正位 + 10 地狱逆位

每个角色、每个阵营固定：

- R：5 张
- SR：4 张
- SSR：1 张

因此全池：

- R：30 张
- SR：24 张
- SSR：6 张

---

## 2. 抽取顺序必须固定

一次判决的随机顺序：

1. 修女先给出 `天堂 / 地狱`。
2. 天堂映射 `upright`；地狱映射 `reversed`。
3. 三位老板娘等权抽取：龙卷 / 山城恋 / 李柚巴。
4. 在该老板娘与阵营内抽稀有度：R 60% / SR 30% / SSR 10%。
5. 在命中的稀有度子池中等权抽一张。
6. 服务端写入 `judgment_id / user_id / character / alignment / rarity / card_id / rng_value / created_at`。
7. 前端只负责播放对应演出，不得自己重新随机。

禁止：先抽 60 张总池再过滤阵营；否则不同角色/稀有度实际概率会偏移。

---

## 3. GitHub 云端卡面规则

运行时素材根目录：

`public/assets/tarot/`

角色素材池：

- `public/assets/tarot/characters/龙卷/`
- `public/assets/tarot/characters/山城恋/`
- `public/assets/tarot/characters/李柚巴/`

### 3.1 专属卡面优先级

程序加载某张卡时，优先尝试：

`public/assets/tarot/cards/{card_id}.webp`

若不存在，再依次尝试 `.png / .jpg / .jpeg`。

例如：

- `public/assets/tarot/cards/H-TAT-10.webp`
- `public/assets/tarot/cards/P-REN-10.png`
- `public/assets/tarot/cards/H-LYB-10.jpg`

只要未来上传专属图，不需要改业务代码。

### 3.2 无专属卡面时

使用角色 `art_pool`。

选择必须是“确定性”的：

`index = stableHash(card_id + manifest_version) % art_pool.length`

不能每次打开同一张牌随机换图，否则玩家无法形成牌面记忆。

### 3.3 新增角色素材

老婆往角色目录加入新图后：

1. 静静更新 manifest 的 `art_pool`；
2. `schema_version` 不变；
3. 增加 `content_version` 或更新 manifest URL query 版本；
4. Activity 下一次启动刷新资源。

禁止运行时直接扫描 GitHub API 目录。正式客户端只读取 manifest，避免 GitHub API 限流和目录变动造成崩溃。

---

## 4. 图片处理

GitHub 中上传的是云端原素材。Activity 加载时：

- 使用 `object-fit: cover` 或等价实现；
- 不修改仓库原图；
- 卡框负责裁切，不永久生成裁剪副本；
- 图片解码失败时显示角色专属占位卡背；
- 预加载当前五张候选牌，其他图片懒加载；
- Android 优先避免一次性解码整个牌池。

允许浏览器缓存；manifest 版本变化时主动换 cache key。

---

## 5. 卡面视觉绑定

无论底图是什么，统一覆盖程序生成的塔罗框层：

### R
- 细银边 / 角色主题色微光
- 低粒子量
- 一次翻牌声

### SR
- 双层金属边框
- 角色主题色流光
- 翻面前追加 250–400ms 稀有度预告

### SSR
- 专属动态边框
- 必须进入对应 `animation_key`
- 不允许仅靠“更亮一点”冒充 SSR

天堂正位：牌面方向正常、白金圣纹。

地狱逆位：卡面视觉旋转 180° 或以逆位构图展示，红黑裂纹 / 倒置封印；文字 UI 本身必须保持可正常阅读，不能跟卡图一起倒转。

---

## 6. 三位老板娘召唤动画键

### 龙卷 `summon_tatsumaki`

绿色念动力裂光 → 五张卡失重悬浮 → 玩家选牌 → 被选卡被猛地拽到镜头前 → 翻面。

### 山城恋 `summon_ren`

烛火排成仪式轴 → 王座轮廓 → 五张牌严格对称列阵 → 玩家选牌 → 山城恋抬眼 → 被选牌缓慢自动翻面。

### 李柚巴 `summon_yuzuha`

筹码 / 纸牌飞散 → 五张塔罗洗牌 → 玩家点一张 → 其余牌像扑克一样收走 → 选中牌旋转翻面。

---

## 7. SSR 动画资源表

机器配置以 manifest 中 `ssr_animations` 为准。

| card_id | 牌名 | 动画键 | 核心视觉 |
|---|---|---|---|
| H-TAT-10 | 暴风眼的庇护 | `ssr_tatsumaki_eye_of_storm_blessing` | 翡翠碎片倒流、巨大风眼、双钟 |
| P-TAT-10 | 暴风眼 | `ssr_tatsumaki_eye_of_storm` | 黑屏绿眼、彩窗碎裂、四牌被掀飞 |
| H-REN-10 | 王座之侧 | `ssr_ren_beside_the_throne` | 王座金纹、中央正位牌、三响钟 |
| P-REN-10 | 伏首 | `ssr_ren_bow_before_the_throne` | 暗场、王座目光、无声翻牌、接受/求饶 |
| H-LYB-10 | JACKPOT | `ssr_yuzuha_jackpot` | HEAVEN×3、金色彩窗爆光、筹码声 |
| P-LYB-10 | 庄家通吃 | `ssr_yuzuha_house_wins` | 假 JACKPOT → HOUSE WINS、逆落筹码 |

SSR 动画尽量用 CSS / Canvas / WebGL / SVG / 音频组合完成，不依赖大体积预渲染视频；保证 Android Activity 内存占用可控。

---

## 8. 执行效果统一类型

manifest 只保存 `effect_key`，完整业务行为由 003–005 和后端 effect registry 实现。

统一类别：

- `nickname`：临时昵称，带原值安全恢复
- `role`：Bot 管理的临时装饰身份组
- `state`：Activity 内状态 / token / 队列优先权
- `interaction`：需要玩家点击或输入完成的仪式
- `cleanse`：只清理本 Bot 创建的效果
- `compound`：多个效果组合

严禁 effect handler 按卡名写大量 if/else。必须用：

`effect_key -> handler`

进行注册式映射。

---

## 9. 昵称与身份组优先级

同一用户同一时刻：

- 主动昵称判决最多 1 个；新高优先级昵称覆盖旧效果，但保留真正的原始昵称基线。
- 优先级：SSR > SR > R。
- 天堂净化可以撤销允许级别的地狱效果。
- 身份组允许多个并存，但同一 `effect_key` 不重复叠加。
- Bot 只能删除自己曾添加并记录在数据库里的身份组。

必须保存：

- `guild_id`
- `user_id`
- `original_nickname`
- `applied_nickname`
- `role_ids_added_by_bot[]`
- `effect_key`
- `card_id`
- `started_at`
- `expires_at`
- `restore_status`

到期恢复时，只有当前昵称仍等于 `applied_nickname` 才自动恢复；若用户期间手动改过昵称，不得覆盖用户新昵称。

---

## 10. 表情包在判决中的挂钩

表情不是单独装饰层。

以下牌可调用 `nun_sticker`：

- P-TAT-07 三连警告
- P-REN-03 口头命令
- P-REN-06 绝对命令
- P-REN-09 御前反省
- P-REN-10 伏首
- 李柚巴所有需要二次选择 / 输赢确认的牌可随机插入 1 张反应贴纸

具体 sticker 文件由静静从资料库母图切片后放入应用运行资源，不与 GitHub 的成人向角色卡面混用。

---

## 11. 前端卡片对象最小字段

前端收到后端判决结果至少包含：

```json
{
  "judgment_id": "uuid",
  "verdict": "hell",
  "alignment": "reversed",
  "character": "tatsumaki",
  "rarity": "SR",
  "card_id": "P-TAT-06",
  "name": "风暴训诫",
  "art_url": "https://...",
  "animation_key": "summon_tatsumaki",
  "effect_preview": "昵称 + 临时身份组",
  "server_effect_pending": true
}
```

前端不得拿到完整 Discord 权限凭据，也不得直接执行服务器修改。

---

## 12. 后端结算顺序

1. 服务端随机并生成 `judgment_id`。
2. 返回卡片结果给 Activity。
3. Activity 播放动画。
4. 玩家完成翻牌 / 必要交互。
5. Activity 请求 `/judgments/{id}/execute`。
6. 后端校验该 judgment 未执行过。
7. effect registry 执行 Discord 修改。
8. 写入 effect instance 与恢复计划。
9. 返回 `executed / degraded / failed`。
10. 前端显示最终结算。

必须幂等：重复请求同一 `judgment_id` 不得重复加角色、重复改昵称或重复生成奖励。

---

## 13. 失败降级

若 GitHub 卡图加载失败：

- 使用角色主题卡背；抽卡仍可继续。

若 Discord 权限不足：

- 保留动画与判词；
- 转为 Activity 内临时称号；
- 明确标注“服务器效果未执行”；
- 后端记录错误原因。

若网络中断发生在动画后、执行前：

- judgment 保留 10 分钟待结算；
- 重连后可继续执行同一个 judgment，不重新抽牌。

---

## 14. QA 必测

- 天堂绝不进入 reversed 池；地狱绝不进入 upright 池。
- 三角色长期统计接近等权。
- 稀有度长期统计接近 60/30/10。
- 每个角色每个阵营恰有 5R / 4SR / 1SSR。
- 60 个 card_id 唯一。
- 6 个 SSR 均有 animation_key。
- manifest 中 art_pool 文件必须真实存在。
- 卡面不存在时 fallback 正常。
- 同一 card_id 多次展示使用同一 fallback 图。
- Android 小屏五卡选择可点击区域足够大。
- 重连不重新随机。
- `/execute` 幂等。
- Bot 重启后恢复计划仍存在。
- 用户手动改昵称后，到期恢复不覆盖新昵称。
- 身份组删除只删除 Bot 自己创建的 effect instance。

---

## 15. 当前冻结结论

静静施工必须把 `public/config/judgement-manifest.v1.json` 当作首发卡池唯一机器入口。

003 / 004 / 005 是文案与业务细节真源；006 负责统一装配与加载规则；manifest 负责机器读取。

后续新增卡牌必须：

1. 先增加对应设计文档；
2. 再增加 manifest 条目；
3. card_id 不得复用；
4. 不修改既有 card_id 的历史语义。
