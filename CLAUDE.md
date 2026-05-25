# AI Engine Chrome Extension

**Repo:** github.com/irushabshah/Fal-Chrome-Extension  
**Purpose:** Batch generate images and videos via fal.ai, 10 slots per model, download all results.  
**Stack:** Vanilla JS + HTML/CSS, Chrome Manifest V3, no build step.

## File Structure

```
manifest.json   — version number lives here (update on every release)
index.html      — shell only: auth card + two empty grid containers (#imageModelsGrid, #videoModelsGrid)
app.js          — all logic: MODELS config array + rendering + API calls
background.js   — one-liner: opens index.html on icon click
```

## How to Add a New Model

1. Visit the fal.ai model page, extract all API parameters (name, type, options, defaults).
2. Append one object to the `MODELS` array in `app.js` — no other code changes needed.
3. Bump `"version"` in `manifest.json`.
4. Commit and push.

## MODELS Config — Full Property Reference

```js
{
  id: 'unique-kebab-id',          // used as DOM id prefix: btn_${id}, slots_${id}, ${id}_${settingId}
  label: 'Display Name',          // card heading
  section: 'image' | 'video',     // which grid the card renders into
  endpoint: 'https://...',        // full fal.ai API URL (fal.run or queue.fal.run)
  useQueue: false,                // false = direct POST (images); true = queue submit+poll (videos)
  outputType: 'image' | 'video',  // controls gallery element type (img vs video)
  responseExtractor: d => d?.images?.[0]?.url ?? null,  // how to pull the result URL from API response
                                  // images: d?.images?.[0]?.url   videos: d?.video?.url
  slotConfig: {
    startImage: true,             // show start-frame file upload per row
    endImage: false,              // show end-frame file upload per row (SeedDance-style)
    imageKey: 'image_url',        // 'image_url' (singular) or 'image_urls' (array) — matches API param name
  },
  promptPlaceholder: '...',
  settings: [ /* main settings, rendered 2-per-row above the slots */ ],
  advancedSettings: [ /* rendered inside <details> */ ],
  additionalPayload: {},          // static keys merged into every request (e.g. { num_images: 1 })
  buttonLabel: 'Generate ...',
}
```

## Setting Object Format

```js
{ id, label, type: 'select' | 'number' | 'text', default, payloadKey, options?, optional?, transform?, placeholder? }
```

- **`options`** (select only): `[{ v: 'api-value', l: 'Display Label' }, ...]`
- **`transform`**: converts DOM string → correct API type. Common patterns:
  - `v => v === 'true'` → boolean
  - `v => parseInt(v)` → integer (e.g. SeedDance duration)
  - `v => v === 'none' ? undefined : v` → omit field when "none" selected
- **`optional: true`** → field is skipped in payload when empty

Consecutive `select` fields are auto-paired side-by-side. `number`/`text` fields span full width.

## Queue vs Direct — Decision Rule

| Model type | endpoint prefix | `useQueue` | `responseExtractor` |
|---|---|---|---|
| Image (fast, synchronous) | `fal.run/...` | `false` | `d?.images?.[0]?.url` |
| Video (async, ~minutes) | `queue.fal.run/...` | `true` | `d?.video?.url` |

Queue models: the executor submits all 10 in parallel, then polls each at 5s intervals up to 20 min.  
Status/response URLs are derived from `model.endpoint + /requests/{request_id}[/status]` or from the submit response's `status_url` / `response_url` fields (whichever the API returns).

## Deploy

```bash
# In /Users/rushab.shah/Documents/Claude/Fal-Chrome-Extension/
git add app.js manifest.json          # (and any other changed files)
git commit -m "vX.Y: description"
git push origin main
```

Then reload the unpacked extension in Chrome (`chrome://extensions` → Reload).
