# AHALab · 探索工坊

![四层探索工坊](public/assets/explorer-hall.png)

用 Blender 建造场景，用 Three.js 走进世界：收集物资、点燃篝火、修复信标，与伙伴一起撑过第一夜。也可以进入自由创作，搭建自己的小角落。

配套阅读：[用 Astra 搭建 3D 小世界：让 Jev 驱动游戏伙伴](https://mp.weixin.qq.com/s/ecNLna3nGzrH7c1ebXWjsg)。从零开始可先运行同系列的 `world-starter`；本项目提供四层场景和多人房间。

## 运行

需要 Node.js 22 或更高版本。在本目录打开终端：

```powershell
npm ci
Copy-Item .env.example .env.local
npm start
```

macOS / Linux 将复制命令换成 `cp .env.example .env.local`。已有配置请保留。
打开 <http://127.0.0.1:8787>。GLB 已随代码提供，游玩不需要安装 Blender。

不填 API Key 时使用本地规则，不访问 AI 服务。Jev 决策和 DeepSeek 房间问答分别由服务端读取 `TYPESAFE_API_KEY`、`DEEPSEEK_API_KEY`；模型名可在同一配置中更改，具体可用性以供应商账户为准。首次接入建议少量调用，检查响应和用量。

## 玩通一轮

1. 按 WASD / 方向键移动，拖动画面调整视角；手机使用方向按钮。
2. 靠近发光物资按 E 拾取。集齐两份木材、一份石材，在庭院篝火旁按 C 点火。
3. 走到青色楼梯圈按 E 上楼、Q 下楼。二、三、四层各有一枚晶体。
4. 集齐三份木材、两份石材、三枚晶体，到顶层信标旁按 E，连续完成三次指针对准挑战。
5. 返回篝火补给，撑到天亮。F 吃食物；到庭院水池岸边按 R 喝水。

自由创作模式提供材料并暂停生存消耗，可直接点选楼层。B 切换建造，1/2 选择木材或石材，点击附近空地放置，右键回收。保存按钮将作品保存到当前浏览器。

楼梯采用“到达标记后按键换层”的交互，阶梯用于表现空间关系。中庭开口、护栏、桌子和墙柱由导航数据限制通行。

三个可探索入口均打开同包示例：篝火添柴后的航标收集、机械哨犬掉落密令后的信号寻踪、顶层拾取鱼竿后的水池小游戏。进入新标签页会暂停当前玩家，返回后点击“返回 AHA”。

## 多人房间

在 `.env.local` 设置 `HOST=0.0.0.0`，重启服务。同行者连接同一局域网，在浏览器输入主机的局域网 IP 和端口，选择“多人联机”。主机防火墙需要允许该端口；最多 8 人共用一个房间。

昵称是临时访客身份。房间消息仅保存在运行进程中，最多保留最近 20 条；不上传到飞书、不写聊天日志。`@AHA` 问答会在配置 DeepSeek 后发送最近房间消息及游戏状态，答案对房间可见。请使用虚构昵称，不发送个人资料。

## 重新建模

使用 Blender 5.1 系列，在本目录执行（替换为自己的安装路径）：

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.1\blender.exe" --background --python-exit-code 1 --python build_scene.py -- --overwrite
```

脚本从基本几何体生成四层工坊，不读取外部模型或照片。

| 文件 | 用途 |
|---|---|
| `generated/explorer-hall.blend` | 可继续编辑的 Blender 场景 |
| `public/assets/explorer-hall.glb` | 浏览器模型 |
| `public/assets/navigation.json` | 同一脚本生成的可走区域与障碍 |
| `public/assets/explorer-hall.png` | 场景预览 |

运行前默认检查输出是否已存在。`--overwrite` 表示允许重新生成上述文件。修改布局时同时调整 `navigation.mjs` 的楼梯和任务位置，以及 `game.mjs` 的物资位置；只替换 GLB 不会自动生成导航。

## 如何扩展

- `public/rules.mjs`：一轮时长、物资配方、生存消耗、AI 置信度门槛。
- `public/game.mjs`：视角、人物、建造、任务及输入。
- `public/portal-quest.mjs`、`public/example-portals.mjs`：隐藏任务与固定入口列表。接入自己有权公开的小游戏时，在这里维护链接，不接受聊天模型生成的任意网址。
- `room.mjs`：WebSocket 房间；`aha-chat.mjs`：有界聊天上下文；`server-security.mjs`：同源校验、限流及每日额度。
- `public/audio.mjs`：Web Audio 合成提示音，可自行设计声音，不依赖音乐文件。

`npm test` 运行规则与接口模拟测试，不产生付费调用。

## 部署边界

本项目默认只监听本机。静态服务仅开放 `public/` 与 Three.js 分发文件，`.env.local`、私有预算目录和 Blender 源文件不作为网页资源提供。

用于公开服务前，需要配置 HTTPS、确切的 `PUBLIC_ORIGIN`、身份认证和多实例额度。现有联机校验不等于完整反作弊：生命值、部分收集及任务状态仍由客户端上报。它适合可信伙伴的协作体验，不能直接当作有奖励或公平竞赛要求的服务。

## 许可与署名

AHALab 原创代码、程序化工坊模型及本目录文档采用 [MIT](LICENSE)。复制或改编时保留 AHALab 版权及许可文本。欢迎 Fork，建议在作品说明中写明“基于 AHALab 探索工坊”，并链接 <https://aha-lab.ai/>。

Third-party notices: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。本许可不授予 AHALab 商标使用权，也不表示对衍生作品的背书。
