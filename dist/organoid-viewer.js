'use strict';

const unit = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t = unit(value); return t*t*(3-2*t); };
const mix = (from, to, amount) => from + (to-from)*amount;
const formWeights = index => shapes.map((_, i) => Number(i === index));

function mountOrganoidViewer(root) {
  const scene = root.querySelector('.organoid-scene');
  const plate = scene.querySelector('.structure-plate');
  const canvas = plate.querySelector('canvas');
  const context = canvas.getContext('2d');
  const caption = root.querySelector('.structure-caption');
  const controls = root.querySelector('.shape-controls');
  const shapeButtons = [...controls.querySelectorAll('[data-shape]')];
  const viewButtons = [...plate.querySelectorAll('[data-structure-view]')];
  const sectionSwitch = plate.querySelector('.section-switch');
  const rotation = plate.querySelector('.rotation-toggle');
  const notes = plate.querySelector('.annotation-toggle');
  const labels = [...plate.querySelectorAll('[data-anatomy]')];
  const nodeGroup = plate.querySelector('.lineage-nodes');
  const nodes = [...nodeGroup.children];
  const instructions = root.querySelector('#organoid-instructions');
  const expand = root.querySelector('.organoid-expand');
  const dialog = root.querySelector('dialog');
  const hero = root.closest('.hero');
  const instrument = root.closest('.story-instrument');
  const nav = document.querySelector('.home-chapters');
  const links = [...nav.querySelectorAll('a')];
  const sections = links.map(link => document.getElementById(link.hash.slice(1)));
  const steps = [...hero.querySelectorAll('[data-fate-step]')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width:760px) and (min-height:521px)');
  const lifetime = new AbortController();
  const options = {signal:lifetime.signal};
  const anatomy = [['cutOutline','cutMass'], ['cutOutline','cutBud'], ['cutWall','cutLumen'], ['cutWall','cutSlit']];
  const stepCaptions = ['beforeCaption', 'afterCaption', 'evolutionCaption'];
  const cavityNarrowing = [0, .45, 1];
  const initialYaw = .64, initialPitch = .26;
  let yaw = initialYaw, pitch = initialPitch, zoom = 1, drag;
  let model, width = 0, height = 0, inView = false, frame = 0, timer = 0;
  let previousDraw = 0, resumeAt = 0, direction = 1, rotating = true;
  let chapter = -1, shape = 2, cutaway = true, annotated = false, phase = 0, scrollPhase = -1;
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
    root.dataset.stage = chapter + 1;
    root.dataset.phase = phase;
    plate.dataset.form = id;
    nodeGroup.hidden = !atlas;
    controls.hidden = sectionSwitch.hidden = notes.hidden = rotation.hidden = expand.hidden = instructions.hidden = !intro || !context;
    plate.classList.toggle('show-notes', intro && annotated);
    for (const [i, button] of shapeButtons.entries()) button.setAttribute('aria-pressed', String(i === shape));
    for (const button of viewButtons) button.setAttribute('aria-pressed', String((button.dataset.structureView === 'cut') === cutaway));
    notes.setAttribute('aria-pressed', String(annotated));
    setText(labels[0], cutaway ? anatomy[shape][0] : 'outerSurface');
    setText(labels[1], anatomy[shape][1]);
    labels[0].dataset.feature = cutaway && shape >= 2 ? 'tissue' : 'surface';
    labels[1].dataset.feature = shape === 1 ? 'surface' : shape >= 2 ? 'lumen' : 'tissue';
    labels[1].hidden = !cutaway && shape !== 1;
    for (const [i, button] of steps.entries()) button.setAttribute('aria-pressed', String(i === phase));
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
  function syncScroll() {
    if (dialog.open) return;
    const line = mobile.matches ? instrument.offsetHeight + Math.max(24,(innerHeight-instrument.offsetHeight)*.25) : innerHeight*.5;
    const current = sections.reduce((index, section, i) => section.getBoundingClientRect().top <= line ? i : index, 0);
    if (current !== chapter) {
      chapter = current;
      for (const [i, link] of links.entries()) {
        if (i === current) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      }
      enteredAt = performance.now();
      scrollPhase = -1;
      phase = 0;
      startTransition();
    }
    if (chapter === 2) {
      const bounds = sections[2].getBoundingClientRect();
      const progress = (line-bounds.top)/bounds.height;
      const next = progress < .55 ? 0 : progress < .76 ? 1 : 2;
      if (next !== scrollPhase) { scrollPhase = next; setPhase(next); }
    }
    const length = document.documentElement.scrollHeight - innerHeight;
    nav.querySelector('.home-progress').textContent = Math.round(100*unit(scrollY/Math.max(1,length))) + '%';
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
    scale = mix(startPose.scale, chapter === 1 ? .42 : 1, travel);
    const auto = motion && chapter === 0 && rotating && !drag;
    if (auto && now >= resumeAt) {
      const delta = Math.min(90,now-(previousDraw || now))*Math.PI/60000;
      yaw += (cutaway ? direction : 1)*delta;
      if (cutaway && (yaw >= 1.75 || yaw <= -.22)) { yaw = Math.max(-.22,Math.min(1.75,yaw)); direction *= -1; }
    }
    previousDraw = now;
    const top = plate.querySelector('.scene-stamp').offsetHeight+16;
    const area = Math.max(32,height-top-24);
    const x = width/2, y = chapter === 1 ? height*.52 : top+area*.51;
    const radius = Math.min(width*.31,area*.41) * zoom;
    context.clearRect(0,0,width,height);
    if (chapter === 1) drawBranches(x,y,now-enteredAt);
    else drawGuide(x,y,Math.min(width*.439,area*.49));
    model ??= createOrganoidStructure(scheduleDraw);
    const anchors = model.draw(context,{x,y,radius:radius*scale,yaw:chapter === 0 ? yaw : initialYaw,
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
    if (!dialog.open) hero.style.setProperty('--instrument-height', (instrument.offsetHeight+6)+'px');
    const bounds = canvas.getBoundingClientRect();
    width = bounds.width; height = bounds.height;
    if (context && width && height) {
      const density = Math.min(devicePixelRatio || 1,2);
      const w = Math.round(width*density), h = Math.round(height*density);
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      context.setTransform(density,0,0,density,0,0);
    }
    syncScroll();
    scheduleDraw();
  }
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
  steps.forEach((button,i) => button.addEventListener('click',() => {
    if (chapter !== 2) sections[2].scrollIntoView({behavior:'instant'});
    // Apply any scroll caused by focusing the button before the reader's explicit choice.
    syncScroll();
    setPhase(i);
  },options));
  canvas.addEventListener('pointerdown',event => {
    if (chapter || !event.isPrimary || event.button !== 0) return;
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
    if (chapter || !directions[event.key]) return;
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

  const sizes = new ResizeObserver(resize);
  const visibility = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.target === canvas) inView = entry.isIntersecting;
      else hero.classList.toggle('ambient-visible',entry.isIntersecting);
    }
    scheduleDraw();
  });
  resize();
  sizes.observe(instrument); sizes.observe(canvas);
  visibility.observe(canvas); visibility.observe(hero);
  reduced.addEventListener('change',scheduleDraw,options);
  window.addEventListener('scroll',syncScroll,{...options,passive:true});
  document.addEventListener('visibilitychange',scheduleDraw,options);
  return () => {
    lifetime.abort();
    sizes.disconnect(); visibility.disconnect();
    cancelAnimationFrame(frame); clearTimeout(timer);
    if (dialog.open) dialog.close();
  };
}
