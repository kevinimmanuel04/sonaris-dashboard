import React, { useState, useRef } from 'react';
import { IconUpload, IconCube, IconCpu } from './Icons';

/**
 * Offline Processing Command Center
 * Ingests optical media files, sends to the Python hardware sensor fusion backend,
 * and loads the down-sampled hardware point cloud into the 3D Workspace.
 */
export default function OfflineProcessing({ onPCDGenerated, onSwitchToWorkspace }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const [serverStatus, setServerStatus] = useState('Checking...');
  const fileInputRef = useRef(null);

  // Check backend server health
  React.useEffect(() => {
    let mounted = true;
    const checkServer = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/health', { method: 'GET' });
        if (res.ok) {
          const data = await res.json();
          if (mounted) setServerStatus(`Online (${data.device.toUpperCase()})`);
        } else {
          if (mounted) setServerStatus('Offline (HTTP ' + res.status + ')');
        }
      } catch {
        if (mounted) setServerStatus('Offline (Run npm start)');
      }
    };
    checkServer();
    return () => { mounted = false; };
  }, []);

  const handleProcessMedia = async (file) => {
    if (!file) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setProcessingStage('Ingesting Optical Telemetry Media...');

    const formData = new FormData();
    formData.append('file', file);

    try {
      setProcessingStage('Aligning Hardware LiDAR Spatial Depth & RGB Texture...');

      const response = await fetch('http://localhost:8000/api/generate-pcd', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errText = 'Server error during hardware telemetry fusion.';
        try {
          const errJson = await response.json();
          errText = errJson.detail || errText;
        } catch {
          // fallback
        }
        throw new Error(errText);
      }

      setProcessingStage('Applying Hardware Voxel Decimation (0.03m)...');

      // Extract filename from header or fallback
      const contentDisposition = response.headers.get('content-disposition');
      let filename = 'hardware_point_cloud.pcd';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) filename = match[1];
      } else {
        const base = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        filename = `${base}_sensor_cloud.pcd`;
      }

      setProcessingStage('Finalizing Calibrated 3D Point Matrix...');

      const blob = await response.blob();
      const pcdFile = new File([blob], filename, { type: 'application/octet-stream' });

      // Automatically load into Workspace and switch tab
      onPCDGenerated(pcdFile, filename);
    } catch (err) {
      console.error('Offline processing failed:', err);
      setErrorMessage(
        err.message.includes('Failed to fetch')
          ? 'Cannot connect to Python backend at http://localhost:8000. Ensure "npm start" is running.'
          : err.message
      );
    } finally {
      setIsProcessing(false);
      setProcessingStage('');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleProcessMedia(file);
  };

  const handleFilePicked = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessMedia(file);
      e.target.value = null;
    }
  };

  return (
    <div className="processing-page-container">
      {/* Background Matrix Styling */}
      <div className="processing-header">
        <div className="processing-badge">
          <span className="badge-pulse-dot" />
          <span>PROJECT S.O.N.A.R.I.S. // OFFLINE SENSOR PIPELINE</span>
        </div>
        <h1 className="processing-title">Hardware Depth &amp; RGB Registration</h1>
        <p className="processing-subtitle">
          Ingest optical media to fuse with hardware spatial sensor depth profiles, voxel-decimate to physical sensor resolution, and deploy into the 3D Workspace.
        </p>
      </div>

      <div className="processing-content-grid">
        {/* Main Upload Dropzone */}
        <div className="processing-main-card">
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".jpg,.jpeg,.png,.mp4,.avi,.mov,.mkv,.webm"
            onChange={handleFilePicked}
          />

          <div
            className={`processing-dropzone ${isDragging ? 'drag-over' : ''} ${isProcessing ? 'processing' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => !isProcessing && fileInputRef.current?.click()}
          >
            {isProcessing ? (
              <div className="processing-active-state">
                <div className="sensor-scan-ring" />
                <div className="processing-status-info">
                  <span className="stage-title">{processingStage}</span>
                  <span className="stage-desc font-mono text-cyan">
                    HARDWARE SPATIAL SENSOR FUSION IN PROGRESS
                  </span>
                </div>
                <div className="sensor-progress-indicator">
                  <div className="sensor-progress-shimmer" />
                </div>
              </div>
            ) : (
              <div className="dropzone-idle-state">
                <div className="dropzone-icon-cube">
                  <IconUpload size={32} />
                </div>
                <h3 className="dropzone-header">Drop Optical Media File Here</h3>
                <p className="dropzone-meta">
                  Upload RGB image (.jpg, .png) or video (.mp4, .avi, .mov)
                </p>
                <div className="accepted-formats-row">
                  <span className="chip-format">JPG / PNG</span>
                  <span className="chip-format">MP4 / AVI / MOV</span>
                  <span className="chip-format">VOXEL FILTER: 0.03m</span>
                  <span className="chip-format">OUTPUT: .PCD</span>
                </div>
              </div>
            )}
          </div>

          {errorMessage && (
            <div className="processing-error-banner">
              <span className="error-icon">!</span>
              <span className="error-text">{errorMessage}</span>
              <button
                type="button"
                className="error-dismiss"
                onClick={() => setErrorMessage(null)}
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Telemetry Sidebar Details */}
        <div className="processing-sidebar">
          <div className="telemetry-panel">
            <div className="panel-header">
              <IconCpu size={16} />
              <span>SENSOR PIPELINE CONFIGURATION</span>
            </div>

            <div className="telemetry-item">
              <span className="item-label">Server Telemetry Endpoint</span>
              <span className="item-value font-mono">http://localhost:8000</span>
            </div>

            <div className="telemetry-item">
              <span className="item-label">Backend Status</span>
              <span className={`item-value font-mono ${serverStatus.includes('Online') ? 'text-emerald' : 'text-amber'}`}>
                {serverStatus}
              </span>
            </div>

            <div className="telemetry-item">
              <span className="item-label">Spatial Depth Sensor</span>
              <span className="item-value">Hardware LiDAR / Range Array</span>
            </div>

            <div className="telemetry-item">
              <span className="item-label">Texture Chrominance</span>
              <span className="item-value">Optical RGB Alignment</span>
            </div>

            <div className="telemetry-item">
              <span className="item-label">Voxel Filter Resolution</span>
              <span className="item-value font-mono text-cyan">0.03m (Hardware Calibrated)</span>
            </div>

            <div className="telemetry-item">
              <span className="item-label">Output Target</span>
              <span className="item-value font-mono">3D Workspace (Auto-Load)</span>
            </div>
          </div>

          <div className="telemetry-actions">
            <button
              type="button"
              className="quick-workspace-btn"
              onClick={onSwitchToWorkspace}
            >
              <IconCube size={15} />
              <span>Jump to 3D Workspace</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
