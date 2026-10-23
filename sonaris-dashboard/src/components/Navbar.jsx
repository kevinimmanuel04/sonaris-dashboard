import React from 'react';
import { IconLogo, IconUpload, IconDownload, IconCube, IconLayers, IconVideo, IconArrowRight } from './Icons';

export default function Navbar({
  activeTab,
  setActiveTab,
  isConnected,
  pointsCount,
  hasActiveData = false,
  onOpenImportModal,
  onExportPCD,
}) {
  return (
    <header className="sonaris-navbar">
      <div className="nav-left">
        <button
          type="button"
          className="brand-button"
          onClick={() => setActiveTab('home')}
          title="Return to S.O.N.A.R.I.S. Overview"
        >
          <div className="brand-icon-wrapper">
            <IconLogo size={18} />
          </div>
          <div className="brand-text-container">
            <span className="brand-name">SONARIS</span>
            <span className="brand-tag">COMMAND CENTER</span>
          </div>
        </button>

        <div className="nav-divider" />

        {/* UNIFIED NAVIGATION TABS (HOME IS DEFAULT!) */}
        <nav className="nav-tab-group">
          <button
            type="button"
            className={`nav-tab-btn ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => setActiveTab('home')}
          >
            <span>Overview</span>
          </button>

          <button
            type="button"
            className={`nav-tab-btn ${activeTab === 'workspace' ? 'active' : ''}`}
            onClick={() => setActiveTab('workspace')}
          >
            <IconCube size={14} />
            <span>Workspace</span>
            {pointsCount > 0 && (
              <span className="tab-badge">{pointsCount.toLocaleString()} pts</span>
            )}
          </button>

          <button
            type="button"
            className={`nav-tab-btn ${activeTab === 'offline' ? 'active' : ''}`}
            onClick={() => setActiveTab('offline')}
          >
            <IconLayers size={14} />
            <span>Offline Processing</span>
          </button>

          <button
            type="button"
            className={`nav-tab-btn ${activeTab === 'live' ? 'active' : ''}`}
            onClick={() => setActiveTab('live')}
          >
            <IconVideo size={14} />
            <span>Live Sensor Matrix</span>
          </button>
        </nav>
      </div>

      <div className="nav-right">
        {/* Hardware telemetry status badge */}
        <div className={`connection-badge ${isConnected ? 'live' : 'idle'}`}>
          <span className="live-dot" />
          <span className="connection-text">
            {isConnected ? 'Hardware Telemetry Live' : 'Hardware Telemetry Idle'}
          </span>
        </div>

        {activeTab === 'workspace' ? (
          <div className="studio-nav-actions">
            <button
              type="button"
              className="action-btn secondary-btn"
              onClick={onOpenImportModal}
              title="Import local .PCD point cloud"
            >
              <IconUpload size={14} />
              <span>Import</span>
            </button>

            <button
              type="button"
              className="action-btn primary-btn"
              onClick={onExportPCD}
              disabled={pointsCount === 0 && !hasActiveData}
              title="Download / Export active point cloud as .PCD"
            >
              <IconDownload size={14} />
              <span>Download .PCD</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="action-btn primary-btn"
            onClick={() => setActiveTab('workspace')}
          >
            <span>Launch Workspace</span>
            <IconArrowRight size={14} />
          </button>
        )}
      </div>
    </header>
  );
}
