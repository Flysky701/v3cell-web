'use strict';

const specimen = document.querySelector('.specimen');
const canvas = document.querySelector('#specimen');
const cut = document.querySelector('#cut');
let opened = false;
const model = createOrganoidStructure(drawSpecimen, 56);

function drawSpecimen() {
  const {width, height} = canvas.getBoundingClientRect();
  if (!width || !height) return;
  const ratio = Math.min(devicePixelRatio || 1, 1.6);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  model.draw(ctx, {
    x: width / 2, y: height * .48, radius: height * .39,
    weights: [0, 0, 1, 0], yaw: .65, pitch: .40, opening: opened ? 1 : 0, form: 2
  });
}

cut.addEventListener('click', () => {
  opened = !opened;
  specimen.dataset.open = String(opened);
  cut.setAttribute('aria-pressed', String(opened));
  cut.querySelector('span').textContent = opened ? '看表面' : '看内部';
  cut.querySelector('i').textContent = opened ? '−' : '＋';
  document.querySelector('.callout').hidden = !opened;
  const caption = '类器官形态示意 · ' + (opened ? '楔形剖面' : '表面');
  canvas.setAttribute('aria-label', caption);
  document.querySelector('#specimen-caption').textContent = caption;
  drawSpecimen();
});
new ResizeObserver(drawSpecimen).observe(specimen);

const names = {colon:'结肠', stomach:'胃', lung:'肺'};
const group = document.querySelector('#lineages');
const subtype = document.querySelector('#subtype');
const crops = document.querySelector('#crops');

async function initAtlas() {
  const response = await fetch('assets/samples.json');
  if (!response.ok) throw new Error('样本清单读取失败');
  const samples = await response.json();
  let lineage = 'stomach';
  const choices = {stomach:'hollow'};
  function renderCrops() {
    choices[lineage] = subtype.value;
    const selected = samples.filter(s => s.lineage === lineage && s.subtype === subtype.value);
    const rows = ['real','virtual'].map(kind => {
      const row = document.createElement('div');
      row.className = 'sample-row';
      const label = document.createElement('div');
      label.className = 'row-name';
      const title = kind === 'real' ? '真实样本' : '虚拟样本';
      label.textContent = title;
      const source = document.createElement('small');
      source.textContent = kind === 'real' ? '成像' : '生成';
      label.append(source);
      row.append(label);
      selected.filter(s => s.kind === kind).forEach((s, i) => {
        const img = document.createElement('img');
        img.src = s.image;
        img.alt = names[lineage] + '，' + s.label + '，' + title + (i + 1);
        img.width = img.height = 64;
        row.append(img);
      });
      return row;
    });
    crops.replaceChildren(...rows);
  }
  function setLineage(code) {
    lineage = code;
    for (const button of group.children) button.setAttribute('aria-pressed', String(button.dataset.code === code));
    const available = new Map(samples.filter(s => s.lineage === code).map(s => [s.subtype,s.label]));
    subtype.replaceChildren(...Array.from(available, ([id,label]) => new Option(label,id)));
    if (available.has(choices[code])) subtype.value = choices[code];
    renderCrops();
  }
  for (const [code,label] of Object.entries(names)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.code = code;
    b.textContent = label;
    b.addEventListener('click', () => setLineage(code));
    group.append(b);
  }
  subtype.addEventListener('change', renderCrops);
  setLineage(lineage);
}
initAtlas().catch(() => {
  subtype.disabled = true;
  const a = document.createElement('a');
  a.href = 'index.html#results?tab=atlas';
  a.textContent = '样本清单读取失败，打开原样本图谱';
  crops.replaceChildren(a);
});

const time = document.querySelector('#time');
const hour = document.querySelector('#hour');
const previous = document.querySelector('#prev-hour');
const next = document.querySelector('#next-hour');
const hours = study.dynamic.hours;
const fateLabels = {formation:['腔体形成','#208485'], collapse:['腔体塌陷','#b66043'], noncavity:['未形成腔体','#7888ab']};
const frames = Object.entries(fateLabels).map(([id,[label,color]]) => {
  const figure = document.createElement('figure');
  figure.style.setProperty('--dot',color);
  const img = document.createElement('img');
  const caption = document.createElement('figcaption');
  caption.textContent = label;
  figure.append(img,caption);
  document.querySelector('#fates').append(figure);
  return {id,label,img};
});
document.querySelector('#ticks').replaceChildren(...hours.map(h => {
  const marker = document.createElement('span');
  marker.textContent = h;
  return marker;
}));
time.max = String(hours.length - 1);
function setTime(index) {
  time.value = String(index);
  hour.value = hours[index] + ' h';
  time.setAttribute('aria-valuetext',hours[index]+' 小时');
  previous.disabled = index === 0;
  next.disabled = index === hours.length - 1;
  for (const {id,label,img} of frames) {
    img.src = 'assets/trajectory-' + id + '-' + index + '.png';
    img.alt = label + '，' + hours[index] + ' 小时的虚拟明场图';
  }
}
time.addEventListener('input',() => setTime(Number(time.value)));
previous.addEventListener('click',() => setTime(Number(time.value) - 1));
next.addEventListener('click',() => setTime(Number(time.value) + 1));
setTime(Number(time.value));

