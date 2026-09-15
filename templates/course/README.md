# 新课程模板

本目录用于准备新课程，不列入学习者目录。复制模板结构并填入真实内容后，才加入 catalog.json。

1. 为课程选择一个主主题与稳定 ID：courses/<topic>/<course-id>/。
2. README 写清课程面向谁、从什么问题开始、需要什么，以及材料入口。
3. course.json 按已有课程结构填写：id、version、primary_topic、topics、connection_axes、title、summary、content_languages、audience、prerequisites、format、planned_duration_minutes、content_license、available_sessions、code_entries。
4. syllabus.md 说明活动路径，assessment.md 写可观察的过程与证据，sessions/ 按课次排序。
5. resources.json 区分 included 与 external-link；assets.json 逐项列出实际再分发的二进制素材。
6. 准备 ATTRIBUTION.md、CHANGELOG.md 与必要的独立软件/素材许可。
7. 运行仓库检查，审阅运行效果、事实、隐私与权利后再发布。

每课避免预设所有学习者会产生相同兴趣或目标；保留自主选择与调整活动的空间。没有实际完成的实验或学生作品，不作为已取得的成果。
