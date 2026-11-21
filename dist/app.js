'use strict';

const main = document.querySelector('main');
const lineageCounts = Object.fromEntries(Object.entries(study.static.lineages).map(([id, data]) => [id, data.classes]));
const resultTabs = ['atlas', 'quality', 'phenotyping', 'temporal'];
const fateIds = Object.keys(study.dynamic.fates);
const trajectoryHours = study.dynamic.hours;
const lastFrame = trajectoryHours.length - 1;
const chapters = ['home-top', 'home-atlas', 'home-fate'];
const chapterTitles = ['introChapter', 'atlasChapter', 'fateChapter'];
let samples = [], selectedLineage = 'all', fate = 'formation', frame = 0;
let compareFates = false, timer = null, fileUrls = [], uploadTotal = 0, page = 'home';
let disposeHomeStory, resultNavObserver;
const bi = (zh, en) => language === 'en' ? en : zh;
const msg = key => `<span data-i18n="${key}">${t(key)}</span>`;
const eye = key => `<div class="eyebrow"><span class="dot"></span>${msg(key)}</div>`;
const frameImage = (key, index) => `assets/trajectory-${key}-${index}.png`;
const figureData = {
  framework: ['frameworkTitle', 'frameworkCaption', 951, 441],
  'static-comparison': ['staticTitle', 'staticCaption', 930, 746],
  quality: ['qualityTitle', 'qualityCaption', 943, 616],
  phenotyping: ['classificationTitle', 'classificationCaption', 943, 483],
  trajectories: ['trajectoryTitle', 'trajectoryCaption', 930, 1013]
};


function chapterFilm(id, duration, caption, cues) {
  const asset = 'assets/films/' + id + (language === 'en' ? '-en' : '');
  const intervals = cues.map(([start], i) => {
    const end = cues[i + 1]?.[0] ?? duration;
    return 'minmax(30px,' + (end - start).toFixed(2) + 'fr)';
  });
  const secondsPart = seconds => String(seconds).replace(/^\d(?=\.|$)/, '0$&');
  return `<figure class="film-plate">
    <div class="film-animation-slot" data-animation-slot="${id}">
      <video controls muted playsinline preload="metadata" width="1280" height="720"
        data-film="${id}" data-duration="${duration}" poster="${asset}.webp" data-i18n-label="${caption}"></video>
      ${id === 'phenotypes' ? '<span class="docked-specimen" aria-hidden="true"></span>' : ''}
    </div>
    <figcaption>
      <div class="film-timeline" role="group" data-i18n-label="filmSeek" style="grid-template-columns:${intervals.join(' ')}">
        ${cues.map(([seconds, key]) => `<div class="film-interval"><button type="button" class="film-node" data-time="${seconds}">
          <span class="film-node-time"><span class="film-minutes">0:</span>${secondsPart(seconds)}</span><span class="film-node-name" data-i18n="${key}">${t(key)}</span>
        </button></div>`).join('')}
      </div>
      <div class="film-clock"><span class="film-key" aria-hidden="true"></span><span class="film-current-name"></span>
        <span class="film-duration">0:${secondsPart(duration)}</span></div>
    </figcaption>
  </figure>`;
}

