/**
 * ============================================================
 *  REPLAY ENGINE — CeRDaS UTP Edge AI Experiment Demo
 * ============================================================
 *  Serves real experimental results from JSON files recorded
 *  on the Jetson Orin hardware. No GPU required for replay.
 *
 *  Lookup directories:
 *    ../html_test/model_coder_json_outputs/
 *    ../html_test/model_general_json_outputs/
 *
 *  API Routes (unchanged, drop-in for previous mock server):
 *    GET  /api/models   → catalogue of all available models
 *    POST /api/chat     → parallel replay for selected models
 *    POST /api/generate → Ollama-compat shim
 * ============================================================
 */

'use strict';

const express = require('express');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');

const app  = express();
const PORT = 3000;

// ── Middleware ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Directory Paths ─────────────────────────────────────────
const HTML_TEST_DIR   = path.resolve(__dirname, '..', 'html_test');
const CODER_DIR       = path.join(HTML_TEST_DIR, 'model_coder_json_outputs');
const GENERAL_DIR     = path.join(HTML_TEST_DIR, 'model_general_json_outputs');
const GROUND_TRUTH    = path.join(HTML_TEST_DIR, '..', 'llm-backend', 'master_ground_truth.json');

// ── Simulation Config ───────────────────────────────────────
const MIN_LATENCY_MS = 1500;
const MAX_LATENCY_MS = 3000;

// ── Helpers ─────────────────────────────────────────────────

/** Random integer between min and max (inclusive) */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Simulated Jetson inference latency */
function inferenceDelay() {
  return new Promise(resolve => setTimeout(resolve, randInt(MIN_LATENCY_MS, MAX_LATENCY_MS)));
}

/**
 * Convert a model ID to a filename stem.
 * Rules:
 *   - Replace ':' with '_'          (e.g. qwen2.5-coder:14b → qwen2.5-coder_14b)
 *   - Replace ' ' with '_'
 * Then append '.json'
 */
function modelIdToFilename(modelId) {
  return modelId.replace(/:/g, '_').replace(/\s+/g, '_') + '.json';
}

/**
 * Search for a model's JSON file in both result directories.
 * Returns { filePath, category } or null if not found.
 */
function findModelFile(modelId) {
  const filename = modelIdToFilename(modelId);

  const candidates = [
    { filePath: path.join(CODER_DIR,   filename), category: 'coder'   },
    { filePath: path.join(GENERAL_DIR, filename), category: 'general' },
  ];

  for (const c of candidates) {
    if (fs.existsSync(c.filePath)) return c;
  }
  return null;
}

/**
 * Load and parse a model JSON file.
 * Returns the parsed array, or null on failure.
 */
function loadModelData(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    // The JSON is a top-level array: [ { users_concurrency, extractions }, ... ]
    return Array.isArray(parsed) ? parsed : null;
  } catch (err) {
    console.error(`  [ERROR] Failed to parse ${filePath}: ${err.message}`);
    return null;
  }
}

/**
 * Parse a PowerShell-serialized extraction string into a plain object.
 *
 * Input format (strings from older export):
 *   "@{file=page_1.html; status=Success; tps=22.5; valid_json=True; data=System.Object[]; time_sec=50.12}"
 *
 * Returns a plain JS object with the same fields.
 */
function parsePSString(str) {
  if (typeof str !== 'string') return str; // already an object

  // Strip the outer "@{...}"
  const inner = str.replace(/^@\{/, '').replace(/\}$/, '');

  const result = {};

  // We need a careful parser because 'data' can contain semicolons
  // Strategy: split on '; ' only for known key= boundaries
  const knownKeys = ['file', 'status', 'tps', 'valid_json', 'data', 'time_sec'];
  const keyPattern = new RegExp(`(${knownKeys.join('|')})=`, 'g');

  const positions = [];
  let match;
  while ((match = keyPattern.exec(inner)) !== null) {
    positions.push({ key: match[1], index: match.index, valueStart: match.index + match[0].length });
  }

  for (let i = 0; i < positions.length; i++) {
    const { key, valueStart } = positions[i];
    const valueEnd = i + 1 < positions.length ? positions[i + 1].index - 2 : inner.length; // -2 for '; '
    let value = inner.slice(valueStart, valueEnd).trim();

    // Type coercion
    if (key === 'tps' || key === 'time_sec') {
      value = parseFloat(value) || 0;
    } else if (key === 'valid_json') {
      value = value === 'True' || value === 'true';
    }
    // 'data' stays as-is string for PS-string extractions (code text / error messages)

    result[key] = value;
  }

  return result;
}

