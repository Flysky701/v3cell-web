# V3Cell Research Website

V3Cell 科研网站基础版 v0.1。参考 scPLAD 的留白、青绿色视觉、研究叙事、结果页和工作台结构，按用户提供的 V3Cell 论文稿组织内容。不是 scPLAD 源码复用。

## 本地运行

需要 Python 3；无前端依赖安装或构建步骤。

```bash
python3 -m http.server 3000 --directory dist
```

访问 http://localhost:3000。不要直接双击 index.html，样本清单通过 fetch 加载。

## 当前页面

- `/#home`：研究概览、概念粒子可视化、静态谱系、动态轨迹及两阶段方法。
- `/#results`：9 个静态形态类别、真实/虚拟来源、论文报告指标、原图弹窗。
- `/#workbench`：3 类发育命运、7 个时点、拖动/播放/逐帧浏览、导出当前浏览记录、本地图片预览。

浏览记录导出只含当前选择和图像出处，没有新预测结果。图片预览仅使用浏览器对象 URL，不上传到服务器。

## 科学内容边界

- 资料：用户提供的 `main_nbe.pdf`，34 页论文稿；未根据文件名推断期刊或发表状态。
- 静态：结肠、胃、肺 3 种谱系，共 9 类；Figure 2 提取 72 个样本（36 真实，36 虚拟）。展示的真实/虚拟不是同一样本的重建对。
- 动态：独立的 hESC 来源羊膜囊类器官研究；Figure 5A 提取 21 个虚拟图像（3 类命运 × 7 时点）。动态数据不等同于静态三种谱系。
- 工作台是论文图像回放，没有推理后端、权重、任务队列或真实样本分析。
- 粒子动画是概念视觉，不能作为测量数据或三维重建。
- `Virtual 3D Cell` 的空间输出指二维明场图像中的形态，不是体素重建。
- 原稿 Figure 5 中仍有待补充的比例尺文字；保留原稿状态，不自行补造。

## 目录

| 路径 | 用途 |
| --- | --- |
| `dist/index.html` | 公共页面骨架 |
| `dist/styles.css` | 视觉规范与响应式布局 |
| `dist/app.js` | 路由、图像浏览和交互 |
| `dist/assets/` | 图稿与样本索引 |
| `scripts/check.py` | 样本数量、来源与文件完整性检查 |
| `scripts/extract_assets.py` | 从所提供 PDF 提取图稿；需要 PyMuPDF |
| `docs/DESIGN.md` | 设计范围、设计依据和后续迭代 |
| `docs/COLLABORATION.md` | 私有仓库协作约定 |
| `.github/` | CI、需求模板和 PR 模板 |

## 检查

```bash
node --check dist/app.js
python3 scripts/check.py
```

资源提取只在更新论文素材时运行：

```bash
python3 scripts/extract_assets.py /path/to/main_nbe.pdf
```

原论文 PDF 不纳入仓库。当前提取脚本按此版 PDF 的页面和图像对象组织；换稿后须重新检查图像布局和类别，不能直接套用旧对象编号。

## 协作与部署

GitHub 私有仓库：[Flysky701/v3cell-web](https://github.com/Flysky701/v3cell-web)。已创建并核验为 Private。

私有预览：https://v3cell-lab-701.toasty-gleam-2639.chatgpt.site

采用 `main` + 短期功能分支 + PR。CI 只做语法和资产完整性检查，不自动公开部署。静态文件可部署到支持私有访问的静态托管服务；本原型预览默认仅所有者可访问。

图稿来自用户提供论文，用于本次私有协作原型。未附加开源许可证，也不自动授予第三方再分发论文图稿的权利。
