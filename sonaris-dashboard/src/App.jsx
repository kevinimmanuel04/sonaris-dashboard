import React, { useState, useEffect } from 'react';
import { ref, onValue, remove } from 'firebase/database';
import { db } from './firebase';
import Navbar from './components/Navbar';
import LandingHome from './components/LandingHome';
import StudioWorkspace from './components/StudioWorkspace';
import OfflineProcessing from './components/OfflineProcessing';
import LiveSensorMatrix from './components/LiveSensorMatrix';
import ImportModal from './components/ImportModal';
import { exportToPCD } from './utils/pcdExporter';
import './App.css';

export default function App() {
  // Navigation: Homepage opens FIRST by DEFAULT!
  const [activeTab, setActiveTab] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    if (['home', 'workspace', 'offline', 'live'].includes(hash)) {
      return hash;
    }
    return 'home'; // Landing page is the default entry point!
  });

  // Source States
  const [pcdSource, setPcdSource] = useState(null);
  const [rawPoints, setRawPoints] = useState(null);
  const [dataSourceName, setDataSourceName] = useState('Hardware Standby');
  const [totalPointCount, setTotalPointCount] = useState(0);
  const [isUsingFirebase, setIsUsingFirebase] = useState(false);

  // Status state
  const [isConnected, setIsConnected] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [notification, setNotification] = useState(null);

  // Sync hash in URL
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (['home', 'workspace', 'offline', 'live'].includes(hash)) {
        setActiveTab(hash);
      } else {
        setActiveTab('home');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    window.location.hash = `#${tab}`;
  };

  // Subscribe to Firebase Realtime Database only when actively needed
  useEffect(() => {
    const connectedRef = ref(db, '.info/connected');
    const unsubConnected = onValue(connectedRef, (snap) => {
      setIsConnected(snap.val() === true);
    });

    if (!isUsingFirebase) {
      return () => unsubConnected();
    }

    const scanRef = ref(db, 'scan_points');
    const unsubPoints = onValue(
      scanRef,
      (snapshot) => {
        const val = snapshot.val();
        if (!val) return;

        let parsed = [];
        if (Array.isArray(val)) {
          parsed = val.filter(Boolean);
        } else if (typeof val === 'object') {
          parsed = Object.values(val);
        }

        const clean = parsed
          .filter((p) => p && typeof p === 'object')
          .map((p) => ({
            x: Number(p.x) || 0,
            y: Number(p.y) || 0,
            z: Number(p.z) || 0,
          }));

        setRawPoints(clean);
        setPcdSource(null);
      },
      (error) => {
        console.error('Firebase telemetry read error:', error);
      }
    );

    return () => {
      unsubConnected();
      unsubPoints();
    };
  }, [isUsingFirebase]);

  // Show temporary toast notification
  const showToast = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 3800);
  };

  // Handler: Import local file (Binary PCD, Compressed PCD, ASCII PCD)
  const handleImportFile = (file) => {
    if (!file) return;
    setPcdSource(file);
    setRawPoints(null);
    setIsUsingFirebase(false);
    setDataSourceName(`Sensor File: ${file.name}`);
    handleTabSwitch('workspace');
    showToast(`Loaded Point Cloud: ${file.name}`, 'info');
  };

  // Handler: Generated PCD from Offline Processing or Live Sensor Matrix
  const handlePCDGenerated = (pcdFile, filename) => {
    setPcdSource(pcdFile);
    setRawPoints(null);
    setIsUsingFirebase(false);
    setDataSourceName(`Hardware Cloud: ${filename}`);
    handleTabSwitch('workspace');
    showToast(`Loaded Calibrated Hardware Point Cloud: ${filename}`, 'success');
  };

  // Handler: Load sample benchmark scan
  const handleLoadPreset = (presetPoints, presetName) => {
    setPcdSource(null);
    setRawPoints(presetPoints);
    setIsUsingFirebase(false);
    setDataSourceName(`Benchmark: ${presetName}`);
    handleTabSwitch('workspace');
    showToast(`Loaded ${presetName}`, 'info');
  };

  // Handler: Export current points to PCD v0.7 / download created .pcd
  const handleExportPCD = async () => {
    // 1. Direct download if pcdSource is a File or Blob
    if (pcdSource instanceof Blob || pcdSource instanceof File) {
      const fileName = pcdSource.name || 'panorama_room.pcd';
      const downloadName = fileName.endsWith('.pcd') ? fileName : `${fileName}.pcd`;
      const url = URL.createObjectURL(pcdSource);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast(`Downloaded ${downloadName}`, 'success');
      return;
    }

    // 2. Export array of points (benchmark preset or live telemetry points)
    if (rawPoints && rawPoints.length > 0) {
      const fileName = dataSourceName.includes(':')
        ? `${dataSourceName.split(':')[1].trim().toLowerCase().replace(/\s+/g, '_')}.pcd`
        : `sonaris_scan_${Date.now()}.pcd`;
      exportToPCD(rawPoints, fileName);
      showToast(`Exported ${fileName}`, 'success');
      return;
    }

    // 3. Fallback: Retrieve generated panorama_room.pcd from backend server
    try {
      showToast('Retrieving generated PCD from server...', 'info');
      const res = await fetch('http://localhost:8000/api/download-latest-pcd');
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'panorama_room.pcd';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast('Downloaded panorama_room.pcd from server', 'success');
        return;
      }
    } catch (err) {
      console.warn('Backend download fallback unavailable:', err);
    }

    showToast('No active point cloud in workspace to export.', 'warning');
  };

  // Handler: Clear workspace
  const handleClearPoints = async () => {
    const confirmed = window.confirm('Clear the active 3D point cloud from workspace?');
    if (!confirmed) return;

    if (isUsingFirebase) {
      try {
        const scanRef = ref(db, 'scan_points');
        await remove(scanRef);
      } catch (err) {
        console.error(err);
      }
    }

    setPcdSource(null);
    setRawPoints(null);
    setTotalPointCount(0);
    setDataSourceName('Hardware Standby');
    showToast('Cleared 3D workspace', 'info');
  };

  return (
    <div className="sonaris-app-container">
      {/* Top Precision Command Center Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={handleTabSwitch}
        isConnected={isConnected}
        pointsCount={totalPointCount || (rawPoints ? rawPoints.length : 0)}
        hasActiveData={!!pcdSource || (rawPoints && rawPoints.length > 0) || totalPointCount > 0}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onExportPCD={handleExportPCD}
      />

      {/* Main Unified View Area */}
      <main className="sonaris-main-view">
        {activeTab === 'home' && (
          <LandingHome
            onLaunchStudio={() => handleTabSwitch('workspace')}
            onLoadPreset={handleLoadPreset}
            onImportFile={handleImportFile}
          />
        )}

        {activeTab === 'workspace' && (
          <StudioWorkspace
            pcdSource={pcdSource}
            setPcdSource={setPcdSource}
            rawPoints={rawPoints}
            dataSourceName={dataSourceName}
            onImportFile={handleImportFile}
            onExportPCD={handleExportPCD}
            onClearPoints={handleClearPoints}
            onLoadPreset={handleLoadPreset}
            onPointCountChange={setTotalPointCount}
          />
        )}

        {activeTab === 'offline' && (
          <OfflineProcessing
            onPCDGenerated={handlePCDGenerated}
            onSwitchToWorkspace={() => handleTabSwitch('workspace')}
          />
        )}

        {activeTab === 'live' && (
          <LiveSensorMatrix
            onPCDGenerated={handlePCDGenerated}
            onSwitchToWorkspace={() => handleTabSwitch('workspace')}
          />
        )}
      </main>

      {/* Import Modal */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onFileLoaded={handleImportFile}
        onPresetLoaded={handleLoadPreset}
      />

      {/* Minimal Toast Notification */}
      {notification && (
        <div className={`toast-notification ${notification.type}`}>
          <span className="toast-dot" />
          <span className="toast-message">{notification.message}</span>
        </div>
      )}
    </div>
  );
}
