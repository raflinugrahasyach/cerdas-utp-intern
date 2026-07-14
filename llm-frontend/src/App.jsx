import React, { useState } from 'react';

// Assets
import logoCerdas from './assets/logo_cerdas.png';
import logoDSB    from './assets/logo_DSB.png';

// Views
import ExtractionView from './ExtractionView.jsx';
import DashboardView  from './DashboardView.jsx';

// ─────────────────────────────────────────────────────────────
//  Navbar
// ─────────────────────────────────────────────────────────────
function Navbar({ activeTab, onTabChange }) {
  return (
    <nav className="navbar">

      {/* Left — Logos + Brand Text */}
      <div className="navbar-left">
        <div className="navbar-logo-group">
          <img src={logoCerdas} alt="CeRDaS UTP"      className="navbar-logo" />
          <div className="navbar-divider" />
          <img src={logoDSB}    alt="ITS DSB"          className="navbar-logo" />
        </div>
        <div className="navbar-divider" />
        <div className="navbar-brand-text">
          <span className="navbar-brand-title">LLM Benchmark Platform</span>
          <span className="navbar-brand-sub">Edge AI · Jetson Orin AGX</span>
        </div>
      </div>

      {/* Right — Navigation Tabs */}
      <div className="navbar-right">
        <button
          id="tab-extraction"
          className={`nav-tab ${activeTab === 'extraction' ? 'active' : ''}`}
          onClick={() => onTabChange('extraction')}
        >
          ⚙ Extraction Engine
        </button>
        <button
          id="tab-dashboard"
          className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => onTabChange('dashboard')}
        >
          📊 Analytics Dashboard
        </button>
      </div>

    </nav>
  );
}

// ─────────────────────────────────────────────────────────────
//  App Shell
// ─────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState('extraction');

  return (
    <div className="app-root">
      <Navbar activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="view-area">
        {activeTab === 'extraction' && <ExtractionView />}
        {activeTab === 'dashboard'  && <DashboardView />}
      </div>
    </div>
  );
}