function home() {
  const sectionImage = 'assets/organoid-section.webp';
  const cultureField = forms => `<div class="culture-field" aria-hidden="true">
    ${forms.map(form => `<i class="micro-${form}"></i>`).join('')}
  </div>`;
  const atlasLinks = Object.keys(lineageCounts).map(lineage =>
    `<a href="#results?tab=atlas&lineage=${lineage}">${msg(lineage)}</a>`).join('');
  return `<section class="hero film-home">
    <article class="film-cover" id="home-top" data-chapter="0" aria-labelledby="film-title">
      ${cultureField(['budding','section','folded'])}
      <img class="cover-specimen" src="${sectionImage}" width="1254" height="1254" fetchpriority="high" data-i18n-alt="filmSectionAlt" alt="">
      <div class="cover-copy">
        <div class="film-eyeline" lang="en">Virtual 3D Cell</div>
        <h1 id="film-title">V3Cell</h1>
        <h2>${msg('filmSubject')}</h2><p>${msg('filmIntro')}</p>
        <a class="film-scroll" href="#home-atlas"><i aria-hidden="true">↓</i>${msg('filmScroll')}</a>
      </div>
      <div class="cover-credit"><span class="film-key"></span>${msg('filmSectionCaption')}</div>
    </article>
    <article class="film-atlas" id="home-atlas" data-chapter="1" aria-labelledby="film-atlas-title">
      ${cultureField(['solid','rosette','budding'])}
      ${chapterFilm('phenotypes',10,'filmStaticCaption',[[0,'filmOpening'],[1.16,'filmSectionField'],
        [3,'filmMicroscope'],[5.45,'filmGan'],[6,'filmComparison'],[7.7,'filmFidelity']])}
      <div class="film-reading"><div class="film-eyeline" lang="en">Static phenotypes</div>
        <h2 id="film-atlas-title">${msg('atlasChapter')}</h2><p>${msg('filmCompare')}</p>
        <div class="film-samples">
          <figure class="film-sample real"><img src="assets/stomach-hollow-real-1.png" width="64" height="64" alt=""><figcaption><strong>${msg('filmReal')}</strong><span>${msg('filmObserved')}</span></figcaption></figure>
          <figure class="film-sample virtual"><img src="assets/stomach-hollow-virtual-1.png" width="64" height="64" alt=""><figcaption><strong>${msg('filmVirtual')}</strong><span>${msg('filmGenerated')}</span></figcaption></figure>
        </div>
        <small class="film-source">${msg('filmSampleSource')}</small>
        <div class="film-lineages">${atlasLinks}</div>
      </div>
    </article>
    <article class="film-fate" id="home-fate" data-chapter="2" aria-labelledby="film-fate-title">
      ${cultureField(['folded','budding','section'])}
      <div class="film-reading"><div class="film-eyeline" lang="en">Developmental fates</div>
        <h2 id="film-fate-title">${msg('fateChapter')}</h2><p>${msg('filmFate')}</p>
        <a class="film-text-link" href="#workbench?compare">${msg('readFateFigure')}</a></div>
      ${chapterFilm('fates',18,'filmDynamicCaption',[[0,'filmEarly'],[3.7,'filmEncoding'],[6.9,'filmCandidates'],
        [10,'filmRanking'],[12.2,'filmHighest'],[14.4,'filmRollout'],[17,'filmFuture']])}
    </article>
    <img class="travel-specimen" src="${sectionImage}" width="1254" height="1254" alt="" aria-hidden="true">
  </section>
  <nav class="home-chapters" data-i18n-label="chapterSelect"><span class="home-progress">0%</span>
    ${chapters.map((id,i) => `<a href="#${id}" data-i18n-label="${chapterTitles[i]}">0${i+1}</a>`).join('')}</nav>
  <section id="research"><div class="research-summary"><div class="wrap">${eye('studyEvidence')}<h2 class="research-title">${msg('evidenceTitle')}</h2>
    <div class="kpi-grid">${[['7,749','roiKpi'],['+44.7 pp','gainKpi'],['88.9%','accKpi'],['r = 0.991','rKpi']].map(([value,key]) => `<article><strong>${value}</strong><p>${msg(key)}</p></article>`).join('')}</div>
    </div></div><div class="research-studies"><div class="wrap research-branches"><article>${eye('s3tag')}<h3>${msg('constructTitle')}</h3><p>${msg('staticStudyText')}</p><a class="text-link" href="#results?tab=atlas">${msg('results')} ↗</a></article>
    <article>${eye('s4tag')}<h3>${msg('forecastTitle')}</h3><p>${msg('dynamicLead')}</p><a class="text-link" href="#workbench?compare">${msg('compareTrajectories')} ↗</a></article></div></div>
    <div class="wrap research-source"><div class="paper"><div class="paper-label">${msg('manuscript')}</div><div><h3 lang="en">V3Cell: A Vision-Guided Virtual 3D Cell Framework for Phenotypic Modeling and Perturbation Prediction</h3><p>Lu You · Xun Deng · Chenke Xu · Jianying Hu · Pengwei Hu</p></div><button class="btn secondary" data-figure="framework">${msg('viewFramework')} ↗</button></div><p class="provenance">${msg('frameworkNote')}</p></div></section>`;
}
function trajectoryWorkspace() {
  return `<div class="workspace"><aside class="sidebar"><h2 data-i18n="setup"></h2>
    <label class="field">${msg('system')}<select id="system-select"><option data-i18n="amniotic"></option></select></label>
    <label class="field" id="fate-field">${msg('developmentalFate')}<select id="fate-select">${fateIds.map(id => `<option value="${id}" ${id === fate ? 'selected' : ''} data-i18n="${id}"></option>`).join('')}</select></label>
    <p class="aside-note">${msg('frameSource')}<br>${msg('timeRange')}<br>${msg('allVirtual')}</p><hr class="sidebar-divider">
    <label class="upload-box">＋ <b data-i18n="upload"></b>${msg('uploadTypes')}<input type="file" id="image-upload" accept="image/png,image/jpeg,image/webp" multiple data-i18n-label="chooseImages"></label>
    <p class="aside-note" data-i18n="previewPrivacy"></p><div id="upload-preview" class="upload-preview"></div><p id="upload-status" class="upload-status" role="status"></p>
    <button class="btn secondary" id="reset-workbench">${msg('reset')} ↺</button></aside>
    <div class="lab-main"><div class="lab-toolbar"><h2 data-i18n="explorer"></h2><button id="compare-fates" class="chip" type="button" aria-controls="single-trajectory compared-trajectories" data-i18n="compareTrajectories"></button></div>
      <div id="single-trajectory" class="preview-stage"><div class="microscope"><span class="corner-label" data-i18n="virtualFig"></span><img id="main-frame" src="${frameImage(fate,frame)}" width="256" height="256" alt=""><span id="frame-time" class="frame-time"></span></div>
      <div class="frame-details"><div class="eyebrow" data-i18n="developmentalFate"></div><h3 id="fate-title"></h3><p id="fate-description"></p>
        <div class="detail-list"><div><span>${msg('probability')} · r</span><b id="current-probability"></b></div><div><span id="current-metric"></span><b id="current-morphometry"></b></div><div>${msg('modality')}<b data-i18n="brightfield"></b></div><div>${msg('imageSource')}<b data-i18n="manuscriptSample"></b></div><div>${msg('timePoint')}<b id="frame-count"></b></div></div>
      </div></div>
      <section id="compared-trajectories" class="comparison-stage" data-i18n-label="compareTrajectories" hidden>
        <div class="comparison-caption"><span data-i18n="sharedTime"></span><span data-i18n="virtualFig"></span></div>
        <div class="comparison-grid">${fateIds.map(id => `<figure><img data-compare-fate="${id}" width="256" height="256" alt=""><figcaption data-i18n="${id}"></figcaption></figure>`).join('')}</div>
      </section>
      <div class="window-band"><span>${bi("早期条件输入","Early conditioning")} · K = 6</span><span>${bi("自回归轨迹推演","Autoregressive rollout")} · 19</span></div><div class="timeline-control"><button id="play" class="icon-button">▶</button><label for="time-slider" class="sr-only" data-i18n="cultureTime"></label><input type="range" id="time-slider" min="0" max="${lastFrame}" step="1" value="${frame}"><output id="time-output" for="time-slider"></output></div>
      <div class="frame-strip">${trajectoryHours.map((hour,i) => `<button class="frame-button" data-frame="${i}"><img src="${frameImage(fate,i)}" width="64" height="64" alt=""><span>${hour} h</span></button>`).join('')}</div>
      <div id="linked-evidence"></div><div class="lab-bottom"><p data-i18n="replayNote"></p><button id="export-selection">${msg('exportRecord')} ↓</button></div>
    </div></div>`;
}