/**
 * Find the entry matching `users` in the loaded model data.
 * Returns the concurrency entry or null.
 */
function findConcurrencyEntry(modelData, users) {
  const usersNum = parseInt(users, 10);
  return modelData.find(entry => entry.users_concurrency === usersNum) || null;
}

/**
 * Build a summary object from a concurrency entry for the API response.
 * Normalises extractions regardless of whether they are PS strings or objects.
 */
function buildSummary(concurrencyEntry, modelId) {
  const rawExtractions = concurrencyEntry.extractions || [];

  const extractions = rawExtractions.map(e => {
    const parsed = parsePSString(e);
    return {
      file:       parsed.file       || 'unknown',
      status:     parsed.status     || 'Unknown',
      tps:        typeof parsed.tps === 'number' ? parsed.tps : parseFloat(parsed.tps) || 0,
      valid_json: parsed.valid_json === true || parsed.valid_json === 'True',
      data:       parsed.data,          // may be array, string, or undefined
      time_sec:   typeof parsed.time_sec === 'number' ? parsed.time_sec : parseFloat(parsed.time_sec) || 0,
    };
  });

  const successCount = extractions.filter(e => e.status === 'Success').length;
  const avgTps       = extractions.filter(e => e.tps > 0)
                                  .reduce((sum, e, _, arr) => sum + e.tps / arr.length, 0);
  const validJsonCount = extractions.filter(e => e.valid_json).length;

  return {
    model_id:          modelId,
    users_concurrency: concurrencyEntry.users_concurrency,
    pages_tested:      extractions.length,
    success_count:     successCount,
    fail_count:        extractions.length - successCount,
    valid_json_count:  validJsonCount,
    avg_tps:           parseFloat(avgTps.toFixed(4)),
    extractions,
  };
}

/** Derive a display type label from the category */
function categoryLabel(category) {
  return category === 'coder'
    ? 'JETSON ORIN — Coder Model'
    : 'JETSON ORIN — General Model';
}

// ── Build model catalogue at startup ────────────────────────
function buildModelCatalogue() {
  const catalogue = [];
  const dirs = [
    { dir: CODER_DIR,   category: 'coder'   },
    { dir: GENERAL_DIR, category: 'general' },
  ];

  for (const { dir, category } of dirs) {
    if (!fs.existsSync(dir)) {
      console.warn(`  [WARN] Directory not found: ${dir}`);
      continue;
    }

    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.json') && !f.includes('Zone.Identifier'));

    for (const file of files) {
      // Convert filename back to model ID: remove .json, replace first _ with :
      // e.g. qwen2.5-coder_14b.json → qwen2.5-coder:14b
      const stem    = file.replace(/\.json$/, '');
      // Find the last underscore to reconstruct the colon separator
      const lastUs  = stem.lastIndexOf('_');
      const modelId = lastUs !== -1
        ? stem.slice(0, lastUs) + ':' + stem.slice(lastUs + 1)
        : stem;

      catalogue.push({
        id:       modelId,
        name:     modelId,
        filename: file,
        category,
        type:     categoryLabel(category),
      });
    }
  }

  return catalogue;
}

// ── Logging ──────────────────────────────────────────────────
function logRequest(method, route, body = {}) {
  const ts = new Date().toISOString();
  console.log('\n' + '═'.repeat(62));
  console.log(`  ${ts}`);
  console.log(`  ${method.toUpperCase()} ${route}`);
  if (Object.keys(body).length) {
    console.log('  Body: ' + JSON.stringify(body));
  }
  console.log('═'.repeat(62));
}

