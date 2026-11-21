'use strict';

(() => {
  const $ = selector=>document.querySelector(selector);
  const tr = (zh,en)=>language==='en'?en:zh;
  const acts = [
    {label:['项目介绍','Overview'],folio:'PROJECT OVERVIEW',title:['V3Cell','V3Cell'],sub:['',''],figure:['图 2 · 明场样本','Fig. 2 · Brightfield ROI'],link:'atlas'},
    {label:['静态表征','Static phenotypes'],folio:'STATIC PHENOTYPES',title:['两种来源，同一表型空间','Two sources, one phenotype space'],sub:['结肠、胃与肺类器官','Colon, stomach and lung organoids'],figure:['图 2 · 样本对照','Fig. 2 · Samples'],link:'atlas'},
    {label:['动态命运','Developmental fates'],folio:'DEVELOPMENTAL FATES',title:['同一起点，三种可能的命运','One starting point, three possible fates'],sub:['独立的羊膜囊类器官实验','Independent amniotic-sac organoid study'],figure:['图 5 · 时序轨迹','Fig. 5 · Trajectories'],link:'temporal'}
  ];
  // Stops are also direct links into the continuous scroll timeline.
  const nodes = [
    {id:'intro',act:0,p:.30,tab:['开场','Opening'],name:['从明场开始','Start in brightfield'],note:['开场取自图 2 的胃类器官明场图像。向下滚动，穿过字母 C，进入类器官的截面。','The opening image is a stomach organoid from Figure 2. Scroll through the letter C to explore the illustrated section.']},
    {id:'portal',act:0,p:1,tab:['穿越','Portal'],name:['穿过字母 C','Through the letter C'],note:['字形放大成观察窗口，一道切面划过组织，露出中央腔隙。','The wordmark opens into a window. A plane through the tissue reveals its central lumen.']},
    {id:'section',act:1,p:.14,tab:['切片','Section'],name:['在截面上取景','Frame a section'],note:['虚线标出概念模型的观察范围。静态研究以 64 × 64 像素的单类器官明场图像为单位。','The reticle frames an illustrative field of view. The static study uses 64 × 64 pixel brightfield images of individual organoids.']},
    {id:'observe',act:1,p:.34,tab:['观测','Observe'],name:['仪器记录真实样本','Observe real specimens'],note:['扫描线扫过后，显出图 2 中三个组织谱系的真实 ROI。轮廓、出芽与腔体都留下可见的形态差异。','The scan reveals real crops from the three tissue lineages in Figure 2. Buds, outlines and lumens distinguish their forms.']},
    {id:'generate',act:1,p:.58,tab:['生成','Generate'],name:['模型生成虚拟样本','Generate virtual specimens'],note:['R3GAN 以噪声和亚型标签生成独立样本。右侧展示图 2 中的虚拟表型示例，可与左侧同亚型的真实图像对照。','R3GAN samples from noise and a subtype label. The examples on the right come from Figure 2 and can be compared with real crops of the same subtype.']},
    {id:'embedding',act:1,p:.81,tab:['汇合','Compare'],name:['在表型空间中汇合','Meet in phenotype space'],note:['实心与空心标记在三个谱系内汇合，坐标为示意。F1 是仅用虚拟样本训练时的 Macro-F1，实测 UMAP 见图 3。','Filled and open points meet within each lineage. Positions are schematic. The scores are virtual-only training Macro-F1. Figure 3 contains the measured UMAP.']},
    {id:'loop',act:1,p:.98,tab:['闭环','Loop'],name:['两条路径合成一环','Close the loop'],note:['成像与生成沿两侧连回类器官，完成群体表型的对照。下一幕转入独立的羊膜囊类器官实验。','Imaging and generation reconnect around the organoid to compare population phenotypes. The next chapter moves to an independent amniotic-sac experiment.']},
    {id:'early',act:2,p:.14,tab:['观测','Observe'],name:['六帧共同的过去','Six early frames'],note:['将早期序列的前 6 帧交给模型。时间轴左侧六格是条件输入，右侧十九格是待推演的后续形态。','Six early frames condition the model. The first six positions are input, followed by nineteen rollout frames.']},
    {id:'perturb',act:2,p:.232,tab:['扰动','Perturb'],name:['读取早期命运线索','Read early fate cues'],note:['液滴示意实验中的化学扰动。分类器 ResNet-50 读取第 5 帧，根据早期形态判别命运。','The drop represents chemical perturbation in the experiment. ResNet-50 reads frame 5 to classify fate from early morphology.']},
    {id:'branch',act:2,p:.35,tab:['分叉','Branch'],name:['一个起点，三条分支','Three branches'],note:['沿三条分支，对照腔体形成、腔体塌陷和未形成腔体。每个真实样本只经历其中一种结局。','The branches compare formation, collapse and non-cavity outcomes. Each observed specimen follows one outcome.']},
    {id:'rollout',act:2,p:.83,tab:['推演','Rollout'],name:['推演第 7 至 25 帧','Roll out frames 7–25'],note:['在三种命运条件下，腔隙分别扩大、先扩大后塌陷，或逐渐消失。曲线与模型形变同步，示意腔隙面积的变化。','Under the three fate conditions, the lumen expands, expands then collapses, or disappears. The schematic area curves follow the illustrated shape changes.']},
    {id:'outcomes',act:2,p:1,tab:['终态','Outcomes'],name:['回到论文中的轨迹','Compare with the evidence'],note:['右侧缩略图取自图 5A 的虚拟轨迹末帧。r 是论文报告的真实与虚拟命运概率轨迹相关系数。','The endpoint crops are from the virtual sequences in Figure 5A. The reported r values are correlations between real and virtual fate-probability trajectories.']}
  ];
  const canvas = $('#plate');
  const copy = $('.intro-copy');
  const slider = $('.scrubber');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const art = createPreviewArt(canvas, invalidate, tr);
  const start = [0, 1.5, 4.5], length = [1.5, 3, 4], total = 8.5;
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  // Leave a short hold on the cutaway before crossing into the static study.
  function coordinate(node) {
    if (node.act === 0) return (node.p - .3) / .7 * 1.44;
    return start[node.act] + length[node.act] * node.p;
  }
  const stops = nodes.map(coordinate);
  let progress = 0, active = -1, pending = 0;
  let playing = false, autoAt = 0, autoFrom = 0, tween = null, drag = null;
  let openingAt = performance.now(), expectedScroll = null, lastDraw = '';
  let distance = 0;
  const initialURL = new URL(location.href);
  const nodeFromHash = () => Math.max(0, nodes.findIndex(n => '#'+n.id === location.hash));

  function sceneAt(value) {
    const act = value < start[1] ? 0 : value < start[2] ? 1 : 2;
    const p = act === 0 ? .3 + .7 * Math.min(1, value / 1.44) : (value-start[act])/length[act];
    const thresholds = [[0,.341], [0,.15,.35,.60,.85], [0,.15,.25,.35,.85]];
    const first = [0,2,7][act];
    return {act, p, index:first+thresholds[act].filter(v=>p+1e-6>=v).length-1};
  }
  function url(i) { return '#'+nodes[i].id; }
  function words(el, fragments) {
    el.replaceChildren(...fragments.map((word,i)=>{
      const span=document.createElement('span'); span.className='word';
      span.style.setProperty('--i',i); span.textContent=word; return span;
    }));
  }
  function labelButtons(selector, labels, attr) {
    const container = $(selector);
    container.replaceChildren(...labels.map(([value,name])=>{
      const button = document.createElement('button');
      button.type='button'; button.dataset[attr]=value; button.textContent=name; return button;
    }));
  }
  function mark(container, attribute, value) {
    for(const el of container.children) {
      if(el.dataset[attribute]===String(value)) el.setAttribute('aria-current','step');
      else el.removeAttribute('aria-current');
    }
  }
  function refresh(index, force=false) {
    if(active===index && !force) return;
    const node=nodes[index], chapter=acts[node.act], previous=nodes[active], isLast=index===nodes.length-1;
    active=index;
    document.documentElement.lang=tr('zh-CN','en');
    document.body.dataset.act=node.act;
    document.title='V3Cell · 3D · '+tr(...chapter.label);
    $('.brand').ariaLabel=tr('返回原首页','Return to homepage');
    $('.chapters').ariaLabel=tr('章节','Chapters'); $('.stops').ariaLabel=tr('本幕节点','Chapter steps');
    slider.ariaLabel=tr('动画进度','Animation progress');
    $('.lang').textContent=tr('EN','中文'); $('.lang').ariaLabel=tr('Switch to English','切换至中文');
    if(force || !previous) labelButtons('.chapters',acts.map((act,i)=>[i,tr(...act.label)]),'act');
    if(force || previous?.act!==node.act) {
      labelButtons('.stops',nodes.flatMap((n,i)=>n.act===node.act?[[i,tr(...n.tab)]]:[]),'stop');
      const title=tr(...chapter.title);
      words($('#scene-title'),language==='en' ? title.match(/\S+\s*/g) : title.split(/(?<=，)/));
      $('.scene-sub').textContent=tr(...chapter.sub);
      $('.index').textContent='0'+(node.act+1)+' / 03'; $('.folio').textContent=chapter.folio;
      words(copy.querySelector('h2'),language==='en'?['Vision-guided ','virtual 3D cells']:['视觉引导的','虚拟 3D 细胞']);
      copy.querySelector('p').textContent=tr('从单张明场图像辨识类器官表型，从连续影像追踪发育命运。','Read organoid phenotypes in a single brightfield image and follow developmental fates across a sequence.');
      const metrics=[[study.static.total,tr('静态 ROI','static ROIs')],[Object.values(study.static.lineages).reduce((n,l)=>n+l.classes,0),tr('类表型','phenotypes')],[Object.keys(study.dynamic.fates).length,tr('种命运','fates')]];
      $('.metrics').innerHTML=metrics.map(([n,label])=>'<span><strong data-value="'+n+'">'+n.toLocaleString('en-US')+'</strong>'+label+'</span>').join('');
    }
    mark($('.chapters'),'act',node.act); mark($('.stops'),'stop',index);
    const evidence=$('.evidence'), scatter=node.id==='embedding';
    evidence.querySelector('span').textContent=scatter?tr('图 3 · UMAP 原图','Fig. 3 · UMAP'):node.act===2?tr('图 5A · 虚拟轨迹','Fig. 5A · Virtual rollout'):tr(...chapter.figure);
    evidence.querySelector('img').src='assets/'+(scatter?'quality-umap':node.act===2?'trajectory-formation-6':'stomach-hollow-real-1')+'.png';
    evidence.href='index.html#results?tab='+(scatter?'quality':chapter.link);
    $('.stage-credit').textContent=tr('3D 形态示意 · 拖动旋转','3D illustration · Drag to rotate');
    const actions=$('.stage-actions'); actions.replaceChildren();
    if(isLast){
      for(const [title,dest] of [[tr('查看论文轨迹','View trajectories'),'results?tab=temporal'],[tr('进入工作台','Open workbench'),'workbench?tab=local']]){
        const a=document.createElement('a'); a.href='index.html#'+dest; a.textContent=title; actions.append(a);
      }
    }else{
      const b=document.createElement('button'); b.type='button'; b.textContent=tr('复位视角','Reset view'); b.onclick=art.reset; actions.append(b);
    }
    canvas.setAttribute('aria-label',tr(...node.name)+' · '+tr(...node.note));
    canvas.tabIndex=0;
    $('.node-index').textContent=String(index-[0,2,7][node.act]+1).padStart(2,'0');
    $('.caption h2').textContent=tr(...node.name); $('.caption p').textContent=tr(...node.note);
    $('#prev').ariaLabel=tr('上一节点','Previous step'); $('#next').ariaLabel=tr('下一节点','Next step');
    updatePlay();
  }
  function updatePlay(){
    const label=playing?tr('暂停','Pause'):progress>=total?tr('从头播放','Replay'):tr('播放全片','Play film');
    $('#play').setAttribute('aria-pressed',String(playing)); $('#play').ariaLabel=label;
    $('.play-label').textContent=label; $('.play-icon').textContent=playing?'Ⅱ':'▶';
  }
  function queue(){ if(!pending) pending=requestAnimationFrame(draw); }
  function invalidate(){lastDraw=''; queue();}
  function place(value, syncScroll=true){
    progress=clamp(value,0,total);
    if(syncScroll && distance>0 && !motion.matches){
      const pos=Math.round(distance*progress/total);
      if(Math.abs(window.scrollY-pos)>.5){expectedScroll=pos; window.scrollTo(0,pos);}
    }
  }
  function halt(){playing=false; tween=null; updatePlay();}
  function draw(now){
    pending=0;
    if(playing){
      place(autoFrom+(now-autoAt)/4400);
      if(progress===total) halt();
    }else if(tween){
      const t=clamp((now-tween.at)/tween.duration,0,1);
      place(tween.from+(tween.to-tween.from)*(t*t*(3-2*t)));
      if(t===1)tween=null;
    }
    const {act,p,index}=sceneAt(progress);
    const age=motion.matches?1:clamp((now-openingAt)/1550,0,1);
    refresh(index);
    const introAlpha=act===0?clamp(1-(p-.30)/.13,0,1):0;
    copy.hidden=introAlpha===0; copy.style.opacity=introAlpha;
    const staticP=motion.matches?nodes[index].p:p;
    const drawKey=[act,staticP,age].join('/');
    if(drawKey!==lastDraw || !playing && !tween){
      if(act>0 && p<.065 && !motion.matches){
        const fade=p/.065;
        art.draw(act-1,1,'3d',1,1-fade);
        art.draw(act,p,'3d',1,fade,false);
      }else art.draw(act,staticP,'3d',age);
      lastDraw=drawKey;
    }
    if(act===0 && (age<1 || $('.metrics').dataset.set!=='1')){
      for(const el of $('.metrics').querySelectorAll('[data-value]')) el.textContent=Math.round(Number(el.dataset.value)*(1-(1-age)**3)).toLocaleString('en-US');
      $('.metrics').dataset.set=age===1?'1':'0';
    }
    slider.value=Math.round(progress*1000);
    slider.style.setProperty('--played',progress/total*100+'%');
    slider.setAttribute('aria-valuetext',tr(...acts[act].label)+' · '+tr(...nodes[index].name));
    $('#prev').disabled=progress<.003; $('#next').textContent=progress>=total-.002?'↺':'→';
    $('#next').ariaLabel=progress>=total-.002?tr('从头重看','Replay from start'):tr('下一节点','Next step');
    if(playing||tween||age<1) queue();
  }
  function seek(value,animate=false){
    halt(); openingAt=-Infinity;
    if(animate && !motion.matches && Math.abs(progress-value)>.005){
      tween={from:progress,to:value,at:performance.now(),duration:clamp(Math.abs(value-progress)*730,440,1250)};
    }else place(value);
    queue();
  }
  function jump(i,origin='pushState'){
    if(i<0||i>=nodes.length)return;
    if(origin && location.hash!==url(i)) history[origin](null,'',url(i));
    seek(stops[i],true);
  }
  function move(direction){
    if(direction>0 && progress>=total-.002){jump(0);return;}
    const i=direction>0?stops.findIndex(s=>s>progress+.003):stops.findLastIndex(s=>s<progress-.003);
    jump(i<0?(direction>0?nodes.length-1:0):i);
  }
  function geometry(){
    const size=$('.page').getBoundingClientRect().height;
    distance=motion.matches?0:Math.max(1,Math.round(innerHeight*total));
    $('.scroll-track').style.height=distance? Math.max(size,innerHeight)+distance+'px':'auto';
    // On short viewports, allow scrolling the entire panel before pinning it.
    $('.page').style.top=Math.min(0,innerHeight-size)+'px';
    if(distance){distance=document.documentElement.scrollHeight-innerHeight;place(progress);}
    invalidate();
  }
  $('.chapters').onclick=e=>{const b=e.target.closest('[data-act]'); if(b) jump([0,2,7][Number(b.dataset.act)]);};
  $('.stops').onclick=e=>{const b=e.target.closest('[data-stop]'); if(b) jump(Number(b.dataset.stop));};
  $('.lang').onclick=()=>{language=tr('en','zh');try{localStorage.setItem('v3cell.language',language);}catch{}refresh(active,true);invalidate();};
  $('#prev').onclick=()=>move(-1); $('#next').onclick=()=>move(1);
  $('#play').onclick=()=>{
    if(playing){halt();return;}
    if(progress>=total-.002){place(0); openingAt=performance.now();}
    tween=null; playing=true; autoFrom=progress; autoAt=performance.now(); updatePlay(); queue();
  };
  slider.addEventListener('input',()=>seek(Number(slider.value)/1000));
  window.addEventListener('scroll',()=>{
    if(!distance || motion.matches) return;
    if(expectedScroll!==null && Math.abs(scrollY-expectedScroll)<1.5){expectedScroll=null;return;}
    expectedScroll=null; halt(); place(total*scrollY/distance,false); queue();
  },{passive:true});
  function restore(){
    seek(history.state?.position??stops[nodeFromHash()]); refresh(sceneAt(progress).index,true);
  }
  window.addEventListener('popstate',restore);
  window.addEventListener('hashchange',()=>{if(!tween)restore();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)halt();});
  addEventListener('keydown',e=>{
    if(e.altKey||e.ctrlKey||e.metaKey||e.target.matches('input,textarea,select'))return;
    if(e.target===canvas && e.key.startsWith('Arrow')){
      e.preventDefault(); art.orbit(({ArrowLeft:-.12,ArrowRight:.12})[e.key]||0,({ArrowUp:-.1,ArrowDown:.1})[e.key]||0); return;
    }
    if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();move(e.key==='ArrowLeft'?-1:1);}
  });
  canvas.addEventListener('pointerdown',e=>{
    if(!e.isPrimary||e.button!==0)return;
    drag={x:e.clientX,y:e.clientY,id:e.pointerId}; canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove',e=>{
    if(!drag||e.pointerId!==drag.id)return;
    art.orbit((e.clientX-drag.x)*.009,(e.clientY-drag.y)*.008);
    drag.x=e.clientX; drag.y=e.clientY;
  });
  canvas.addEventListener('lostpointercapture',()=>{drag=null;});
  canvas.addEventListener('pointerup',()=>{drag=null;});
  new ResizeObserver(geometry).observe($('.page'));
  window.addEventListener('resize',geometry);
  motion.addEventListener('change',()=>{halt();geometry();});
  history.scrollRestoration='manual';
  progress=stops[nodeFromHash()];
  if(initialURL.hash && progress>0)openingAt=-Infinity;
  refresh(sceneAt(progress).index,true); geometry();
})();
