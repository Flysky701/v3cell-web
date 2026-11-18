'use strict';

const unit = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t = unit(value); return t*t*(3-2*t); };
const mix = (from, to, amount) => from + (to-from)*amount;
const formWeights = index => shapes.map((_, i) => Number(i === index));

function mountHomeStory(hero) {
  const sections = [...hero.querySelectorAll('[data-chapter]')];
  const nav = document.querySelector('.home-chapters');
  const links = [...nav.querySelectorAll('a')];
  const progress = nav.querySelector('.home-progress');
  const fate = sections[2];
  const panel = fate.querySelector('.chapter-panel');
  const stops = [...fate.querySelector('.fate-stops').children];
  const steps = [...fate.querySelectorAll('[data-fate-step]')];
  const lifetime = new AbortController();
  const options = {signal:lifetime.signal};
  let model, active = -1, lastScrollPhase = -1;
  function getModel() {
    model ??= createOrganoidStructure(() => viewers.forEach(viewer => viewer.redraw()));
    return model;
  }
  const viewers = sections.map(section => mountOrganoidViewer(section, getModel));

  function syncScroll() {
    const readingLine = innerHeight / 2;
    const current = sections.reduce((index, section, i) => section.getBoundingClientRect().top <= readingLine ? i : index, 0);
    if (current !== active) {
      active = current;
      links.forEach((link,i) => {
        if (i === active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }
    if (active === 2) {
      const top = fate.getBoundingClientRect().top;
      const travel = fate.offsetHeight - Math.min(panel.offsetHeight, innerHeight);
      const phase = Math.round(unit(-top/Math.max(1,travel)) * (steps.length-1));
      if (phase !== lastScrollPhase) { lastScrollPhase = phase; viewers[2].setPhase(phase); }
    } else lastScrollPhase = -1;
    const length = document.documentElement.scrollHeight-innerHeight;
    progress.textContent = Math.round(100*unit(scrollY/Math.max(1,length)))+'%';
  }
  function fitPanels() {
    hero.style.setProperty('--intro-header',header.offsetHeight+'px');
    // Oversized panels need their entire natural scroll range for reading or zoom.
    fate.classList.toggle('phase-track',panel.offsetHeight <= innerHeight+1);
    syncScroll();
  }
  steps.forEach((step,i) => step.addEventListener('click',() => {
    if (fate.classList.contains('phase-track')) stops[i].scrollIntoView({block:'start'});
    else viewers[2].setPhase(i);
  },options));
  const sizes = new ResizeObserver(fitPanels);
  sizes.observe(header); sizes.observe(panel);
  const ambient = new IntersectionObserver(([entry]) => hero.classList.toggle('ambient-visible',entry.isIntersecting));
  ambient.observe(hero);
  fitPanels();
  window.addEventListener('resize',fitPanels,options);
  window.addEventListener('scroll',syncScroll,{...options,passive:true});
  return () => {
    lifetime.abort(); sizes.disconnect(); ambient.disconnect();
    viewers.forEach(viewer => viewer.dispose());
  };
}

function mountOrganoidViewer(section, getModel) {
  const root = section.querySelector('.organoid-viewer');
  const chapter = Number(section.dataset.chapter);
  const scene = root.querySelector('.organoid-scene');
  const plate = scene.querySelector('.structure-plate');
  const canvas = plate.querySelector('canvas');
  const context = canvas.getContext('2d');
  const caption = root.querySelector('.structure-caption');
  const controls = root.querySelector('.shape-controls');
  const shapeButtons = [...root.querySelectorAll('[data-shape]')];
  const viewButtons = [...plate.querySelectorAll('[data-structure-view]')];
  const sectionSwitch = plate.querySelector('.section-switch');
  const rotation = plate.querySelector('.rotation-toggle');
  const notes = plate.querySelector('.annotation-toggle');
  const labels = [...plate.querySelectorAll('[data-anatomy]')];
  const nodes = [...plate.querySelectorAll('.lineage-node')];
  const instructions = root.querySelector('#organoid-instructions');
  const expand = root.querySelector('.organoid-expand');
  const dialog = root.querySelector('dialog');
  const steps = [...section.querySelectorAll('[data-fate-step]')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const lifetime = new AbortController();
  const options = {signal:lifetime.signal};
  const anatomy = [['cutOutline','cutMass'], ['cutOutline','cutBud'], ['cutWall','cutLumen'], ['cutWall','cutSlit']];
  const stepCaptions = ['beforeCaption', 'afterCaption', 'evolutionCaption'];
  const cavityNarrowing = [0, .45, 1];
  const initialYaw = .64, initialPitch = .26;
  let yaw = initialYaw, pitch = initialPitch, zoom = 1, drag;
  let width = 0, height = 0, inView = false, frame = 0, timer = 0;
  let previousDraw = 0, resumeAt = 0, direction = 1, rotating = true;
  let shape = 2, cutaway = true, annotated = false, phase = 0;
  let weights = formWeights(shape), opening = 1, scale = 1;
  let startPose, changedAt = 0, enteredAt = 0;

  function setText(node, key) {
    node.dataset.i18n = key;
    node.textContent = t(key);
  }
  function describe() {
    const intro = chapter === 0, atlas = chapter === 1;
    const id = shapes[shape];
    setText(plate.querySelector('[data-scene-kind]'), atlas ? 'atlasExample' : intro ? 'structureModel' : 'fateLegend');
    setText(plate.querySelector('[data-active-shape]'), atlas ? 'atlasChapter' : intro ? id : fateSteps[phase]);
    setText(caption, atlas ? 'atlasLegend' : intro ? id+(cutaway ? 'Cut' : 'Surface') : stepCaptions[phase]);
    const canvasKey = atlas ? 'atlasCanvas' : intro ? 'organoidCanvasLabel' : 'fateCanvas';
    canvas.dataset.i18nLabel = canvasKey;
    canvas.setAttribute('aria-label', t(canvasKey));
    canvas.tabIndex = intro && context ? 0 : -1;
    root.dataset.phase = phase;
    plate.dataset.form = id;
    for (const [i, button] of steps.entries()) button.setAttribute('aria-pressed', String(i === phase));
    if (!intro) return;
    controls.hidden = sectionSwitch.hidden = notes.hidden = rotation.hidden = expand.hidden = instructions.hidden = !context;
    plate.classList.toggle('show-notes', annotated);
    for (const [i, button] of shapeButtons.entries()) button.setAttribute('aria-pressed', String(i === shape));
    for (const button of viewButtons) button.setAttribute('aria-pressed', String((button.dataset.structureView === 'cut') === cutaway));
    notes.setAttribute('aria-pressed', String(annotated));
    setText(labels[0], cutaway ? anatomy[shape][0] : 'outerSurface');
    setText(labels[1], anatomy[shape][1]);
    labels[0].dataset.feature = cutaway && shape >= 2 ? 'tissue' : 'surface';
    labels[1].dataset.feature = shape === 1 ? 'surface' : shape >= 2 ? 'lumen' : 'tissue';
    labels[1].hidden = !cutaway && shape !== 1;
  }
  function startTransition() {
    startPose = {weights, opening, scale};
    changedAt = performance.now();
    describe();
    scheduleDraw();
  }
  function setPhase(next) {
    if (phase === next) return;
    phase = next;
    startTransition();
  }
  function drawGuide(x,y,radius) {
    context.save();
    context.translate(x,y);
    context.strokeStyle = '#7797ad6b';
    context.lineWidth = .8;
    context.beginPath();
    context.arc(0,0,radius,0,Math.PI*2);
    context.stroke();
    context.beginPath();
    for (let i=0;i<96;i++) {
      const angle = i*Math.PI/48, length = i%8 === 0 ? 7 : 2;
      const dx = Math.cos(angle), dy = Math.sin(angle);
      context.moveTo(dx*radius,dy*radius);
      context.lineTo(dx*(radius+length),dy*(radius+length));
    }
    context.stroke();
    context.restore();
  }
  function drawBranches(x,y,elapsed) {
    context.save();
    context.strokeStyle = '#768da1';
    context.lineWidth = 1;
    context.setLineDash([3,4]);
    // The same DOM centers are used for hit targets and their connecting lines.
    for (const [i,node] of nodes.entries()) {
      const progress = reduced.matches ? 1 : smooth((elapsed-i*85)/580);
      const dx = node.offsetLeft-x, dy = node.offsetTop-y;
      context.beginPath();
      context.moveTo(x,y);
      context.lineTo(x+progress*dx,y+progress*dy);
      context.stroke();
    }
    context.restore();
  }
  function drawLeaders(anchors) {
    labels.forEach((label,i) => {
      const point = anchors[i];
      label.style.visibility = point?.visible ? '' : 'hidden';
      if (!point?.visible || label.hidden) return;
      const left = label.offsetLeft+label.offsetWidth/2 < width/2;
      const x = label.offsetLeft+(left ? label.offsetWidth : 0), y = label.offsetTop+label.offsetHeight/2;
      context.strokeStyle = context.fillStyle = '#496e85';
      context.lineWidth = 1;
      context.beginPath(); context.moveTo(x,y); context.lineTo(x+(left ? 10 : -10),y); context.lineTo(point.x,point.y); context.stroke();
      context.beginPath(); context.arc(point.x,point.y,2.4,0,2*Math.PI); context.fill();
    });
  }
  function draw(now) {
    frame = 0;
    if (!inView || document.hidden || !width || !height || !startPose) return;
    const motion = !reduced.matches;
    const travel = motion ? smooth((now-changedAt)/680) : 1;
    const narrowing = cavityNarrowing[phase];
    let target = formWeights(shape);
    if (chapter === 1) target = formWeights(0);
    if (chapter === 2) target = [0, 0, 1-narrowing, narrowing];
    weights = target.map((value,i) => mix(startPose.weights[i],value,travel));
    opening = mix(startPose.opening, chapter === 0 ? Number(cutaway) : Number(chapter === 2),travel);
    scale = mix(startPose.scale, chapter === 1 ? .51 : 1, travel);
    const auto = motion && chapter === 0 && rotating && !drag;
    if (auto && now >= resumeAt) {
      const delta = Math.min(90,now-(previousDraw || now))*Math.PI/60000;
      yaw += (cutaway ? direction : 1)*delta;
      if (cutaway && (yaw >= 1.75 || yaw <= -.22)) { yaw = Math.max(-.22,Math.min(1.75,yaw)); direction *= -1; }
    }
    previousDraw = now;
    const top = plate.querySelector('.scene-stamp').offsetHeight+16;
    const area = Math.max(32,height-top-24);
    const x = width/2, y = chapter === 1 ? height*.49 : top+area*.51;
    const radius = Math.min(width*.39,area*.45) * zoom;
    context.clearRect(0,0,width,height);
    if (chapter === 1) drawBranches(x,y,now-enteredAt);
    else drawGuide(x,y,Math.min(width*.439,area*.49));
    const anchors = getModel().draw(context,{x,y,radius:radius*scale,yaw:chapter === 0 ? yaw : initialYaw,
      pitch:chapter === 0 ? pitch : initialPitch, weights,opening,form:shape,showNotes:chapter === 0 && annotated});
    if (chapter === 0 && annotated) drawLeaders(anchors);
    if (travel<1 || (motion && chapter===1 && now-enteredAt<800)) scheduleDraw();
    else if (auto) timer = setTimeout(scheduleDraw,Math.max(60,resumeAt-now));
  }
  function scheduleDraw() {
    clearTimeout(timer);
    if (context && !frame && inView && !document.hidden && !lifetime.signal.aborted) frame = requestAnimationFrame(draw);
  }
  function pauseRotation() {
    resumeAt = performance.now()+3000;
    previousDraw = 0;
    scheduleDraw();
  }
  function orient(dx,dy) {
    yaw += dx;
    if (cutaway) yaw = Math.max(-.22,Math.min(1.75,yaw));
    pitch = Math.max(-1.15,Math.min(1.15,pitch+dy));
    pauseRotation();
  }
  function resize() {
    width = canvas.clientWidth; height = canvas.clientHeight;
    if (context && width && height) {
      const density = Math.min(devicePixelRatio || 1,2);
      const w = Math.round(width*density), h = Math.round(height*density);
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      context.setTransform(density,0,0,density,0,0);
    }
    scheduleDraw();
  }
  function bindModelControls() {
    shapeButtons.forEach((button,i) => button.addEventListener('click',() => {
      shape = i;
      pauseRotation();
      startTransition();
    },options));
    for (const button of viewButtons) button.addEventListener('click',() => {
      cutaway = button.dataset.structureView === 'cut';
      if (cutaway) { yaw = initialYaw; pitch = initialPitch; }
      pauseRotation();
      startTransition();
    },options);
    notes.addEventListener('click',() => { annotated = !annotated; describe(); pauseRotation(); },options);
    rotation.addEventListener('click',() => {
      rotating = !rotating; resumeAt = 0; previousDraw = 0;
      rotation.setAttribute('aria-pressed',String(rotating));
      scheduleDraw();
    },options);
    canvas.addEventListener('pointerdown',event => {
      if (!event.isPrimary || event.button !== 0) return;
      drag = {id:event.pointerId,x:event.clientX,y:event.clientY};
      canvas.setPointerCapture(event.pointerId);
      pauseRotation();
    },options);
    canvas.addEventListener('pointermove',event => {
      if (event.pointerId !== drag?.id) return;
      orient((event.clientX-drag.x)*.012,(event.clientY-drag.y)*.012);
      drag.x = event.clientX; drag.y = event.clientY;
    },options);
    canvas.addEventListener('lostpointercapture',() => { drag = null; pauseRotation(); },options);
    const directions = {ArrowLeft:[-.18,0],ArrowRight:[.18,0],ArrowUp:[0,-.18],ArrowDown:[0,.18]};
    canvas.addEventListener('keydown',event => {
      if (!directions[event.key]) return;
      event.preventDefault(); orient(...directions[event.key]);
    },options);
    expand.addEventListener('click',() => {
      root.style.minHeight = root.getBoundingClientRect().height+'px';
      dialog.querySelector('.organoid-expanded-scene').append(plate);
      dialog.querySelector('.expanded-reading').append(controls,caption);
      canvas.setAttribute('aria-describedby','structure-caption organoid-expanded-instructions');
      dialog.showModal();
      resize();
    },options);
    function zoomBy(amount) { zoom = Math.max(.75,Math.min(1.8,zoom+amount)); pauseRotation(); }
    for (const button of dialog.querySelectorAll('[data-viewer-zoom]')) {
      button.addEventListener('click',() => zoomBy(button.dataset.viewerZoom === 'in' ? .14 : -.14),options);
    }
    canvas.addEventListener('wheel',event => {
      if (!dialog.open || event.ctrlKey) return;
      event.preventDefault(); zoomBy(-Math.sign(event.deltaY)*.08);
    },{...options,passive:false});
    dialog.querySelector('button').addEventListener('click',() => dialog.close(),options);
    dialog.addEventListener('click',event => { if (event.target === dialog) dialog.close(); },options);
    dialog.addEventListener('close',() => {
      scene.append(plate); scene.after(controls,caption);
      root.style.removeProperty('min-height');
      canvas.setAttribute('aria-describedby','structure-caption organoid-instructions');
      zoom = 1; resize();
    },options);
  }

  const sizes = new ResizeObserver(resize);
  const visibility = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    if (inView) enteredAt = performance.now();
    root.classList.toggle('in-view',inView);
    scheduleDraw();
  });
  if (chapter === 0) bindModelControls();
  startTransition();
  resize();
  sizes.observe(canvas);
  visibility.observe(root);
  reduced.addEventListener('change',scheduleDraw,options);
  document.addEventListener('visibilitychange',scheduleDraw,options);
  return {setPhase, redraw:scheduleDraw, dispose() {
    lifetime.abort(); sizes.disconnect(); visibility.disconnect();
    cancelAnimationFrame(frame); clearTimeout(timer);
    if (dialog?.open) dialog.close();
  }};
}
