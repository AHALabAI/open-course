# 捕获每一帧 · MoveLab 运动视觉 PBL

用固定机位录像练习地面标定、过线插值和运动事件核对。

- [教学 Notebook](movelab-measurement.ipynb)
- [课程安排](syllabus.md)与[验收](assessment.md)
- [Rust 测量内核](code/measurement.rs)
- [来源与许可](ATTRIBUTION.md)

在 Jupyter 中打开 Notebook。Python 依赖见 [requirements.txt](code/requirements.txt)。演示数据随代码生成，可直接复跑。运行时不需要 API 密钥或 GPU。代码在本机运行。

在 code 目录运行 node build-wasm.mjs，需要 Rust 的 wasm32-unknown-unknown 目标。构建脚本生成 WASM 和静态页面使用的嵌入副本。网页交互代码可查看 [course.js](code/course.js)。

[篮球实拍叠加 Notebook 源码](basketball-video-review.ipynb)可检查球员框、号码候选与球场投影，以及篮筐和骨架。准备有权限的原片和对应的 MoveLab 观测后运行；此仓库发布的是源码。