function updatePlayButton() {
  const b = document.querySelector('#play');
  if (b) {
    b.textContent = timer ? 'Ⅱ' : '▶';
    b.setAttribute('aria-label',t(timer ? 'pause' : 'play'));
  }
}

function stopPlayback() {
  clearInterval(timer);
  timer = null;
  updatePlayButton();
}

function updateFrame() {
  const hour = trajectoryHours[frame];
  document.querySelector('#compare-fates').setAttribute('aria-pressed',String(compareFates));
  document.querySelector('#fate-field').hidden = compareFates;
  document.querySelector('#single-trajectory').hidden = compareFates;
  document.querySelector('#compared-trajectories').hidden = !compareFates;
  document.querySelector('.frame-strip').classList.toggle('time-ticks',compareFates);

  if (compareFates) {
    document.querySelectorAll('[data-compare-fate]').forEach(image => {
      const id = image.dataset.compareFate;
      image.src = frameImage(id,frame);
      image.alt = t('frameAlt', {name:t(id),hour});
    });
  }
  const image = document.querySelector('#main-frame');
  image.src = frameImage(fate,frame);
  image.alt = t('frameAlt', {name:t(fate),hour});
  document.querySelector('#frame-time').textContent = `${hour} h / ${t('cultureTime')}`;
  document.querySelector('#fate-title').textContent = t(fate);
  const outcome = study.dynamic.fates[fate];
  document.querySelector('#current-probability').textContent = outcome.probability.toFixed(3);
  document.querySelector('#current-metric').textContent = t(outcome.metric)+' · r';
  document.querySelector('#current-morphometry').textContent = outcome.morphometry.toFixed(3);
  document.querySelector('#fate-description').textContent = phaseReading(fate,hour);
  document.querySelector('#frame-count').textContent = `0${frame+1} / 0${trajectoryHours.length}`;
  document.querySelector('#time-output').textContent = `${hour} h`;
  const slider = document.querySelector('#time-slider');
  slider.value = frame;
  slider.setAttribute('aria-valuetext',t('hours',{hour}));
  for (const b of document.querySelectorAll('[data-frame]')) {
    const i = Number(b.dataset.frame);
    b.setAttribute('aria-pressed',String(i === frame));
    b.setAttribute('aria-label',t('viewTime',{hour:trajectoryHours[i]}));
    b.querySelector('img').src = frameImage(fate,i);
  }
  updateLinkedEvidence();
  updatePlayButton();
}

