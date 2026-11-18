'use strict';

const labModes = ['dynamics','attribution','architecture'];
const labLabels = ['studioDynamics','studioAttribution','studioArchitecture'];
let labTab = 'dynamics', condition = 'ehdpp', activeModule = 'generator', labSubtype = 'budding-opaque';
let uploadedNames = [];

function workbench() {
  return `<section class="wrap page-intro workbench-intro">${eye('workbenchSection')}<h1>${msg('labTitleNew')}</h1>
    <div class="intro-row"><p>${msg('workbenchLead')}</p><div class="lab-intro-actions"><span class="pill">${msg('replayOnly')}</span><button class="chip" id="how-to">${msg('howTo')} ?</button></div></div></section>
    <section class="wrap lab-shell"><nav class="lab-modes" data-i18n-label="workbench">${labModes.map((id,i) =>
      `<a href="#workbench?tab=${id}" data-lab-mode="${id}">${msg(labLabels[i])}</a>`).join('')}</nav><div id="lab-host"></div></section>`;
}

function renderLab() {
  const host = document.getElementById('lab-host');
  host.dataset.mode = labTab;
  for (const link of main.querySelectorAll('[data-lab-mode]')) {
    if (link.dataset.labMode === labTab) link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  }
  if (labTab === 'attribution') { renderAttribution(); return; }
  if (labTab === 'architecture') { renderArchitecture(); return; }
  host.innerHTML = trajectoryWorkspace();
  localize(host);
  const preview = document.getElementById('upload-preview');
  fileUrls.forEach((url,i) => { const image = new Image(); image.src = url; image.alt = uploadedNames[i]; preview.append(image); });
  updateUploadStatus();
  updateFrame();
}

function phaseReading(id,hour) {
  if (id === 'noncavity') return bi('在未形成腔体的结局下，类器官面积在 48–96 h 内持续增长，但始终未组织出围绕中央腔体的玫瑰花结结构。','In the non-cavity outcome, organoid area grows steadily across 48–96 h without organizing a rosette around a central lumen.');
  if (id === 'collapse') return hour < 64 ? bi('在早期条件窗口（48–56 h）内，明场形态提供初始几何线索，后续腔体能否稳定维持将决定该命运。','Within the early conditioning window (48–56 h), brightfield morphology provides the initial structural cues before lumen stability diverges.') :
    bi('进入推演阶段后，腔体塌陷类的玫瑰花结发育畸形，中央腔体未能稳定维持，边界不规则度随之上升。','During rollout, the cavity-collapse trajectory forms a malformed rosette whose central lumen fails to stabilize, accompanied by rising boundary irregularity.');
  if (hour < 64) return bi('在约 64 h 之前，腔体形成类的上皮细胞围绕共同的顶端收缩点初步排列。','Before ~64 h, cells in the cavity-formation trajectory organize around a shared focus of apical constriction.');
  return hour < 72 ? bi('64 h 前后进入由早期极化迈向腔体扩张的关键过渡阶段。','Around 64 h, the organoid transitions from early apical polarization toward lumen expansion.') :
    bi('在 72–96 h 期间，成熟的玫瑰花结结构清晰围合出稳定的中央腔体，腔体面积持续扩大。','Between 72 and 96 h, a well-defined rosette encloses a expanding central lumen.');
}

function trajectoryCurves(id) {
  const f = study.dynamic.fates[id];
  return `<article class="curve-set"><h3>${t(id)}</h3>${compareFates ? '<p class="phase-reading"></p>' : ''}<div class="curve-pair">${[
    ['probability',t('probability'),f.probability,'5C'],['morphometry',t(f.metric),f.morphometry,'5G']
  ].map(([kind,name,r,panel]) => `<figure><figcaption><span>${name}</span><strong>r = ${r.toFixed(3)}</strong></figcaption>
    <div class="curve-image ${kind}"><img src="assets/${kind}-${id}.png" alt="${t(id)} · ${name} · Fig. ${panel}"><i aria-hidden="true"></i></div></figure>`).join('')}</div></article>`;
}

