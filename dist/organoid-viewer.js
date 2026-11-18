'use strict';

function mountOrganoidViewer(root) {
  const scene = root.querySelector('.organoid-scene');
  const plate = scene.querySelector('.structure-plate');
  const canvas = plate.querySelector('canvas');
  const labels = [...plate.querySelectorAll('[data-anatomy]')];
  const caption = root.querySelector('.structure-caption');
  const shapeControls = root.querySelector('.shape-controls');
  const viewButtons = [...plate.querySelectorAll('[data-structure-view]')];
  const noteToggle = plate.querySelector('.annotation-toggle');
  const rotationToggle = plate.querySelector('.rotation-toggle');
  let showNotes = false;
  const context = canvas.getContext('2d');
  const dialog = root.querySelector('dialog');
  const expandedScene = dialog.querySelector('.organoid-expanded-scene');
  const expand = root.querySelector('.organoid-expand');
  const hero = root.closest('.hero');
  const instrument = root.closest('.story-instrument');
  const stickyMobile = matchMedia('(max-width:760px) and (min-height:521px)');
  const shapeButtons = [...root.querySelectorAll('[data-shape]')];
  const chapters = document.querySelector('.home-chapters');
  const progressLabel = chapters.querySelector('.home-progress');
  const chaptersBySection = [...chapters.querySelectorAll('a')].map(link => ({
    link, section:document.getElementById(link.hash.slice(1))
  }));
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const lifetime = new AbortController();
  const options = {signal:lifetime.signal};
  if (!context) {
    expand.hidden = true;
    scene.hidden = true;
    root.querySelector('#organoid-instructions').hidden = true;
  }

  const model = context ? createOrganoidStructure(scheduleDraw) : null;
  const anatomy = [
    ['cutOutline','cutMass'], ['cutOutline','cutBud'],
    ['cutWall','cutLumen'], ['cutWall','cutSlit']
  ];
  let width = 0, height = 0, frame = 0, progress = 0, expandedZoom = 1;
  const initialYaw = .24, initialPitch = .30;
  let yaw = initialYaw, pitch = initialPitch, drag = null, activeChapter, sceneHue = 225;
  let shapeIndex = 2, cutaway = true;
  const cutMin = -.22, cutMax = 1.78;
  const cutCenter = (cutMax+cutMin)/2, cutRadius = (cutMax-cutMin)/2;
  const angularSpeed = Math.PI/60; // One exterior revolution in two minutes.
  let rotationEnabled = true, inView = false, idleTimer = 0;
  let idleAfter = 0, lastTurn = null, cutPhase = 0;

  function canRotate() {
    return context && inView && rotationEnabled && !drag && !reducedMotion.matches &&
      !document.hidden && !lifetime.signal.aborted;
  }
  function queueIdleDraw() {
    clearTimeout(idleTimer);
    if (!canRotate()) return;
    // The software renderer only needs a modest cadence for this slow motion.
    const next = Math.max(idleAfter,(lastTurn ?? 0)+1000/18);
    idleTimer = setTimeout(scheduleDraw,Math.max(24,next-performance.now()));
  }
  function postponeRotation(delay = 3000) {
    idleAfter = performance.now()+delay;
    lastTurn = null;
    queueIdleDraw();
  }
  function advanceRotation(now) {
    if (!canRotate() || now<idleAfter) return;
    if (lastTurn===null) {
      // Start the cutaway arc from the current manual yaw, including at either limit.
      cutPhase = cutaway ? Math.acos(Math.max(-1,Math.min(1,(yaw-cutCenter)/cutRadius))) : 0;
    } else {
      const step = angularSpeed*Math.min(250,now-lastTurn)/1000;
      if (cutaway) {
        cutPhase -= step/cutRadius;
        yaw = cutCenter+cutRadius*Math.cos(cutPhase);
      } else {
        yaw = (yaw+step)%(2*Math.PI);
      }
    }
    lastTurn = now;
  }
  rotationToggle.addEventListener('click',() => {
    rotationEnabled = !rotationEnabled;
    rotationToggle.setAttribute('aria-pressed',String(rotationEnabled));
  },options);
  root.addEventListener('click',event => {
    if (rotationToggle.contains(event.target) && rotationEnabled) postponeRotation(0);
    else postponeRotation();
  },options);

  function setText(node,key) {
    node.dataset.i18n = key;
    node.textContent = t(key);
  }
  function describeModel() {
    const id = shapes[shapeIndex];
    setText(root.querySelector('[data-active-shape]'),id);
    plate.dataset.form = id;
    setText(caption,id+(cutaway ? 'Cut' : 'Surface'));
    setText(labels[0],cutaway ? anatomy[shapeIndex][0] : 'outerSurface');
    plate.dataset.view = cutaway ? 'cut' : 'surface';
    setText(labels[1],anatomy[shapeIndex][1]);
    labels[0].dataset.feature = cutaway && shapeIndex>=2 ? 'tissue' : 'surface';
    labels[1].dataset.feature = shapeIndex>=2 ? 'lumen' : 'tissue';
    labels[1].hidden = !cutaway;
    for (const button of shapeButtons) button.setAttribute('aria-pressed',String(button.dataset.shape===id));
    for (const button of viewButtons) button.setAttribute('aria-pressed',String((button.dataset.structureView==='cut')===cutaway));
  }
  function selectShape(id) {
    shapeIndex = shapes.indexOf(id);
    model?.select(shapeIndex,performance.now());
    describeModel();
    scheduleDraw();
  }
  for (const button of shapeButtons) {
    button.addEventListener('click',() => selectShape(button.dataset.shape),options);
  }
  noteToggle.addEventListener('click',() => {
    showNotes = !showNotes;
    noteToggle.setAttribute('aria-pressed',String(showNotes));
    plate.classList.toggle('show-notes',showNotes);
    scheduleDraw();
  },options);
  function orient(dx,dy) {
    yaw += dx;
    pitch = Math.max(-1.15,Math.min(1.15,pitch+dy));
    // Keep the open side in sight in cutaway mode. Exterior mode allows a full turn.
    if (cutaway) yaw = Math.max(cutMin,Math.min(cutMax,yaw));
    scheduleDraw();
  }
  for (const button of viewButtons) {
    button.addEventListener('click',() => {
      const nextCut = button.dataset.structureView==='cut';
      if (nextCut===cutaway) return;
      cutaway = nextCut;
      if (cutaway) { yaw=initialYaw; pitch=initialPitch; }
      describeModel();
      scheduleDraw();
    },options);
  }
  const leaderColors = {tissue:'#34718a', lumen:'#4d6eaa', surface:'#655e96'};
  function draw(now) {
    frame = 0;
    if (!inView || document.hidden) return;
    advanceRotation(now);
    context.clearRect(0,0,width,height);
    const result = model.draw(context,width,height,{
      yaw,pitch,zoom:dialog.open?expandedZoom:1+.025*progress,cutaway,now,showNotes,reduced:reducedMotion.matches
    });
    result.anchors.forEach((point,i) => {
      const label=labels[i];
      label.style.visibility = point.visible ? '' : 'hidden';
      if (!point.visible) return;
      const left = label.offsetLeft+label.offsetWidth/2 < width/2;
      const x=label.offsetLeft+(left?label.offsetWidth:0), y=label.offsetTop+label.offsetHeight*.52;
      const color=leaderColors[label.dataset.feature];
      context.strokeStyle=color;context.lineWidth=1;
      context.beginPath();context.moveTo(x,y);
      context.lineTo(x+(left?1:-1)*Math.min(18,width*.027),y);
      context.lineTo(point.x,point.y);context.stroke();
      context.beginPath();context.arc(point.x,point.y,3.0,0,2*Math.PI);
      context.fillStyle=color;context.fill();
    });
    if (result.moving) scheduleDraw();
    else queueIdleDraw();
  }

  function scheduleDraw() {
    if (!lifetime.signal.aborted && context && inView && !document.hidden && !frame && width && height) frame = requestAnimationFrame(draw);
  }

  const hueStops = [225,208,243,216,231];
  function syncScroll() {
    if (dialog.open) return;
    const heroTop = hero.offsetTop;
    const travel = Math.max(1,hero.offsetHeight - window.innerHeight);
    const position = Math.max(0,Math.min(1,(window.scrollY-heroTop)/travel));
    const next = reducedMotion.matches ? 0 : position;
    if (next !== progress) {
      progress = next;
      scheduleDraw();
    }
    const scrollRange = document.documentElement.scrollHeight - window.innerHeight;
    const percent = Math.round(100 * Math.max(0,Math.min(1,window.scrollY / Math.max(1,scrollRange))));
    progressLabel.textContent = `${percent}%`;

    const readingLine = Math.max(window.innerHeight*.35, stickyMobile.matches ? instrument.offsetHeight+16 : 0);
    const current = percent === 100 ? chaptersBySection.at(-1) : chaptersBySection.reduce((selected,chapter) =>
      chapter.section.getBoundingClientRect().top <= readingLine ? chapter : selected,chaptersBySection[0]);
    if (current !== activeChapter) {
      activeChapter?.link.removeAttribute('aria-current');
      current.link.setAttribute('aria-current','location');
      selectShape(chapterShapes[Number(current.section.dataset.chapter)]);
      activeChapter = current;
    }
    // Cross chapter boundaries continuously. Reduced-motion readers get the settled chapter color.
    const stop = reducedMotion.matches ? Number(current.section.dataset.chapter) : position*4;
    const i = Math.floor(stop), j = Math.min(i+1,4);
    const u = stop-i, blend = u*u*(3-2*u);
    const hue = Math.round(hueStops[i]+(hueStops[j]-hueStops[i])*blend);
    if (hue !== sceneHue) {
      sceneHue = hue;
      root.style.setProperty('--scene-hue',hue);
      scheduleDraw();
    }
  }

  const observer = new ResizeObserver(() => {
    if (!dialog.open) {
      const margin = (instrument.offsetHeight+6)+'px';
      if (hero.style.getPropertyValue('--instrument-height')!==margin) hero.style.setProperty('--instrument-height',margin);
    }
    const size = canvas.getBoundingClientRect();
    if (context && size.width && size.height) {
      width = size.width;
      height = size.height;
      const density = Math.min(devicePixelRatio || 1,2);
      const w = Math.round(width*density), h = Math.round(height*density);
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      context.setTransform(density,0,0,density,0,0);
    }
    syncScroll();
    scheduleDraw();
  });
  // Populate the caption before the router measures a chapter or evidence anchor.
  syncScroll();
  observer.observe(canvas);
  observer.observe(instrument);
  for (const label of labels) observer.observe(label);
  const visibility = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.target===hero) {
        hero.classList.toggle('ambient-visible',entry.isIntersecting && !document.hidden);
      } else {
        inView = entry.isIntersecting;
        postponeRotation(1200);
        scheduleDraw();
      }
    }
  });
  visibility.observe(hero);
  visibility.observe(canvas);
  document.addEventListener('visibilitychange',() => {
    const bounds=hero.getBoundingClientRect();
    hero.classList.toggle('ambient-visible',!document.hidden && bounds.bottom>0 && bounds.top<innerHeight);
    postponeRotation();
    scheduleDraw();
  },options);
  window.addEventListener('scroll',() => {
    postponeRotation();
    syncScroll();
  },{...options,passive:true});
  reducedMotion.addEventListener('change',() => {
    postponeRotation();
    syncScroll();
    scheduleDraw();
  },options);

  canvas.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    drag = {id:event.pointerId,x:event.clientX,y:event.clientY};
    postponeRotation();
    canvas.setPointerCapture(event.pointerId);
  }, options);
  canvas.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId) return;
    orient((event.clientX-drag.x)*.012,(event.clientY-drag.y)*.012);
    drag.x = event.clientX;
    drag.y = event.clientY;
    scheduleDraw();
  }, options);
  canvas.addEventListener('lostpointercapture', () => {
    drag = null;
    postponeRotation();
  },options);
  const directions = {ArrowLeft:[-.18,0],ArrowRight:[.18,0],ArrowUp:[0,-.18],ArrowDown:[0,.18]};
  canvas.addEventListener('keydown', event => {
    const step = directions[event.key];
    if (!step) return;
    event.preventDefault();
    postponeRotation();
    orient(step[0],step[1]);
  }, options);

  expand.addEventListener('click', () => {
    expandedZoom = 1;
    // Moving the controls into the dialog must not shift the chapter behind it.
    root.style.minHeight = root.getBoundingClientRect().height+'px';
    expandedScene.append(plate);
    dialog.querySelector('.expanded-reading').append(shapeControls,caption);
    canvas.setAttribute('aria-describedby','structure-caption organoid-expanded-instructions');
    dialog.showModal();
  }, options);
  function zoomExpanded(amount) {
    postponeRotation();
    expandedZoom = Math.max(.75,Math.min(1.8,expandedZoom + amount));
    scheduleDraw();
  }
  canvas.addEventListener('wheel', event => {
    if (!dialog.open || event.ctrlKey) return;
    event.preventDefault();
    zoomExpanded(-Math.sign(event.deltaY)*.08);
  }, {...options,passive:false});
  for (const button of dialog.querySelectorAll('[data-viewer-zoom]')) {
    button.addEventListener('click',() => zoomExpanded(button.dataset.viewerZoom === 'in' ? .14 : -.14),options);
  }
  dialog.querySelector('button').addEventListener('click', () => dialog.close(), options);
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  }, options);
  dialog.addEventListener('close', () => {
    scene.append(plate);
    scene.after(shapeControls,caption);
    root.style.removeProperty('min-height');
    drag = null;
    postponeRotation();
    canvas.setAttribute('aria-describedby','structure-caption organoid-instructions');
  }, options);

  return () => {
    lifetime.abort();
    observer.disconnect();
    visibility.disconnect();
    clearTimeout(idleTimer);
    cancelAnimationFrame(frame);
    if (dialog.open) dialog.close();
  };
}