function clearUploads() {
  fileUrls.forEach(url => URL.revokeObjectURL(url));
  fileUrls = [];
  uploadedNames = [];
  uploadTotal = 0;
}

function updateUploadStatus() {
  const status = document.querySelector('#upload-status');
  if (!uploadTotal) { status.textContent = ''; return; }
  if (!fileUrls.length) { status.textContent = t('uploadInvalid'); return; }
  const lines = [t(fileUrls.length === 1 ? 'uploadedOne' : 'uploadedMany',{count:fileUrls.length})];
  if (fileUrls.length < uploadTotal) lines.push(t('uploadLimit'));
  lines.push(t('noPrediction'));
  status.textContent = lines.join(language === 'en' ? ' ' : '');
}

function updateLanguage() {
  document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';
  document.title = 'V3Cell — '+t(page);
  document.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-pressed',String(b.dataset.lang === language)));
  localize(document);
  if (page === 'results' && main.querySelector('.evidence-section')) refreshEvidence();
  if (page === 'workbench' && main.querySelector('#lab-host')) renderLab();

}

document.addEventListener('click', e => {
  const link = e.target.closest('a[href]');
  if (link && link.hash === location.hash && ['#home','#results','#workbench'].includes(link.hash)) {
    window.scrollTo({top:0,behavior:'smooth'});
  }
});
const backToTop = document.getElementById('back-to-top');
const header = document.querySelector('.header');
const headerVisibility = new IntersectionObserver(([entry]) => {
  backToTop.hidden = entry.isIntersecting;
}, {rootMargin:'100px 0px 0px'});
headerVisibility.observe(header);

