# 鲸鱼娘素材

来源：已安装的 [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet)，版本 0.4.0，读取日期 2026-11-07。未修改插件安装。

使用原版透明 VP9 WebM，640 × 360；版权与 MIT 许可见同目录 LICENSE。idle.png 为待机动画首帧，用于减少动态效果、加载及不支持视频时的静态显示。

| 本地文件 | 原动作 |
| --- | --- |
| idle.webm | 待机呼吸休闲 |
| snack.webm | 大口吃零食 |
| bubbles.webm | 鲸鱼吐泡泡特效 |
| cube.webm | 原地专心玩魔方 |
| dance.webm | 轻快摇摆舞 |
| gift.webm | 拆礼物 |
| cat.webm | 撸猫 |
| happy.webm | 点击回应-开心跃动 |
| stretch.webm | 超大伸懒腰 |
| wave.webm | 点击回应-元气挥手 |
| meal.webm | 吃早餐 |

2026-11-09：互动改为零食包、伸个懒腰、一起加油、打个招呼、礼物盒和一起吃饭，对应 snack、stretch、happy、wave、gift、meal。新增三个原版透明动画，仍来自本机已安装的 dsh-pet，未修改插件。泡泡、魔方、跳舞、撸猫文件保留用于旧页面兼容，新版按钮不再使用。

继续使用 bone、water、toy、stick、gift、cat 存储字段，已有库存、奖励历史和同步规则沿用。记录与打卡仍按原规则获得互动次数；每次成功使用一份互动增加 1 点幸福值，获得库存不加点，撤销记录只撤回对应库存。幸福值随库存使用原有更新时间合并同步，并由现有备份完整恢复。

同日视觉优化：六个按钮直接标为吃零食、伸懒腰、开心跃动、挥挥手、拆礼物和吃早餐，与对应原动画一致。`preview-snack.webp`、`preview-stretch.webp`、`preview-happy.webp`、`preview-wave.webp`、`preview-gift.webp`、`preview-meal.webp` 为对应 WebM 的透明截帧，裁去空白后等比缩放至144×144，用于按钮预览，沿用同目录素材许可。次数显示为角标，不替换原有数据字段。
