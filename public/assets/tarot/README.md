# 忏悔室塔罗卡面素材

此目录用于 Discord Confessional Activity 的运行时云端卡面资源。

## 目录约定

- `characters/`：常规角色卡面与立绘参考
- `adult/`：仅限明确成年角色的成人向/暧昧卡面
- `effects/heaven/`：天堂抽卡与结算视觉素材
- `effects/hell/`：地狱抽卡与结算视觉素材
- `backs/`：塔罗牌背、通用牌框、稀有度底图

## 运行规则

1. 成人向素材仅允许明确成年角色进入 `adult/`。
2. 未成年或年龄不明角色不得进入成人向牌池。
3. 程序侧通过 manifest 映射资源 URL，不在业务代码中硬编码文件名。
4. 后续优先使用静态公开 URL 由 Activity 运行时加载。