function updateLinkedEvidence() {
  const host = document.getElementById('linked-evidence');
  const ids = compareFates ? fateIds : [fate];
  const key = language+'-'+ids.join('-');
  if (host.dataset.selection !== key) {
    host.innerHTML = `<div class="linked-head"><h3>${bi('同步定量轨迹（图 5C / 5G）','Synchronized quantitative trajectories (Fig. 5C / 5G)')}</h3><b id="window-label"></b></div>
      <p class="lab-note">${bi('图 5C 中的竖直虚线（约 60 h）标示早期条件输入与后续自回归推演的分界：48、56 h 属于条件输入窗口，64–96 h 属于模型推演序列。实线为真实观测均值，虚线为 V3Cell 虚拟序列均值（阴影表示 ± s.e.m.），r 为整段时序的 Pearson 相关性。','The vertical dotted line in Fig. 5C (~60 h) marks the boundary between early conditioning (48 and 56 h) and autoregressive rollout (64–96 h). Solid curves show real mean trajectories and dashed curves show V3Cell virtual means (shaded bands denote ± s.e.m.), with Pearson r computed across the full time series.')}</p>
      ${ids.map(trajectoryCurves).join('')}`;
    host.dataset.selection = key;
  }
  const hour = trajectoryHours[frame];
  host.querySelector('#window-label').textContent = hour+' h · '+(hour < 60 ? bi('条件输入期','Conditioning') : bi('自回归推演期','Rollout'));
  host.querySelectorAll('.phase-reading').forEach((p,i) => { p.textContent = phaseReading(ids[i],hour); });
  // Relative x positions are measured from the printed 48 h and 96 h axis ticks in the two crops.
  const fraction = (hour-48)/48;
  host.style.setProperty('--probability-x',(19.58+55.94*fraction)+'%');
  host.style.setProperty('--morphometry-x',(17.04+77.03*fraction)+'%');
}

