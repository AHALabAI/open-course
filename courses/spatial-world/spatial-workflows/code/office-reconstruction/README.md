# 公开办公室重建：复现操作手册

配套文章：《把真实空间搬进游戏｜Codex × GPT-6-Astra 重建手记》。2026-09-24。

本文命令面向新解压的 `office-reconstruction`，在 Windows PowerShell 中执行。附件为源码及渲染器，不包含上游程序、模型权重和完整照片集；照片由下载脚本从官方公开数据源获取。新机器安装流程已核对脚本依赖与路径，未进行另一台空白机器全链路测试。

## 1. 工作流与输出

下载公开标定照片 → OpenMVS 重建 → 按照片修复平面与物件 → 导出 GLB → 浏览器对照 → 渲染无声视频。

本目录提供源码。模型、照片、渲染结果由下面的命令生成，完成后再打开 viewer 中的相应页面。

## 2. 安装环境

安装 Python 3.13、Node.js 22 或更高版本、Blender 5.1、FFmpeg。COLMAP／OpenMVS 由固定版本脚本安装。该复现流程面向 Windows；OpenMVS 阶段会使用 .exe 文件。

假设源码附件解压在 `C:\recon\office-lab\office-reconstruction`：

```powershell
Set-Location C:\recon\office-lab\office-reconstruction
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe home-pilot\install_tools.py
Copy-Item home-pilot\tools.example.json home-pilot\tools.json
```

只在首次配置时复制 `tools.example.json`。编辑 `tools.json`，填入实际路径，尤其 Blender、FFmpeg／FFprobe。不需要更改全局 Python。安装脚本附件副本的 ROOT 为 `C:/recon-tools`；改到其他盘后同时修改 JSON。

固定工具包：

