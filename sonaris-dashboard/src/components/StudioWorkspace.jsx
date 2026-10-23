import React, { useState, useMemo, useRef } from 'react';
import PointCloudCanvas from './PointCloudCanvas';
import {
  IconUpload,
  IconDownload,
  IconTrash,
  IconRuler,
  IconGrid,
  IconCompass,
  IconRefresh,
  IconPlay,
  IconPause,
  IconRotate3D,
  IconPalette,
  IconCube,
  IconSliders,
} from './Icons';
import { generateUrbanScan, generateWarehouseScan, generateTerrainScan } from '../utils/sampleScans';

export default function StudioWorkspace({
  pcdSource,
  rawPoints,
  dataSourceName = 'Default Workspace',
  onImportFile,
  onExportPCD,
  onClearPoints,
  onLoadPreset,
  onPointCountChange,
}) {
  const fileInputRef = useRef(null);

  // Core Engine States
  const [useColor, setUseColor] = useState(true);
  const [pointSize, setPointSize] = useState(0.2);
  const [renderMode, setRenderMode] = useState('points'); // 'points' | 'surface'
  const [axisRotation, setAxisRotation] = useState(0);    // 0, 90, 180, 270 deg
  const [showGrid, setShowGrid] = useState(true);
  const [isRotating, setIsRotating] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(1);
  const rotationSpeeds = [0.5, 1.5, 3.0];

  // Popover Toggles on Left Toolbar
  const [showSizeSlider, setShowSizeSlider] = useState(false);
  const [showPresetsMenu, setShowPresetsMenu] = useState(false);

  // Camera & Measurement States
  const [cameraPreset, setCameraPreset] = useState(null);
  const [measureMode, setMeasureMode] = useState(false);
  const [measurePoints, setMeasurePoints] = useState([]);

  // Telemetry
  const [pointCount, setPointCount] = useState(0);
  const [mapStatus, setMapStatus] = useState('Standby');
  const [progress, setProgress] = useState(0);

  // Single Axis Cycle Handler: 0 -> 90 -> 180 -> 270 -> 0
  const cycleAxis = () => {
    setAxisRotation((prev) => (prev + 90) % 360);
  };

  // Cycle Auto-Rotation Speed
  const cycleRotationSpeed = () => {
    if (!isRotating) {
      setIsRotating(true);
    } else {
      setSpeedIndex((prev) => (prev + 1) % rotationSpeeds.length);
    }
  };

  // 100% Accurate Physical Distance Calculation (in true meters)
  const measurementResult = useMemo(() => {
    if (measurePoints.length < 2) return null;
    const p1 = measurePoints[0].truePos;
    const p2 = measurePoints[1].truePos;

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dz = p2.z - p1.z;
    const euclidean = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const groundDist = Math.sqrt(dx * dx + dy * dy);
    const deltaZ = Math.abs(dz);

    const formatDist = (meters) => {
      if (meters < 0.01) return `${(meters * 1000).toFixed(1)} mm`;
      if (meters < 1.0) return `${(meters * 100).toFixed(1)} cm`;
      return `${meters.toFixed(3)} m`;
    };

    return {
      distanceFormatted: formatDist(euclidean),
      deltaZFormatted: formatDist(deltaZ),
      groundFormatted: formatDist(groundDist),
      rawDist: euclidean.toFixed(3),
    };
  }, [measurePoints]);

  const handlePointSelectForMeasurement = (pointData) => {
    if (measurePoints.length >= 2) {
      setMeasurePoints([pointData]);
    } else {
      setMeasurePoints((prev) => [...prev, pointData]);
    }
  };

  const handleClearMeasurement = () => {
    setMeasurePoints([]);
  };

  const handleFilePicked = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportFile(file);
      e.target.value = null;
    }
  };

  return (
    <div className="studio-root">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".pcd"
        onChange={handleFilePicked}
      />

      {/* 3D WebGL Canvas Layer (Direct High-Speed Three.js) */}
      <div className="studio-canvas-container">
        <PointCloudCanvas
          pcdSource={pcdSource}
          rawPoints={rawPoints}
          useColor={useColor}
          pointSize={pointSize}
          renderMode={renderMode}
          axisRotation={axisRotation}
          showGrid={showGrid}
          isRotating={isRotating}
          rotationSpeed={rotationSpeeds[speedIndex]}
          cameraPreset={cameraPreset}
          setCameraPreset={setCameraPreset}
          measureMode={measureMode}
          measurePoints={measurePoints}
          onMeasurePointSelect={handlePointSelectForMeasurement}
          onPointCountChange={(count) => {
            setPointCount(count);
            if (onPointCountChange) onPointCountChange(count);
          }}
          onLoadStatusChange={setMapStatus}
          onProgressChange={setProgress}
        />
      </div>

      {/* ALL TOOLS CONSOLIDATED ON THE LEFT VERTICAL BAR */}
      <div className="studio-left-toolbar">
        {/* Group 1: Navigation & Measure */}
        <div className="tool-group">
          <button
            type="button"
            className={`tool-btn ${!measureMode ? 'active' : ''}`}
            onClick={() => setMeasureMode(false)}
            title="360° Free Mouse Orbit (Rotate in any angle)"
          >
            <IconCompass size={18} />
            <span className="tool-tooltip">360° Free Orbit</span>
          </button>

          <button
            type="button"
            className={`tool-btn ${measureMode ? 'active' : ''}`}
            onClick={() => setMeasureMode(!measureMode)}
            title="3D Distance Measurement Ruler"
          >
            <IconRuler size={18} />
            <span className="tool-tooltip">Measure Distance</span>
          </button>
        </div>

        <div className="tool-divider" />

        {/* Group 2: PCD Display & Style Controls (Moved from Right Box!) */}
        <div className="tool-group">
          {/* RGB Color ON/OFF Toggle */}
          <button
            type="button"
            className={`tool-btn ${useColor ? 'active' : ''}`}
            onClick={() => setUseColor(!useColor)}
            title={`RGB Color Mode: ${useColor ? 'ON' : 'OFF'}`}
          >
            <IconPalette size={17} />
            <span className="tool-tooltip">RGB {useColor ? 'ON' : 'OFF'}</span>
          </button>

          {/* Render Mode: Points vs Surface */}
          <button
            type="button"
            className={`tool-btn ${renderMode === 'surface' ? 'active' : ''}`}
            onClick={() => setRenderMode(renderMode === 'points' ? 'surface' : 'points')}
            title={`Render Mode: ${renderMode === 'surface' ? 'Surface Splat' : 'Points'}`}
          >
            <span className="tool-label-text">{renderMode === 'surface' ? 'SURF' : 'PNTS'}</span>
            <span className="tool-tooltip">Mode: {renderMode}</span>
          </button>

          {/* Point Size Adjuster with Flyout Slider */}
          <div className="tool-popover-wrapper">
            <button
              type="button"
              className={`tool-btn ${showSizeSlider ? 'active' : ''}`}
              onClick={() => setShowSizeSlider(!showSizeSlider)}
              title={`Point Size: ${pointSize.toFixed(2)}`}
            >
              <IconSliders size={17} />
              <span className="tool-tooltip">Point Size ({pointSize.toFixed(2)})</span>
            </button>

            {showSizeSlider && (
              <div className="tool-flyout-card">
                <span className="flyout-title">Point Size: {pointSize.toFixed(2)}</span>
                <input
                  type="range"
                  min="0.02"
                  max="2.5"
                  step="0.02"
                  value={pointSize}
                  onChange={(e) => setPointSize(parseFloat(e.target.value))}
                  className="flyout-slider"
                />
              </div>
            )}
          </div>

          {/* Auto-Rotation Play/Pause & Speed */}
          <button
            type="button"
            className={`tool-btn ${isRotating ? 'active' : ''}`}
            onClick={() => {
              if (isRotating) setIsRotating(false);
              else cycleRotationSpeed();
            }}
            title={`Auto-Rotate: ${isRotating ? `${rotationSpeeds[speedIndex]}x` : 'Paused'}`}
          >
            {isRotating ? <IconPause size={15} /> : <IconPlay size={15} />}
            <span className="tool-tooltip">
              {isRotating ? `Auto-Rotate (${rotationSpeeds[speedIndex]}x)` : 'Auto-Rotate (OFF)'}
            </span>
          </button>
        </div>

        <div className="tool-divider" />

        {/* Group 3: Orientation & Viewport (Single Axis Flip, NO DUPLICATE!) */}
        <div className="tool-group">
          {/* SINGLE Axis Flip Button */}
          <button
            type="button"
            className="tool-btn"
            onClick={cycleAxis}
            title={`Coordinate Axis: ${axisRotation}° (Click to cycle 0°, 90°, 180°, 270°)`}
          >
            <IconRotate3D size={17} />
            <span className="tool-tooltip">{axisRotation}° Axis Flip</span>
          </button>

          {/* Floor Grid Toggle */}
          <button
            type="button"
            className={`tool-btn ${showGrid ? 'active' : ''}`}
            onClick={() => setShowGrid(!showGrid)}
            title="Toggle Floor Grid"
          >
            <IconGrid size={17} />
            <span className="tool-tooltip">Floor Grid</span>
          </button>

          {/* Camera View Presets */}
          <button
            type="button"
            className="tool-btn"
            onClick={() => setCameraPreset('top')}
            title="Top View (Bird's Eye)"
          >
            <span className="tool-label-text">TOP</span>
            <span className="tool-tooltip">Top View (Bird's Eye)</span>
          </button>

          <button
            type="button"
            className="tool-btn"
            onClick={() => setCameraPreset('iso')}
            title="Isometric 45° View"
          >
            <span className="tool-label-text">ISO</span>
            <span className="tool-tooltip">Isometric 45°</span>
          </button>

          <button
            type="button"
            className="tool-btn"
            onClick={() => setCameraPreset('reset')}
            title="Center & Reset View"
          >
            <IconRefresh size={15} />
            <span className="tool-tooltip">Center &amp; Frame</span>
          </button>
        </div>

        <div className="tool-divider" />

        {/* Group 4: File Actions & Samples */}
        <div className="tool-group">
          <button
            type="button"
            className="tool-btn primary"
            onClick={() => fileInputRef.current?.click()}
            title="Upload Any .PCD File"
          >
            <IconUpload size={16} />
            <span className="tool-tooltip">Upload .PCD</span>
          </button>

          <button
            type="button"
            className="tool-btn"
            onClick={onExportPCD}
            disabled={pointCount === 0 && !pcdSource && !rawPoints}
            title="Download / Export .PCD Point Cloud"
          >
            <IconDownload size={16} />
            <span className="tool-tooltip">Export .PCD</span>
          </button>

          <button
            type="button"
            className="tool-btn danger"
            onClick={onClearPoints}
            disabled={pointCount === 0}
            title="Clear Current Map"
          >
            <IconTrash size={16} />
            <span className="tool-tooltip">Clear Workspace</span>
          </button>

          {/* Sample Benchmark Environments Flyout */}
          <div className="tool-popover-wrapper">
            <button
              type="button"
              className={`tool-btn ${showPresetsMenu ? 'active' : ''}`}
              onClick={() => setShowPresetsMenu(!showPresetsMenu)}
              title="Load Benchmark Sample Scans"
            >
              <IconCube size={16} />
              <span className="tool-tooltip">Sample Maps</span>
            </button>

            {showPresetsMenu && (
              <div className="tool-flyout-card presets-card">
                <span className="flyout-title">BENCHMARK SCANS</span>
                <button
                  type="button"
                  className="flyout-preset-btn"
                  onClick={() => {
                    onLoadPreset(generateUrbanScan(), 'Urban LiDAR Scan');
                    setShowPresetsMenu(false);
                  }}
                >
                  Urban LiDAR
                </button>
                <button
                  type="button"
                  className="flyout-preset-btn"
                  onClick={() => {
                    onLoadPreset(generateWarehouseScan(), 'Warehouse SLAM');
                    setShowPresetsMenu(false);
                  }}
                >
                  Warehouse SLAM
                </button>
                <button
                  type="button"
                  className="flyout-preset-btn"
                  onClick={() => {
                    onLoadPreset(generateTerrainScan(), 'Terrain Survey');
                    setShowPresetsMenu(false);
                  }}
                >
                  Terrain Survey
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Measurement Banner with Sub-millimeter Physical Accuracy */}
      {measureMode && (
        <div className="measurement-floating-banner">
          <div className="banner-left">
            <IconRuler size={16} />
            <span>
              {measurePoints.length === 0 && 'Click any point on the PCD to place 1st measurement marker'}
              {measurePoints.length === 1 && 'Click a 2nd point to calculate exact 3D Euclidean distance'}
              {measurePoints.length === 2 && (
                <>
                  Distance: <strong className="font-mono text-cyan">{measurementResult?.distanceFormatted}</strong> (ΔZ: {measurementResult?.deltaZFormatted}, Ground: {measurementResult?.groundFormatted})
                </>
              )}
            </span>
          </div>
          {measurePoints.length > 0 && (
            <button
              type="button"
              className="banner-clear-btn"
              onClick={handleClearMeasurement}
            >
              Reset Points
            </button>
          )}
        </div>
      )}

      {/* Loading & Extraction Overlay */}
      {mapStatus !== 'Ready' && mapStatus !== 'Standby' && (
        <div className="spatial-loading-overlay">
          <div className="spatial-loading-card">
            <div className="loading-spinner" />
            <span className="loading-status-text font-mono">{mapStatus}</span>
            {progress > 0 && progress < 100 && (
              <div className="loading-progress-bar">
                <div
                  className="loading-progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Engineering Status Bar */}
      <footer className="studio-status-bar">
        <div className="status-left">
          <span className="status-chip">
            <span className="chip-key">L-DRAG</span> 360° Free Orbit
          </span>
          <span className="status-chip">
            <span className="chip-key">R-DRAG</span> Pan
          </span>
          <span className="status-chip">
            <span className="chip-key">SCROLL</span> Zoom
          </span>
          <span className="status-chip">
            <span className="chip-key">CLICK</span> {measureMode ? 'Place Measure Marker' : 'Select'}
          </span>
        </div>

        <div className="status-right">
          <span className="status-chip font-mono">
            {dataSourceName}
          </span>
          <span className="status-chip font-mono active-points">
            {pointCount.toLocaleString()} PTS
          </span>
          <span className={`status-chip font-mono ${mapStatus === 'Ready' ? 'active-ready' : ''}`}>
            {mapStatus === 'Ready' ? 'READY' : mapStatus.toUpperCase()}
          </span>
        </div>
      </footer>
    </div>
  );
}
