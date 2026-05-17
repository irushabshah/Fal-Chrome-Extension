document.addEventListener('DOMContentLoaded', () => {
  const ROW_COUNT = 10;
  let generatedAssets = [];

  // --- DYNAMIC VERSION from manifest ---
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
      const v = chrome.runtime.getManifest().version;
      const slot = document.getElementById('appVersion');
      if (slot && v) slot.textContent = v;
    }
  } catch (e) {
    console.warn('Could not read manifest version:', e);
  }

  // --- RESTORE API KEY ---
  try {
    chrome.storage.local.get(['falApiKey'], (result) => {
      if (result && result.falApiKey) document.getElementById('apiKey').value = result.falApiKey;
    });
  } catch (e) { /* not in extension context */ }

  // --- BUILD ROWS ---
  const generateRows = (containerId, prefix, placeholder, includeFile) => {
    const container = document.getElementById(containerId);
    for (let i = 1; i <= ROW_COUNT; i++) {
      const row = document.createElement('div');
      row.className = 'asset-row';
      const fileInput = includeFile
        ? `<input type="file" id="${prefix}File${i}" accept="image/png, image/jpeg, image/webp">`
        : '';
      row.innerHTML = `
        <div class="row-number">${i}</div>
        <div class="asset-col">
          ${fileInput}
          <textarea id="${prefix}Prompt${i}" placeholder="${placeholder}"></textarea>
        </div>
      `;
      container.appendChild(row);
    }
  };

  generateRows('t2iFieldsContainer', 't2i', 'Prompt (e.g. A cinematic corporate office.)', false);
  generateRows('i2iFieldsContainer', 'i2i', 'Edit Prompt (e.g. Change the lighting to sunset.)', true);
  generateRows('gptFieldsContainer', 'gpt', 'Edit Prompt (e.g. Add a sunset sky behind the building.)', true);
  generateRows('v2vFieldsContainer', 'v2v', 'Motion Prompt (e.g. Subtle camera pan.)', true);
  generateRows('veoFieldsContainer', 'veo', 'Motion Prompt (e.g. Slow zoom into the scene.)', true);

  // --- HELPERS ---
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

  const getInputs = async (prefix, requireFile) => {
    const inputs = [];
    for (let i = 1; i <= ROW_COUNT; i++) {
      const promptEl = document.getElementById(`${prefix}Prompt${i}`);
      if (!promptEl) continue;
      const prompt = promptEl.value.trim();
      if (!prompt) continue;
      if (requireFile) {
        const fileInput = document.getElementById(`${prefix}File${i}`);
        if (fileInput && fileInput.files.length > 0) {
          const base64 = await fileToBase64(fileInput.files[0]);
          inputs.push({ base64, prompt, index: i });
        } else {
          console.warn(`Row ${i} has a prompt but no image — skipped.`);
        }
      } else {
        inputs.push({ prompt, index: i });
      }
    }
    return inputs;
  };

  // --- VIDEO POLL (independent per request, no shared state) ---
  const pollVideoRequest = async (statusUrl, responseUrl, authHeader, onUpdate) => {
    const maxAttempts = 240; // 20 min cap at 5s intervals
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(r => setTimeout(r, 5000));
      let statusData = null;
      try {
        const statusRes = await fetch(statusUrl, { method: "GET", headers: authHeader });
        statusData = await safeJson(statusRes);
      } catch (e) {
        onUpdate('network hiccup, retrying…');
        continue;
      }
      if (!statusData) continue;

      if (statusData.status === "IN_QUEUE") {
        onUpdate(`queued (pos ${statusData.queue_position ?? '?'})`);
      } else if (statusData.status === "IN_PROGRESS") {
        onUpdate('generating…');
      } else if (statusData.status === "COMPLETED") {
        // Retry /response up to 6x for eventual consistency
        for (let r = 0; r < 6; r++) {
          try {
            const resultRes = await fetch(responseUrl, { method: "GET", headers: authHeader });
            const resultData = await safeJson(resultRes);
            if (resultData && resultData.video && resultData.video.url) {
              return { ok: true, url: resultData.video.url };
            }
          } catch (_) { /* retry */ }
          await new Promise(r => setTimeout(r, 2000));
        }
        return { ok: false, error: "COMPLETED but response body unavailable" };
      } else if (statusData.status === "FAILED" || statusData.error) {
        return { ok: false, error: statusData.error || "Generation failed" };
      }
    }
    return { ok: false, error: "Timed out after 20 minutes" };
  };

  // --- ALL ACTION BUTTONS ---
  const allButtons = () => [
    document.getElementById('btnT2i'),
    document.getElementById('btnI2i'),
    document.getElementById('btnGpt'),
    document.getElementById('btnV2v'),
    document.getElementById('btnVeo')
  ];

  // --- MAIN BATCH ---
  const executeBatch = async (type) => {
    const apiKey = document.getElementById('apiKey').value.trim();
    const statusDiv = document.getElementById('status');
    const galleryDiv = document.getElementById('outputGallery');
    const downloadBtn = document.getElementById('downloadBtn');

    if (!apiKey) {
      statusDiv.style.color = "#ff5252";
      statusDiv.innerText = "Error: Please enter your fal.ai API key.";
      return;
    }

    const actionButtons = allButtons();
    actionButtons.forEach(btn => { btn.disabled = true; btn.style.opacity = '0.5'; });

    try { chrome.storage.local.set({ falApiKey: apiKey }); } catch (e) {}

    statusDiv.style.color = "var(--accent-cyan)";
    galleryDiv.innerHTML = '';
    downloadBtn.style.display = 'none';
    generatedAssets = [];

    const headers = {
      "Authorization": `Key ${apiKey}`,
      "Content-Type": "application/json"
    };
    const authHeader = { "Authorization": `Key ${apiKey}` };

    try {
      // ==== TEXT TO IMAGE (Nano Banana 2) ====
      if (type === 't2i') {
        const inputs = await getInputs('t2i', false);
        if (!inputs.length) throw new Error("Enter at least one prompt.");
        statusDiv.innerText = `Generating ${inputs.length} image(s) in parallel…`;

        const promises = inputs.map(async (input) => {
          const payload = {
            prompt: input.prompt,
            num_images: 1,
            limit_generations: true,
            aspect_ratio: document.getElementById('t2iAspect').value,
            resolution: document.getElementById('t2iRes').value,
            output_format: document.getElementById('t2iFormat').value,
            safety_tolerance: document.getElementById('t2iSafety').value,
            "enable_Web Search": document.getElementById('t2iWeb').value === 'true'
          };
          const thinking = document.getElementById('t2iThinking').value;
          if (thinking !== 'none') payload.thinking_level = thinking;
          const seed = document.getElementById('t2iSeed').value;
          if (seed) payload.seed = parseInt(seed);

          const res = await fetch("https://fal.run/fal-ai/nano-banana-2", {
            method: "POST", headers, body: JSON.stringify(payload)
          });
          return { input, data: await safeJson(res) };
        });

        const results = await Promise.all(promises);
        results.forEach(({ input, data }) => {
          if (data && data.images && data.images[0]) {
            const url = data.images[0].url;
            generatedAssets.push({ url, filename: `t2i_result_${input.index}.png` });
            const el = document.createElement('img');
            el.src = url;
            galleryDiv.appendChild(el);
          } else {
            console.error(`Image #${input.index} failed:`, data);
          }
        });
      }

      // ==== IMAGE EDITING (Nano Banana 2) ====
      else if (type === 'i2i') {
        const inputs = await getInputs('i2i', true);
        if (!inputs.length) throw new Error("Upload a reference image and enter a prompt for at least one row.");
        statusDiv.innerText = `Editing ${inputs.length} image(s) in parallel…`;

        const promises = inputs.map(async (input) => {
          const payload = {
            prompt: input.prompt,
            image_urls: [input.base64],
            num_images: 1,
            limit_generations: true,
            aspect_ratio: document.getElementById('i2iAspect').value,
            resolution: document.getElementById('i2iRes').value,
            output_format: document.getElementById('i2iFormat').value,
            safety_tolerance: document.getElementById('i2iSafety').value,
            "enable_Web Search": document.getElementById('i2iWeb').value === 'true'
          };
          const thinking = document.getElementById('i2iThinking').value;
          if (thinking !== 'none') payload.thinking_level = thinking;
          const seed = document.getElementById('i2iSeed').value;
          if (seed) payload.seed = parseInt(seed);

          const res = await fetch("https://fal.run/fal-ai/nano-banana-2/edit", {
            method: "POST", headers, body: JSON.stringify(payload)
          });
          return { input, data: await safeJson(res) };
        });

        const results = await Promise.all(promises);
        results.forEach(({ input, data }) => {
          if (data && data.images && data.images[0]) {
            const url = data.images[0].url;
            generatedAssets.push({ url, filename: `i2i_result_${input.index}.png` });
            const el = document.createElement('img');
            el.src = url;
            galleryDiv.appendChild(el);
          } else {
            console.error(`Edit #${input.index} failed:`, data);
          }
        });
      }

      // ==== IMAGE EDITING (GPT Image 2) ====
      else if (type === 'gpt') {
        const inputs = await getInputs('gpt', true);
        if (!inputs.length) throw new Error("Upload a reference image and enter a prompt for at least one row.");
        statusDiv.innerText = `Generating ${inputs.length} GPT Image 2 edit(s) in parallel…`;

        const promises = inputs.map(async (input) => {
          // Build image_size
          const sizeVal = document.getElementById('gptSize').value;
          let image_size;
          if (sizeVal === 'auto') {
            image_size = 'auto';
          } else {
            const [w, h] = sizeVal.split('x').map(Number);
            image_size = { width: w, height: h };
          }

          const payload = {
            prompt: input.prompt,
            image_urls: [input.base64],
            num_images: 1,
            image_size: image_size,
            quality: document.getElementById('gptQuality').value,
            output_format: document.getElementById('gptFormat').value
          };

          const res = await fetch("https://fal.run/openai/gpt-image-2/edit", {
            method: "POST", headers, body: JSON.stringify(payload)
          });
          return { input, data: await safeJson(res) };
        });

        const results = await Promise.all(promises);
        results.forEach(({ input, data }) => {
          if (data && data.images && data.images[0]) {
            const url = data.images[0].url;
            generatedAssets.push({ url, filename: `gpt_result_${input.index}.png` });
            const el = document.createElement('img');
            el.src = url;
            galleryDiv.appendChild(el);
          } else {
            console.error(`GPT Image #${input.index} failed:`, data);
          }
        });
      }

      // ==== VIDEO GENERATION (Veo 3.1 Fast — QUEUE) ====
      else if (type === 'v2v') {
        const inputs = await getInputs('v2v', true);
        if (!inputs.length) throw new Error("Upload an initial frame and enter a motion prompt for at least one row.");
        statusDiv.innerText = `Submitting ${inputs.length} video(s) to fal queue (Veo 3.1 Fast)…`;

        // STEP 1 — submit all in parallel
        const submissions = await Promise.all(inputs.map(async (input) => {
          const payload = {
            prompt: input.prompt,
            image_url: input.base64,
            resolution: document.getElementById('v2vRes').value,
            duration: document.getElementById('v2vDur').value,
            aspect_ratio: document.getElementById('v2vAspect').value,
            generate_audio: document.getElementById('v2vAudio').value === 'true',
            auto_fix: document.getElementById('v2vFix').value === 'true',
            safety_tolerance: document.getElementById('v2vSafety').value
          };
          const neg = document.getElementById('v2vNeg').value;
          if (neg) payload.negative_prompt = neg;
          const seed = document.getElementById('v2vSeed').value;
          if (seed) payload.seed = parseInt(seed);

          try {
            const res = await fetch("https://queue.fal.run/fal-ai/veo3.1/fast/image-to-video", {
              method: "POST", headers, body: JSON.stringify(payload)
            });
            return { input, submitData: await safeJson(res) };
          } catch (e) {
            return { input, submitData: null, error: e.message };
          }
        }));

        const validSubs = submissions.filter(s => s.submitData && s.submitData.request_id);
        if (!validSubs.length) {
          console.error('Submission responses:', submissions);
          throw new Error("All video submissions failed. Check API key / payload / console.");
        }

        // Live status tracker
        const statuses = {};
        validSubs.forEach(s => { statuses[s.input.index] = 'submitted'; });
        const renderStatus = () => {
          const lines = Object.entries(statuses)
            .sort((a, b) => Number(a[0]) - Number(b[0]))
            .map(([i, s]) => `#${i}: ${s}`).join('\n');
          statusDiv.innerText = `Videos (Fast):\n${lines}`;
        };
        renderStatus();

        // STEP 2 — poll all in parallel
        const results = await Promise.all(validSubs.map(async ({ input, submitData }) => {
          const statusUrl = submitData.status_url ||
            `https://queue.fal.run/fal-ai/veo3.1/fast/image-to-video/requests/${submitData.request_id}/status`;
          const responseUrl = submitData.response_url ||
            `https://queue.fal.run/fal-ai/veo3.1/fast/image-to-video/requests/${submitData.request_id}`;

          const result = await pollVideoRequest(statusUrl, responseUrl, authHeader, (msg) => {
            statuses[input.index] = msg;
            renderStatus();
          });
          statuses[input.index] = result.ok ? '✅ done' : `❌ ${result.error}`;
          renderStatus();
          return { input, result };
        }));

        results.forEach(({ input, result }) => {
          if (result.ok) {
            generatedAssets.push({ url: result.url, filename: `v2v_result_${input.index}.mp4` });
            const el = document.createElement('video');
            el.src = result.url;
            el.controls = true;
            galleryDiv.appendChild(el);
          } else {
            console.error(`Video #${input.index} failed:`, result.error);
          }
        });
      }

      // ==== VIDEO GENERATION (Veo 3.1 Standard — QUEUE) ====
      else if (type === 'veo') {
        const inputs = await getInputs('veo', true);
        if (!inputs.length) throw new Error("Upload a reference image and enter a prompt for at least one row.");
        statusDiv.innerText = `Submitting ${inputs.length} video(s) to fal queue (Veo 3.1)…`;

        // STEP 1 — submit all in parallel
        const submissions = await Promise.all(inputs.map(async (input) => {
          const payload = {
            prompt: input.prompt,
            image_url: input.base64,
            resolution: document.getElementById('veoRes').value,
            duration: document.getElementById('veoDur').value,
            aspect_ratio: document.getElementById('veoAspect').value,
            generate_audio: document.getElementById('veoAudio').value === 'true',
            auto_fix: document.getElementById('veoFix').value === 'true',
            safety_tolerance: document.getElementById('veoSafety').value
          };
          const neg = document.getElementById('veoNeg').value;
          if (neg) payload.negative_prompt = neg;
          const seed = document.getElementById('veoSeed').value;
          if (seed) payload.seed = parseInt(seed);

          try {
            const res = await fetch("https://queue.fal.run/fal-ai/veo3.1/image-to-video", {
              method: "POST", headers, body: JSON.stringify(payload)
            });
            return { input, submitData: await safeJson(res) };
          } catch (e) {
            return { input, submitData: null, error: e.message };
          }
        }));

        const validSubs = submissions.filter(s => s.submitData && s.submitData.request_id);
        if (!validSubs.length) {
          console.error('Submission responses:', submissions);
          throw new Error("All video submissions failed. Check API key / payload / console.");
        }

        // Live status tracker
        const statuses = {};
        validSubs.forEach(s => { statuses[s.input.index] = 'submitted'; });
        const renderStatus = () => {
          const lines = Object.entries(statuses)
            .sort((a, b) => Number(a[0]) - Number(b[0]))
            .map(([i, s]) => `#${i}: ${s}`).join('\n');
          statusDiv.innerText = `Videos (Veo 3.1):\n${lines}`;
        };
        renderStatus();

        // STEP 2 — poll all in parallel
        const results = await Promise.all(validSubs.map(async ({ input, submitData }) => {
          const statusUrl = submitData.status_url ||
            `https://queue.fal.run/fal-ai/veo3.1/image-to-video/requests/${submitData.request_id}/status`;
          const responseUrl = submitData.response_url ||
            `https://queue.fal.run/fal-ai/veo3.1/image-to-video/requests/${submitData.request_id}`;

          const result = await pollVideoRequest(statusUrl, responseUrl, authHeader, (msg) => {
            statuses[input.index] = msg;
            renderStatus();
          });
          statuses[input.index] = result.ok ? '✅ done' : `❌ ${result.error}`;
          renderStatus();
          return { input, result };
        }));

        results.forEach(({ input, result }) => {
          if (result.ok) {
            generatedAssets.push({ url: result.url, filename: `veo_result_${input.index}.mp4` });
            const el = document.createElement('video');
            el.src = result.url;
            el.controls = true;
            galleryDiv.appendChild(el);
          } else {
            console.error(`Veo Video #${input.index} failed:`, result.error);
          }
        });
      }

      statusDiv.style.color = "#00c853";
      statusDiv.innerText = `Batch Complete! (${generatedAssets.length} asset(s) generated)`;
      if (generatedAssets.length) downloadBtn.style.display = 'block';

    } catch (error) {
      statusDiv.style.color = "#ff5252";
      statusDiv.innerText = `Error: ${error.message}`;
      console.error(error);
    } finally {
      actionButtons.forEach(btn => { btn.disabled = false; btn.style.opacity = '1'; });
    }
  };

  // --- EVENT LISTENERS ---
  document.getElementById('btnT2i').addEventListener('click', () => executeBatch('t2i'));
  document.getElementById('btnI2i').addEventListener('click', () => executeBatch('i2i'));
  document.getElementById('btnGpt').addEventListener('click', () => executeBatch('gpt'));
  document.getElementById('btnV2v').addEventListener('click', () => executeBatch('v2v'));
  document.getElementById('btnVeo').addEventListener('click', () => executeBatch('veo'));

  document.getElementById('downloadBtn').addEventListener('click', () => {
    generatedAssets.forEach(asset => {
      chrome.downloads.download({ url: asset.url, filename: asset.filename, saveAs: false });
    });
  });
});