| 组件 | 官方下载 | SHA-256 |
|---|---|---|
| COLMAP 4.2.0 Windows CUDA | [Release](https://github.com/colmap/colmap/releases/tag/4.2.0) | `991e0bae403a496fcc4de0c1f1f428619bf12f8000978f77bc6799d9bfeac23e` |
| OpenMVS v2.4.0 Windows x64 | [Release](https://github.com/cdcseacave/openMVS/releases/tag/v2.4.0) | `0c31660c15c9ebc4c106873cf67564d9570d404aef7a6403451da1b6178b2167` |

这些是本次固定下载文件的哈希，后续不能把换过的文件静默视为同一版本。工具能启动后再运行实验。

```powershell
& C:\recon-tools\colmap-4.2.0\bin\colmap.exe -h
& C:\recon-tools\openmvs-2.4.0\vc17\x64\Release\InterfaceCOLMAP.exe --help
& 'C:\Program Files\Blender Foundation\Blender 5.1\blender.exe' --version
```

若安装包实际层级不同，以 `installed-tools.json` 列出的可执行文件为准。OpenMVS 帮助调用可能用非零退出码表示帮助结束，不能只看该码就判断程序无法运行。

## 3. 公开数据到初始 GLB

本例采用官方提供的标定相机，不运行新的 SfM。普通自采照片／视频不能直接套用该相机。

```powershell
Set-Location C:\recon\office-lab\office-reconstruction\home-pilot\public-demo
..\..\.venv\Scripts\python.exe download_office.py
New-Item -ItemType Directory -Force source\model-txt
& C:\recon-tools\colmap-4.2.0\bin\colmap.exe model_converter --input_path source\model --output_path source\model-txt --output_type TXT
..\..\.venv\Scripts\python.exe prepare_calibrated_views.py
..\..\.venv\Scripts\python.exe run_reconstruction.py
```

成功产物是 `runs/office-v01/delivery/office.glb`。各阶段日志位于 `runs/office-v01/logs`。准备脚本会拒绝已有 `office-v01`，保留历史后在新的实验副本复跑；不要在已有模型上反复执行补建脚本。

底层命令记录在 `run_reconstruction.py`。这里关闭了 OpenMVS 两项 seam leveling；换参数时另建实验并对照，不把修改参数后的耗时沿用为本文数字。

## 4. 按顺序修复

以下是**针对 office1a 坐标写的场景专用脚本**。迁移到自己房屋时，必须重新定位缺陷、设边界和选照片；不是通用一键修复器。工作目录继续为 `home-pilot/public-demo`。

墙面：

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.1\blender.exe' --background --python-exit-code 1 --python repair_planar_holes.py
..\..\.venv\Scripts\python.exe texture_repair.py
..\..\.venv\Scripts\python.exe export_patch_overlay.py
..\..\.venv\Scripts\python.exe verify_repair_geometry.py
```

桌面：

```powershell
..\..\.venv\Scripts\python.exe analyze_table.py
..\..\.venv\Scripts\python.exe repair_table.py
..\..\.venv\Scripts\python.exe texture_table.py
..\..\.venv\Scripts\python.exe export_table_overlay.py
..\..\.venv\Scripts\python.exe verify_table_geometry.py
```

门与邻近墙面：

```powershell
..\..\.venv\Scripts\python.exe analyze_door.py
..\..\.venv\Scripts\python.exe repair_door.py
..\..\.venv\Scripts\python.exe verify_door_geometry.py
```

全屋物件：

```powershell
..\..\.venv\Scripts\python.exe audit_room.py
..\..\.venv\Scripts\python.exe audit_room_details.py
..\..\.venv\Scripts\python.exe plan_room_repairs.py
..\..\.venv\Scripts\python.exe bake_floor_sample.py
..\..\.venv\Scripts\python.exe repair_room.py
..\..\.venv\Scripts\python.exe verify_room_geometry.py
..\..\.venv\Scripts\python.exe ..\..\check_glb.py repairs\room-v01\office-room-final.glb --require-texture
```

在 `plan_room_repairs.py` 和 `bake_floor_sample.py` 后查看输出的参考图，确认没有取到遮挡区。这一阶段是 `repairs/room-v01/office-room-final.glb` 与 `room-repair-overlay-final.glb`。椅子、桌体等参数为近似补建；玻璃与屏幕为固定照片外观。

## 5. 墙顶精修：从标定照片重新投影

先完成前述全屋物件版本。代码包根目录执行 `npm ci`；下面浏览器脚本使用 Playwright 和已安装的 Edge。给深度渲染先启动本地服务，在单独终端保持运行：

```powershell
Set-Location C:\recon\office-lab\office-reconstruction\home-pilot\public-demo
..\..\.venv\Scripts\python.exe -m http.server 8767 --bind 127.0.0.1 --directory viewer
```

另一个终端仍在 `home-pilot/public-demo`，依次执行：

```powershell
..\..\.venv\Scripts\python.exe audit_envelope.py
node capture_envelope_depth.mjs
..\..\.venv\Scripts\python.exe bake_envelope.py
..\..\.venv\Scripts\python.exe finish_envelope_materials.py
..\..\.venv\Scripts\python.exe repair_envelope.py
..\..\.venv\Scripts\python.exe verify_envelope_geometry.py
..\..\.venv\Scripts\python.exe ..\..\check_glb.py repairs\envelope-v01\office-envelope-final.glb --require-texture
```

深度页读取上一轮 `office-room-final.glb`，为 261 个标定视角生成遮挡参考。贴图脚本将相机图像投影到约束平面，材料整理脚本标记并处理重影和不可见区域。最后裁剪原扫描墙顶、插入新平面，保留独立门和家具网格。成品另存 `repairs/envelope-v01/office-envelope-final.glb`，生成橙色标记层和 JSON 验证记录。已有目标 GLB 时拒绝覆盖，应归档整轮后另建实验副本。

坐标范围、相机选择、纹理裁剪和填充区域都针对 office1a。不可见区域的材质是推断； ceiling 小设施仅保留平面照片外观。测量精度与整个场景封闭性不在这次验证范围。

## 6. 同相机渲染与动画

补建脚本会把最终资产复制到 `viewer/assets`；另补入原始模型以便动画显示前后对照。

```powershell
Copy-Item runs\office-v01\delivery\office.glb viewer\assets\office.glb
..\..\.venv\Scripts\python.exe prepare_article_views.py
..\..\.venv\Scripts\python.exe prepare_envelope_review.py
..\..\.venv\Scripts\python.exe -m http.server 8767 --bind 127.0.0.1 --directory viewer
```

若 8767 已被上一步服务占用，继续使用现有服务，不重复启动。该终端保持运行。`http://127.0.0.1:8767/envelope-review.html` 提供 `window.renderCase(key, variant)`；`article-film-envelope.html` 提供 `window.renderFilm(t)`，浏览器开发控制台可用秒数控制时间。电影页面本身为确定性渲染入口，不会自动播放整段时间线。

另开 PowerShell，在代码包根目录：

```powershell
Set-Location C:\recon\office-lab\office-reconstruction
npm ci
$env:FFMPEG = 'C:\recon-tools\ffmpeg\bin\ffmpeg.exe'
node render_film.mjs
```

脚本默认使用本机 Microsoft Edge。若没有 Edge，安装 Playwright Chromium，调整脚本浏览器启动配置。已有 `rendered-film/media/office-envelope-silent-50s.mp4` 时脚本拒绝覆盖，请先归档本轮渲染目录。

脚本先等待 `filmReady`，再逐帧调用 `renderFilm(frame/24)`、截图，通过管道输入 FFmpeg。原片、最终 GLB 与补建标记层必须齐全。代码包包含本次使用的 Three.js 本地模块，不依赖外部 CDN；许可随 vendor 保留。

## 7. 公开素材与交付限制

Meta Eyeful Tower 上游许可固定来源版本：`06a01a4915afc872b893c20a025a0e14598c8478`，保留 `LICENSE-EyefulTower.txt`。图片分发保留出处。各软件仍有独立许可，特别是 OpenMVS AGPL 与第三方模型权重，不能统一标为 MIT。

本目录的 AHALab 原创脚本采用 MIT；第三方库和下载数据按各自许可使用，见 THIRD_PARTY_NOTICES.md。

适用范围：office1a 的标定相机与坐标。模型可用于视觉检查；不提供测量精度保证、封闭网格保证或游戏碰撞数据。换成自采照片时需重新标定和定位修复区域。


## 8. 给视频加入自己的音乐

渲染脚本输出无声 MP4。以下命令是可选混音示例，不包含歌曲文件；将自己的音频放在代码包根目录。保持原视频流，显式选择音频流，避免 MP3 内嵌封面被当作视频。

```powershell
& $env:FFMPEG -n -i rendered-film/media/office-envelope-silent-50s.mp4 -i "your-music.mp3" -map 0:v:0 -map 1:a:0 -c:v copy -af "atrim=0:50,asetpts=PTS-STARTPTS,loudnorm=I=-19:TP=-1.5:LRA=9,afade=t=in:st=0:d=1.2,afade=t=out:st=47:d=3" -c:a aac -b:a 192k -ar 48000 -t 50 -map_metadata -1 -movflags +faststart rendered-film/media/office-3d-showcase-50s.mp4
```

混音后检查视频总长、音轨和完整解码。请使用自己有权使用的音乐；数据和代码许可不包含音乐授权。
