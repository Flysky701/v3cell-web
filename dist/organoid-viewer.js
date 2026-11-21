'use strict';

const unit = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t = unit(value); return t*t*(3-2*t); };
const mix = (from, to, amount) => from + (to-from)*amount;
const formWeights = index => shapes.map((_, i) => Number(i === index));

const firstVisitKey = 'v3cell.home.intro-seen.v1';
let visitedHome = false;

function mountHomeStory(hero) {
  const sections = [...hero.querySelectorAll('[data-chapter]')];
  const readingTitles = sections.slice(1).map(section => section.querySelector('.film-reading h2'));
  const nav = document.querySelector('.home-chapters');
  const links = [...nav.querySelectorAll('a')];
  const progress = nav.querySelector('.home-progress');
  const cover = hero.querySelector('.cover-specimen');
  const dock = hero.querySelector('.docked-specimen');
  const films = [...hero.querySelectorAll('.film-animation-slot video')];
  const atlasFilm = films[0];
  const traveler = hero.querySelector('.travel-specimen');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const lifetime = new AbortController();
  const options = {signal:lifetime.signal};
  let frame = 0, active = -1, furthest = 0;
  let reveal = 0, lastMorphTick = 0;
  let lastScrollY = window.scrollY, scrollDirection = 0, snapFrame = 0;
  const motionMode = new URLSearchParams(location.search).get('motion');
  const localReview = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const releaseFilms = [];
  const filmAsset = video => 'assets/films/' + video.dataset.film + (language === 'en' ? '-en' : '');
  const preview = motionMode === 'preview' || (localReview && motionMode !== 'once');
  hero.toggleAttribute('data-motion-preview', preview);
  // Claim on entry so an early refresh or a return via another route is static too.
  if (!preview) {
    try { visitedHome ||= localStorage.getItem(firstVisitKey) === '1'; } catch {}
  }
  let firstPass = (preview || !visitedHome) && !reduced.matches && ['', '#home', '#home-top'].includes(location.hash);
  const pendingPlayback = new Set(preview || !visitedHome ? films : []);
  const manualResume = new Set();
  hero.toggleAttribute('data-visit-drift', firstPass && !preview);
  if (!preview) {
    visitedHome = true;
    try { localStorage.setItem(firstVisitKey, '1'); } catch {}
  }

  function prepareHandoff() {
    atlasFilm.controls = false;
    atlasFilm.poster = filmAsset(atlasFilm) + '-opening.webp';
  }
  if (firstPass) prepareHandoff();

  function finishIntro() {
    firstPass = false;
    atlasFilm.controls = true;
    hero.removeAttribute('data-first-pass');
  }

  function syncFilms() {
    films.forEach((video, i) => {
      const bounds = video.getBoundingClientRect();
      const visibleHeight = Math.min(innerHeight, bounds.bottom) - Math.max(0, bounds.top);
      const visible = active === i + 1 && visibleHeight >= Math.min(bounds.height, innerHeight) * .55;
      const expanded = document.fullscreenElement === video || document.pictureInPictureElement === video;
      if (document.hidden || (!visible && !expanded)) {
        if (!video.paused && !video.ended) {
          pendingPlayback.add(video);
          video.pause();
        }
      } else if (video.readyState >= 1 && (!reduced.matches || manualResume.has(video)) && !(firstPass && video === atlasFilm) && pendingPlayback.delete(video)) {
        manualResume.delete(video);
        // Native controls remain available when the browser requires a user gesture.
        video.play().catch(() => {});
      }
    });
  }
  for (const video of films) {
    const caption = video.closest('figure').querySelector('figcaption');
    const nodes = [...caption.querySelectorAll('.film-node')];
    const currentName = caption.querySelector('.film-current-name');
    let request, blobUrl, expectedSource, seekTime = null;
    function updateTimeline() {
      const time = seekTime ?? video.currentTime;
      const duration = video.duration;
      const current = nodes.findLast(node => Number(node.dataset.time) <= time + .001) || nodes[0];
      nodes.forEach((node, index) => {
        const start = Number(node.dataset.time);
        const end = nodes[index + 1] ? Number(nodes[index + 1].dataset.time) : duration;
        const fraction = end > start ? unit((time - start) / (end - start)) : 0;
        node.parentElement.style.setProperty('--played', (fraction * 100) + '%');
        node.parentElement.toggleAttribute('data-past', start < Number(current.dataset.time));
        if (node === current) node.setAttribute('aria-current', 'step');
        else node.removeAttribute('aria-current');
      });
      const key = current.querySelector('[data-i18n]').dataset.i18n;
      currentName.dataset.i18n = key;
      currentName.textContent = t(key);
    }
    function seekWhenReady() {
      if (seekTime === null || video.readyState < 1 || video.currentSrc !== expectedSource) return;
      video.currentTime = Math.min(seekTime, video.duration);
      seekTime = null;
    }
    function jump(node) {
      if (video === atlasFilm && firstPass) finishIntro();
      pendingPlayback.delete(video);
      manualResume.delete(video);
      seekTime = Number(node.dataset.time);
      seekWhenReady();
      updateTimeline();
    }
    for (const [index, node] of nodes.entries()) {
      node.addEventListener('click', () => jump(node), options);
      node.addEventListener('keydown', event => {
        const step = {ArrowLeft: Math.max(0, index - 1), ArrowRight: Math.min(nodes.length - 1, index + 1),
          Home: 0, End: nodes.length - 1}[event.key];
        if (step === undefined) return;
        event.preventDefault();
        nodes[step].focus();
        jump(nodes[step]);
      }, options);
    }
    function release() {
      request?.abort();
      video.pause();
      video.removeAttribute('src');
      video.load();
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      blobUrl = null;
      expectedSource = '';
    }
    async function changeFilm() {
      const asset = filmAsset(video);
      if (seekTime === null && video.currentTime > 0) seekTime = video.currentTime;
      if (!video.paused && !video.ended) {
        pendingPlayback.add(video);
        if (reduced.matches) manualResume.add(video);
      }
      release();
      video.poster = asset + (firstPass && video === atlasFilm ? '-opening.webp' : '.webp');
      const controller = request = new AbortController();
      let source = new URL(asset + '.mp4', document.baseURI).href;
      try {
        // Some static hosts ignore Range. A complete response can still seek via a blob URL.
        const response = await fetch(source, {headers: {Range: 'bytes=0-0'}, signal: controller.signal});
        if (response.status === 206) {
          await response.body?.cancel();
        } else if (response.status === 200) {
          const blob = await response.blob();
          if (controller.signal.aborted) return;
          source = blobUrl = URL.createObjectURL(blob);
        }
      } catch { /* Let the media element try the original URL. */ }
      if (controller.signal.aborted) return;
      expectedSource = source;
      video.src = source;
    }
    video.addEventListener('loadedmetadata', () => { seekWhenReady(); updateTimeline(); queue(); }, options);
    for (const event of ['timeupdate', 'seeked', 'playing', 'ended']) video.addEventListener(event, updateTimeline, options);
    video.addEventListener('play', () => pendingPlayback.delete(video), options);
    hero.addEventListener('filmlanguagechange', changeFilm, options);
    releaseFilms.push(release);
    updateTimeline();
    changeFilm();
  }

  function endVisitEffects() {
    cancelSnap();
    hero.removeAttribute('data-visit-drift');
    finishIntro();
  }
  function cancelSnap() {
    cancelAnimationFrame(snapFrame);
    snapFrame = 0;
  }
  function settleAtChapter() {
    if (document.hidden || reduced.matches || snapFrame || scrollDirection <= 0) return;
    scrollDirection = 0;
    const reach = innerHeight * .10;
    for (const chapter of sections.slice(1)) {
      const gap = chapter.getBoundingClientRect().top;
      if (Math.abs(gap) > .75 && Math.abs(gap) <= reach) {
        const startY = window.scrollY;
        const started = performance.now();
        const duration = 320 + 320 * Math.sqrt(Math.abs(gap) / reach);
        function align(now) {
          const t = unit((now - started) / duration);
          // Minimum-jerk easing starts and ends with zero velocity and acceleration.
          const eased = t * t * t * (10 + t * (-15 + 6 * t));
          window.scrollTo({top:startY + gap * eased, behavior:'instant'});
          snapFrame = t < 1 ? requestAnimationFrame(align) : 0;
        }
        snapFrame = requestAnimationFrame(align);
        break;
      }
    }
  }

  function render(now) {
    frame = 0;
    const bounds = hero.getBoundingClientRect();
    const atlasTop = sections[1].getBoundingClientRect().top;
    const end = sections[2].getBoundingClientRect().top;
    const readingLine = innerHeight * .5;
    const next = end <= readingLine ? 2 : atlasTop <= readingLine ? 1 : 0;
    if (next !== active) {
      active = next;
      links.forEach((link, i) => {
        sections[i].toggleAttribute('data-current-chapter', i === active);
        if (i === active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }
    const offset = Math.max(0, header.offsetHeight - bounds.top);
    const storyTravel = Math.max(1, bounds.height + header.offsetHeight - innerHeight);
    progress.textContent = Math.round(100 * unit(offset / storyTravel)) + '%';
    if (preview && !reduced.matches && offset <= 1 && (!firstPass || furthest > 3)) {
      firstPass = true;
      furthest = 0;
      reveal = 0;
      lastMorphTick = 0;
      prepareHandoff();
      for (const video of films) {
        video.pause();
        if (video.readyState) video.currentTime = 0;
        pendingPlayback.add(video);
      }
      for (const chapter of sections.slice(1)) {
        chapter.removeAttribute('data-copy-entered');
      }
    }
    readingTitles.forEach((heading, i) => {
      const chapter = sections[i + 1];
      if (chapter.hasAttribute('data-copy-entered')) return;
      const rect = heading.getBoundingClientRect();
      if (rect.top < innerHeight * .78 && rect.bottom > 0) chapter.setAttribute('data-copy-entered', '');
    });
    if (firstPass || hero.hasAttribute('data-visit-drift')) {
      if (!snapFrame && offset < furthest - 3) { endVisitEffects(); syncFilms(); return; }
      furthest = snapFrame ? offset : Math.max(furthest, offset);
    }
    syncFilms();
    if (!firstPass) return;
    const distance = Math.max(1, atlasTop - bounds.top + header.offsetHeight);
    const p = unit(offset / distance);
    if (end <= 0) { finishIntro(); return; }
    const start = cover.getBoundingClientRect();
    const target = dock.getBoundingClientRect();
    const t = smooth(p / .72);
    const requestedReveal = p >= .72 ? 1 : 0;
    // Once the cutaway reaches the subject in the first frame, finish the dissolve even at rest.
    if (requestedReveal > reveal) {
      const elapsed = lastMorphTick ? Math.min(80, now - lastMorphTick) : 0;
      reveal = Math.min(requestedReveal, reveal + elapsed / 1800);
      lastMorphTick = now;
      if (reveal < requestedReveal) queue();
    } else {
      lastMorphTick = 0;
    }
    if (reveal >= .999) { finishIntro(); syncFilms(); return; }
    const x = mix(start.left, target.left, t) - bounds.left;
    const y = mix(start.top, target.top, t) - bounds.top;
    const scale = mix(1, target.width / start.width, t);
    traveler.style.width = start.width + 'px';
    traveler.style.setProperty('--dock-progress', t);
    traveler.style.opacity = reveal > 0 ? 1 - reveal : '';
    atlasFilm.style.setProperty('--section-reveal', reveal);
    traveler.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) scale(' + scale + ')';
    hero.style.setProperty('--cover-opacity', 1 - smooth(p / .57));
    hero.setAttribute('data-first-pass', '');
  }
  function queue() {
    if (!frame) frame = requestAnimationFrame(render);
  }
  const sizes = new ResizeObserver(() => {
    hero.style.setProperty('--intro-header', header.offsetHeight + 'px');
    queue();
  });
  sizes.observe(header); sizes.observe(hero); sizes.observe(dock);
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (!snapFrame && y !== lastScrollY) scrollDirection = Math.sign(y - lastScrollY);
    lastScrollY = y;
    queue();
  }, {...options, passive:true});
  for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown', 'resize']) {
    window.addEventListener(event, cancelSnap, {...options, passive:true, capture:true});
  }
  document.addEventListener('scrollend', settleAtChapter, options);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelSnap(); syncFilms(); }, options);
  window.addEventListener('pagehide', endVisitEffects, options);
  reduced.addEventListener('change', () => {
    if (reduced.matches) { endVisitEffects(); manualResume.clear(); films.forEach(video => video.pause()); }
    queue();
  }, options);
  queue();
  return () => {
    lifetime.abort(); sizes.disconnect(); cancelAnimationFrame(frame); cancelSnap();
    releaseFilms.forEach(release => release());
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
