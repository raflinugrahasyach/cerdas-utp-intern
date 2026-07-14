import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, Area, AreaChart,
} from 'recharts';

// ─────────────────────────────────────────────────────────────
//  Benchmark Data  (from accuracy_metrics_report experiment)
// ─────────────────────────────────────────────────────────────

// F1-Score data across user loads
const f1Data = [
  {
    concurrency: '1 User',
    'Qwen2.5-Coder 14B':  86.2,
    'Yi-Coder 9B':        78.4,
    'Codestral 22B':      72.1,
    'DeepSeek-Coder 33B': 65.3,
    'Llama3.1 8B':        71.8,
    'Gemma2 9B':          68.5,
  },
  {
    concurrency: '4 Users',
    'Qwen2.5-Coder 14B':  85.9,
    'Yi-Coder 9B':        74.2,
    'Codestral 22B':      68.7,
    'DeepSeek-Coder 33B':  0.0,
    'Llama3.1 8B':        58.3,
    'Gemma2 9B':          52.1,
  },
  {
    concurrency: '8 Users',
    'Qwen2.5-Coder 14B':  85.5,
    'Yi-Coder 9B':        70.1,
    'Codestral 22B':      61.4,
    'DeepSeek-Coder 33B':  0.0,
    'Llama3.1 8B':        44.6,
    'Gemma2 9B':          38.9,
  },
];

// TPS degradation under load
const tpsData = [
  {
    concurrency: '1 User',
    'Qwen2.5-Coder 14B': 10.18,
    'Yi-Coder 9B':       20.18,
    'Llama3.1 8B':       22.25,
    'Gemma2 9B':         11.29,
    'DeepSeek-Coder 33B': 2.32,
  },
  {
    concurrency: '4 Users',
    'Qwen2.5-Coder 14B':  3.58,
    'Yi-Coder 9B':        9.11,
    'Llama3.1 8B':        8.30,
    'Gemma2 9B':          4.41,
    'DeepSeek-Coder 33B': 0.00,
  },
  {
    concurrency: '8 Users',
    'Qwen2.5-Coder 14B':  2.14,
    'Yi-Coder 9B':        5.47,
    'Llama3.1 8B':        5.11,
    'Gemma2 9B':          2.63,
    'DeepSeek-Coder 33B': 0.00,
  },
];

// Detailed leaderboard table
const tableData = [
  { model: 'Qwen2.5-Coder 14B', category: 'coder',   f1_u1: 86.2, f1_u4: 85.9, f1_u8: 85.5, tps_u1: 10.18, oom: false, valid_json: '100%',  verdict: 'top' },
  { model: 'Yi-Coder 9B',       category: 'coder',   f1_u1: 78.4, f1_u4: 74.2, f1_u8: 70.1, tps_u1: 20.18, oom: false, valid_json: '92%',   verdict: 'good' },
  { model: 'Codestral 22B',     category: 'coder',   f1_u1: 72.1, f1_u4: 68.7, f1_u8: 61.4, tps_u1:  5.81, oom: false, valid_json: '83%',   verdict: 'good' },
  { model: 'Llama3.1 8B',       category: 'general', f1_u1: 71.8, f1_u4: 58.3, f1_u8: 44.6, tps_u1: 22.25, oom: false, valid_json: '78%',   verdict: 'warn' },
  { model: 'Gemma2 9B',         category: 'general', f1_u1: 68.5, f1_u4: 52.1, f1_u8: 38.9, tps_u1: 11.29, oom: false, valid_json: '71%',   verdict: 'warn' },
  { model: 'Qwen2.5 14B',       category: 'general', f1_u1: 65.0, f1_u4: 51.2, f1_u8: 32.4, tps_u1:  9.54, oom: false, valid_json: '68%',   verdict: 'warn' },
  { model: 'DeepSeek-V2 16B',   category: 'coder',   f1_u1: 70.1, f1_u4: 12.3, f1_u8:  0.0, tps_u1:  4.41, oom: true,  valid_json: '60%',   verdict: 'bad'  },
  { model: 'Phind-CodeLlama 34B',category: 'coder',  f1_u1: 68.7, f1_u4:  8.1, f1_u8:  0.0, tps_u1:  3.97, oom: true,  valid_json: '55%',   verdict: 'bad'  },
  { model: 'DeepSeek-Coder 33B',category: 'coder',   f1_u1: 65.3, f1_u4:  0.0, f1_u8:  0.0, tps_u1:  2.32, oom: true,  valid_json: '48%',   verdict: 'bad'  },
];

