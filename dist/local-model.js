'use strict';

const localRunner = 'http://127.0.0.1:8765/v1/';
const authorRepo = 'https://github.com/Laineyoulu/V3Cell';
const authorRevision = 'ee2988f67c2ca33cd8df276f01289240be26d039';
const modelRecord = 'https://zenodo.org/records/24088077';
const localFates = {lumen:'formation', lumen_collapse:'collapse', non_lumen:'noncavity'};
const localModel = {
  files: [], thumbnails: [], condition: '', device: '', weights: null,
  result: '', record: '', seconds: 0, request: null, operation: '', error: ''
};

function agentSetupPrompt() {
  const runnerURL = new URL('local-runner.py', document.baseURI).href;
  const setup = bi(
    '请在我的电脑上接入 V3Cell 羊膜囊类器官时序模型。先检查已有源码、权重、Python 和可用硬件，复用兼容环境或新建独立环境。按以下来源准备缺少的文件，并在反序列化前核对 Zenodo 的 MD5。模型与图像均保存在本机。',
    'Set up the V3Cell amniotic-sac trajectory model on my computer. Inspect existing code, weights, Python and hardware. Reuse a compatible environment or create an isolated one. Obtain missing files from the sources below and verify the Zenodo MD5 checksums before loading. Keep weights and images on this computer.'
  );
  const launch = bi(
    '下载下方运行脚本（若本站需要登录，使用我从工作台下载的副本）。按作者 requirements.txt 准备 PyTorch 与推理依赖。用实际路径替换命令里的占位符。CPU 可先运行；具备兼容 CUDA 工具链时可改用 --device cuda。',
    'Download the runner below, or use the copy I downloaded from the workbench if the site requires login. Prepare PyTorch and inference dependencies from the author requirements.txt. Replace the command placeholders with actual local paths. Start with CPU or select --device cuda with a compatible CUDA toolchain.'
  );
  const verify = bi(
    '看到 ready 后访问 http://127.0.0.1:8765/v1/status，确认协议 v3cell-trajectory/1 和设备。打开工作台，连接本机并用同一序列按时间排列的 6 张 PNG 试跑。可用作者 assets/results/formation_real.gif 前 6 帧做接线测试，记录输入来源。公开推理入口要求手动给定命运。检查输出 GIF 共 25 帧，包括 6 帧条件重建和 19 帧推演。报告设备、权重校验、实际输出或具体错误，并给我下次启动的命令。',
    'After ready appears, check http://127.0.0.1:8765/v1/status for protocol v3cell-trajectory/1 and the device. Connect in the workbench and test six chronological PNGs from one sequence. The first six frames from the author assets/results/formation_real.gif may serve as a wiring test. Record the input source. The release uses a user-specified fate condition. Verify the 25-frame GIF contains six reconstructed and 19 future frames. Report the device, checksums, actual output or error, and the command to restart.'
  );
  return [setup, authorRepo + ' @ ' + authorRevision, modelRecord + ' · CC BY-NC 4.0',
    'stage1_amniotic_frames256_snapshot580.pkl  MD5 7443012c8896e4f538e76f5d472721ee',
    'stage2_motion_checkpoint_003999.pt  MD5 29341f317df553e134c470c1931ddf4d',
    launch, runnerURL,
    'python local-runner.py --source "<V3Cell>" --weights "<weights>" --device cpu --origin "' + location.origin + '"',
    verify].join('\n\n');
}

function clearLocalResult() {
  for (const key of ['result', 'record']) {
    if (localModel[key]) URL.revokeObjectURL(localModel[key]);
    localModel[key] = '';
  }
}

function clearLocalModel() {
  localModel.request?.abort();
  localModel.thumbnails.forEach(URL.revokeObjectURL);
  clearLocalResult();
  Object.assign(localModel, {files:[], thumbnails:[], condition:'', device:'', weights:null,
    request:null, operation:'', error:''});
}

function chooseLocalFrames(fileList) {
  clearLocalResult();
  localModel.thumbnails.forEach(URL.revokeObjectURL);
  const files = Array.from(fileList).sort((a,b) =>
    a.name.localeCompare(b.name, 'en', {numeric:true}) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const ok = files.length === 6 && files.every(f => /\.png$/i.test(f.name) && f.size > 0)
    && files.reduce((sum,f) => sum + f.size, 0) <= 24 * 1024 * 1024;
  localModel.files = ok ? files : [];
  localModel.thumbnails = localModel.files.map(f => URL.createObjectURL(f));
  localModel.error = ok || !files.length ? '' : 'files';
}

function encodeLocalFrame(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('read'));
    reader.readAsDataURL(file);
  });
}

