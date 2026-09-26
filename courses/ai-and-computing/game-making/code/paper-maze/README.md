# 我画的迷宫

第一人称3D迷宫游戏和关卡编辑器。10关加入收集物品、守路怪、火把及墙顶出口；第一关只收集物品。

## 运行

需要 Python 3.10+ 和支持 WebGL 的现代浏览器，无需 npm、账号或模型密钥。

```sh
python serve.py
```

打开 http://127.0.0.1:8766/ 。Windows 也可双击 start.cmd。
局域网共享：`python serve.py --host 0.0.0.0`，其他设备用主机的局域网地址和端口打开。
请只从本游戏目录启动服务；不要直接双击游戏HTML，浏览器模块需要HTTP服务。

## 怎么玩

- WASD或方向键移动，鼠标观察；手机使用触控按钮。
- E取火、点亮火把或上下梯子；空格挥动光杖；F放路标；H查看提示。
- 收集任务物品后找到梯子，爬上墙，走到出口门。
- 第五关开始只有短距离照明，找到火源后逐一点亮火把。
- 编辑器支持宽、高各5–43格，配色、起点、收集物、梯子和墙顶门；可导入导出JSON。

## 修改位置

- `game/levels.mjs`：十关规则与第一关路线。
- `game/characters.mjs`、`game/themes.mjs`：角色与配色。
- `game/collision.mjs`：碰撞；`game/rooftop.mjs`：墙顶路线。
- `game/effects.mjs`、`game/audio.mjs`：动效和音效。
- `music/compose*.py`：原创音乐生成脚本；运行游戏使用现成OGG音频，无需重新生成。

第一关是手绘设计的人工栅格解释，并非逐像素复原。仓库中的路线图由程序生成，原始手绘照片不随源码分发。进度保存在当前浏览器；不同设备不会自动同步。

代码：MIT；教学说明：CC BY 4.0；Three.js保留独立MIT声明。详见 [ATTRIBUTION.md](ATTRIBUTION.md)。