function logResult(modelId, users, latencyMs, status) {
  const ts = new Date().toISOString();
  const statusIcon = status === 'SUCCESS' ? '✅' : '❌';
  console.log(
    `  [${ts}] MODEL: ${modelId} | USERS: ${users} | ` +
    `LATENCY: ${latencyMs}ms | STATUS: ${statusIcon} ${status}`
  );
}

// ── Init ─────────────────────────────────────────────────────
console.log('\n  Scanning result directories...');

const MODEL_CATALOGUE = buildModelCatalogue();

console.log(`  ✅ Found ${MODEL_CATALOGUE.filter(m => m.category === 'coder').length} coder models`);
console.log(`  ✅ Found ${MODEL_CATALOGUE.filter(m => m.category === 'general').length} general models`);

// ── Routes ───────────────────────────────────────────────────

/**
 * GET /api/models
 * Returns all available models discovered from the JSON directories.
 */
app.get('/api/models', (req, res) => {
  logRequest('GET', '/api/models');

  const models = MODEL_CATALOGUE.map(m => ({
    id:       m.id,
    name:     m.name,
    type:     m.type,
    category: m.category,
  }));

  console.log(`  📋 Serving ${models.length} models from experimental data`);
  res.json({ success: true, models });
});

/**
 * POST /api/chat
 * Body: { prompt: string, modelIds: string[], users?: number }
 *
 * Replays real experimental results for each model in parallel,
 * with a simulated Jetson inference delay.
 */
app.post('/api/chat', async (req, res) => {
  const { prompt = '', modelIds = [], users = 1 } = req.body;

  logRequest('POST', '/api/chat', { prompt: prompt.slice(0, 80), modelIds, users });

  if (!modelIds || modelIds.length === 0) {
    return res.json({ success: false, error: 'No models selected.' });
  }

  const inferenceJobs = modelIds.map(async (modelId) => {
    const startMs = Date.now();

    console.log(`\n  [REPLAY] ⏳ ${modelId} | users=${users} — loading...`);

    // 1. Locate the JSON file
    const found = findModelFile(modelId);
    if (!found) {
      const latencyMs = Date.now() - startMs;
      logResult(modelId, users, latencyMs, 'FAIL — file not found');
      return {
        modelId,
        success: false,
        error:   `No experimental data found for model "${modelId}". ` +
                 `Expected file: ${modelIdToFilename(modelId)} in coder or general directory.`,
      };
    }

    // 2. Load & parse the file
    const modelData = loadModelData(found.filePath);
    if (!modelData) {
      const latencyMs = Date.now() - startMs;
      logResult(modelId, users, latencyMs, 'FAIL — parse error');
      return { modelId, success: false, error: `Failed to parse data file for "${modelId}".` };
    }

    // 3. Find the matching concurrency entry
    const entry = findConcurrencyEntry(modelData, users);
    if (!entry) {
      const availableConcurrencies = modelData.map(e => e.users_concurrency).join(', ');
      const latencyMs = Date.now() - startMs;
      logResult(modelId, users, latencyMs, `FAIL — no data for users=${users}`);
      return {
        modelId,
        success: false,
        error:   `No data for users_concurrency=${users} in "${modelId}". ` +
                 `Available: [${availableConcurrencies}]`,
      };
    }

    // 4. Simulate Jetson inference latency
    await inferenceDelay();

    // 5. Build the response summary
    const summary    = buildSummary(entry, modelId);
    const latencyMs  = Date.now() - startMs;

    logResult(modelId, users, latencyMs, 'SUCCESS');

    // 6. Build a natural-language answer for the chat UI
    const answer = formatAnswer(summary, prompt);

    return {
      modelId,
      success:  true,
      answer,
      summary,   // full structured data also available
    };
  });

  try {
    const results = await Promise.all(inferenceJobs);
    res.json({ success: true, responses: results });
  } catch (err) {
    console.error('  [ERROR] Parallel replay failed:', err.message);
    res.json({ success: false, error: 'Replay engine failure.' });
  }
});

/**
 * POST /api/generate
 * Ollama-compatible shim.
 * Body: { model, prompt, users? }
 */
