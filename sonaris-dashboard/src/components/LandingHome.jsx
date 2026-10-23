import React, { useRef, useState } from 'react';
import SpatialBackground from './SpatialBackground';
import { IconUpload, IconArrowRight, IconCube } from './Icons';
import { generateUrbanScan } from '../utils/sampleScans';

export default function LandingHome({
  onLaunchStudio,
  onLoadPreset,
  onImportFile,
}) {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onImportFile(file);
    }
  };

  const handleFilePicked = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportFile(file);
      e.target.value = null;
    }
  };

  return (
    <div className="landing-minimal-wrapper">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".pcd"
        onChange={handleFilePicked}
      />

      {/* GPU-Accelerated 3D LiDAR Topographic Background */}
      <div className="landing-ambient-bg">
        <SpatialBackground />
      </div>

      {/* Subtle Spatial Telemetry Accents */}
      <div className="landing-corner-stats top-left font-mono">
        <span>SYS // SONARIS 3D</span>
        <span className="text-muted">PRECISION: SUB-MILLIMETER</span>
      </div>
      <div className="landing-corner-stats top-right font-mono">
        <span>PROJECTION: ORTHO/PERSP</span>
        <span className="text-muted">INPUT: .PCD (BIN/COMP/ASCII)</span>
      </div>

      {/* Foreground Minimal Content */}
      <div className="landing-hero-center">
        {/* Minimal Pill Badge */}
        <div className="minimal-badge animated-fade-in">
          <span className="minimal-badge-dot" />
          <span>3D SPATIAL POINT CLOUD WORKSPACE</span>
        </div>

        {/* Striking Minimal Headline */}
        <h1 className="minimal-hero-title animated-slide-up">
          Inspect, measure, and edit 3D maps.
        </h1>

        <p className="minimal-hero-sub animated-slide-up delay-1">
          High-performance point cloud renderer with 360° free rotation, accurate real-world metric distance measurement, and universal PCD support.
        </p>

        {/* Central Drag-and-Drop Area */}
        <div
          className={`minimal-dropzone animated-scale-in delay-2 ${isDragging ? 'drag-over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="dropzone-pulse-circle">
            <IconUpload size={24} />
          </div>

          <div className="dropzone-text-group">
            <span className="dropzone-main-text">
              Drop any .PCD file here or click to browse
            </span>
            <span className="dropzone-sub-text">
              Direct Binary, Compressed &amp; ASCII parsing with instant WebGL rendering
            </span>
          </div>

          <div className="format-badges-row">
            <span className="format-chip">PCD BINARY</span>
            <span className="format-chip">COMPRESSED</span>
            <span className="format-chip">ASCII</span>
            <span className="format-chip">RGB COLOR</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="minimal-action-buttons animated-slide-up delay-3">
          <button
            type="button"
            className="minimal-primary-btn"
            onClick={onLaunchStudio}
          >
            <span>Open 3D Workspace</span>
            <IconArrowRight size={15} />
          </button>

          <button
            type="button"
            className="minimal-secondary-btn"
            onClick={() => onLoadPreset(generateUrbanScan(), 'Urban LiDAR Demo')}
          >
            <IconCube size={15} />
            <span>Load Demo Scan</span>
          </button>
        </div>
      </div>
    </div>
  );
}