const homeTextObserver = new IntersectionObserver(entries => {
  let order = 0;
  for (const {target, isIntersecting} of entries) {
    if (!isIntersecting) continue;
    target.style.setProperty('--text-delay', Math.min(order, 3) * 70 + 'ms');
    target.classList.replace('home-text-pending', 'home-text-shown');
    homeTextObserver.unobserve(target);
    order++;
  }
}, {rootMargin:'0px 0px -16px'});

function observeHomeText() {
  const textBlocks = main.querySelectorAll([
    '#research :is(.eyebrow, h2, h3, .paper-label, .provenance)',
    '.kpi-grid article', '.research-branches p', '.research-source .paper p'
  ].join(', '));
  for (const block of textBlocks) {
    block.classList.add('home-text-pending');
    homeTextObserver.observe(block);
  }
}

backToTop.addEventListener('click',() => {
  header.querySelector('.brand').focus({preventScroll:true});
  window.scrollTo({top:0,behavior:'auto'});
});

document.querySelector('.language-switch').addEventListener('click', e => {
  const b = e.target.closest('[data-lang]');
  if (!b || b.dataset.lang === language) return;
  const chapterLink=main.querySelector('.home-chapters a[aria-current="location"]');
  const chapter=chapterLink && document.getElementById(chapterLink.hash.slice(1));
  const before=chapter?.getBoundingClientRect();
  language = b.dataset.lang;
  try { localStorage.setItem('v3cell.language',language); } catch { /* Keep the choice for this visit. */ }
  updateLanguage();
  if (page === 'home') main.querySelector('.film-home')?.dispatchEvent(new Event('filmlanguagechange'));
  // Translated chapters wrap at different heights, particularly on phones.
  if (before && before.top<innerHeight && before.bottom>0 && window.scrollY>0) {
    window.scrollBy({top:chapter.getBoundingClientRect().top-before.top,behavior:'instant'});
  }
});

function route() {
  const [requestedPath,query] = (location.hash.slice(1) || 'home').split('?');
  const path = requestedPath === 'home-background' ? 'home-top' : requestedPath === 'home-method' ? 'home-fate' : requestedPath;
  if (path === 'main') { main.focus(); return; }
  const anchor = [...chapters, 'research'].includes(path);
  if (page === 'home' && main.querySelector('.film-home')) {
    if (path === 'home') {
      window.scrollTo({top: 0, behavior: 'smooth'});
      return;
    }
    if (anchor && document.getElementById(path)) {
      document.getElementById(path).scrollIntoView();
      return;
    }
  }
  clearToast();
  const previousPage = page;
  if (previousPage === 'workbench' && path !== 'workbench') clearLocalModel();
  stopPlayback();
  if (previousPage !== path) clearUploads();
  disposeHomeStory?.();
  disposeHomeStory = undefined;
  homeTextObserver.disconnect();
  resultNavObserver?.disconnect();
  resultNavObserver = undefined;
  page = ['results','workbench'].includes(path) ? path : 'home';
  const params = new URLSearchParams(query);
  const tab = params.get('tab');
  if (page === 'results') {
    focusedResult = resultTabs.includes(tab) ? tab : 'atlas';
    if (previousPage !== 'results' || !query) selectedLineage = 'all';
    if (Object.hasOwn(lineageCounts,params.get('lineage'))) { selectedLineage = params.get('lineage'); focusedResult = 'atlas'; }
  }
  if (page === 'workbench') {
    labTab = labModes.includes(tab) ? tab : 'dynamics';
    compareFates = params.has('compare');
  }
  main.innerHTML = page === 'results' ? results() : page === 'workbench' ? workbench() : home();
  document.querySelectorAll('[data-nav]').forEach(a => {
    if (a.dataset.nav === page) a.setAttribute('aria-current','page');
    else a.removeAttribute('aria-current');
  });
  updateLanguage();
  if (page === 'results') {
    const nav = main.querySelector('.evidence-nav');
    const setOffset = () => main.style.setProperty('--result-nav-height',nav.offsetHeight+'px');
    setOffset();
    resultNavObserver = new ResizeObserver(setOffset);
    resultNavObserver.observe(nav);
  }
  if (page === 'home') {
    observeHomeText();
    disposeHomeStory = mountHomeStory(main.querySelector('.hero'));
  }
  if (page === 'workbench') {
    // Warm the other trajectories so playback can switch all three frames together.
    for (const id of fateIds) {
      if (id === fate) continue;
      for (const index of trajectoryHours.keys()) {
        const image = new Image();
        image.src = frameImage(id,index);
      }
    }
  }
  if (page === 'results' && resultTabs.includes(tab)) document.getElementById('result-'+focusedResult).scrollIntoView({behavior:'instant'});
  else if (anchor) document.getElementById(path).scrollIntoView();
  else window.scrollTo({top:0,behavior:'instant'});
}