app.post('/api/generate', async (req, res) => {
  const { model, prompt = '', users = 1 } = req.body;

  logRequest('POST', '/api/generate', { model, users });

  if (!model) {
    return res.json({ error: 'model field is required' });
  }

  const startMs = Date.now();
  const found   = findModelFile(model);

  if (!found) {
    logResult(model, users, Date.now() - startMs, 'FAIL — file not found');
    return res.json({
      model,
      created_at: new Date().toISOString(),
      response:   `Error: No experimental data for model "${model}".`,
      done:       true,
    });
  }

  const modelData = loadModelData(found.filePath);
  const entry     = modelData ? findConcurrencyEntry(modelData, users) : null;

  await inferenceDelay();
  const latencyMs = Date.now() - startMs;

  if (!entry) {
    logResult(model, users, latencyMs, 'FAIL — no concurrency entry');
    return res.json({
      model,
      created_at: new Date().toISOString(),
      response:   `No data for users_concurrency=${users} in model "${model}".`,
      done:       true,
    });
  }

  const summary = buildSummary(entry, model);
  logResult(model, users, latencyMs, 'SUCCESS');

  res.json({
    model,
    created_at:     new Date().toISOString(),
    response:       formatAnswer(summary, prompt),
    done:           true,
    total_duration: latencyMs * 1_000_000,
    eval_count:     Math.round(summary.avg_tps * 60),
  });
});

// ── Answer Formatter ─────────────────────────────────────────
/**
 * Converts a summary object into a readable text response for the chat UI.
 * Includes overall stats + per-page extraction results.
 */
function formatAnswer(summary, prompt) {
  const { model_id, users_concurrency, pages_tested, success_count,
          fail_count, valid_json_count, avg_tps, extractions } = summary;

  const lines = [
    `📊 Replay Results — ${model_id}`,
    `${'─'.repeat(48)}`,
    `  Concurrency : ${users_concurrency} concurrent user(s)`,
    `  Pages Tested: ${pages_tested}`,
    `  Successful  : ${success_count} / ${pages_tested}`,
    `  Valid JSON  : ${valid_json_count} / ${pages_tested}`,
    `  Avg TPS     : ${avg_tps} tokens/sec`,
    '',
    `Per-Page Results:`,
    `${'─'.repeat(48)}`,
  ];

  for (const e of extractions) {
    const statusIcon = e.status === 'Success' ? '✅' : '❌';
    const jsonIcon   = e.valid_json ? '🟢 JSON' : '🔴 Raw';
    const tpsStr     = e.tps > 0 ? `${e.tps.toFixed(2)} tps` : 'N/A';
    const timeStr    = e.time_sec > 0 ? `${e.time_sec}s` : 'timeout';

    lines.push(`${statusIcon} ${e.file.padEnd(12)} | ${jsonIcon} | ${tpsStr.padEnd(12)} | ${timeStr}`);

    // If data is a valid array of products, show a preview
    if (Array.isArray(e.data) && e.data.length > 0) {
      const preview = e.data.slice(0, 3);
      for (const item of preview) {
        if (item && item.product_name) {
          lines.push(`    → ${item.product_name} — ${item.price}`);
        }
      }
      if (e.data.length > 3) {
        lines.push(`    … and ${e.data.length - 3} more products`);
      }
    }
  }

  return lines.join('\n');
}

// ── Boot ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  const ts = new Date().toISOString();
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   🔬  REPLAY ENGINE — Edge AI Experiment Results Demo        ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Port      : http://localhost:${PORT}                            ║`);
  console.log(`║  Started   : ${ts}     ║`);
  console.log('║  Data Dirs :                                                 ║');
  console.log('║    model_coder_json_outputs/                                 ║');
  console.log('║    model_general_json_outputs/                               ║');
  console.log('║  Models    :                                                 ║');
  MODEL_CATALOGUE.forEach(m => {
    const tag = `[${m.category.padEnd(7)}]`;
    console.log(`║    ${tag} ${m.id.padEnd(40)} ║`.slice(0, 66) + '║');
  });
  console.log('║                                                              ║');
  console.log('║  GPU Required : ❌  NONE (Replay Mode)                       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('\n  [READY] Waiting for frontend requests...\n');
});