function renderAttribution() {
  const a = study.attribution;
  const title = condition.toUpperCase()+' · '+a.conditions[condition]+' μM';
  document.getElementById('lab-host').innerHTML = `<section class="lab-panel"><div class="panel-heading"><div class="section-ref">Fig. 5B / 5F</div>
    <h2>${bi('Grad-CAM 空间归因与免疫荧光验证','Grad-CAM spatial attribution & immunofluorescence validation')}</h2>
    <p>${bi('为检验驱动 V3Cell 命运编码的区域是否对应具有生物学意义的解剖结构，我们对比了三种化学扰动（EHDPP、IDDPP、RGD）下的明场图、腔体形成 logit 的 Grad-CAM 激活图，以及肌动球蛋白收缩力标志物 p-MLC-II 与细胞核 DAPI 染色。','To test whether the regions driving V3Cell’s fate encoding correspond to biologically meaningful structures, we compared brightfield frames, Grad-CAM activation maps for the cavity-formation logit, and endpoint immunofluorescence for actomyosin contractility (p-MLC-II) and nuclei (DAPI) across EHDPP, IDDPP, and RGD perturbations.')}</p></div>
    ${choiceButtons('condition',Object.entries(a.conditions).map(([id,dose])=>[id,id.toUpperCase()+' · '+dose+' μM']),condition)}
    <div class="channel-grid">${a.channels.map(ch => `<figure><button data-channel="${ch}" aria-label="${title} · ${t(ch)}"><img src="assets/attribution-${condition}-${ch}.png" alt="${title} · ${t(ch)}"></button><figcaption>${t(ch)}</figcaption></figure>`).join('')}</div>
    <p class="lab-note">${bi('模型高关注的上皮环区域与 p-MLC-II 免疫荧光在空间上高度吻合，且在 EHDPP、IDDPP 与 RGD 三种扰动条件下保持一致，表明模型归因能够跨扰动泛化并定位于力学活跃的上皮区域。免疫荧光图像取自匹配或同条件代表性视野，Grad-CAM 由冻结编码器上的线性探针提取。','The attended epithelial ring spatially coincides with p-MLC-II immunofluorescence across EHDPP, IDDPP, and RGD conditions, demonstrating that model attribution localizes to mechanically active epithelial regions in a perturbation-generalizable manner. IF panels show matched or representative fields; Grad-CAM is computed via a linear probe on the frozen encoder.')}</p>
    <div class="dimension-card"><button class="panel-image" data-figure="trajectories" aria-label="${t('openFigure')}"><img src="assets/attribution-nef.png" alt="Fig. 5F · nEF"></button>
    <div><span class="section-ref">Fig. 5F · §4.7–4.8</span><h3>${bi('区域归一化能量占比（nEF）','Normalized Energy Fraction (nEF)')}</h3><p>${bi('我们定义了区域归一化能量占比（nEF）以量化归因偏好：水平虚线 nEF = 1 代表空间均匀基线（激活能量与区域面积成正比），大于 1 表示归因富集，小于 1 表示相对抑制。统计时先在每条视频内对帧取均值，再以视频为单位执行双侧 Wilcoxon 符号秩检验。','We defined the Normalized Energy Fraction (nEF) to quantify regional attribution preference: the dashed line at nEF = 1 marks the spatially uniform baseline (activation proportional to region area), with nEF > 1 indicating enrichment and nEF < 1 indicating suppression. Frame values were averaged within each video before Wilcoxon signed-rank testing.')}</p><p>${attributionNote()}</p></div></div>
    ${resultDrawer(bi('查看 51 条归因分析视频的样本构成','View composition of the 51-video attribution subset'),valueTable([bi('视频子集来源','Video subset source'),bi('视频序列数','Video sequences')],[[bi('EHDPP 训练集','EHDPP training'),a.trainingEhdpp],[bi('EHDPP 留出测试集','EHDPP held-out'),a.heldOutEhdpp],['IDDPP',a.iddpp],['RGD',a.rgd]])+
      `<p>${bi('归因定量分析涵盖发生腔体形成或呈现形成趋势的 51 条延时视频序列；其中 IDDPP 与 RGD 扰动组专门留作跨条件归因验证。','Quantitative attribution covers 51 time-lapse sequences exhibiting cavity formation or a cavity-forming tendency, with the IDDPP and RGD perturbation cohorts reserved specifically for cross-condition attribution validation.')}</p>`)}
    ${sourcePages('§2.4 · §4.7–4.8',[10,11],'trajectories')}</section>`;
}

