# V3Cell Research Website

V3Cell 论文交互展示网站 v1.0。中英文首页从虚拟 3D 细胞、静态表征到动态命运建模，引导读者进入结果图谱和交互工作台。网页采用原生 HTML、CSS 和 JavaScript，在本机直接运行。

## 本地运行

需要 Python 3；无前端依赖安装或构建步骤。

```bash
python3 -m http.server 3000 --directory dist
```

访问 http://localhost:3000。不要直接双击 index.html，样本清单通过 fetch 加载。

## 当前页面

- `/#home` 展示可旋转的概念模型。滚动到 `/#home-atlas` 可按三个谱系打开静态图谱，`/#home-fate` 随滚动或点选显示扰动前后的形态示意，并链接论文轨迹。`/#research` 汇总研究指标与论文署名。
- `/#results` 可按谱系筛选和放大 72 张静态 ROI，切换保真度、少样本分类和命运轨迹指标，展开数值或查看原稿页。
- `/#workbench` 支持论文轨迹回放、空间归因、网络架构和本机模型推理四个模式。

回放模式的记录只含当前选择和图像出处。本机推理的输入只发往用户电脑的回环地址。

## 在自己的电脑上运行模型

进入 `/#workbench?tab=local`。点击「复制 Agent 提示词」可取得带当前网站地址的设置指令。作者代码和权重分别来自 [V3Cell](https://github.com/Laineyoulu/V3Cell/tree/ee2988f67c2ca33cd8df276f01289240be26d039) 和 [Zenodo 模型记录](https://zenodo.org/records/24088077)。权重许可为 CC BY-NC 4.0。

1. 准备该版本的作者代码、兼容的 PyTorch 环境和两份权重 `stage1_amniotic_frames256_snapshot580.pkl`、`stage2_motion_checkpoint_003999.pt`，权重放在同一目录。网页的「下载运行脚本」提供 `dist/local-runner.py`。
2. 在该 Python 环境运行以下命令。将两个路径和工作台来源替换为本机实际值。脚本先校验两份权重，加载成功后仅监听 `127.0.0.1:8765`。`Ctrl+C` 退出并释放模型内存。

   ```text
   python dist/local-runner.py --source "<作者代码目录>" --weights "<权重目录>" --device cpu --origin "http://127.0.0.1:3000"
   ```

3. 在网页点「连接本机」，选择同一羊膜囊类器官的 6 张 PNG。按文件名数字排序，核对缩略图顺序后指定命运条件并运行。使用原始 15 分钟序列时，取第 1、9、17、25、33、41 帧。输出是 256 × 256、共 25 帧的 GIF，包括 6 帧重建和 19 帧推演。可以另存带输入顺序、设备、权重摘要和随机种子的 JSON。

公开的 `scripts/inference.py` 使用已给定的三类命运条件。工作台沿用这一接口。CPU 是默认设备，已配置作者 CUDA 依赖的机器可以指定 `--device cuda`。网页静态托管费用与本机推理算力相互独立。

## 科学内容边界

- 资料：用户提供的 `main_nbe.pdf`，34 页论文稿；未根据文件名推断期刊或发表状态。
- 静态：结肠、胃、肺 3 种谱系，共 9 类；Figure 2 提取 72 个样本（36 真实，36 虚拟）。展示的真实/虚拟不是同一样本的重建对。
- 动态：独立的 hESC 来源羊膜囊类器官研究；Figure 5A 提取 21 个虚拟图像（3 类命运 × 7 时点）。动态数据不等同于静态三种谱系。
- 论文模式显示稿件图像与原始报告值。本机模式的结果来自用户选择的序列和官方时序权重。
- 首页可旋转四种示意形态，切换完整外观与局部剖面，按需开启结构标注。纹理为程序生成的示意材质，首页的真实明场缩略图来自图 2。
- `Virtual 3D Cell` 的空间输出指二维明场图像中的形态，不是体素重建。
- 原稿 Figure 5 中仍有待补充的比例尺文字；保留原稿状态，不自行补造。

## 目录

| 路径 | 用途 |
| --- | --- |
| `dist/index.html` | 公共页面骨架 |
| `dist/styles.css` | 视觉规范与响应式布局 |
| `dist/app.js`、`dist/organoid-viewer.js`、`dist/structure-model.js` | 页面导航、轨迹回放与类器官结构示意 |
| `dist/data.js`、`dist/evidence.js`、`dist/lab.js` | 论文报告值、交互结果面板与工作台 |
| `dist/i18n.js` | 中英文界面文案 |
| `dist/assets/` | 图稿与样本索引 |
| `scripts/check.py` | 样本数量、来源与文件完整性检查 |
| `scripts/extract_assets.py` | 从所提供 PDF 提取图稿；需要 PyMuPDF |
| `docs/DESIGN.md` | 设计范围、设计依据和后续迭代 |
| `docs/COLLABORATION.md` | 私有仓库协作约定 |
| `.github/` | CI、需求模板和 PR 模板 |

## 检查

```bash
npm run check
```

资源提取只在更新论文素材时运行：

```bash
python3 scripts/extract_assets.py /path/to/main_nbe.pdf
```

原论文 PDF 不纳入仓库。当前提取脚本按此版 PDF 的页面和图像对象组织；换稿后须重新检查图像布局和类别，不能直接套用旧对象编号。

## 协作与部署

GitHub 私有仓库：[Flysky701/v3cell-web](https://github.com/Flysky701/v3cell-web)。已创建并核验为 Private。

此前版本的私有预览：https://v3cell-lab-701.toasty-gleam-2639.chatgpt.site 。v1.0 本地版本从本页的运行入口访问。

采用 `main` + 短期功能分支 + PR。CI 只做语法和资产完整性检查，不自动公开部署。静态文件可部署到支持私有访问的静态托管服务；本原型预览默认仅所有者可访问。

图稿来自用户提供论文，用于本次私有协作原型。未附加开源许可证，也不自动授予第三方再分发论文图稿的权利。
