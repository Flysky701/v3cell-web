'use strict';

(() => {
  const tr=(zh,en)=>language==='en'?en:zh;
  const copy={
    nav0:['截面','Section'],nav1:['表型','Phenotypes'],nav2:['命运','Fates'],
    title:['明场里的\n类器官','Organoids in\nbrightfield'],
    lead:['一张图像，辨识表型。\n一段序列，追踪发育命运。','A single image reveals a phenotype.\nA sequence traces a developmental fate.'],
    roi:['静态 ROI','static ROIs'],classes:['类表型','phenotypes'],fates:['种命运','fates'],playAll:['连播三幕','Play all chapters'],
    fig0:['从明场到截面','From image to section'],fig1:['观测与生成','Observe and generate'],fig3:['命运条件推演','Fate-conditioned rollout'],
    staticTitle:['两条路径，\n同一表型空间','Two paths,\none phenotype space'],
    staticLead:['显微镜记录真实类器官，模型按亚型生成虚拟样本。沿着两条路径，看结肠、胃与肺的形态如何在表型空间汇合。','Microscopy records real organoids. R3GAN generates virtual samples by subtype. Follow both paths into a shared phenotype space for colon, stomach and lung organoids.'],
    fig2:['图 2 · 真实与虚拟 ROI','Fig. 2 · Real and virtual ROIs'],umap:['查看图 3 的实测 UMAP','View the measured UMAP in Fig. 3'],
    fatesTitle:['一个起点，\n三种可能的命运','One starting point,\nthree possible fates'],
    fatesLead:['独立的羊膜囊类器官研究以六帧早期形态为输入，在命运条件下推演后续十九帧。分支展示三种可能，每个真实样本只经历一种结局。','In an independent amniotic-sac organoid study, six early frames condition a nineteen-frame rollout. The branches illustrate possible fates. Each observed specimen follows one outcome.'],
    fig5:['图 5A · 虚拟轨迹末帧','Fig. 5A · Virtual endpoints'],bench:['进入时序工作台','Open the trajectory workbench'],
    credit:['2D 形态与曲线为概念示意','Illustrated morphology and schematic curves'],top:['回到开头 ↑','Back to top ↑']
  };
  const beats=[
    [[0,'图 2 的胃类器官真实明场 ROI。','Real stomach organoid crop from Figure 2.'],[.16,'轮廓展开为二维上皮截面。','The outline opens into an epithelial section.'],[.28,'字形成为窗口，从 C 进入截面。','The wordmark opens into a window through the letter C.'],[.60,'扫描线穿过上皮与腔隙。','A scan line crosses the epithelium and lumen.'],[.83,'截面示意标出上皮层和中央腔隙。','The illustrated section marks the epithelium and central lumen.']],
    [[0,'先在截面上框出 64 × 64 ROI。','Frame a 64 × 64 field on the section.'],[.15,'仪器成像，显出真实 ROI。','Microscopy reveals the real crops.'],[.35,'R3GAN 按亚型生成虚拟样本。','R3GAN generates samples by subtype.'],[.60,'实心与空心代表真实和虚拟。点位为示意，F1 来自仅用虚拟样本训练的实验。','Filled and open points denote real and virtual samples. Positions are illustrative. F1 scores use virtual-only training.'],[.85,'两条路径闭合，完成群体表型对照。','The paths close a loop around the population comparison.']],
    [[0,'前六帧记录早期形态。','The first six frames capture early morphology.'],[.15,'液滴示意化学扰动，分类器读取第 5 帧。','A drop signifies perturbation. The classifier reads frame 5.'],[.25,'形成、塌陷或未形成腔体。','Three branches show formation, collapse or non-cavity.'],[.35,'从第 7 帧推演至第 25 帧，曲线示意腔隙随形态变化。','Frames 7–25 show the rollout. The curves illustrate changing lumen area.'],[.85,'末帧取自图 5A 的虚拟轨迹。r 为真实与虚拟命运概率轨迹相关系数。','Virtual endpoint crops are from Figure 5A. Reported r values compare real and virtual fate-probability trajectories.']]
  ];
  const medial=matchMedia('(prefers-reduced-motion: reduce)');
  const full=document.querySelector('#read-all');
  let reading=false, current=null, frame=0;
  const panels=[...document.querySelectorAll('.spread')].map((el,i)=>{
    const canvas=el.querySelector('canvas');
    const panel={i,el,canvas,progress:medial.matches?[1,.80,1][i]:0,started:false,dirty:true,lastBeat:-1,
      duration:[6700,10400,12800][i],play:el.querySelector('[data-play]'),slider:el.querySelector('input'),
      out:el.querySelector('output'),caption:el.querySelector('[data-step]')};
    panel.art=createPreviewArt(canvas,()=>{panel.dirty=true;queue();},tr);
    return panel;
  });
  function queue(){if(!frame)frame=requestAnimationFrame(draw);}
  function draw(now){
    frame=0;
    if(current){
      current.progress=Math.max(0,Math.min(1,current.from+(now-current.at)/current.duration));
      current.dirty=true;
    }
    for(const p of panels){
      if(!p.dirty)continue;
      p.dirty=false;
      p.art.draw(p.i,p.progress,'2d');
      p.slider.value=Math.round(p.progress*1000);
      p.out.textContent=Math.round(p.progress*100)+'%';
      const beat=beats[p.i].findLastIndex(b=>b[0]<=p.progress);
      if(beat!==p.lastBeat){
        const [,zh,en]=beats[p.i][beat];p.caption.textContent=tr(zh,en);
        p.canvas.setAttribute('aria-label',tr(zh,en));p.slider.setAttribute('aria-valuetext',tr(zh,en));
        p.lastBeat=beat;
      }
    }
    if(current?.progress===1){
      if(reading && current.i<2){
        start(panels[current.i+1],true,true);
      }else stop();
    }
    if(current)queue();
  }
  function controls(){
    full.querySelector('b').textContent=reading?tr('暂停连播','Pause film'):tr(...copy.playAll);
    full.querySelector('span').textContent=reading?'Ⅱ':'▶';full.setAttribute('aria-pressed',String(reading));
    for(const p of panels){
      p.play.textContent=p===current?tr('暂停','Pause'):p.progress>=1?tr('重播','Replay'):tr('播放','Play');
      p.play.ariaLabel=p.play.textContent+' · '+p.el.querySelector('.plate-title b').textContent;
      p.play.setAttribute('aria-pressed',String(p===current));
    }
  }
  function stop(){current=null;reading=false;controls();}
  function start(p,whole=false,restart=false){
    reading=whole;
    if(restart || p.progress>=1)p.progress=0;
    p.at=performance.now();p.from=p.progress;p.started=true;current=p;
    if(whole)p.el.scrollIntoView({block:'start',behavior:medial.matches?'instant':'smooth'});
    controls();queue();
  }
  function textContent(){
    document.documentElement.lang=tr('zh-CN','en');
    for(const el of document.querySelectorAll('[data-text]')){
      const parts=tr(...copy[el.dataset.text]).split('\n');
      el.replaceChildren();
      parts.forEach((part,i)=>{if(i){el.append(document.createElement('br'));if(language==='en')el.append(' ');}el.append(part);});
    }
    const lang=document.querySelector('#lang');lang.textContent=tr('EN','中文');lang.ariaLabel=tr('Switch to English','切换至中文');
    document.querySelector('nav').ariaLabel=tr('章节','Chapters');
    for(const p of panels){
      p.dirty=true;p.lastBeat=-1;p.slider.ariaLabel=p.el.querySelector('.plate-title b').textContent+' · '+tr('动画进度','Animation progress');
    }
    controls();queue();
  }
  for(const p of panels){
    p.play.onclick=()=>{if(current===p)stop();else start(p);};
    p.slider.oninput=()=>{stop();p.started=true;p.progress=Number(p.slider.value)/1000;p.dirty=true;controls();queue();};
  }
  full.onclick=()=>{if(reading)stop();else start(panels[0],true,true);};
  document.querySelector('#lang').onclick=()=>{language=tr('en','zh');try{localStorage.setItem('v3cell.language',language);}catch{}textContent();};
  const observer=new IntersectionObserver(entries=>{
    if(reading||medial.matches)return;
    for(const entry of entries){
      const p=panels.find(v=>v.canvas===entry.target);
      if(entry.intersectionRatio>=.56 && !p.started) start(p);
      else if(!entry.isIntersecting && current===p)stop();
    }
  },{threshold:[0,.56]});
  for(const p of panels){observer.observe(p.canvas);new ResizeObserver(()=>{p.dirty=true;queue();}).observe(p.canvas);}
  for(const event of ['wheel','touchmove'])window.addEventListener(event,()=>{if(reading)stop();},{passive:true});
  document.querySelector('nav').addEventListener('click',stop);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  medial.addEventListener('change',()=>{stop();if(medial.matches)panels.forEach((p,i)=>{p.progress=[1,.80,1][i];p.dirty=true;});queue();});
  document.querySelector('[data-total]').textContent=study.static.total.toLocaleString('en-US');
  document.querySelector('[data-classes]').textContent=Object.values(study.static.lineages).reduce((sum,item)=>sum+item.classes,0);
  document.querySelector('[data-fates]').textContent=Object.keys(study.dynamic.fates).length;
  textContent();
})();
