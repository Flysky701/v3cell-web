'use strict';

let qualityMode = 'distribution', phenotypeMode = 'scores', temporalMode = 'probability';
let focusedResult = 'atlas', singleResult = false, physicalBudget = 25;

function choiceButtons(attribute, choices, active) {
  return `<div class="choice-row">${choices.map(([id,label]) =>
    `<button class="chip" data-${attribute}="${id}" aria-pressed="${id === active}">${label}</button>`).join('')}</div>`;
}

function valueTable(headers, rows) {
  return `<div class="table-scroll"><table><thead><tr>${headers.map(h => `<th scope="col">${h}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(row => `<tr><th scope="row">${row[0]}</th>${row.slice(1).map(v => `<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function sourcePages(section, pages, figure) {
  return `<div class="source-links"><span>${bi('正文章节与原页','Manuscript')} · ${section}</span>
    ${pages.map(n => `<button data-source-page="${n}">${bi('第 '+n+' 页','p. '+n)} ↗</button>`).join('')}
    <button data-figure="${figure}">${t('readFigure')} ↗</button></div>`;
}

function resultDrawer(title, content) {
  return `<details class="values"><summary>${title}</summary><div>${content}</div></details>`;
}

function results() {
  return `<section class="wrap page-intro">${eye('resultsSection')}<h1>${msg('resultTitleNew')}</h1><p>${msg('resultsLead')}</p></section>
    <section class="wrap result-body"><nav class="evidence-nav" data-i18n-label="resultCategories">
    ${resultTabs.map((id,i) => `<a href="#results?tab=${id}" data-result-tab="${id}"><small>0${i+1}</small> ${msg(id)}</a>`).join('')}
    <button id="solo-result" class="chip"></button></nav>
    ${resultTabs.map((id,i) => `<section class="evidence-section" id="result-${id}"><div class="section-title"><span>0${i+1} / 04</span><h2>${msg(id)}</h2></div><div data-evidence="${id}"></div></section>`).join('')}</section>`;
}

function sampleGroup(subtype) {
  const group = samples.filter(s => s.subtype === subtype);
  return `<article class="sample-group"><h3>${t(subtype)}</h3><span class="specimen-lineage">${t(group[0].lineage)}</span>
    ${['real','virtual'].map(kind => `<div class="sample-row" data-kind="${kind}"><span>${t(kind)}</span>${group.filter(s => s.kind === kind).map((s,i) =>
      `<button data-sample="${s.id}" aria-label="${t(s.lineage)} · ${t(subtype)} · ${t(kind)} ${i+1}"><img loading="lazy" width="64" height="64" src="${s.image}" alt=""></button>`).join('')}</div>`).join('')}</article>`;
}

function atlasPanel() {
  const lineages = study.static.lineages;
  const group = selectedLineage === 'all' ? samples : samples.filter(s => s.lineage === selectedLineage);
  return `<p>${t('atlasNotice')}</p>${choiceButtons('lineage',['all',...Object.keys(lineages)].map(id => [id,t('filterCount',{name:t(id),count:id==='all'?9:lineages[id].classes})]),selectedLineage)}
    <div class="atlas-head"><strong>${bi('代表性 ROI','Displayed ROIs')} · ${group.length} / 72</strong><span>${bi('点击任意样本可放大对照同亚型的真实与虚拟实例','Select any ROI to compare real and virtual examples from that subtype')}</span></div>
    <div class="atlas-grid">${[...new Set(group.map(s => s.subtype))].map(sampleGroup).join('')}</div>
    ${resultDrawer(bi('查看静态数据集构成','View static dataset composition'),valueTable([t('lineage'),bi('静态 ROI 数','Static ROIs'),bi('形态亚型数','Morphological subtypes')],Object.entries(lineages).map(([id,d])=>[t(id),d.rois.toLocaleString('en-US'),d.classes]))+`<p>7,749 ROIs · 64 × 64 px · ${study.static.page}</p>`)}
    ${sourcePages('Fig. 2',[6],'static-comparison')}`;
}

function showSample(id) {
  const sample = samples.find(s => s.id === id);
  const group = samples.filter(s => s.subtype === sample.subtype);
  const title = t(sample.lineage)+' · '+t(sample.subtype);
  const ordinal = Number(id.split('-').at(-1));
  openInspection(title,`<div class="roi-comparison">${['real','virtual'].map(kind => {
    const items = group.filter(s => s.kind === kind);
    const initial = items[ordinal-1];
    return `<figure><figcaption>${t(kind+'SampleShort')}</figcaption><img width="64" height="64" src="${initial.image}" alt="${t(kind)} · ${title}"><div class="choice-row">${items.map((s,i) => `<button data-magnify="${s.image}" class="chip" aria-label="${t(kind)} ${i+1}" aria-pressed="${s === initial}">${i+1}</button>`).join('')}</div></figure>`;
  }).join('')}</div><p>${t('atlasNotice')}</p>`);
}

function qualityPanel() {
  const f = study.fidelity;
  const dimensions = {
    distribution: ['3A','IS / KID',bi('我们将 V3Cell 与六种主流生成基线（cGAN、F2DGAN、cVAE、LDM、DiT、Medfusion）进行了对比。在全部三种谱系中，V3Cell 均取得最高的 IS 与最低的 KID（较最优基线最多降低 2.7 倍）；其中结肠数据集 KID 低至 ','We benchmarked V3Cell against six leading generative baselines (cGAN, F2DGAN, cVAE, LDM, DiT, and Medfusion). Across all three lineages, V3Cell achieved the highest IS and lowest KID (reducing KID by up to 2.7-fold relative to the best baseline); on the colon dataset, KID reached ')+f.colonKid+bi('，落入真实样本的类内变异范围内。','—within the intra-class variability observed among real organoids.')],
    texture: ['3C','Haralick',bi('由于群体分布指标无法直接衡量区分不同亚型的细粒度微纹理，我们在类器官前景内计算了五项 Haralick 灰度共生纹理描述符。鉴于样本量较大，我们以效应量而非单纯 p 值衡量实际差异：绝大多数指标与亚型的真实—虚拟差异均满足 |d| < 0.2，Q-Q 图也紧贴恒等线。','Because distributional metrics do not directly assess fine-grained micro-textural properties that distinguish subtypes, we quantified five Haralick texture descriptors within the organoid foreground. Focusing on effect size rather than p-values alone given the large sample sizes, Cohen’s |d| remained below 0.2 across most metrics and subtypes, with Q-Q plots tightly aligned to the identity line.')],
    morphometry: ['3E–F',bi('谱系特异发育标志','Lineage-specific developmental hallmarks'),bi('为验证生物学层面的结构保真度，我们定量比对了各谱系的关键发育标志：结肠出芽不透明亚型的出芽数（隐窝形成的涌现特征）及胃凋亡亚型的椭圆度与真实分布均无显著差异，仅面向类器官前景的训练策略有效保留了主体几何特征；肺有腔亚型的腔面面积与真实观测高度一致，残差在效应量上可忽略（p = 0.033，d = −0.27 ± 0.05）。','To verify biological fidelity at the ROI level, we evaluated lineage-specific developmental hallmarks: colon budding opaque organoids reproduced the real bud-number distribution (an emergent hallmark of crypt formation) with no significant difference, stomach apoptotic organoids matched real ellipticity distributions, and lung lumen organoids closely aligned in lumen area with only a negligible residual effect size (p = 0.033, d = −0.27 ± 0.05).')],
    umap: ['3D','UMAP',bi('我们将类器官特异编码器提取的高维特征向量投影至统一的 UMAP 表型空间。在全部三种谱系中，V3Cell 构建的虚拟 3D 细胞群体均嵌入并与对应真实样本流形广泛重叠，覆盖了完整的真实表型流形且未见明显模式坍塌（mode collapse）。','We projected high-dimensional feature vectors from our organoid-specific encoder into a unified UMAP phenotypic landscape. Across all three lineages, V3Cell-constructed virtual 3D cell populations were embedded within and overlapped extensively with their real counterparts, demonstrating broad coverage of the real phenotypic manifold without gross mode collapse.')]
  };
  const qualitySizes = {distribution:[1408,478], texture:[1414,404], morphometry:[1868,340], umap:[430,404]};
  const [panel,title,detail] = dimensions[qualityMode];
  const [qw, qh] = qualitySizes[qualityMode];
  const rows = [
    [bi('结肠数据集 KID','Colon dataset KID'),f.colonKid],
    [bi('三谱系相对最优基线的最大 KID 降幅','Max KID reduction vs. best baseline across lineages'),'2.7×'],
    [bi('对比生成基线','Evaluated baselines'),f.baselines.join(' · ')],
    [bi('Haralick 微纹理描述符','Haralick texture descriptors'),f.haralick.join(' · ')],
    [bi('小效应量判据（实际差异可忽略）','Small effect-size threshold'),'|d| < '+f.negligibleD],
    [t('colon')+' · '+t('buds'),bi('与真实分布无显著差异（ns）','No significant difference vs. real (ns)')],
    [t('lung')+' · '+t('lumenArea'),'p = '+f.lungP+', d = '+f.lungD+bi('（效应量可忽略）',' (negligible effect size)')],
    [t('stomach')+' · '+t('ellipticity'),bi('与真实分布无显著差异（ns）','No significant difference vs. real (ns)')]
  ];
  return `${choiceButtons('quality-mode',Object.keys(dimensions).map(id => [id,t(id)]),qualityMode)}
    <div class="dimension-card"><button class="panel-image" data-figure="quality" aria-label="${t('openFigure')}"><img loading="lazy" width="${qw}" height="${qh}" src="assets/quality-${qualityMode}.png" alt="${title} · Fig. ${panel}"></button><div><span class="section-ref">Fig. ${panel}</span><h3>${title}</h3><p>${detail}</p></div></div>
    ${resultDrawer(bi('展开定量评估指标与效应量汇总','View quantitative metrics & effect sizes'),valueTable([bi('评估维度','Evaluation metric'),bi('实验结果','Result')],rows))}
    ${sourcePages('§2.2 · Fig. 3',[5,6,7],'quality')}`;
}

// Virtual only, real only, and augmented. Keep these roles fixed in the two-series view.
const barColors = ['#7472a8','#327b88','#455eaa'];
function barChart(groups, series, max, suffix, title) {
  // Use the same zero baseline for every group. Text values are also available in the table.
  const colors = series.length === 1 ? ['var(--accent)'] : barColors.slice(-series.length);
  const row = 25, block = series.length*row+36;
  const height = groups.length*block+42;
  const axisX = 29, plotWidth = 447;
  const grid = [0,.25,.5,.75,1].map(f => `<line x1="${axisX+f*plotWidth}" x2="${axisX+f*plotWidth}" y1="23" y2="${height-7}" stroke="var(--line)"/><text x="${axisX+f*plotWidth}" y="15" text-anchor="middle">${Number((f*max).toFixed(2))}${suffix}</text>`).join('');
  const groupsSvg = groups.map(([label,values],g) => {
    const start = 34+g*block;
    return `<text x="${axisX}" y="${start+6}" class="group-label">${label}</text>`+values.map((value,i) => {
      const width = value/max*plotWidth, y = start+16+i*row;
      const caption = Number.isInteger(value) ? value : String(Number(value.toFixed(3)));
      return `<g><title>${label} · ${series[i]} · ${caption}${suffix}</title><rect x="${axisX}" y="${y}" width="${width}" height="14" rx="2" fill="${colors[i]}"/><text x="${axisX+width+5}" y="${y+12}">${caption}${suffix}</text></g>`;
    }).join('');
  }).join('');
  return `<div class="chart"><h3>${title}</h3><div class="chart-legend">${series.map((s,i)=>`<span><i style="background:${colors[i]}"></i>${s}</span>`).join('')}</div>
    <svg role="img" aria-label="${title}" viewBox="0 0 540 ${height}">${grid}${groupsSvg}</svg></div>`;
}

function budgetChart() {
  // Figure 4A uses categorical x positions for N=0,10,25,50. Mark only printed x positions.
  const panels = [
    {id:'colon',left:38,ticks:[178,219,260]},
    {id:'stomach',left:320,ticks:[460,501,543]},
    {id:'lung',left:602,ticks:[742,783,824]}
  ];
  const budgets = study.phenotyping.budgets;
  const index = budgets.indexOf(physicalBudget);
  return `<div class="budget-chart"><h3>${bi('每类物理训练样本预算（图 4A）','Physical training samples per class (Fig. 4A)')}</h3>
    ${choiceButtons('budget',budgets.map(n=>[String(n),'N = '+n]),String(physicalBudget))}
    <div class="budget-panels">${panels.map(p=>`<figure><figcaption>${t(p.id)} · N = ${physicalBudget}</figcaption>
      <svg viewBox="${p.left} 26 264 229" role="img" aria-label="${t(p.id)} · Fig. 4A · N = ${physicalBudget}">
      <image href="assets/phenotyping.png" width="943" height="483"/><line x1="${p.ticks[index]}" x2="${p.ticks[index]}" y1="37" y2="211" stroke="var(--cursor)" stroke-width="1.6" stroke-dasharray="3 3"/></svg></figure>`).join('')}</div>
    <p>${bi('纵向虚线标示所选的每类物理样本数 N。折线与阴影区域对应图 4A 中 n = 5 个独立随机种子的均值 ± 1 标准差。','The vertical dashed line marks the selected physical budget N per class. Curves and shaded bands show means ± 1 s.d. across n = 5 independent random seeds from Fig. 4A.')}</p></div>`;
}

function phenotypePanel() {
  const p = study.phenotyping;
  const series = [bi('仅虚拟样本 · N=0','Virtual only · N=0'),bi('仅物理样本 · N=25','Real only · N=25'),bi('物理＋V3Cell 增强 · N=25','Real + V3Cell · N=25')];
  const rows = Object.entries(p.scores);
  const sdTitle = bi('肺类器官分类器跨运行标准差（N=25）','Lung classifier inter-run standard deviation (N=25)');
  const chart = phenotypeMode === 'scores' ?
    barChart(rows.map(([id,s])=>[t(id),[Math.round(s.virtual*100),s.real,s.augmented]]),series,100,'%','Macro-F1') :
    barChart([[t('lung'),p.lungSD]],series.slice(1),20,'%',sdTitle);
  return `${choiceButtons('phenotype-mode',[['scores','Macro-F1'],['variability',bi('跨种子稳定性','Inter-run stability')],['budgets',bi('10 / 25 / 50 张样本预算','10 / 25 / 50 sample budgets')]],phenotypeMode)}
    ${phenotypeMode === 'budgets' ? budgetChart() : `<div class="chart-layout">${chart}<aside class="finding"><span class="section-ref">Fig. 4B–C</span><strong>${phenotypeMode==='scores'?'+44.7 pp':'15.9% → 1.3%'}</strong>
    <p>${phenotypeMode==='scores' ? bi('当每类仅依赖 25 个物理样本时，分类性能明显退化；引入 V3Cell 虚拟 3D 细胞使三谱系分别恢复 +22.0、+24.1 和 +44.7 个百分点，其中肺谱系的恢复最为显著。','Relying solely on 25 physical samples per class degraded F1-macro; augmenting with V3Cell virtual 3D cells restored performance by +22.0, +24.1, and +44.7 percentage points, with the most pronounced recovery in lung.') : bi('在共享相同物理训练划分的配对实验中，加入虚拟 3D 细胞将肺分类器的跨种子标准差从 15.9% 降至 1.3%，显著稳定了稀疏采样下的表型决策边界。','Across paired runs sharing identical physical training splits, incorporating virtual 3D cells reduced inter-run standard deviation in lung from 15.9% to 1.3%, stabilizing phenotypic decision boundaries under sparse sampling.')}</p></aside></div>`}
    ${resultDrawer(bi('展开分类性能表与实验设计细节','View classification scores & experimental protocol'),valueTable([t('lineage'),...series,bi('恢复增益','Gain')],rows.map(([id,s])=>[t(id),s.virtual.toFixed(2),s.real+'%',s.augmented+'%','+'+s.gain.toFixed(1)+' pp']))+
    `<p>${bi('在完全不使用任何物理样本（N = 0，仅用 V3Cell 虚拟 3D 细胞训练）的设置下，分类器在结肠、胃与肺上已分别达到 0.86、0.78 和 0.82 的 Macro-F1（表中以小数列出，柱状图换算为百分比）。胃谱系 +24.1 pp 的增益依据未舍入前原始均值计算。','Trained exclusively on V3Cell virtual 3D cells without any physical samples (N = 0), classifiers achieved F1-macro scores of 0.86 in colon, 0.78 in stomach, and 0.82 in lung (shown as decimals in the table and percentages in the chart). The +24.1 pp stomach gain reflects unrounded intermediate means.')}</p><p>${bi('我们在每类 10、25、50 张物理样本三种低资源区间内，系统对比了仅物理样本（Real Only）、常规图像增强（Real + StdAug）与 V3Cell 虚拟增强（Real + V3Cell），并在固定的 10% 分层真实测试集上跨越 n = 5 个独立随机种子评估。','Across low-resource regimes of 10, 25, and 50 physical images per class, we compared Real Only, standard augmentation (Real + StdAug), and V3Cell augmentation (Real + V3Cell) on a fixed stratified 10% real test set across n = 5 random seeds.')} ${sdTitle} · 15.9% → 1.3%.</p>`)}
    ${sourcePages('§2.3 · Fig. 4',[8,9],'phenotyping')}`;
}

function attributionNote() {
  return bi('我们在 §2.4 中通过区域归一化能量占比（nEF）定量证实，腔体形成 logit 的 Grad-CAM 归因显著富集于羊膜外胚层上皮环（nEF > 1），而在背景区域受到抑制（nEF < 1）。注：正文第 11 页写明腔体与背景均低于均匀基线 1，而图 5F 中腔体一栏的均值标记绘于虚线 1 上方，此处保留两处原始呈现以供对照。','In §2.4 we quantified regional attribution via Normalized Energy Fraction (nEF), confirming significant enrichment in the amniotic ectodermal epithelial ring (nEF > 1) and suppression in background (nEF < 1). Note: page 11 text states that both background and cavity lie below the uniform baseline of 1, whereas the central marker for Cavity in Fig. 5F is plotted above 1; both are preserved here for reference.');
}

function temporalPanel() {
  const d = study.dynamic, ids = ['noncavity','collapse','formation'];
  const probability = temporalMode === 'probability';
  const rows = ids.map(id => [t(id),d.fates[id].probability.toFixed(3),t(d.fates[id].metric),d.fates[id].morphometry.toFixed(3)]);
  const chart = barChart(ids.map(id => [t(id)+(probability?'':' · '+t(d.fates[id].metric)),[d.fates[id][probability?'probability':'morphometry']]]),['Pearson r'],1,'',t(probability?'probability':'morphometric'));
  return `<p>${t('dynamicNotice')}</p>${choiceButtons('temporal-mode',[['probability',t('probability')],['morphometric',t('morphometric')]],temporalMode)}
    <div class="chart-layout">${chart}<aside class="finding"><span class="section-ref">§2.4 · Fig. 5</span><strong>${d.accuracy}%</strong><p>${t('heldOut')} · Macro-F1 ${d.macroF1}</p><a class="text-link" href="#workbench">${t('openWorkbench')} ↗</a></aside></div>
    ${resultDrawer(bi('展开时序保真度与数据划分详情','View temporal fidelity & dataset split details'),valueTable([t('developmentalFate'),t('probability')+' r',t('morphometric'), 'Pearson r'],rows)+
    valueTable([bi('数据集划分','Dataset split'),...fateIds.map(tKey => t(tKey))],[[bi('训练序列','Training sequences')+' (245)',...fateIds.map(id=>d.fates[id].train)],[bi('留出测试序列','Held-out sequences')+' (36)',12,12,12]])+
    `<p>${bi('每条原始延时序列含 196 帧，等距重采样为 25 帧（256 × 256 px）。前 6 帧作为早期条件输入，命运分类器仅读取交叉验证选出的第 5 帧（k* = 4），预测出的命运标签作为唯一类别信号传入轨迹生成器。无论是命运概率轨迹（图 5C）还是命运特异形态学轨迹（图 5G），虚拟均值曲线均与真实观测高度对齐；其中腔体形成类的相关性相对温和（r = 0.705 / 0.752），与该命运本身较高的内生生物变异性一致。','Each raw 196-frame sequence was uniformly resampled to 25 frames at 256 × 256 px. Six early frames provide conditioning, while the fate classifier reads only the fifth frame (k* = 4) to supply the sole categorical signal to the trajectory generator. Virtual mean trajectories closely tracked real observations in both fate probability (Fig. 5C) and morphodynamics (Fig. 5G), with moderate correlation in cavity formation (r = 0.705 / 0.752) reflecting its higher intrinsic biological variability.')}</p><p>${attributionNote()}</p><a class="text-link" href="#workbench?tab=attribution">${t('studioAttribution')} ↗</a>`)}
    ${sourcePages('§2.4 · Fig. 5',[9,10,11],'trajectories')}`;
}

const evidencePanels = {atlas:atlasPanel,quality:qualityPanel,phenotyping:phenotypePanel,temporal:temporalPanel};
function refreshPanel(id) {
  const host = main.querySelector(`[data-evidence="${id}"]`);
  const expanded = host.querySelector('details')?.open;
  host.innerHTML = evidencePanels[id]();
  if (expanded) host.querySelector('details').open = true;
}
function applyResultSelection() {
  for (const id of resultTabs) {
    document.getElementById('result-'+id).hidden = singleResult && id !== focusedResult;
    const link = main.querySelector(`[data-result-tab="${id}"]`);
    if (id === focusedResult) link.setAttribute('aria-current','location');
    else link.removeAttribute('aria-current');
  }
  const toggle = document.querySelector('#solo-result');
  toggle.setAttribute('aria-pressed',String(singleResult));
  toggle.textContent = singleResult ? bi('显示全部章节','Show all sections') : bi('只看当前章节','Isolate section');
}
function refreshEvidence() {
  resultTabs.forEach(refreshPanel);
  applyResultSelection();
}
function handleEvidenceClick(target) {
  const button = target.closest('button');
  if (!button) return false;
  const d = button.dataset;
  if (d.sample) { showSample(d.sample); return true; }
  if (d.sourcePage) {
    const title = bi('手稿原页 · 第 '+d.sourcePage+' 页','Manuscript · page '+d.sourcePage);
    openInspection(title,`<img class="source-page" width="1191" height="1684" src="assets/source-p${d.sourcePage}.png" alt="${title}">`);
    return true;
  }
  if (button.id === 'solo-result') { singleResult = !singleResult; applyResultSelection(); document.getElementById('result-'+focusedResult).scrollIntoView(); return true; }
  let section;
  if (d.lineage) { selectedLineage = d.lineage; section = 'atlas'; }
  if (d.qualityMode) { qualityMode = d.qualityMode; section = 'quality'; }
  if (d.budget) { physicalBudget = Number(d.budget); section = 'phenotyping'; }
  if (d.phenotypeMode) { phenotypeMode = d.phenotypeMode; section = 'phenotyping'; }
  if (d.temporalMode) { temporalMode = d.temporalMode; section = 'temporal'; }
  if (!section) return false;
  refreshPanel(section);
  const attr = [...button.attributes].find(a => a.name.startsWith('data-'));
  document.querySelector(`[${attr.name}="${attr.value}"]`).focus({preventScroll:true});
  return true;
}
