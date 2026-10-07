# 英语录音与本机参考反馈

研发 · AHALab X ZimaBlueAI

示范音频与台词在 assets/english/，可先试听、跟读与配合操偶。在公开网页中可录音回听；需要台词核对与音素参考时运行本机版本。

Python 3.11+，安装环境

```sh
python scripts/setup-local.py speech
```

准备 `.models-speech/sensevoice-small/` 中的 model.onnx 与 tokens.json。models.json 的 SHA-256 标识本轮验证过的导出文件。自行导出的文件可能具有不同摘要，需要先检查接口并记录自己的摘要；课程运行时不下载或执行远程模型代码。可用环境变量 SHADOW_SENSEVOICE_MODEL 指定已有模型目录。

音素模型为 vitouphy/wav2vec2-xls-r-300m-timit-phoneme，固定修订 efb7ae9b88f13db0d42eac8cedbba19739e2a278。运行 `python scripts/setup-local.py phones` 下载列出的文件并检查摘要，也可将已有文件放入 `.models-speech/english-phones/`。这一步下载约1.3GB。

准备好后重新启动 `node serve.cjs`。台词匹配只比较转写与剧本；发音参考另比较录音估计的音素与 CMUdict 候选读音。低音量、环境噪声、口音、弱读和模型错误都可能影响结果。蓝字门槛只改变提示，不改变原始分数。

SenseVoice 权重按所选版本的上游模型许可使用；[官方模型卡](https://huggingface.co/FunAudioLLM/SenseVoiceSmall) 链接了 [FunASR 模型许可](https://github.com/modelscope/FunASR/blob/main/MODEL_LICENSE)。音素模型、CMUdict 与各 Python 库保留各自许可。原录音在内存中使用，本机不自动写入文件；导出的课堂记录只含文字反馈。

Windows 环境为现有实现的运行依据。已整理 macOS 的路径与依赖安装方式，尚未在 Mac 实机验证。分数也尚未经儿童语音校准，不能作为标准化考试成绩。

## 自行准备 SenseVoice 导出

从 [官方模型卡](https://huggingface.co/FunAudioLLM/SenseVoiceSmall) 取得 SenseVoice Small 权重，在独立导出环境按 [官方 ONNX 导出示例](https://github.com/QwenAudio/SenseVoice/blob/main/export.py) 准备浮点模型。导出环境可按上游说明安装，完成后将 model.onnx 与模型的 tokens.json 放到上文目录；不要将导出环境打包进课程。

本课程读取的 ONNX 输入为 speech（float32，批次×时间×560）、speech_lengths、language 和 textnorm（三者 int32）。输出需要包含批次×时间×词表长度的 logits；tokens.json 为按 token ID 排列的字符串列表。量化版、不同前处理或只输出 token ID 的导出不能直接替换。导出后先用已知英语短句核对转写，再保存该导出的文件大小、SHA-256 和模型版本信息。当前清单不宣称官方另一个导出文件能与本轮摘要完全相同。