function architectureModules() {
  return {
    generator: ['Stage 1','R3GAN','z ∈ ℝ⁶⁴',bi('我们针对每个谱系分别训练前景感知的条件 R3GAN 生成器，将 64 维高斯潜变量 z ∼ N(0, I) 与表型类别标签映射为 64 × 64 明场 ROI。通过前景二元掩码 m 构造空间权重矩阵 W = 1 + m(5 − 1)，对类器官内部的 R1/R2 梯度惩罚赋予 5 倍权重（背景为 1），从而聚焦主体结构并抑制基质胶伪影。','We train a lineage-specific, foreground-aware conditional R3GAN generator that maps a 64-dimensional latent vector z ~ N(0, I) and phenotype class label to a 64 × 64 brightfield ROI. A binary foreground mask m defines the spatial weight matrix W = 1 + m(5 − 1), weighting R1/R2 gradient penalties fivefold inside the organoid (versus 1 in background) to suppress Matrigel artifacts.'),'§4.4 · pp. 16–17'],
    classifier: ['Stage 2',bi('早期命运分类器','Early fate classifier'),'ResNet-50',bi('独立训练的 ResNet-50 分类器仅读取由五折交叉验证选出的第 5 早期条件帧（k* = 4），在无需外部扰动标签的情况下输出三类发育命运预测 ĉ。该预测标签随后作为唯一类别条件信号输入轨迹解码器。','An independently trained ResNet-50 classifier reads the fifth conditioning frame (k* = 4, selected via fivefold cross-validation) to predict the three-way developmental fate ĉ without perturbation labels; ĉ then serves as the sole categorical conditioning signal for the trajectory decoder.'),'§4.5 · p. 18'],
    encoder: ['Stage 2',bi('时序解耦编码器','Disentangled sequence encoder'),'zC ∈ ℝ³² / zM ∈ ℝ³²',bi('编码分支读取前 6 帧 256 × 256 明场序列，将潜表征解耦为提取自第 1 帧并保持时序恒定的 32 维内容编码 zC，以及逐帧演化的 32 维运动编码 zM。特征编码与命运分类两支并行运行。','The encoding branch reads the six early 256 × 256 brightfield frames, disentangling representation into a time-invariant 32-dimensional content code zC (from frame 1) and a time-varying 32-dimensional motion code zM, operating in parallel with the fate classifier.'),'§4.5 · p. 18'],
    motion: ['Stage 2','MotionRNN','LSTM · dh = 384',bi('双层 LSTM（隐层维度 dh = 384）由前 6 帧早期序列初始化隐状态，随后结合上一时刻运动状态与高斯噪声逐步预测运动增量，以步长缩放系数 α = 0.1 自回归更新运动编码 zM，连续推演余下 19 个未来时间步。','A two-layer LSTM (hidden dimension dh = 384) initializes its hidden state from the six conditioning frames and predicts step-wise motion increments from the preceding motion state and Gaussian noise, updating zM with scale α = 0.1 across the remaining 19 future frames.'),'§4.5–4.6 · pp. 18–19'],
    decoder: ['Stage 2',bi('冻结条件解码器','Frozen conditional decoder'),'G([zC, zM], ĉ)',bi('解码器在每个时间步将恒定内容编码 zC 与当前运动编码 zM 拼接，并在预测命运 ĉ 的条件下渲染对应的二维明场图像。在阶段 2 训练与推演期间，生成器权重保持冻结，确保单帧形态表征的视觉保真度。','At each time step, the decoder concatenates the fixed content code zC with the current motion code zM and renders a 2D brightfield frame conditioned on the predicted fate ĉ. Generator weights remain frozen during Stage 2 to preserve frame-level visual fidelity.'),'§4.5–4.6 · pp. 18–19'],
    loss: ['Stage 2',bi('复合训练目标','Composite training objective'),'Eq. 7',bi('总损失函数定义为 10 Lrecon + Ladv + Ldir + LMI + 0.1 Lmotion + 0.01 LKL：六项共同约束像素重建保真度、对抗真实性、时序演化方向、潜空间互信息对齐、运动轨迹平滑性以及变分后验正则化。','The composite loss 10 Lrecon + Ladv + Ldir + LMI + 0.1 Lmotion + 0.01 LKL jointly enforces reconstruction fidelity, adversarial realism, temporal progression direction, mutual-information alignment, motion smoothness, and KL posterior regularization.'),'§4.5 · pp. 18–19']
  };
}

