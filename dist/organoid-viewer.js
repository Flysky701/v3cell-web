'use strict';

const unit = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t = unit(value); return t * t * (3 - 2 * t); };
const mix = (from, to, amount) => from + (to - from) * amount;

const firstVisitKey = 'v3cell.home.intro-seen.v1';
let visitedHome = false;
let rangeStatus = 0; // 0 = unknown, 1 = HTTP 206 supported, -1 = full 200 fallback via Blob URL

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
  const options = {signal: lifetime.signal};
  let frame = 0, active = -1, furthest = 0;
  let reveal = 0, lastMorphTick = 0;
  let lastScrollY = window.scrollY, scrollDirection = 0, snapFrame = 0;
  const motionMode = new URLSearchParams(location.search).get('motion');
  const localReview = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const releaseFilms = [];
  const filmLoaders = new Map();
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

  function currentPoster(video) {
    return filmAsset(video) + (firstPass && video === atlasFilm ? '-opening.webp' : '.webp');
  }
  function prepareHandoff() {
    atlasFilm.controls = false;
    atlasFilm.poster = currentPoster(atlasFilm);
  }
  if (firstPass) prepareHandoff();

  function finishIntro() {
    firstPass = false;
    atlasFilm.controls = true;
    atlasFilm.poster = currentPoster(atlasFilm);
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
      } else if (visible) {
        filmLoaders.get(video)?.();
        if (video.readyState >= 1 && (!reduced.matches || manualResume.has(video)) && !(firstPass && video === atlasFilm) && pendingPlayback.delete(video)) {
          manualResume.delete(video);
          // Native controls remain available when the browser requires a user gesture.
          video.play().catch(() => {});
        }
      }
    });
  }

  const filmObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      filmLoaders.get(entry.target)?.();
      filmObserver.unobserve(entry.target);
    }
  }, {rootMargin: '420px 0px'});

  for (const video of films) {
    const caption = video.closest('figure').querySelector('figcaption');
    const nodes = [...caption.querySelectorAll('.film-node')];
    const currentName = caption.querySelector('.film-current-name');
    let loaded = false, request, blobUrl, expectedSource, seekTime = null;
    function updateTimeline() {
      const time = seekTime ?? video.currentTime;
      const duration = video.duration || Number(video.dataset.duration) || 1;
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
      ensureFilm();
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
      loaded = true;
      const asset = filmAsset(video);
      if (seekTime === null && video.currentTime > 0) seekTime = video.currentTime;
      if (!video.paused && !video.ended) {
        pendingPlayback.add(video);
        if (reduced.matches) manualResume.add(video);
      }
      release();
      video.poster = currentPoster(video);
      let source = new URL(asset + '.mp4', document.baseURI).href;
      if (rangeStatus !== 1) {
        const controller = request = new AbortController();
        try {
          // Static hosts without Range (e.g. python http.server) need a Blob URL for scrubbing.
          const response = await fetch(source, {headers: {Range: 'bytes=0-0'}, signal: controller.signal});
          if (response.status === 206) {
            rangeStatus = 1;
            await response.body?.cancel();
          } else if (response.status === 200) {
            rangeStatus = -1;
            const blob = await response.blob();
            if (controller.signal.aborted) return;
            source = blobUrl = URL.createObjectURL(blob);
          }
        } catch { /* Let the media element try the original URL. */ }
        if (controller.signal.aborted) return;
      }
      expectedSource = source;
      video.src = source;
    }
    function ensureFilm() {
      if (!loaded) changeFilm();
    }
    filmLoaders.set(video, ensureFilm);
    filmObserver.observe(video);
    video.addEventListener('loadedmetadata', () => { seekWhenReady(); updateTimeline(); queue(); }, options);
    for (const event of ['timeupdate', 'seeked', 'playing', 'ended']) video.addEventListener(event, updateTimeline, options);
    video.addEventListener('play', () => pendingPlayback.delete(video), options);
    hero.addEventListener('filmlanguagechange', () => {
      video.poster = currentPoster(video);
      if (loaded) changeFilm();
    }, options);
    releaseFilms.push(release);
    video.poster = currentPoster(video);
    updateTimeline();
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
          window.scrollTo({top: startY + gap * eased, behavior: 'instant'});
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
    const outsideHero = bounds.bottom <= innerHeight * .35;
    nav.toggleAttribute('data-outside', outsideHero);
    const next = outsideHero ? -1 : end <= readingLine ? 2 : atlasTop <= readingLine ? 1 : 0;
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
  }, {...options, passive: true});
  for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown', 'resize']) {
    window.addEventListener(event, cancelSnap, {...options, passive: true, capture: true});
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
    lifetime.abort(); filmObserver.disconnect(); sizes.disconnect();
    cancelAnimationFrame(frame); cancelSnap();
    releaseFilms.forEach(release => release());
  };
}
