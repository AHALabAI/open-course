# HTML 课件播放器

AHALab 公开课使用的浏览器播放器：键盘翻页、独立讲者窗、逐页讲稿、计时、过程动效及静态阅读。无外部运行库、无账号、无统计上传。

## 启动

需要 Python 3.11+ 和现代浏览器。在本目录运行：

```sh
python serve.py --port 8827
```

打开 http://127.0.0.1:8827/ 。按 S 打开讲者窗，将主窗口放到投影屏；按方向键翻页，F 全屏，R 重播，M 切换静态模式。计时需手动开始，Ctrl+C 关闭服务。浏览器需要允许本机页面弹出讲者窗。

关闭 JavaScript 后，示例仍按顺序显示三页。打印时显示全部页面。

## 写自己的课件

修改 web/index.html：每个 section.slide 使用唯一 data-id；zima-doc 中的 slides 必须与页面顺序、id 一致。title 是标题，min 是建议分钟数，notes 是讲稿数组；每项讲稿包含 tag、label、text。新增页面时同时修改 HTML 和数据。

示例 CSS 内嵌在 HTML 中，讲者窗通过播放器读取这些样式渲染预览；如改成外链样式，需要同时扩展样式传递。网页结构和 zima-doc 只应使用作者信任的内容，不直接接入匿名用户提交的 HTML。

web/runtime.js 为原公开课的共享播放器，保留 mmcool 消息命名及既有课件控件兼容逻辑；这份示例使用基础导航和流程动画。科学演示、开场揭晓和小组计时需要对应的课件结构，不会凭空生成。web/speaker-window.html 与对应 JavaScript 负责讲者界面。

来源、版权与采用时的署名见 ATTRIBUTION.md。软件 MIT；示例文案 CC BY 4.0。