function renderArchitecture() {
  const modules = architectureModules();
  const [stage,name,param,detail,source] = modules[activeModule];
  const group = samples.find(s => s.subtype === labSubtype);
  document.getElementById('lab-host').innerHTML = `<section class="lab-panel"><div class="panel-heading"><div class="section-ref">§4.3–4.6 · Fig. 6</div>
    <h2>${bi('两阶段架构与内容—运动潜空间解耦','Two-stage architecture & content–motion disentanglement')}</h2>
    <p>${bi('我们在阶段 1 中通过前景感知条件生成学习静态表型流形，在阶段 2 中并行执行早期命运解码与内容—运动潜空间解耦，进而自回归推演完整发育轨迹。点击下方模块可查阅各组件的设计与超参数。','In Stage 1 we learn the static phenotypic manifold via foreground-aware conditional generation; in Stage 2 we decode early fate in parallel with content–motion latent disentanglement to autoregressively roll out developmental trajectories. Select any module below to inspect its formulation.')}</p></div>
    <div class="module-grid">${Object.entries(modules).map(([id,[stage,label,param]])=>`<button data-module="${id}" aria-pressed="${id===activeModule}"><small>${stage}</small><b>${label}</b><span>${param}</span></button>`).join('')}</div>
    <p class="flow-caption">${bi('数据流：早期第 5 帧 → ResNet-50 分类器 → 预测命运 ĉ；同时前 6 帧序列 → 编码器 → 恒定内容编码 zC + 初始运动编码 zM → MotionRNN 自回归更新 zM → 两支在冻结解码器 G([zC, zM], ĉ) 汇合输出未来帧。','Dataflow: 5th early frame → ResNet-50 classifier → predicted fate ĉ; in parallel, 6 early frames → encoder → fixed content zC + initial motion zM → MotionRNN rolls out zM → both branches join at frozen decoder G([zC, zM], ĉ).')}</p>
    <article class="module-detail"><div class="section-ref">${stage} / ${source}</div><h3>${name} · ${param}</h3><p>${detail}</p></article>
    <div class="atlas-explorer"><div><h3>${bi('阶段 1 静态亚型对照检视','Stage 1 static subtype inspector')}</h3><label class="field">${bi('选择形态亚型（共 9 类）','Select morphological subtype (9 classes)')}
    <select id="lab-subtype">${[...new Set(samples.map(s=>s.subtype))].map(id=>{const s=samples.find(item=>item.subtype===id);return `<option value="${id}" ${id===labSubtype?'selected':''}>${t(s.lineage)} · ${t(id)}</option>`}).join('')}</select></label>
    <p>${bi('该谱系关键形态学标志','Key lineage morphometric hallmark')} · ${t(study.static.lineages[group.lineage].hallmark)}</p><p class="lab-note">${t('atlasNotice')}</p></div>${sampleGroup(labSubtype)}</div></section>`;
}

function handleLabClick(target) {
  const b = target.closest('button');
  if (!b) return false;
  if (b.id === 'how-to') {
    openInspection(t('howTo'),`<ol class="guide"><li><b>${t('studioDynamics')}</b><p>${bi('切换发育命运并拖动时间滑块或自动播放，图 5C（命运概率）与图 5G（形态动力学）上的游标将与当前培养时点实时联动；开启「三命运并排对比」可在同一时点横向对照三类结局，也可将当前检视状态导出为 JSON 记录。','Select a developmental fate and scrub or play across 48–96 h; time cursors move synchronously along the Fig. 5C (fate probability) and Fig. 5G (morphodynamics) curves. Toggle side-by-side comparison to inspect all three outcomes at the same culture hour, or export the current view metadata as JSON.')}</p></li><li><b>${t('studioAttribution')}</b><p>${bi('在 EHDPP、IDDPP 与 RGD 三种化学扰动间切换，点击任意通道可放大检视明场、Grad-CAM 与 p-MLC-II / DAPI 免疫荧光的空间共定位，并结合图 5F 查阅三个解剖区域的 nEF 定量分布。','Switch among EHDPP, IDDPP, and RGD perturbations and click any channel to enlarge brightfield, Grad-CAM, and p-MLC-II / DAPI immunofluorescence, alongside the regional nEF distributions in Fig. 5F.')}</p></li><li><b>${t('studioArchitecture')}</b><p>${bi('点击六个模型组件查阅阶段 1 与阶段 2 的潜空间维度、掩码加权与损失项权重，或在下方快速切换九种静态类器官亚型的真实与虚拟样本。','Select any of the six architecture modules to review latent dimensions, foreground mask weighting, and loss terms across Stages 1 and 2, or switch among the nine static subtypes below.')}</p></li></ol>`);
    return true;
  }
  if (b.dataset.condition) { condition = b.dataset.condition; renderAttribution(); main.querySelector(`[data-condition="${condition}"]`).focus({preventScroll:true}); return true; }
  if (b.dataset.module) { activeModule = b.dataset.module; renderArchitecture(); main.querySelector(`[data-module="${activeModule}"]`).focus({preventScroll:true}); return true; }
  if (b.dataset.channel) {
    const title = condition.toUpperCase()+' · '+t(b.dataset.channel);
    openInspection(title,`<img class="channel-detail" src="assets/attribution-${condition}-${b.dataset.channel}.png" alt="${title}"><p>Fig. 5B · p. 10</p>`); return true;
  }
  return false;
}
