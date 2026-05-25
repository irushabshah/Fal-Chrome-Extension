document.addEventListener('DOMContentLoaded', () => {
  const ROW_COUNT = 10;
  let generatedAssets = [];

  // ─────────────────────────────────────────────────────────────
  // MODEL REGISTRY
  // To add a new model: append one config object to this array.
  // No other code changes needed.
  // ─────────────────────────────────────────────────────────────
  const MODELS = [

    // ── IMAGE MODELS ───────────────────────────────────────────
    {
      id: 'nb2-t2i',
      label: 'Text to Image (Nano Banana 2)',
      section: 'image',
      endpoint: 'https://fal.run/fal-ai/nano-banana-2',
      useQueue: false,
      outputType: 'image',
      responseExtractor: d => d?.images?.[0]?.url ?? null,
      slotConfig: { startImage: false, endImage: false, imageKey: null },
      promptPlaceholder: 'Prompt (e.g. A cinematic corporate office.)',
      settings: [
        { id: 'aspect', label: 'Aspect Ratio', type: 'select', default: '16:9', payloadKey: 'aspect_ratio',
          options: [{v:'16:9',l:'16:9'},{v:'9:16',l:'9:16'},{v:'1:1',l:'1:1'},{v:'4:3',l:'4:3'},
                    {v:'3:4',l:'3:4'},{v:'21:9',l:'21:9'},{v:'9:21',l:'9:21'},{v:'auto',l:'Auto'}] },
        { id: 'res', label: 'Resolution', type: 'select', default: '2K', payloadKey: 'resolution',
          options: [{v:'2K',l:'2K'},{v:'1K',l:'1K'},{v:'4K',l:'4K'},{v:'0.5K',l:'0.5K'}] },
      ],
      advancedSettings: [
        { id: 'format', label: 'Format', type: 'select', default: 'png', payloadKey: 'output_format',
          options: [{v:'png',l:'PNG'},{v:'jpeg',l:'JPEG'},{v:'webp',l:'WEBP'}] },
        { id: 'safety', label: 'Safety', type: 'select', default: '4', payloadKey: 'safety_tolerance',
          options: [{v:'1',l:'1 (Strict)'},{v:'2',l:'2'},{v:'3',l:'3'},{v:'4',l:'4 (Default)'},{v:'5',l:'5'},{v:'6',l:'6 (Loose)'}] },
        { id: 'thinking', label: 'Thinking', type: 'select', default: 'none', payloadKey: 'thinking_level',
          options: [{v:'none',l:'None'},{v:'minimal',l:'Minimal'},{v:'high',l:'High'}],
          transform: v => v === 'none' ? undefined : v },
        { id: 'web', label: 'Web Search', type: 'select', default: 'false', payloadKey: 'enable_Web Search',
          options: [{v:'false',l:'Disabled'},{v:'true',l:'Enabled'}],
          transform: v => v === 'true' },
        { id: 'seed', label: 'Seed (Optional)', type: 'number', payloadKey: 'seed', optional: true,
          transform: v => parseInt(v) },
      ],
      additionalPayload: { num_images: 1, limit_generations: true },
      buttonLabel: 'Generate Text-to-Image',
    },

    {
      id: 'gpt-i2i',
      label: 'Image Editing (GPT Image 2)',
      section: 'image',
      endpoint: 'https://fal.run/openai/gpt-image-2/edit',
      useQueue: false,
      outputType: 'image',
      responseExtractor: d => d?.images?.[0]?.url ?? null,
      slotConfig: { startImage: true, endImage: false, imageKey: 'image_urls' },
      promptPlaceholder: 'Edit Prompt (e.g. Add a sunset sky behind the building.)',
      settings: [
        { id: 'size', label: 'Image Size', type: 'select', default: '3840x2160', payloadKey: 'image_size',
          options: [{v:'2560x1440',l:'2560×1440'},{v:'3840x2160',l:'3840×2160 (4K)'},{v:'1024x1024',l:'1024×1024'},
                    {v:'1536x1024',l:'1536×1024'},{v:'1024x1536',l:'1024×1536'},{v:'auto',l:'Auto'}],
          transform: v => v === 'auto' ? 'auto' : (() => { const [w, h] = v.split('x').map(Number); return { width: w, height: h }; })() },
        { id: 'quality', label: 'Quality', type: 'select', default: 'medium', payloadKey: 'quality',
          options: [{v:'medium',l:'Medium'},{v:'low',l:'Low'},{v:'high',l:'High'}] },
      ],
      advancedSettings: [
        { id: 'format', label: 'Format', type: 'select', default: 'png', payloadKey: 'output_format',
          options: [{v:'png',l:'PNG'},{v:'jpeg',l:'JPEG'},{v:'webp',l:'WEBP'}] },
      ],
      additionalPayload: { num_images: 1 },
      buttonLabel: 'Generate GPT Image 2',
    },

    // ── VIDEO MODELS ───────────────────────────────────────────
    {
      id: 'seedance2-i2v',
      label: 'SeedDance 2.0 (Image to Video)',
      section: 'video',
      endpoint: 'https://queue.fal.run/bytedance/seedance-2.0/image-to-video',
      useQueue: true,
      outputType: 'video',
      responseExtractor: d => d?.video?.url ?? null,
      slotConfig: { startImage: true, endImage: true, imageKey: 'image_url' },
      promptPlaceholder: 'Motion Prompt (e.g. Slow zoom with gentle camera drift.)',
      settings: [
        { id: 'res', label: 'Resolution', type: 'select', default: '1080p', payloadKey: 'resolution',
          options: [{v:'480p',l:'480p'},{v:'720p',l:'720p'},{v:'1080p',l:'1080p'}] },
        { id: 'dur', label: 'Duration', type: 'select', default: '8', payloadKey: 'duration',
          options: [{v:'4',l:'4s'},{v:'5',l:'5s'},{v:'6',l:'6s'},{v:'8',l:'8s'},{v:'10',l:'10s'},{v:'12',l:'12s'},{v:'15',l:'15s'}],
          transform: v => parseInt(v) },
      ],
      advancedSettings: [
        { id: 'aspect', label: 'Aspect Ratio', type: 'select', default: 'auto', payloadKey: 'aspect_ratio',
          options: [{v:'auto',l:'Auto'},{v:'16:9',l:'16:9'},{v:'9:16',l:'9:16'},{v:'1:1',l:'1:1'},
                    {v:'4:3',l:'4:3'},{v:'3:4',l:'3:4'},{v:'21:9',l:'21:9'}] },
        { id: 'audio', label: 'Audio', type: 'select', default: 'false', payloadKey: 'generate_audio',
          options: [{v:'false',l:'Off'},{v:'true',l:'On'}],
          transform: v => v === 'true' },
        { id: 'seed', label: 'Seed (Optional)', type: 'number', payloadKey: 'seed', optional: true,
          transform: v => parseInt(v) },
      ],
      additionalPayload: {},
      buttonLabel: 'Generate SeedDance 2.0 Videos',
    },

    {
      id: 'veo31-i2v',
      label: 'Video Generation (Veo 3.1)',
      section: 'video',
      endpoint: 'https://queue.fal.run/fal-ai/veo3.1/image-to-video',
      useQueue: true,
      outputType: 'video',
      responseExtractor: d => d?.video?.url ?? null,
      slotConfig: { startImage: true, endImage: false, imageKey: 'image_url' },
      promptPlaceholder: 'Motion Prompt (e.g. Slow zoom into the scene.)',
      settings: [
        { id: 'res', label: 'Resolution', type: 'select', default: '1080p', payloadKey: 'resolution',
          options: [{v:'1080p',l:'1080p'},{v:'720p',l:'720p'},{v:'4k',l:'4K'}] },
        { id: 'dur', label: 'Duration', type: 'select', default: '8s', payloadKey: 'duration',
          options: [{v:'8s',l:'8s'},{v:'6s',l:'6s'},{v:'4s',l:'4s'}] },
      ],
      advancedSettings: [
        { id: 'aspect', label: 'Aspect Ratio', type: 'select', default: '16:9', payloadKey: 'aspect_ratio',
          options: [{v:'16:9',l:'16:9'},{v:'9:16',l:'9:16'},{v:'auto',l:'Auto'}] },
        { id: 'audio', label: 'Audio', type: 'select', default: 'false', payloadKey: 'generate_audio',
          options: [{v:'false',l:'Off'},{v:'true',l:'On'}],
          transform: v => v === 'true' },
        { id: 'fix', label: 'Auto Fix', type: 'select', default: 'false', payloadKey: 'auto_fix',
          options: [{v:'false',l:'Disabled'},{v:'true',l:'Enabled'}],
          transform: v => v === 'true' },
        { id: 'safety', label: 'Safety', type: 'select', default: '4', payloadKey: 'safety_tolerance',
          options: [{v:'1',l:'1 (Strict)'},{v:'2',l:'2'},{v:'3',l:'3'},{v:'4',l:'4 (Default)'},{v:'5',l:'5'},{v:'6',l:'6 (Loose)'}] },
        { id: 'neg', label: 'Negative Prompt', type: 'text', payloadKey: 'negative_prompt', optional: true,
          placeholder: 'e.g., blurry, distorted...' },
        { id: 'seed', label: 'Seed (Optional)', type: 'number', payloadKey: 'seed', optional: true,
          transform: v => parseInt(v) },
      ],
      additionalPayload: {},
      buttonLabel: 'Generate Videos (Veo 3.1)',
    },

  ];

  // ─────────────────────────────────────────────────────────────
  // DYNAMIC VERSION
  // ─────────────────────────────────────────────────────────────
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
      const v = chrome.runtime.getManifest().version;
      const slot = document.getElementById('appVersion');
      if (slot && v) slot.textContent = v;
    }
  } catch (e) {
    console.warn('Could not read manifest version:', e);
  }

  // RESTORE API KEY
  try {
    chrome.storage.local.get(['falApiKey'], (result) => {
      if (result && result.falApiKey) document.getElementById('apiKey').value = result.falApiKey;
    });
  } catch (e) { /* not in extension context */ }

  // ─────────────────────────────────────────────────────────────
  // UI RENDERING
  // ─────────────────────────────────────────────────────────────
  const renderField = (s, modelId) => {
    const id = `${modelId}_${s.id}`;
    if (s.type === 'select') {
      const opts = s.options.map(o =>
        `<option value="${o.v}"${o.v === s.default ? ' selected' : ''}>${o.l}</option>`
      ).join('');
      return `<label>${s.label}</label><select id="${id}">${opts}</select>`;
    }
    if (s.type === 'number') {
      return `<label>${s.label}</label><input type="number" id="${id}" placeholder="Random">`;
    }
    if (s.type === 'text') {
      return `<label>${s.label}</label><input type="text" id="${id}" placeholder="${s.placeholder || ''}">`;
    }
    return '';
  };

  // Pairs consecutive select fields side-by-side; text/number fields span full width.
  const renderSettingRows = (settings, modelId) => {
    let html = '';
    let i = 0;
    while (i < settings.length) {
      const a = settings[i];
      const b = settings[i + 1];
      if (a.type === 'select' && b && b.type === 'select') {
        html += `<div class="row"><div class="col">${renderField(a, modelId)}</div><div class="col">${renderField(b, modelId)}</div></div>`;
        i += 2;
      } else {
        html += renderField(a, modelId);
        i++;
      }
    }
    return html;
  };

  const renderSlots = (model) => {
    const sc = model.slotConfig;
    const slotLabel = sc.startImage
      ? (sc.endImage ? 'Start & End Frames + Prompts (up to 10)' : 'Reference Images & Prompts (up to 10)')
      : 'Prompts (1 per row, up to 10)';

    let slotsHtml = '';
    for (let i = 1; i <= ROW_COUNT; i++) {
      let inner = '';
      if (sc.startImage) {
        if (sc.endImage) inner += `<span class="slot-sublabel">Start Frame</span>`;
        inner += `<input type="file" id="${model.id}_startFile_${i}" accept="image/png, image/jpeg, image/webp">`;
      }
      if (sc.endImage) {
        inner += `<span class="slot-sublabel">End Frame (Optional)</span>`;
        inner += `<input type="file" id="${model.id}_endFile_${i}" accept="image/png, image/jpeg, image/webp">`;
      }
      inner += `<textarea id="${model.id}_prompt_${i}" placeholder="${model.promptPlaceholder}"></textarea>`;
      slotsHtml += `<div class="asset-row"><div class="row-number">${i}</div><div class="asset-col">${inner}</div></div>`;
    }
    return { slotLabel, slotsHtml };
  };

  const buildModelCard = (model) => {
    const mainSettingsHtml = renderSettingRows(model.settings, model.id);
    const advancedHtml = model.advancedSettings.length
      ? `<details class="advanced"><summary>Advanced Settings</summary><div class="advanced-content">${renderSettingRows(model.advancedSettings, model.id)}</div></details>`
      : '';
    const { slotLabel, slotsHtml } = renderSlots(model);

    const card = document.createElement('div');
    card.className = 'group';
    card.innerHTML = `
      <div class="group-title">${model.label}</div>
      ${mainSettingsHtml}
      ${advancedHtml}
      <label>${slotLabel}</label>
      <div id="slots_${model.id}">${slotsHtml}</div>
      <button class="primary-btn" id="btn_${model.id}">${model.buttonLabel}</button>
    `;
    return card;
  };

  const renderModels = () => {
    const imageGrid = document.getElementById('imageModelsGrid');
    const videoGrid = document.getElementById('videoModelsGrid');
    MODELS.forEach(model => {
      const card = buildModelCard(model);
      (model.section === 'image' ? imageGrid : videoGrid).appendChild(card);
      document.getElementById(`btn_${model.id}`)
        .addEventListener('click', () => executeBatch(model.id));
    });
  };

  renderModels();

  // ─────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────
  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
  });

  const safeJson = async (res) => {
    const text = await res.text();
    if (!text) return null;
    try { return JSON.parse(text); } catch { return null; }
  };

  const getSlotInputs = async (model) => {
    const sc = model.slotConfig;
    const inputs = [];
    for (let i = 1; i <= ROW_COUNT; i++) {
      const promptEl = document.getElementById(`${model.id}_prompt_${i}`);
      if (!promptEl) continue;
      const prompt = promptEl.value.trim();
      if (!prompt) continue;

      if (sc.startImage) {
        const startEl = document.getElementById(`${model.id}_startFile_${i}`);
        if (!startEl || startEl.files.length === 0) {
          console.warn(`Row ${i}: prompt provided but no start image — skipped.`);
          continue;
        }
        const startBase64 = await fileToBase64(startEl.files[0]);
        let endBase64 = null;
        if (sc.endImage) {
          const endEl = document.getElementById(`${model.id}_endFile_${i}`);
          if (endEl && endEl.files.length > 0) endBase64 = await fileToBase64(endEl.files[0]);
        }
        inputs.push({ prompt, startBase64, endBase64, index: i });
      } else {
        inputs.push({ prompt, startBase64: null, endBase64: null, index: i });
      }
    }
    return inputs;
  };

  const buildPayload = (model, slotInput) => {
    const payload = { ...model.additionalPayload };

    for (const s of [...model.settings, ...model.advancedSettings]) {
      const el = document.getElementById(`${model.id}_${s.id}`);
      if (!el) continue;
      const val = typeof el.value === 'string' ? el.value.trim() : String(el.value);
      if (s.optional && !val) continue;
      const transformed = s.transform ? s.transform(val) : val;
      if (transformed !== undefined) payload[s.payloadKey] = transformed;
    }

    payload.prompt = slotInput.prompt;

    if (slotInput.startBase64) {
      if (model.slotConfig.imageKey === 'image_urls') {
        payload.image_urls = [slotInput.startBase64];
      } else {
        payload.image_url = slotInput.startBase64;
      }
    }
    if (slotInput.endBase64) {
      payload.end_image_url = slotInput.endBase64;
    }

    return payload;
  };

  // ─────────────────────────────────────────────────────────────
  // VIDEO POLLING
  // ─────────────────────────────────────────────────────────────
  const pollVideoRequest = async (statusUrl, responseUrl, authHeader, responseExtractor, onUpdate) => {
    const maxAttempts = 240; // 20-min cap at 5s intervals
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(r => setTimeout(r, 5000));
      let statusData = null;
      try {
        const statusRes = await fetch(statusUrl, { method: 'GET', headers: authHeader });
        statusData = await safeJson(statusRes);
      } catch (e) {
        onUpdate('network hiccup, retrying…');
        continue;
      }
      if (!statusData) continue;

      if (statusData.status === 'IN_QUEUE') {
        onUpdate(`queued (pos ${statusData.queue_position ?? '?'})`);
      } else if (statusData.status === 'IN_PROGRESS') {
        onUpdate('generating…');
      } else if (statusData.status === 'COMPLETED') {
        for (let r = 0; r < 6; r++) {
          try {
            const resultRes = await fetch(responseUrl, { method: 'GET', headers: authHeader });
            const resultData = await safeJson(resultRes);
            const url = responseExtractor(resultData);
            if (url) return { ok: true, url };
          } catch (_) { /* retry */ }
          await new Promise(r => setTimeout(r, 2000));
        }
        return { ok: false, error: 'COMPLETED but response body unavailable' };
      } else if (statusData.status === 'FAILED' || statusData.error) {
        return { ok: false, error: statusData.error || 'Generation failed' };
      }
    }
    return { ok: false, error: 'Timed out after 20 minutes' };
  };

  // ─────────────────────────────────────────────────────────────
  // BATCH EXECUTORS
  // ─────────────────────────────────────────────────────────────
  const executeImageBatch = async (model, inputs, headers) => {
    const galleryDiv = document.getElementById('outputGallery');
    document.getElementById('status').innerText = `Generating ${inputs.length} image(s) in parallel…`;

    const results = await Promise.all(inputs.map(async (slotInput) => {
      const payload = buildPayload(model, slotInput);
      const res = await fetch(model.endpoint, { method: 'POST', headers, body: JSON.stringify(payload) });
      return { slotInput, data: await safeJson(res) };
    }));

    results.forEach(({ slotInput, data }) => {
      const url = model.responseExtractor(data);
      if (url) {
        generatedAssets.push({ url, filename: `${model.id}_${slotInput.index}.png` });
        const el = document.createElement('img');
        el.src = url;
        galleryDiv.appendChild(el);
      } else {
        console.error(`Image #${slotInput.index} failed:`, data);
      }
    });
  };

  const executeVideoBatch = async (model, inputs, headers, authHeader) => {
    const statusDiv = document.getElementById('status');
    const galleryDiv = document.getElementById('outputGallery');
    statusDiv.innerText = `Submitting ${inputs.length} video(s) to queue (${model.label})…`;

    const submissions = await Promise.all(inputs.map(async (slotInput) => {
      const payload = buildPayload(model, slotInput);
      try {
        const res = await fetch(model.endpoint, { method: 'POST', headers, body: JSON.stringify(payload) });
        return { slotInput, submitData: await safeJson(res) };
      } catch (e) {
        return { slotInput, submitData: null, error: e.message };
      }
    }));

    const validSubs = submissions.filter(s => s.submitData && s.submitData.request_id);
    if (!validSubs.length) {
      console.error('Submission responses:', submissions);
      throw new Error('All video submissions failed. Check API key / payload / console.');
    }

    const statuses = {};
    validSubs.forEach(s => { statuses[s.slotInput.index] = 'submitted'; });
    const renderStatus = () => {
      const lines = Object.entries(statuses)
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([i, s]) => `#${i}: ${s}`).join('\n');
      statusDiv.innerText = `${model.label}:\n${lines}`;
    };
    renderStatus();

    const results = await Promise.all(validSubs.map(async ({ slotInput, submitData }) => {
      const statusUrl = submitData.status_url || `${model.endpoint}/requests/${submitData.request_id}/status`;
      const responseUrl = submitData.response_url || `${model.endpoint}/requests/${submitData.request_id}`;

      const result = await pollVideoRequest(
        statusUrl, responseUrl, authHeader, model.responseExtractor,
        (msg) => { statuses[slotInput.index] = msg; renderStatus(); }
      );
      statuses[slotInput.index] = result.ok ? '✅ done' : `❌ ${result.error}`;
      renderStatus();
      return { slotInput, result };
    }));

    results.forEach(({ slotInput, result }) => {
      if (result.ok) {
        generatedAssets.push({ url: result.url, filename: `${model.id}_${slotInput.index}.mp4` });
        const el = document.createElement('video');
        el.src = result.url;
        el.controls = true;
        galleryDiv.appendChild(el);
      } else {
        console.error(`Video #${slotInput.index} failed:`, result.error);
      }
    });
  };

  // ─────────────────────────────────────────────────────────────
  // MAIN DISPATCHER
  // ─────────────────────────────────────────────────────────────
  const executeBatch = async (modelId) => {
    const model = MODELS.find(m => m.id === modelId);
    const apiKey = document.getElementById('apiKey').value.trim();
    const statusDiv = document.getElementById('status');
    const galleryDiv = document.getElementById('outputGallery');
    const downloadBtn = document.getElementById('downloadBtn');

    if (!apiKey) {
      statusDiv.style.color = '#ff5252';
      statusDiv.innerText = 'Error: Please enter your fal.ai API key.';
      return;
    }

    const allBtns = document.querySelectorAll('.primary-btn');
    allBtns.forEach(btn => { btn.disabled = true; btn.style.opacity = '0.5'; });

    try { chrome.storage.local.set({ falApiKey: apiKey }); } catch (e) {}

    statusDiv.style.color = 'var(--accent-cyan)';
    galleryDiv.innerHTML = '';
    downloadBtn.style.display = 'none';
    generatedAssets = [];

    const headers = { 'Authorization': `Key ${apiKey}`, 'Content-Type': 'application/json' };
    const authHeader = { 'Authorization': `Key ${apiKey}` };

    try {
      const inputs = await getSlotInputs(model);
      if (!inputs.length) {
        throw new Error(model.slotConfig.startImage
          ? 'Upload a reference image and enter a prompt for at least one row.'
          : 'Enter at least one prompt.');
      }

      if (model.useQueue) {
        await executeVideoBatch(model, inputs, headers, authHeader);
      } else {
        await executeImageBatch(model, inputs, headers);
      }

      statusDiv.style.color = '#00c853';
      statusDiv.innerText = `Batch Complete! (${generatedAssets.length} asset(s) generated)`;
      if (generatedAssets.length) downloadBtn.style.display = 'block';

    } catch (error) {
      statusDiv.style.color = '#ff5252';
      statusDiv.innerText = `Error: ${error.message}`;
      console.error(error);
    } finally {
      allBtns.forEach(btn => { btn.disabled = false; btn.style.opacity = '1'; });
    }
  };

  // DOWNLOAD
  document.getElementById('downloadBtn').addEventListener('click', () => {
    generatedAssets.forEach(asset => {
      try {
        chrome.downloads.download({ url: asset.url, filename: asset.filename, saveAs: false });
      } catch (e) {
        console.error('Download failed:', asset.filename, e);
      }
    });
  });
});
