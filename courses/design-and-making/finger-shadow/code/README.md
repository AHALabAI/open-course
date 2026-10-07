# 手指皮影戏

研发 · AHALab X ZimaBlueAI

在浏览器里操偶、排演英语短剧、记录语文习作。七位传统题材角色可点选，道具可拿起放下，孩子可修改花纹、镂空和关节点，保存自己的影人。

## 启动

需要 Node.js 22+、Python 3.11+ 与现代浏览器。Windows、macOS 均可先用鼠标操作。

```sh
python scripts/fetch-assets.py
node serve.cjs
```

打开 http://127.0.0.1:8773/ 。首次使用先完成素材下载。Windows 可双击 start.cmd，macOS 可运行 `sh start.command`。

课程包提供原创代码、教案、图集及配置脚本。运行环境与模型由使用者自行下载安装。下载脚本从固定版本的上游地址取得 MediaPipe，从课程网站取得配乐与英语示范，逐文件核对 SHA-256。网址与哈希保存在 vendor/manifest.json、assets/english/manifest.json 与 assets/music/manifest.json。课程音频地址需公开网站发布相应版本后才能使用。

## 从这里进入

- index.html 为总入口，classroom.html 为7至15岁分龄教案。
- app/index.html 为剧场，中指控制头，两边手指对称控制四肢；握拳拿物，张手放下。
- english-drama.html 有6出戏的教学安排；逐句朗读与三行提词器在剧场中。
- chinese-drama.html 有10项语文习作，可保留草稿、同伴建议与修改。
- design.html 可选七位影人作为起步，改画后导出；当前浏览器保存一份在用角色和多份设计作品。

## 本机选配

摄像头推理在浏览器内进行，需要 localhost 或 HTTPS 与摄像头许可。默认绑定逻辑不依赖 Python；需要 OC-SORT 时运行 `python scripts/setup-local.py tracking`，再在剧场选择跟踪模式。

英语本机录音评估安装见 [speech/README.md](speech/README.md)。语音与追踪环境分别安装，按实际需要选择。macOS 可以播放已备好的英语音频；修改台词后重新合成目前使用 Windows 本机声音服务。

已提供10个操偶槽位，真实多人交叉与遮挡仍需现场验证。发音分来自音素相似度，未用儿童语音校准，老师应结合回听作反馈。

摄像头画面在浏览器中处理，本机跟踪只接收手部框。本机录音评估在内存中运行，不自动存档。草稿与角色设计在当前浏览器保存，换设备前请导出。

## 验证与改编

```sh
node --test tests/*.test.mjs
```

原创软件 MIT，原创课程文案 CC BY 4.0，品牌与第三方依赖分别处理。见 [NOTICE.md](NOTICE.md)、[PROVENANCE.md](PROVENANCE.md) 和 [LICENSE](LICENSE)。

## 页面语言

页面提供16种语言，可从页面上方的 Language 选项切换。本机使用时也可打开 `index.html?lang=en`；英语剧场可使用 `app/index.html?drama=moon-gift&lang=en`。语言选择不会改变角色编号、手指对应规则、英语台词或学生的草稿。中国小学语文习作保留原有学习内容，教学说明可切换语言。
