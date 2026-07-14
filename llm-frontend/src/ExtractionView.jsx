import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:3000';

// ─────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────
function groupByCategory(engines) {
  return {
    coder:   engines.filter(e => e.category === 'coder'),
    general: engines.filter(e => e.category === 'general'),
    other:   engines.filter(e => !e.category || (e.category !== 'coder' && e.category !== 'general')),
  };
}

function now() {
  return new Date().toLocaleTimeString('en-GB', { hour12: false });
}

// ─────────────────────────────────────────────────────────────
//  Terminal Log Component
// ─────────────────────────────────────────────────────────────
function TerminalPanel({ logs }) {
  const bottomRef = useRef(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  return (
    <div className="terminal-panel">
      <div className="terminal-header">
        <div className="terminal-dots">
          <div className="terminal-dot dot-red" />
          <div className="terminal-dot dot-yellow" />
          <div className="terminal-dot dot-green" />
        </div>
        <span className="terminal-label">backend — replay-engine · port 3000</span>
      </div>
      <div className="terminal-body">
        {logs.length === 0 && (
          <span className="t-dim">
            {'>'} Waiting for extraction request…{' '}
            <span className="terminal-cursor" />
          </span>
        )}
        {logs.map((line, i) => (
          <div key={i} className="terminal-line">
            <span className="t-dim terminal-ts">[{line.ts}]</span>
            <span className={`t-${line.color || 'white'}`}>{line.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Results Panel Component
// ─────────────────────────────────────────────────────────────
function ResultsPanel({ responses, isLoading }) {
  return (
    <div className="results-panel">
      <div className="results-panel-header">
        <span className="results-panel-label">Extraction Output</span>
        {responses.length > 0 && (
          <span className="pill pill-teal" style={{ marginLeft: 'auto' }}>
            {responses.length} result{responses.length > 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div className="results-scroll">
        {!isLoading && responses.length === 0 && (
          <div className="ext-empty">
            <div className="ext-empty-icon">🗂</div>
            <p className="ext-empty-title">No Results Yet</p>
            <p className="ext-empty-sub">Select models and run extraction to see output here.</p>
          </div>
        )}
        {responses.map((res, i) => (
          <div key={`${res.modelId}-${i}`} className="result-card">
            <div className="result-card-header">
              <span className="result-model-name">{res.modelId}</span>
              <span className={`status-badge ${res.success ? 'success' : 'error'}`}>
                {res.success ? 'Success' : 'Failed'}
              </span>
            </div>
            <div className="result-card-body">
              {res.success
                ? <p className="result-text">{res.answer}</p>
                : <p className="result-error-text">⚠ {res.error || 'Failed to retrieve response.'}</p>
              }
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Engine Sidebar Controls
// ─────────────────────────────────────────────────────────────
function EngineItem({ engine, isSelected, onToggle }) {
  return (
    <label className={`engine-item ${isSelected ? 'is-selected' : ''}`}>
      <input
        type="checkbox"
        className="engine-checkbox"
        checked={isSelected}
        onChange={() => onToggle(engine.id)}
      />
      <div className="engine-info">
        <p className="engine-name" title={engine.name}>{engine.name}</p>
        <p className="engine-type">{engine.type || 'JETSON ORIN'}</p>
      </div>
      {engine.category === 'coder'
        ? <span className="badge badge-coder">Coder</span>
        : engine.category === 'general'
          ? <span className="badge badge-general">General</span>
          : null}
    </label>
  );
}

// ─────────────────────────────────────────────────────────────
//  EXTRACTION ENGINE VIEW
// ─────────────────────────────────────────────────────────────
export default function ExtractionView() {
  const [engines,        setEngines]        = useState([]);
  const [selectedModels, setSelectedModels] = useState([]);
  const [users,          setUsers]          = useState(1);
  const [prompt,         setPrompt]         = useState('');
  const [isLoading,      setIsLoading]      = useState(false);
  const [responses,      setResponses]      = useState([]);
  const [logs,           setLogs]           = useState([]);

  const pushLog = (text, color = 'white') =>
    setLogs(prev => [...prev, { ts: now(), text, color }]);

  // Fetch models on mount
  useEffect(() => {
    pushLog('Replay Engine initialising…', 'dim');
    axios.get(`${API_BASE}/api/models`)
      .then(res => {
        if (res.data.success && res.data.models.length > 0) {
          setEngines(res.data.models);
          setSelectedModels([res.data.models[0].id]);
          pushLog(`✓ Loaded ${res.data.models.length} models from experimental data`, 'green');
        }
      })
      .catch(() => pushLog('✗ Failed to connect to backend at localhost:3000', 'error'));
  }, []);

  const toggleModel = (id) =>
    setSelectedModels(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );

  const handleRun = async () => {
    if (!prompt.trim() || selectedModels.length === 0 || isLoading) return;
    setIsLoading(true);
    setResponses([]);
    setLogs([]);

    pushLog(`POST /api/chat  →  models: [${selectedModels.join(', ')}]  users: ${users}`, 'amber');
    pushLog(`Prompt: "${prompt.slice(0, 60)}${prompt.length > 60 ? '…' : ''}"`, 'dim');
    pushLog('Dispatching parallel inference jobs…', 'dim');
    selectedModels.forEach(m => pushLog(`  ⏳ ${m} | users=${users} — thinking…`, 'dim'));

    try {
      const start = Date.now();
      const res = await axios.post(`${API_BASE}/api/chat`, {
        prompt,
        modelIds: selectedModels,
        users: Number(users),
      });
      const elapsed = Date.now() - start;

      if (res.data.success) {
        setResponses(res.data.responses);
        res.data.responses.forEach(r => {
          if (r.success) pushLog(`  ✓ ${r.modelId}  |  STATUS: SUCCESS`, 'green');
          else           pushLog(`  ✗ ${r.modelId}  |  STATUS: FAIL — ${r.error}`, 'error');
        });
        pushLog(`────────────────────────────────────────`, 'dim');
        pushLog(`✓ All responses received in ${elapsed}ms`, 'green');
      } else {
        pushLog(`✗ API error: ${res.data.error}`, 'error');
      }
    } catch (err) {
      pushLog(`✗ Connection failed: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
      setPrompt('');
    }
  };

  const handleKeyDown = e => { if (e.key === 'Enter' && !e.shiftKey) handleRun(); };

  const { coder, general, other } = groupByCategory(engines);
  const canRun = !isLoading && selectedModels.length > 0 && prompt.trim().length > 0;

  return (
    <div className="extraction-layout">

      {/* ── LEFT SIDEBAR ───────────────────────────────────── */}
      <aside className="ext-sidebar">
        <div className="ext-sidebar-header">
          <p className="ext-sidebar-eyebrow">Configuration</p>
          <h2 className="ext-sidebar-title">Extraction Engine</h2>
        </div>

        <div className="ext-sidebar-body">
          {/* Model selection */}
          <div className="ext-field-group">
            <span className="field-label">Target Models</span>
            <div className="engine-list">
              {coder.length > 0 && (
                <>
                  <p className="group-label">Coder Models</p>
                  {coder.map(e => (
                    <EngineItem key={e.id} engine={e}
                      isSelected={selectedModels.includes(e.id)}
                      onToggle={toggleModel} />
                  ))}
                </>
              )}
              {general.length > 0 && (
                <>
                  <p className="group-label">General Models</p>
                  {general.map(e => (
                    <EngineItem key={e.id} engine={e}
                      isSelected={selectedModels.includes(e.id)}
                      onToggle={toggleModel} />
                  ))}
                </>
              )}
              {other.map(e => (
                <EngineItem key={e.id} engine={e}
                  isSelected={selectedModels.includes(e.id)}
                  onToggle={toggleModel} />
              ))}
              {engines.length === 0 && (
                <p style={{ fontSize: 11, color: 'var(--color-label)', padding: '4px 4px' }}>
                  Connecting to backend…
                </p>
              )}
            </div>
          </div>

          {/* Concurrency */}
          <div className="ext-field-group">
            <span className="field-label">User Load (Concurrency)</span>
            <select
              className="ctrl-select"
              value={users}
              onChange={e => setUsers(Number(e.target.value))}
              disabled={isLoading}
            >
              <option value={1}>1 User  —  Sequential</option>
              <option value={4}>4 Users  —  Concurrent</option>
              <option value={8}>8 Users  —  High Load</option>
            </select>
          </div>

          {/* Selection count */}
          <p style={{ fontSize: 11, color: 'var(--color-label)', paddingLeft: 2 }}>
            {selectedModels.length} of {engines.length} engines selected
          </p>
        </div>

        <div className="ext-sidebar-footer">
          <button className="run-btn" onClick={handleRun} disabled={!canRun}>
            {isLoading
              ? <><div className="run-spinner" /> Processing…</>
              : '▶  Run Extraction'
            }
          </button>
        </div>
      </aside>

      {/* ── RIGHT MAIN ─────────────────────────────────────── */}
      <main className="ext-main">
        <div className="ext-topbar">
          <span className="ext-topbar-title">Multi-Engine Output</span>
          <div className="status-pill">
            <div className={`status-dot ${isLoading ? 'loading' : ''}`} />
            {isLoading ? 'Processing…' : 'Standby'}
          </div>
        </div>

        <div className="ext-output-area">
          <TerminalPanel logs={logs} />
          <ResultsPanel responses={responses} isLoading={isLoading} />
        </div>

        <div className="ext-prompt-strip">
          <input
            type="text"
            className="prompt-input"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter extraction prompt (e.g. Extract products from page_1.html)…"
            disabled={isLoading || selectedModels.length === 0}
            autoComplete="off"
          />
          <button
            className="run-btn"
            style={{ width: 'auto', padding: '0 22px', flexShrink: 0 }}
            onClick={handleRun}
            disabled={!canRun}
          >
            {isLoading ? <div className="run-spinner" /> : 'Execute'}
          </button>
        </div>
      </main>
    </div>
  );
}
