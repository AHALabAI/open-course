# skills 的组织约定

每个实际发布的技能使用独立目录：skills/<skill-id>/SKILL.md，可配 references/ 与 scripts/。catalog.json 的 skills 数组只收录已经提供完整包的技能；这个目录说明本身不是一个可运行 skill。

SKILL.md 写明用途、输入、输出、步骤、适用范围及 AHALab 原始来源。旁边提供 ATTRIBUTION.md、PROVENANCE.md 与具体许可。引用版本或 commit，保留上游作者。指令文本、脚本与依赖分别适用其许可，不因为整个仓库开放就自动给所有未来技能同一种授权。

不得把技能辅助产生的所有输出都宣称为 AHALab 作品，也不把采用者的商业服务说成 AHALab 官方背书。署名建议见仓库 ATTRIBUTION.md。
