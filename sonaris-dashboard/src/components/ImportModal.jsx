import React, { useRef, useState } from 'react';
import { IconUpload, IconCube } from './Icons';
import { generateUrbanScan, generateWarehouseScan, generateTerrainScan } from '../utils/sampleScans';

export default function ImportModal({
  isOpen,
  onClose,
  onFileLoaded,
  onPresetLoaded,
}) {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleProcessFile = async (file) => {
    if (!file) return;
    setIsLoading(true);
    setErrorMsg('');
    try {
      await onFileLoaded(file);
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to parse point cloud file.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleProcessFile(file);
  };

  const handlePreset = (generator, name) => {
    const pts = generator();
    onPresetLoaded(pts, name);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Import 3D Point Cloud</h3>
            <p className="modal-subtitle">
              Load any .PCD (Binary, Compressed, or ASCII), .CSV, or .JSON file
            </p>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept=".pcd,.csv,.txt,.json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleProcessFile(file);
          }}
        />

        <div
          className={`modal-drop-area ${isDragging ? 'dragging' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="drop-icon-wrapper">
            <IconUpload size={28} />
          </div>
          <div className="drop-text-content">
            <span className="drop-primary-text">
              {isLoading ? 'Parsing 3D geometry...' : 'Drop any .PCD file here or click to browse'}
            </span>
            <span className="drop-secondary-text">
              Full support for Binary, Binary-Compressed &amp; ASCII PCD • CSV • JSON
            </span>
          </div>
        </div>

        {errorMsg && (
          <div className="modal-error-banner">
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="modal-presets-row">
          <span className="presets-label">Or load a sample benchmark environment:</span>
          <div className="presets-buttons-flex">
            <button
              type="button"
              className="preset-pill-alt"
              onClick={() => handlePreset(generateUrbanScan, 'Urban LiDAR Scan')}
            >
              <IconCube size={13} />
              <span>Urban LiDAR</span>
            </button>
            <button
              type="button"
              className="preset-pill-alt"
              onClick={() => handlePreset(generateWarehouseScan, 'Warehouse SLAM')}
            >
              <IconCube size={13} />
              <span>Warehouse SLAM</span>
            </button>
            <button
              type="button"
              className="preset-pill-alt"
              onClick={() => handlePreset(generateTerrainScan, 'Terrain Survey')}
            >
              <IconCube size={13} />
              <span>Terrain Survey</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
