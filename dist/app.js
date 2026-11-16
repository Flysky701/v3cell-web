'use strict';
const main = document.querySelector('main');
const lineageNames = {colon:'结肠', stomach:'胃', lung:'肺'};
const fates = {
  formation: {name:'腔体形成', en:'CAVITY FORMATION', description:'随培养时间推进，虚拟类器官呈现逐步形成的腔体结构。', color:'#9f81bc'},
  collapse: {name:'腔体塌陷', en:'CAVITY COLLAPSE', description:'观察腔体塌陷命运下的形态变化，以及不同培养时点的结构差异。', color:'#45958e'},
  noncavity: {name:'未形成腔体', en:'NON-CAVITY', description:'探索未形成腔体的发育命运，在时间轴上查看对应虚拟类器官的形态。', color:'#6e8aaa'}
};
let samples = [], selectedLineage = 'all', resultTab='atlas', fate='formation', frame=0, timer=null, cleanupArt=null, fileUrls=[];
const eye = text => `<div class="eyebrow"><span class="dot"></span>${text}</div>`;
const sampleImage = (lineage, kind='virtual', subtype=null) => samples.find(s => s.lineage===lineage && s.kind===kind && (!subtype || s.subtype===subtype))?.image || '';
const frameImage = (key,index) => `assets/trajectory-${key}-${index}.png`;
const figureButton = (file,title,caption,extra='') => `<button class="figure-preview ${extra}" data-figure="${file}" data-title="${title}" data-caption="${caption}"><img src="assets/${file}.png" alt="${title}" loading="lazy"><span>${title} <span aria-hidden="true">↗</span> 点击查看完整图示</span></button>`;
function home() {
 return `<section class="hero" aria-labelledby="hero-title">
  <div class="hero-copy">${eye('OBSERVE TODAY. EXPLORE TOMORROW.')}<h1 id="hero-title">From an image.<br>To a living<br><em>trajectory.</em></h1><p>从一幅明场图像出发，看见类器官的更多可能。<br>以视觉表型构建虚拟类器官，探索发育命运与扰动响应。</p><div class="actions"><a class="btn" href="#workbench">探索交互工作台 <span>↗</span></a><a class="text-link" href="#home-method">了解研究方法 ↓</a></div></div>
  <div class="hero-art"><canvas id="organoid-canvas" role="img" aria-label="类器官概念粒子可视化，非测量数据或三维重建"></canvas><span class="visual-label">THE ORGANISM, REIMAGINED.</span><div class="specimen s1"><img src="${sampleImage('lung','real')}" alt="论文中的肺类器官真实样本"><div>BRIGHTFIELD / OBSERVED<strong>从真实观察出发</strong><span>Figure 2 · Lung</span></div></div><div class="specimen s2"><img src="${sampleImage('colon')}" alt="论文中的结肠虚拟类器官样本"><div>VIRTUAL / CONSTRUCTED<strong>探索视觉表型</strong><span>Figure 2 · Colon</span></div></div><span class="visual-note">概念可视化 · 非测量数据或三维重建</span></div>
  <div class="hero-bottom"><div class="chapter"><b>01</b><i></i>FROM OBSERVATION TO POSSIBILITY</div><a href="#home-atlas" class="scroll-mark"><span>↓</span> SCROLL TO EXPLORE</a><span>V3CELL / RESEARCH PREVIEW</span></div>
 </section>
 <div class="facts"><div class="fact-intro">GROUNDED IN BRIGHTFIELD IMAGING<br>无标记 · 非破坏性 · 类器官尺度</div><div class="fact"><strong>03</strong><span>静态类器官谱系</span></div><div class="fact"><strong>09</strong><span>静态形态类别</span></div><div class="fact"><strong>06</strong><span>早期条件帧</span></div></div>
 <section class="section wrap" id="home-atlas"><div class="section-head"><div>${eye('01 / STATIC VIRTUAL ORGANOIDS')}<h2>Different forms.<br>One visual language.</h2></div><p>从结肠、胃到肺，保留各自的形态特征。<br>浏览论文中的真实样本与虚拟类器官，<br>理解无标记图像所承载的表型信息。</p></div><div class="lineage-grid">${[['colon','Colon','04 个形态类别'],['stomach','Stomach','03 个形态类别'],['lung','Lung','02 个形态类别']].map(([id,name,count],i)=>`<a class="lineage" href="#results?lineage=${id}"><div class="lineage-top"><h3>${name}<span>${lineageNames[id]}类器官</span></h3><span class="index">0${i+1} ↗</span></div><div class="sample-pair"><img src="${sampleImage(id,'real')}" alt="${lineageNames[id]}真实样本" loading="lazy"><span>→</span><img src="${sampleImage(id)}" alt="${lineageNames[id]}虚拟样本" loading="lazy"></div><div class="lineage-bottom"><span>${count}</span><span>REAL / VIRTUAL</span></div></a>`).join('')}</div><p class="provenance">图像来源：所提供论文 Figure 2。真实与虚拟图像为各类别的独立示例，并非同一个样本的重建前后对照。</p></section>
 <section class="section dark-section"><div class="wrap temporal-layout"><div>${eye('02 / DYNAMIC VIRTUAL ORGANOIDS')}<h2>A glimpse of today.<br>A window into tomorrow.</h2><p>从稀疏的早期观察中预测发育命运，再建模后续形态轨迹。动态研究使用独立的羊膜囊类器官数据，探索腔体形成、腔体塌陷与未形成腔体三类结局。</p><a class="text-link" href="#workbench">在时间轴中探索轨迹 ↗</a></div><div><div class="film-label"><span>VIRTUAL TRAJECTORY / 腔体形成</span><span>FIGURE 5A</span></div><div class="filmstrip">${[0,2,4,6].map(i=>`<figure><img src="${frameImage('formation',i)}" alt="培养 ${48+i*8} 小时的虚拟类器官" loading="lazy"><figcaption>${48+i*8} h</figcaption></figure>`).join('')}</div><div class="timeline-line">CULTURE TIME / 48—96 h</div><p class="provenance">论文展示帧回放，不是实时运行模型生成的结果。</p></div></div></section>
 <section class="section wrap" id="home-method"><div class="section-head"><div>${eye('03 / THE FRAMEWORK')}<h2>From possibility to evidence.</h2></div><p>两阶段建模，从静态表型到动态命运。<br>以明场图像为基础，无需组学分析或荧光标记。</p></div><div class="method-grid"><article><div class="num">01 / OBSERVE</div><h3>从完整类器官中观察</h3><p>使用明场显微成像，以单个类器官 ROI 为单位组织样本，保持非破坏性的观察方式。</p><div class="tags">BRIGHTFIELD · ROI</div></article><article><div class="num">02 / CONSTRUCT</div><h3>构建静态视觉表型</h3><p>以前景感知策略聚焦类器官形态，减少背景干扰，支持按谱系和形态类别构建虚拟样本。</p><div class="tags">FOREGROUND-AWARE · CLASS-CONDITIONED</div></article><article><div class="num">03 / FORECAST</div><h3>从早期观察预测命运</h3><p>先从早期图像预测发育命运，再以命运为条件建模后续图像平面上的形态演化。</p><div class="tags">FATE · TEMPORAL TRAJECTORY</div></article></div><div class="paper"><div class="paper-label">THE RESEARCH<br>MANUSCRIPT</div><div><h3>V3Cell: A Vision-Guided Virtual 3D Cell Framework for Phenotypic Modeling and Perturbation Prediction</h3><p>Lu You · Xun Deng · Chenke Xu · Jianying Hu · Pengwei Hu</p></div><button class="btn secondary" data-figure="framework" data-title="V3Cell 两阶段框架" data-caption="所提供论文 Figure 1，p.5。">查看方法图 ↗</button></div><p class="provenance">“Virtual 3D Cell”指三维类器官的计算替代体；本研究建模二维明场图像中的空间形态及其时间变化，不表示重建三维体积。本站为基础原型，尚未接入在线模型推理。</p></section>`;
}
function results() {
 return `<section class="wrap page-intro">${eye('RESEARCH / EVIDENCE & EXPLORATION')}<h1>让表型与轨迹，清晰可见。</h1><div class="intro-row"><p>浏览论文中的代表性样本、定量评估与发育轨迹。</p><span class="pill">MANUSCRIPT FIGURES · 研究展示</span></div></section><section class="wrap"><div class="result-stats"><div class="result-stat"><div class="stat-label">早期命运分类 · 准确率</div><strong>88.9<span style="font-size:20px">%</span></strong><p>36 个留出类器官，第 5 条件帧</p></div><div class="result-stat"><div class="stat-label">早期命运分类 · Macro-F1</div><strong>0.888</strong><p>对应相同留出评估设置</p></div><div class="result-stat"><div class="stat-label">静态表型 · 三种谱系</div><strong>3 / 9</strong><p>3 种谱系，9 个形态类别</p></div></div><div class="result-tabs" role="tablist" aria-label="结果分类">${[['atlas','静态表型图谱'],['phenotyping','表型分类评估'],['temporal','动态轨迹与验证']].map(([id,title])=>`<button class="tab-button" role="tab" id="tab-${id}" aria-controls="result-panel" aria-selected="${resultTab===id}" data-result-tab="${id}">${title}</button>`).join('')}</div><div id="result-panel" class="result-panel" role="tabpanel" aria-labelledby="tab-${resultTab}"></div></section>`;
}
function renderResultPanel(){
 const panel=document.querySelector('#result-panel'); if(!panel)return;
 panel.setAttribute('aria-labelledby',`tab-${resultTab}`);
 document.querySelectorAll('[data-result-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.resultTab===resultTab)));
 if(resultTab==='atlas'){
  const filtered=samples.filter(s=>s.kind==='real' && s.id.endsWith('-1') && (selectedLineage==='all'||s.lineage===selectedLineage));
  panel.innerHTML=`<p class="notice">以下图像提取自论文 Figure 2，保留真实 / 虚拟来源标记。每组为同类别的独立示例，不是成对重建结果。</p><div class="filters"><span class="filter-label">类器官谱系</span>${[['all','全部 · 9 类'],['colon','结肠 · 4 类'],['stomach','胃 · 3 类'],['lung','肺 · 2 类']].map(([id,label])=>`<button class="chip" data-lineage="${id}" aria-pressed="${selectedLineage===id}">${label}</button>`).join('')}</div><div class="pair-grid">${filtered.map(s=>`<article class="pair-card"><h3>${lineageNames[s.lineage]} · ${s.label}</h3><div class="sample-pair"><img src="${s.image}" alt="${s.label}真实样本"><img src="${sampleImage(s.lineage,'virtual',s.subtype)}" alt="${s.label}虚拟样本"></div><div class="legend"><span>真实 / REAL</span><span>虚拟 / VIRTUAL</span></div><div class="meta">FIGURE 2 · ${s.lineage.toUpperCase()}</div></article>`).join('')}</div><p class="provenance">样本为论文展示用的低分辨率 ROI；不代表完整数据集，也不用于新的定量测量。每类 4 个真实与 4 个虚拟样本的完整图示可在下方打开。</p><div style="max-width:470px;margin-top:25px">${figureButton('static-comparison','完整静态样本对照','所提供论文 Figure 2，p.6。9 类，各 4 个真实与 4 个虚拟样本。')}</div>`;
 } else if(resultTab==='phenotyping') {
  panel.innerHTML=`<p class="notice">以下指标来自论文 §2.3：每类 25 个真实训练样本，比较仅使用真实样本与加入 V3Cell 虚拟样本。这里展示原稿报告值。</p><div class="figure-layout">${figureButton('phenotyping','稀疏样本条件下的表型分类','所提供论文 Figure 4，p.9。阴影或误差线对应原图给定的随机种子评估。')}<div><table><caption class="sr-only">25 个真实样本每类的 F1-macro 比较</caption><thead><tr><th>谱系</th><th>仅真实样本</th><th>加入 V3Cell</th></tr></thead><tbody><tr><td>结肠</td><td>65.8%</td><td>87.8%</td></tr><tr><td>胃</td><td>59.4%</td><td>83.4%</td></tr><tr><td>肺</td><td>31.7%</td><td>76.4%</td></tr></tbody></table><p class="provenance">F1-macro；来源：所提供论文 p.8，§2.3。静态分类数据与动态命运预测数据是不同实验，不应合并解释。</p><a class="text-link" href="#workbench" style="display:inline-block;margin-top:24px">继续探索动态样本 ↗</a></div></div>`;
 } else {
  panel.innerHTML=`<p class="notice">动态实验使用独立的 hESC 来源羊膜囊类器官数据。所示 48–96 h 图像均为论文中的虚拟轨迹；不是原始观察序列。</p><div class="figure-layout">${figureButton('trajectories','发育命运、轨迹与归因验证','所提供论文 Figure 5，p.10。原稿中的占位注释按原样保留，图示不代表已完成发表版本。')}<div><table><caption class="sr-only">真实与虚拟平均命运概率轨迹的 Pearson 相关性</caption><thead><tr><th>发育命运</th><th>Pearson r</th></tr></thead><tbody><tr><td>腔体形成</td><td>0.705</td></tr><tr><td>腔体塌陷</td><td>0.912</td></tr><tr><td>未形成腔体</td><td>0.929</td></tr></tbody></table><p class="provenance">相关性针对真实与虚拟平均命运概率轨迹，不是逐像素图像相似度。来源：论文 §2.4，p.9。</p><a class="btn" href="#workbench" style="margin-top:24px">打开轨迹工作台 ↗</a></div></div>`;
 }
}
function workbench(){
 return `<section class="wrap page-intro workbench-intro">${eye('WORKBENCH / VIRTUAL ORGANOID EXPLORER')}<h1>在时间中，观察变化。</h1><div class="intro-row"><p>选择一种发育命运，逐帧探索论文中的虚拟类器官。</p><span class="pill">图示回放 · 未连接推理服务</span></div></section><section class="wrap"><div class="workspace"><aside class="sidebar"><h2>EXPERIMENT SETUP</h2><label class="field"><span>研究系统</span><select id="system-select"><option>羊膜囊类器官</option></select></label><label class="field"><span>发育命运</span><select id="fate-select">${Object.entries(fates).map(([id,f])=>`<option value="${id}" ${id===fate?'selected':''}>${f.name}</option>`).join('')}</select></label><p class="aside-note">样本来源：论文 Figure 5A<br>7 个展示时点 · 48–96 h<br>全部为 V3Cell 虚拟样本。</p><hr class="sidebar-divider"><label class="upload-box">＋ 本地图片预览<span>PNG / JPG / WEBP · 最多 6 张</span><input type="file" id="image-upload" accept="image/png,image/jpeg,image/webp" multiple aria-label="选择本地预览图片"></label><p class="aside-note">仅在当前浏览器预览，不上传、不运行预测。实际推理将在后续版本接入。</p><div id="upload-preview" class="upload-preview"></div><p id="upload-status" class="upload-status" role="status"></p><button class="btn secondary" id="reset-workbench">重置工作台 ↺</button></aside><div class="lab-main"><div class="lab-toolbar"><h2>Trajectory explorer</h2><span class="pill">● PAPER FIGURE REPLAY</span></div><div class="preview-stage"><div class="microscope"><span class="corner-label">VIRTUAL / FIG. 5A</span><img id="main-frame" src="${frameImage(fate,frame)}" alt=""><span id="frame-time" class="frame-time"></span></div><div class="frame-details"><div class="eyebrow" id="fate-en"></div><h3 id="fate-title"></h3><p id="fate-description"></p><div class="detail-list"><div><span>成像模态</span><b>Brightfield</b></div><div><span>图像来源</span><b>论文虚拟样本</b></div><div><span>展示时点</span><b id="frame-count"></b></div></div></div></div><div class="timeline-control"><button id="play" class="icon-button" aria-label="播放轨迹">▶</button><label for="time-slider" class="sr-only">培养时间</label><input type="range" id="time-slider" min="0" max="6" step="1" value="${frame}" aria-valuetext="${48+frame*8} 小时"><output id="time-output" for="time-slider"></output></div><div class="frame-strip">${Array.from({length:7},(_,i)=>`<button class="frame-button" data-frame="${i}" aria-label="查看 ${48+i*8} 小时" aria-pressed="${i===frame}"><img src="${frameImage(fate,i)}" alt=""><span>${48+i*8} h</span></button>`).join('')}</div><div class="lab-bottom"><p>图像摘自论文 Figure 5A，放大仅用于观察。时间轴回放不代表实时预测；未提供原始数据时，不计算新的面积或置信度。</p><button id="export-selection">导出当前浏览记录 ↓</button></div></div></div></section>`;
}
function stopPlayback(){if(timer){clearInterval(timer);timer=null;}const b=document.querySelector('#play');if(b){b.textContent='▶';b.setAttribute('aria-label','播放轨迹');}}
function updateFrame(){
 const image=document.querySelector('#main-frame');if(!image)return;
 const info=fates[fate],hour=48+frame*8;
 image.src=frameImage(fate,frame);image.alt=`论文虚拟类器官：${info.name}，培养 ${hour} 小时`;
 document.querySelector('#frame-time').textContent=`${hour} h / CULTURE TIME`;
 document.querySelector('#fate-en').textContent=info.en;
 document.querySelector('#fate-title').textContent=info.name;
 document.querySelector('#fate-description').textContent=info.description;
 document.querySelector('#frame-count').textContent=`0${frame+1} / 07`;
 document.querySelector('#time-output').textContent=`${hour} h`;
 document.querySelector('#time-slider').value=frame;
 document.querySelector('#time-slider').setAttribute('aria-valuetext',`${hour} 小时`);
 document.querySelectorAll('[data-frame]').forEach(b=>{const i=Number(b.dataset.frame);b.setAttribute('aria-pressed',String(i===frame));b.querySelector('img').src=frameImage(fate,i);});
}
function clearUploads(){fileUrls.forEach(URL.revokeObjectURL);fileUrls=[];}
function route(){
 const [path,query]=(location.hash.slice(1)||'home').split('?');
 if(path==='home-atlas'||path==='home-method'){
  if(!document.querySelector('#organoid-canvas')){main.innerHTML=home();createArt();}
  document.querySelector(`#${path}`)?.scrollIntoView();return;
 }
 stopPlayback();clearUploads();if(cleanupArt){cleanupArt();cleanupArt=null;}
 const page=['home','results','workbench'].includes(path)?path:'home';
 if(page==='results'){const v=new URLSearchParams(query).get('lineage');if(v&&Object.hasOwn(lineageNames,v)){selectedLineage=v;resultTab='atlas';}}
 main.innerHTML=page==='results'?results():page==='workbench'?workbench():home();
 document.querySelectorAll('[data-nav]').forEach(a=>{if(a.dataset.nav===page)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
 document.title=`${page==='results'?'研究结果':page==='workbench'?'交互工作台':'From images to living trajectories'} — V3Cell`;
 if(page==='results')renderResultPanel();if(page==='workbench')updateFrame();if(page==='home')createArt();window.scrollTo(0,0);
}
function showToast(message){const t=document.querySelector('#toast');t.textContent=message;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3000);}
main.addEventListener('click',e=>{
 const tab=e.target.closest('[data-result-tab]');if(tab){resultTab=tab.dataset.resultTab;renderResultPanel();}
 const chip=e.target.closest('[data-lineage]');if(chip){selectedLineage=chip.dataset.lineage;renderResultPanel();}
 const fb=e.target.closest('[data-frame]');if(fb){stopPlayback();frame=Number(fb.dataset.frame);updateFrame();}
 const figure=e.target.closest('[data-figure]');if(figure){document.querySelector('#figure-image').src=`assets/${figure.dataset.figure}.png`;document.querySelector('#figure-image').alt=figure.dataset.title;document.querySelector('#figure-title').textContent=figure.dataset.title;document.querySelector('#figure-caption').textContent=figure.dataset.caption;document.querySelector('#figure-dialog').showModal();}
 if(e.target.closest('#play')){if(timer){stopPlayback();}else{if(frame===6)frame=0;updateFrame();const b=document.querySelector('#play');b.textContent='Ⅱ';b.setAttribute('aria-label','暂停轨迹');timer=setInterval(()=>{frame++;updateFrame();if(frame===6)stopPlayback();},850);}}
 if(e.target.closest('#reset-workbench')){stopPlayback();clearUploads();fate='formation';frame=0;main.innerHTML=workbench();updateFrame();showToast('已重置为默认轨迹');}
 if(e.target.closest('#export-selection')){const record={mode:'manuscript-figure-replay',source:'main_nbe.pdf, Figure 5A, page 10',fate,phenotype:fates[fate].name,culture_time_hours:48+frame*8,frame_index:frame,asset:frameImage(fate,frame),live_inference:false};const url=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`v3cell-${fate}-${48+frame*8}h.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);showToast('浏览记录已导出');}
});
main.addEventListener('change',e=>{
 if(e.target.id==='fate-select'){stopPlayback();fate=e.target.value;frame=0;updateFrame();}
 if(e.target.id==='image-upload'){
  clearUploads();const preview=document.querySelector('#upload-preview');preview.replaceChildren();const files=Array.from(e.target.files||[]);const accepted=files.filter(f=>['image/png','image/jpeg','image/webp'].includes(f.type)&&f.size<=10*1024*1024).slice(0,6);
  accepted.forEach(f=>{const url=URL.createObjectURL(f);fileUrls.push(url);const image=document.createElement('img');image.src=url;image.alt=f.name;preview.appendChild(image);});
  document.querySelector('#upload-status').textContent=accepted.length?`已在本地预览 ${accepted.length} 张图片。${accepted.length<files.length?'仅保留前 6 张支持的图片，每张不超过 10 MB。':''}未运行预测。`:'请选择 PNG、JPG 或 WEBP 图片，每张不超过 10 MB。';
 }
});
main.addEventListener('input',e=>{if(e.target.id==='time-slider'){stopPlayback();frame=Number(e.target.value);updateFrame();}});
document.querySelector('#close-dialog').addEventListener('click',()=>document.querySelector('#figure-dialog').close());
document.querySelector('#figure-dialog').addEventListener('click',e=>{if(e.target===e.currentTarget)e.currentTarget.close();});
function createArt(){
 const canvas=document.querySelector('#organoid-canvas');if(!canvas)return;
 const ctx=canvas.getContext('2d');if(!ctx)return;
 const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 let width=0,height=0,raf=0,angle=.2;
 let seed=71;const random=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
 const points=Array.from({length:1450},(_,i)=>{const y=1-2*(i+.5)/1450;const a=i*Math.PI*(3-Math.sqrt(5));const r=Math.sqrt(1-y*y);const wobble=1+.075*Math.sin(a*5)*Math.cos(y*7);return{x:r*Math.cos(a)*wobble,y:y*wobble,z:r*Math.sin(a)*wobble,s:.5+random()*1.6,accent:random()>.985};});
 function resize(){const rect=canvas.getBoundingClientRect();width=rect.width;height=rect.height;const scale=Math.min(devicePixelRatio||1,2);canvas.width=width*scale;canvas.height=height*scale;ctx.setTransform(scale,0,0,scale,0,0);}
 const ro=new ResizeObserver(()=>{resize();if(reduce)draw();});ro.observe(canvas);
 function draw(){ctx.clearRect(0,0,width,height);const cx=width*.49,cy=height*.48,R=Math.min(width*.34,height*.36);const glow=ctx.createRadialGradient(cx,cy,0,cx,cy,R*1.5);glow.addColorStop(0,'rgba(159,190,157,.18)');glow.addColorStop(1,'rgba(159,190,157,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
  ctx.strokeStyle='#aebfad45';ctx.lineWidth=.6;for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(cx,cy,R*(1.2+i*.15),R*(.44+i*.12),-.4+i*.52,0,Math.PI*2);ctx.stroke();}
  const projected=points.map(p=>{const x=p.x*Math.cos(angle)-p.z*Math.sin(angle),z=p.x*Math.sin(angle)+p.z*Math.cos(angle);return {...p,px:cx+R*x,py:cy+R*(p.y*.92+z*.13),depth:z};}).sort((a,b)=>a.depth-b.depth);
  projected.forEach(p=>{const alpha=.16+(p.depth+1)*.28;ctx.beginPath();ctx.arc(p.px,p.py,p.s*(.65+(p.depth+1)*.24),0,Math.PI*2);ctx.fillStyle=p.accent?`rgba(165,156,76,${alpha})`:`rgba(41,116,99,${alpha})`;ctx.fill();});
  ctx.strokeStyle='#7ba49a80';ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(cx+R*.4,cy-R*.55);ctx.lineTo(cx+R*1.15,cy-R*.9);ctx.lineTo(cx+R*1.5,cy-R*.9);ctx.stroke();
  if(!reduce){angle+=.0017;raf=requestAnimationFrame(draw);}
 }
 resize();draw();cleanupArt=()=>{cancelAnimationFrame(raf);ro.disconnect();};
}
window.addEventListener('hashchange',route);
fetch('assets/samples.json').then(r=>{if(!r.ok)throw Error('样本资源未能载入');return r.json();}).then(data=>{samples=data;route();}).catch(()=>{main.innerHTML='<div class="load-error"><h1>样本资源暂时未能载入</h1><p>请刷新页面重试，或检查本地服务是否包含 assets/samples.json。</p><button class="btn" onclick="location.reload()">重新加载</button></div>';});