function refreshLocalPanel() {
  const host = document.querySelector('#lab-host[data-mode="local"]');
  if (host) renderLocalModel(host);
}

async function contactLocalRunner(run) {
  if (localModel.request) return;
  const controller = new AbortController();
  localModel.request = controller;
  localModel.operation = run ? 'run' : 'connect';
  localModel.error = '';
  if (run) clearLocalResult();
  refreshLocalPanel();
  const timeout = run ? null : setTimeout(() => controller.abort(), 5000);
  const options = {signal:controller.signal, redirect:'error', credentials:'omit', cache:'no-store'};
  try {
    if (run) {
      const frames = await Promise.all(localModel.files.map(encodeLocalFrame));
      const start = performance.now();
      const response = await fetch(localRunner + 'trajectory', {...options, method:'POST',
        headers:{'Content-Type':'application/json'}, body:JSON.stringify({condition:localModel.condition, frames})});
      if (!response.ok) throw new Error(({400:'badImage', 409:'busy', 413:'files', 500:'model'})[response.status] || 'connect');
      if (response.headers.get('Content-Type') !== 'image/gif') throw new Error('protocol');
      const seed = response.headers.get('X-V3Cell-Seed');
      if (seed === null || !/^\d+$/.test(seed)) throw new Error('protocol');
      const gif = await response.blob();
      if (controller !== localModel.request) return;
      localModel.seconds = Number(((performance.now() - start) / 1000).toFixed(2));
      const record = {mode:'local-conditional-trajectory', live_inference:true, source:modelRecord,
        weights_md5:localModel.weights, device:localModel.device, seed:Number(seed),
        condition:localModel.condition, condition_source:'user', frames:localModel.files.map(f => f.name),
        reconstructed_frames:6, future_frames:19, request_seconds:localModel.seconds, completed_at:new Date().toISOString()};
      localModel.result = URL.createObjectURL(gif);
      localModel.record = URL.createObjectURL(new Blob([JSON.stringify(record,null,2)], {type:'application/json'}));
    } else {
      const response = await fetch(localRunner + 'status', options);
      if (!response.ok) throw new Error('connect');
      const info = await response.json();
      if (info.protocol !== 'v3cell-trajectory/1' || typeof info.device !== 'string' || !info.device) throw new Error('protocol');
      if (controller !== localModel.request) return;
      localModel.device = info.device;
      localModel.weights = info.weights;
    }
  } catch (error) {
    if (controller !== localModel.request) return;
    localModel.error = ['badImage','busy','files','model','protocol','read'].includes(error.message) ? error.message : 'connect';
    if (!run || localModel.error === 'connect') localModel.device = '';
  } finally {
    clearTimeout(timeout);
    if (controller === localModel.request) {
      localModel.request = null;
      localModel.operation = '';
      refreshLocalPanel();
    }
  }
}