// ─────────────────────────────────────────────────────────────
//  Chart Color Palettes
// ─────────────────────────────────────────────────────────────
const CHART_COLORS = {
  'Qwen2.5-Coder 14B':  '#00A388',
  'Yi-Coder 9B':        '#2563EB',
  'Codestral 22B':      '#7C3AED',
  'DeepSeek-Coder 33B': '#DC2626',
  'Llama3.1 8B':        '#D97706',
  'Gemma2 9B':          '#059669',
};

// ─────────────────────────────────────────────────────────────
//  Custom Tooltip
// ─────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label, unit = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <p className="custom-tooltip-label">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="custom-tooltip-row">
          <div className="tooltip-swatch" style={{ background: p.color }} />
          <span style={{ color: 'var(--color-muted)', minWidth: 140 }}>{p.name}</span>
          <strong style={{ color: 'var(--color-charcoal)' }}>
            {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}{unit}
          </strong>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  KPI Card
// ─────────────────────────────────────────────────────────────
function KPICard({ label, value, sub, badge, badgeClass = 'pill-teal' }) {
  return (
    <div className="kpi-card">
      <p className="kpi-label">{label}</p>
      <p className="kpi-value">{value}</p>
      <p className="kpi-sub">{sub}</p>
      {badge && <span className={`kpi-badge pill ${badgeClass}`}>{badge}</span>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  ANALYTICS DASHBOARD VIEW
// ─────────────────────────────────────────────────────────────
const ACTIVE_F1_MODELS  = ['Qwen2.5-Coder 14B', 'Yi-Coder 9B', 'Codestral 22B', 'DeepSeek-Coder 33B', 'Llama3.1 8B'];
const ACTIVE_TPS_MODELS = ['Qwen2.5-Coder 14B', 'Yi-Coder 9B', 'Llama3.1 8B', 'Gemma2 9B'];

export default function DashboardView() {
  const [f1Models,  setF1Models]  = useState(new Set(ACTIVE_F1_MODELS));
  const [tpsModels, setTpsModels] = useState(new Set(ACTIVE_TPS_MODELS));

  const toggleF1  = m => setF1Models(prev  => { const s = new Set(prev); s.has(m) ? s.delete(m) : s.add(m); return s; });
  const toggleTps = m => setTpsModels(prev => { const s = new Set(prev); s.has(m) ? s.delete(m) : s.add(m); return s; });

  // Verdict helper
  const verdictCell = (v) => {
    if (v === 'top')  return <span className="pill pill-teal">⭐ Top</span>;
    if (v === 'good') return <span className="pill pill-green">Good</span>;
    if (v === 'warn') return <span className="pill pill-amber">Fair</span>;
    return <span className="pill pill-red">Fail</span>;
  };

  return (
    <div className="dash-view">

      {/* Header */}
      <div className="dash-header">
        <p className="dash-eyebrow">Benchmark Report · Jetson Orin AGX</p>
        <h1 className="dash-title">Model Performance Analytics</h1>
        <p className="dash-subtitle">
          Edge AI HTML-to-JSON extraction benchmark — 9 models × 3 concurrency levels × 10 HTML pages
        </p>
      </div>

      {/* KPI Row */}
      <div className="kpi-row">
        <KPICard
          label="Top Performing Model"
          value="Qwen2.5-Coder"
          sub="14B parameters — highest F1 score stability across all load conditions"
          badge="Best Overall"
          badgeClass="pill-teal"
        />
        <KPICard
          label="Peak TPS (1 User)"
          value="22.25 tok/s"
          sub="Llama3.1 8B — fastest raw throughput at sequential load (1 user)"
          badge="Fastest TPS"
          badgeClass="pill-blue"
        />
        <KPICard
          label="OOM Failures @ 4+ Users"
          value="3 Models"
          sub="DeepSeek-Coder 33B, Phind-CodeLlama 34B, DeepSeek-V2 16B — memory saturation on Jetson"
          badge="⚠ OOM Risk"
          badgeClass="pill-amber"
        />
      </div>

      {/* Charts */}
      <div className="chart-row">

        {/* F1-Score Bar Chart */}
        <div className="chart-card">
          <div className="chart-card-header">
            <p className="chart-card-title">F1-Score Comparison by Concurrency</p>
            <p className="chart-card-sub">
              Higher is better. Note DeepSeek-Coder 33B collapses to 0% at ≥4 users.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              {ACTIVE_F1_MODELS.map(m => (
                <button key={m} onClick={() => toggleF1(m)} style={{
                  fontSize: 10, fontWeight: 600, padding: '3px 8px',
                  borderRadius: 99, cursor: 'pointer', border: '1.5px solid',
                  borderColor: CHART_COLORS[m] || '#ccc',
                  background: f1Models.has(m) ? (CHART_COLORS[m] || '#ccc') : 'transparent',
                  color: f1Models.has(m) ? '#fff' : (CHART_COLORS[m] || '#888'),
                  transition: 'all 0.15s',
                }}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="chart-card-body">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={f1Data} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F1F2" />
                <XAxis dataKey="concurrency" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip content={<CustomTooltip unit="%" />} />
                {ACTIVE_F1_MODELS.filter(m => f1Models.has(m)).map(m => (
                  <Bar key={m} dataKey={m} fill={CHART_COLORS[m] || '#ccc'}
                    radius={[3, 3, 0, 0]} maxBarSize={32} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* TPS Area Chart */}
        <div className="chart-card">
          <div className="chart-card-header">
            <p className="chart-card-title">Token Throughput (TPS) Degradation</p>
            <p className="chart-card-sub">
              TPS under increasing user load — smaller models maintain throughput better.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              {ACTIVE_TPS_MODELS.map(m => (
                <button key={m} onClick={() => toggleTps(m)} style={{
                  fontSize: 10, fontWeight: 600, padding: '3px 8px',
                  borderRadius: 99, cursor: 'pointer', border: '1.5px solid',
                  borderColor: CHART_COLORS[m] || '#ccc',
                  background: tpsModels.has(m) ? (CHART_COLORS[m] || '#ccc') : 'transparent',
                  color: tpsModels.has(m) ? '#fff' : (CHART_COLORS[m] || '#888'),
                  transition: 'all 0.15s',
                }}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="chart-card-body">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={tpsData} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
                <defs>
                  {ACTIVE_TPS_MODELS.map(m => (
                    <linearGradient key={m} id={`grad-${m.replace(/\s+/g,'')}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={CHART_COLORS[m]} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={CHART_COLORS[m]} stopOpacity={0.01} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F1F2" />
                <XAxis dataKey="concurrency" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} unit=" t/s" />
                <Tooltip content={<CustomTooltip unit=" t/s" />} />
                {ACTIVE_TPS_MODELS.filter(m => tpsModels.has(m)).map(m => (
                  <Area key={m} type="monotone" dataKey={m}
                    stroke={CHART_COLORS[m]} strokeWidth={2}
                    fill={`url(#grad-${m.replace(/\s+/g,'')})`}
                    dot={{ r: 4, fill: CHART_COLORS[m], strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detailed Leaderboard Table */}
      <div className="detail-card">
        <div className="detail-card-header">
          <p className="detail-card-title">Model Leaderboard — Full Benchmark Results</p>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Model</th>
              <th>Category</th>
              <th>F1 (1 User)</th>
              <th>F1 (4 Users)</th>
              <th>F1 (8 Users)</th>
              <th>Peak TPS</th>
              <th>Valid JSON</th>
              <th>OOM Risk</th>
              <th>Verdict</th>
            </tr>
          </thead>
          <tbody>
            {tableData.map((row, i) => (
              <tr key={i}>
                <td className="td-model">{row.model}</td>
                <td>
                  <span className={`pill ${row.category === 'coder' ? 'pill-blue' : 'pill-teal'}`}>
                    {row.category}
                  </span>
                </td>
                <td className={row.f1_u1 >= 70 ? 'td-good' : 'td-warn'}>{row.f1_u1.toFixed(1)}%</td>
                <td className={row.f1_u4 >= 60 ? 'td-good' : row.f1_u4 > 0 ? 'td-warn' : 'td-bad'}>
                  {row.f1_u4.toFixed(1)}%
                </td>
                <td className={row.f1_u8 >= 60 ? 'td-good' : row.f1_u8 > 0 ? 'td-warn' : 'td-bad'}>
                  {row.f1_u8.toFixed(1)}%
                </td>
                <td>{row.tps_u1.toFixed(2)} t/s</td>
                <td className={parseFloat(row.valid_json) >= 90 ? 'td-good' : parseFloat(row.valid_json) >= 70 ? 'td-warn' : 'td-bad'}>
                  {row.valid_json}
                </td>
                <td>
                  {row.oom
                    ? <span className="pill pill-red">⚠ OOM</span>
                    : <span className="pill pill-green">✓ Stable</span>
                  }
                </td>
                <td>{verdictCell(row.verdict)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer note */}
      <p style={{ fontSize: 11, color: 'var(--color-label)', textAlign: 'center', paddingBottom: 16 }}>
        Benchmark conducted on NVIDIA Jetson Orin AGX 64GB · Ollama runtime · 10 HTML pages per model per concurrency level
      </p>
    </div>
  );
}
