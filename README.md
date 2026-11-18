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
- `/#workbench` 支持三个模式。轨迹回放联动物理时间与图 5C、5G 原曲线；归因模式比较三种扰动的四通道图像；模型模式展示两阶段模块、损失项和九种静态亚型。

浏览记录导出只含当前选择和图像出处，没有新预测结果。图片预览仅使用浏览器对象 URL，不上传到服务器。

## 科学内容边界

- 资料：用户提供的 `main_nbe.pdf`，34 页论文稿；未根据文件名推断期刊或发表状态。
- 静态：结肠、胃、肺 3 种谱系，共 9 类；Figure 2 提取 72 个样本（36 真实，36 虚拟）。展示的真实/虚拟不是同一样本的重建对。
- 动态：独立的 hESC 来源羊膜囊类器官研究；Figure 5A 提取 21 个虚拟图像（3 类命运 × 7 时点）。动态数据不等同于静态三种谱系。
- 工作台是论文图像回放，没有推理后端、权重、任务队列或真实样本分析。
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