function renderLocalModel(host) {
  const s = localModel;
  const errors = {
    connect: bi('未连通。请启动本机运行器，检查允许的网站地址及浏览器的本地网络权限，然后重新连接。','Connection failed. Start the runner, check the allowed site origin and browser local-network permission, then reconnect.'),
    files: bi('请选择 6 张 PNG，总大小不超过 24 MiB。','Select six PNGs totalling at most 24 MiB.'),
    badImage: bi('图像无法读取。每个文件须为单帧 PNG，最多 1600 万像素。','Check that each file is a single-frame PNG of at most 16 megapixels.'),
    busy: bi('本机正在运行另一条轨迹，请稍后重试。','The local model is busy. Try again when it finishes.'),
    model: bi('推理失败，请查看本机运行器窗口的错误信息。','Inference failed. Check the error in the local runner console.'),
    read: bi('文件读取失败，请重新选择。','Could not read the files. Please select them again.'),
    protocol: bi('运行器版本不匹配，请下载本页运行脚本。','Runner version mismatch. Download the runner from this page.')
  };
  host.innerHTML = `<section class="lab-panel local-panel"><div class="panel-heading">
    <h2>${bi('用早期明场图像推演发育轨迹','Generate a trajectory from early brightfield frames')}</h2>
    <p>${bi('选择同一羊膜囊类器官的 6 张早期图像，并指定一个命运条件。V3Cell 使用你电脑上的权重重建前 6 帧，再推演后续 19 帧。','Select six early frames of one amniotic-sac organoid and specify a fate condition. V3Cell uses the weights on your computer to reconstruct six frames and generate the next 19.')}</p></div>
    <div class="local-columns"><div><h3>${bi('本机运行器','Local runner')}</h3>
    <p>${bi('首次使用时，把接入提示词交给电脑上的 Agent。已有运行器时可直接连接。','For first-time setup, give the setup prompt to your local agent. If the runner is already active, connect below.')}</p>
    <div class="local-actions"><button class="btn secondary" id="local-connect" ${s.request?'disabled':''}>${bi('连接本机','Connect to this computer')}</button>
    <button class="chip" id="local-copy">${bi('复制 Agent 提示词','Copy agent prompt')}</button></div>
    <p id="local-status" role="status"></p><details id="local-setup"><summary>${bi('查看提示词与下载地址','Setup prompt and downloads')}</summary>
    <textarea id="local-prompt" readonly aria-label="Agent prompt" rows="8"></textarea>
    <div class="local-actions"><a href="local-runner.py" download>${bi('下载运行脚本','Download runner')}</a><a href="${modelRecord}" target="_blank" rel="noopener">${bi('下载模型权重','Get weights')}</a><a href="${authorRepo}" target="_blank" rel="noopener">${bi('作者代码','Author code')}</a></div></details></div>
    <div><h3>${bi('输入序列','Input sequence')}</h3>
    <label class="field">${bi('早期 PNG 图像（6 张）','Early PNG frames (6)')}<input id="local-files" type="file" accept=".png,image/png" multiple ${s.request?'disabled':''}></label>
    <p class="lab-note">${bi('按文件名中的数字排序。使用已按 2 小时间隔采样的连续帧；原始 15 分钟序列应每 8 帧取 1 帧。','Frames are ordered numerically by filename. Use consecutive frames sampled every two hours. For 15-minute acquisitions, take every eighth frame.')}</p>
    <ol class="local-frames"></ol>
    <label class="field">${bi('给模型的命运条件','Fate condition supplied to the model')}<select id="local-condition" ${s.request?'disabled':''}>
    <option value="">${bi('请选择','Select a condition')}</option>${Object.entries(localFates).map(([id,key])=>`<option value="${id}">${t(key)}</option>`).join('')}</select></label>
    <button class="btn" id="local-run" ${!s.device || s.request || !s.condition || s.files.length!==6?'disabled':''}>${bi('在本机生成轨迹','Generate on this computer')}</button></div></div>
    <p id="local-error" role="alert"></p>
    ${s.result?`<div class="local-output"><img src="${s.result}" alt="${bi('本机 V3Cell 生成的轨迹','Trajectory generated by local V3Cell')}">
    <div><h3>${bi('本机生成结果','Local result')}</h3><p>${t(localFates[s.condition])} · ${bi('6 帧重建 + 19 帧推演','6 reconstructed + 19 future frames')} · ${s.seconds} s</p>
    <div class="local-actions"><a href="${s.result}" download="v3cell-trajectory.gif">${bi('保存 GIF','Save GIF')}</a><a href="${s.record}" download="v3cell-run.json">${bi('保存运行记录','Save run record')}</a></div></div></div>`:''}
    </section>`;
  const get = id => host.querySelector('#local-' + id);
  get('prompt').value = agentSetupPrompt();
  get('status').textContent = s.operation === 'run' ? bi('正在本机推理…','Running on this computer…')
    : s.operation === 'connect' ? bi('正在连接…','Connecting…')
    : s.device ? bi('已连接 · ','Connected · ') + s.device : bi('尚未连接','Disconnected');
  get('error').textContent = errors[s.error] || '';
  get('condition').value = s.condition;
  if (s.files.length && typeof DataTransfer === 'function') {
    const selection = new DataTransfer();
    s.files.forEach(file => selection.items.add(file));
    get('files').files = selection.files;
  }
  s.files.forEach((file,i) => {
    const li = document.createElement('li'), img = new Image(), label = document.createElement('span');
    img.src = s.thumbnails[i]; img.alt = ''; label.textContent = (i + 1) + ' · ' + file.name;
    li.append(img,label); host.querySelector('.local-frames').append(li);
  });
  get('connect').onclick = () => contactLocalRunner(false);
  get('run').onclick = () => contactLocalRunner(true);
  get('condition').onchange = e => { s.condition = e.target.value; clearLocalResult(); refreshLocalPanel(); };
  get('files').onchange = e => { chooseLocalFrames(e.target.files); refreshLocalPanel(); };
  get('copy').onclick = async () => {
    try {
      await navigator.clipboard.writeText(get('prompt').value);
      get('copy').textContent = bi('已复制','Copied');
    } catch {
      get('setup').open = true; get('prompt').focus(); get('prompt').select();
    }
  };
}
