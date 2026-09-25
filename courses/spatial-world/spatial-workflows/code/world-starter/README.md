# 一间房，一个小任务

独立教学示例：Blender / bpy → GLB → Three.js → Jev 决策 / DeepSeek 对话。
不包含 AHA 空间的原始模型、游戏源码或真实密钥。

## 先运行

安装 Node.js 22 或更高版本。解压后在本目录打开终端：

```sh
npm ci
```

将 `.env.example` 复制为 `.env.local`。Windows PowerShell：

```powershell
Copy-Item .env.example .env.local
npm start
```

macOS / Linux 复制命令为 `cp .env.example .env.local`。已有配置时请勿覆盖。
打开 http://127.0.0.1:8795 。压缩包带有生成后的 GLB，无须先安装 Blender。
两个 Key 留空也能完整体验任务；界面会注明本地规则。服务仅监听本机。

## 重新建模

本例实测 Blender 5.1.2。请调整下面安装路径：

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.1\blender.exe" --background --python build_scene.py -- --overwrite
```

macOS / Linux：将可执行文件路径换成自己的 Blender，其他参数相同。
`--overwrite` 明确允许替换本示例的三个生成文件。脚本在独立 Blender 后台进程中创建空场景，不操作已打开的交互窗口。
使用 Blender 自带 Python，不需要 `pip install bpy`。

- `generated/room.blend`：继续编辑的源场景。
- `public/assets/room-render.png`：Cycles 静态渲染图。
- `public/assets/room.glb`：浏览器使用的模型，包含对象交互标记。

## 玩通一轮

1. WASD / 方向键移动，或点地面移动。
2. 接近三个金色方块后点击它们，或按 E；远处点物体只会先走近。
3. 收集三块木头，到石圈内火堆旁互动。
4. 点“进入小游戏”，原场景暂停；新标签页点完三个星星。
5. 返回原标签页，点“返回，继续探索”。

手机尺寸下任务面板默认收起，点击标题展开。示例只有简单碰撞，没有绕障寻路；被桌子挡住时手动绕行。实际手机访问需要另行配置服务器与 HTTPS，本包默认不开放局域网端口。

## 接入 AI

Jev：从 https://console.typesafe.ai/playground 进入控制台申请 Key，填写 `TYPESAFE_API_KEY`。
DeepSeek：从 https://platform.deepseek.com 申请 Key，填写 `DEEPSEEK_API_KEY`。
模型名位于 `.env.local`，分别默认 `jev-latest`、`deepseek-flash`。账户权限、余额和可用模型请以控制台为准。
修改配置后重启服务。点击“请求一次 NPC 判断”才调用 Jev；提交聊天才调用 DeepSeek，不按帧自动请求。

降低体力后观察 NPC 是否靠近；资源不足时观察它是否走向木头。NPC 不替玩家增减背包。
在线失败时回退本地提示。真实供应商调用可能产生费用。

## 文件导览

- `build_scene.py`：尺寸、材质、对象属性、相机、渲染及导出。
- `public/app.mjs`：Three.js、移动、拾取、任务、暂停、UI。
- `ai.mjs`：状态清洗、Jev 白名单、置信度回退、DeepSeek 上下文。
- `server.mjs`：静态文件白名单、API 代理、请求限制。
- `tests/ai.test.mjs`：`npm test`，模拟供应商响应，不扣费。

## 排错

- GLB 404：检查 `public/assets/room.glb`；用 HTTP 服务打开，勿双击 index.html。
- 修改 bpy 后画面没变：重新生成 GLB，再刷新浏览器。
- NPC 显示本地规则：空 Key、超时、接口错误都可能回退；先核对控制台权限和模型名，不要在前端打印 Key。
- 429：两次请求至少间隔 2 秒；每次进程启动最多接受 40 次 API 请求。重启会重置这个教学用计数。
- 对话不能改变背包：这是刻意保留的权限边界，背包变化由游戏互动代码执行。

## 验证范围与安全边界

已运行 Blender 5.1.2 导出和渲染；单元测试覆盖模拟响应和无 Key 路径。真实 Jev / DeepSeek 付费接口未在本教学包中实调。

本例使用本机绑定、同源检查、4 KB 请求体上限、单并发和进程内额度。它不包含用户认证、持久预算、多实例限流或服务端权威游戏状态；请勿直接作为公网多人生产服务发布。客户端状态可以被玩家修改，AI 输入不应被当成可信账本。不要公开 `.env.local`。
