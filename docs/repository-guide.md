# 目录与课程组织

```text
open-course/
  catalog.json
  courses/
    world-and-society/mmcool-worldview/
    climate-and-ecology/cool-island/
  tools/html-ppt-player/
  skills/
  templates/course/
  scripts/
  LICENSES/
```

课程目录包含 README.md、course.json、syllabus.md、assessment.md、sessions/、resources.json、assets.json、ATTRIBUTION.md 与 CHANGELOG.md。实际配套软件放 code/；没有软件的课程不虚构代码入口。

主题是导航层，课程有且仅有一个主目录；多个 topics 标签用于交叉检索。课程 ID 使用稳定的小写英文短名，不带授课日期、人名或版本号。课次用 01、02 等顺序前缀，便于按学习路径进入；源文件只有一份。

people 与 world 两个 connection_axes 对应“与他人”和“与世界”。它们记录课程设计方向，不用来给学生态度评分。

course.json 中 planned_duration_minutes 是全课程计划时长；available_sessions 只列实际可进入的材料，完整设计与已提供课次可以不同。每项入口明确 repository 或 external-website，不把只有链接的课程说成克隆后即可离线使用。

content_languages 只列完整教学材料已有的语言。课程元数据可有中英文 title/summary；后续译稿放课程 i18n/<语言>/，与原文共用课程 ID、活动和资源来源。默认中文不强制加网站路径前缀。

不将整套网站、服务配置或研发工程搬进仓库。仓库保存可编辑材料，网站负责在线阅读和展播，Release 或网站承载较大的许可清楚的下载包。