let toastTimeout;
function clearToast() {
  clearTimeout(toastTimeout);
  const toast = document.getElementById('toast');
  toast.classList.remove('show');
  delete toast.dataset.i18n;
  toast.textContent = '';
}
function showToast(key) {
  const toast = document.querySelector('#toast');
  toast.dataset.i18n = key;
  toast.textContent = t(key);
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(clearToast,3000);
}

main.addEventListener('click', e => {
  const link = e.target.closest('[data-result-tab], [data-lab-mode]');
  if (link && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
    e.preventDefault();
    if (location.hash !== link.hash) history.pushState(null,'',link.hash);
    clearToast();
    if (link.dataset.resultTab) {
      focusedResult = link.dataset.resultTab;
      applyResultSelection();
      document.getElementById('result-'+focusedResult).scrollIntoView();
    } else {
      stopPlayback();
      labTab = link.dataset.labMode;
      renderLab();
    }
    return;
  }
  if (handleEvidenceClick(e.target) || handleLabClick(e.target)) return;
  const fb = e.target.closest('[data-frame]');
  if (fb) { stopPlayback(); frame = Number(fb.dataset.frame); updateFrame(); }
  if (e.target.closest('#compare-fates')) {
    compareFates = !compareFates;
    const nextHash = compareFates ? '#workbench?compare' : '#workbench';
    if (location.hash !== nextHash) history.replaceState(null, '', nextHash);
    updateFrame();
  }
  const figure = e.target.closest('[data-figure]');
  if (figure) {
    const id = figure.dataset.figure;
    const [title, caption, width, height] = figureData[id];
    const image = document.querySelector('#figure-image');
    image.removeAttribute('src');
    image.width = width;
    image.height = height;
    image.src = 'assets/' + id + '.png';
    image.dataset.i18nAlt = title;
    document.querySelector('#figure-title').dataset.i18n = title;
    document.querySelector('#figure-caption').dataset.i18n = caption;
    const dialog = document.querySelector('#figure-dialog');
    localize(dialog);
    dialog.showModal();
  }
  if (e.target.closest('#play')) {
    if (timer) stopPlayback();
    else {
      if (frame === lastFrame) frame = 0;
      timer = setInterval(() => { frame++; updateFrame(); if (frame === lastFrame) stopPlayback(); },850);
      updateFrame();
    }
  }
  if (e.target.closest('#reset-workbench')) {
    stopPlayback(); clearUploads(); fate = 'formation'; frame = 0; compareFates = false;
    if (location.hash === '#workbench?compare') history.replaceState(null, '', '#workbench');
    renderLab(); showToast('resetDone');
  }
  if (e.target.closest('#export-selection')) {
    const hour = trajectoryHours[frame];
    const samplesAtTime = (compareFates ? fateIds : [fate]).map(id => ({fate:id,phenotype:t(id),asset:frameImage(id,frame)}));
    const record = {
      mode:'manuscript-figure-replay',
      source:'main_nbe.pdf, Figure 5A, page 10',
      culture_time_hours:hour,
      frame_index:frame,
      ...(compareFates ? {fates:samplesAtTime} : samplesAtTime[0]),
      live_inference:false
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'}));
    const a = document.createElement('a'); a.href = url; a.download = `v3cell-${compareFates ? 'comparison' : fate}-${hour}h.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url),1000); showToast('exported');
  }
});

main.addEventListener('change', e => {
  if (e.target.id === 'lab-subtype') { labSubtype = e.target.value; renderArchitecture(); document.getElementById('lab-subtype').focus({preventScroll:true}); }
  if (e.target.id === 'fate-select') { stopPlayback(); fate = e.target.value; updateFrame(); }
  if (e.target.id === 'image-upload') {
    clearUploads();
    const preview = document.querySelector('#upload-preview');
    preview.replaceChildren();
    const files = Array.from(e.target.files || []);
    uploadTotal = files.length;
    const accepted = files.filter(f => ['image/png','image/jpeg','image/webp'].includes(f.type) && f.size <= 10*1024*1024).slice(0,6);
    accepted.forEach(f => {
      const url = URL.createObjectURL(f); fileUrls.push(url); uploadedNames.push(f.name);
      const image = document.createElement('img'); image.src = url; image.alt = f.name; preview.appendChild(image);
    });
    updateUploadStatus();
  }
});
main.addEventListener('input', e => {
  if (e.target.id === 'time-slider') { stopPlayback(); frame = Number(e.target.value); updateFrame(); }
});
function openInspection(title,content) {
  document.getElementById('inspection-title').textContent = title;
  document.getElementById('inspection-content').innerHTML = content;
  document.getElementById('inspection').showModal();
}
const inspection = document.getElementById('inspection');
document.getElementById('close-inspection').addEventListener('click',() => inspection.close());
inspection.addEventListener('click', e => {
  if (e.target === inspection) { inspection.close(); return; }
  const b = e.target.closest('[data-magnify]');
  if (!b) return;
  const group = b.closest('figure');
  group.querySelector('img').src = b.dataset.magnify;
  for (const item of group.querySelectorAll('[data-magnify]')) item.setAttribute('aria-pressed',String(item === b));
});
let navFrame = 0;
window.addEventListener('scroll',() => {
  if (navFrame || page !== 'results' || singleResult) return;
  navFrame = requestAnimationFrame(() => {
    navFrame = 0;
    if (page !== 'results' || singleResult) return;
    const threshold = main.querySelector('.evidence-nav').offsetHeight + 65;
    let current = resultTabs[0];
    for (const id of resultTabs) {
      if (document.getElementById('result-'+id).getBoundingClientRect().top <= threshold) current = id;
    }
    if (current !== focusedResult) { focusedResult = current; applyResultSelection(); }
  });
},{passive:true});
document.querySelector('#close-dialog').addEventListener('click', () => document.querySelector('#figure-dialog').close());
document.querySelector('#figure-dialog').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.close(); });

updateLanguage();
fetch('assets/samples.json')
  .then(response => {
    if (!response.ok) throw new Error('Sample index unavailable');
    return response.json();
  })
  .then(data => {
    samples = data;
    window.addEventListener('hashchange',route);
    route();
  })
  .catch(() => {
    main.innerHTML = '<div class="load-error"><h1 data-i18n="loadTitle"></h1><p data-i18n="loadHelp"></p><button class="btn" data-i18n="retry"></button></div>';
    localize(main);
    main.querySelector('button').addEventListener('click', () => location.reload());
  });
