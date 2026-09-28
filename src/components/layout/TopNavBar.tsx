import React from 'react';
import type { ConsolePage } from '../../types/sonar';

interface TopNavBarProps {
  activePage: ConsolePage;
  onPageChange: (page: ConsolePage) => void;
  onSignOut: () => void;
  liveStreamStatus?: 'connected' | 'connecting' | 'disconnected';
  packetCount?: number;
  streamSource?: 'AUTO' | 'SIMULATION';
  onToggleSource?: () => void;
}

const navTabs: { key: ConsolePage; label: string; icon: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'fa-gauge-high' },
  { key: 'environment', label: 'Environment', icon: 'fa-water' },
  { key: 'waveforms', label: 'Waveforms', icon: 'fa-chart-line' },
  { key: 'analytics', label: 'Analytics', icon: 'fa-chart-simple' },
  { key: 'system', label: 'System', icon: 'fa-microchip' },
];

export const TopNavBar: React.FC<TopNavBarProps> = ({
  activePage,
  onPageChange,
  onSignOut,
  liveStreamStatus = 'disconnected',
  packetCount = 0,
  streamSource = 'AUTO',
  onToggleSource,
}) => {
  return (
    <header className="dash-top-bar">
      {/* Brand */}
      <div className="dash-brand">
        <div className="dash-logo-box">
          <svg viewBox="0 0 26 26" width="22" height="22" fill="none">
            <path
              d="M2.5 13C4.5 13 5.5 6 7.5 6C9.5 6 10.5 20 12.5 20C14.5 20 15.5 8 17.5 8C19.5 8 20.5 15 22.5 15"
              stroke="#38bdf8"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <span className="dash-brand-title">Wave Forge</span>
      </div>

      {/* Center GPS Coordinates Pill */}
      <div className="dash-gps-pill">
        <i className="fa-solid fa-crosshairs gps-icon"></i>
        <span>GPS 248° N, 47.63° E</span>
      </div>

      {/* Navigation Tabs Switcher */}
      <nav className="dash-main-nav" id="dashMainNav">
        {navTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`dash-nav-tab ${activePage === tab.key ? 'active' : ''}`}
            data-page={tab.key}
            onClick={() => onPageChange(tab.key)}
          >
            <i className={`fa-solid ${tab.icon}`}></i>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Right Actions: Telemetry Stream + Operator + Mode + Sign Out */}
      <div className="dash-top-actions">
        {/* Real-time Stream Link Indicator */}
        <div
          className={`dash-stream-pill ${liveStreamStatus === 'connected' && streamSource === 'AUTO' ? 'connected' : 'simulated'}`}
          title={
            liveStreamStatus === 'connected'
              ? `Connected to hardware stream (ws://localhost:8081). ${packetCount} packets parsed. Click to switch source.`
              : 'Live stream offline (run npm run feeder). Using realistic simulated telemetry. Click to toggle.'
          }
          onClick={onToggleSource}
          style={{ cursor: 'pointer' }}
        >
          <span
            className={`stream-indicator-dot ${
              liveStreamStatus === 'connected' && streamSource === 'AUTO'
                ? 'dot-live'
                : 'dot-sim'
            }`}
          ></span>
          <span>
            {liveStreamStatus === 'connected' && streamSource === 'AUTO'
              ? `LIVE STREAM (${packetCount} PKTS)`
              : 'SIMULATION MODE'}
          </span>
        </div>

        <div className="dash-operator-badge">
          <i className="fa-regular fa-user"></i>
          <span>Operator</span>
        </div>
        <div className="dash-mode-select">
          <span>Mode: Active</span>
          <i className="fa-solid fa-chevron-down"></i>
        </div>
        <button
          type="button"
          className="btn-dash-signout"
          id="btnDashSignOut"
          title="Sign out to console login"
          onClick={onSignOut}
        >
          <i className="fa-solid fa-arrow-right-from-bracket"></i>
          <span>Sign Out</span>
        </button>
      </div>
    </header>
  );
};
