# 专属塔罗卡面覆盖目录

本目录用于“某一张判决牌的专属卡面”。

命名必须直接使用 `card_id`：

- `H-TAT-10.webp`：龙卷｜天堂 SSR｜暴风眼的庇护
- `P-TAT-10.webp`：龙卷｜地狱 SSR｜暴风眼
- `H-REN-10.webp`：山城恋｜天堂 SSR｜王座之侧
- `P-REN-10.webp`：山城恋｜地狱 SSR｜伏首
- `H-LYB-10.webp`：李柚巴｜天堂 SSR｜JACKPOT
- `P-LYB-10.webp`：李柚巴｜地狱 SSR｜庄家通吃

加载优先级：

1. `public/assets/tarot/cards/{card_id}.webp`
2. 同名 `.png`
3. 同名 `.jpg`
4. 同名 `.jpeg`
5. 若都不存在，按 `public/config/judgement-manifest.v1.json` 的角色 `art_pool` 做确定性 fallback。

不要在文件名后追加“最终版”“新”“2”等中文版本标记；如需替换专属卡面，直接替换同一 card_id 文件并提升 manifest/content cache 版本。
