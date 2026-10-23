# PROJECT S.O.N.A.R.I.S.
### Spatial Optical Navigation & Range-Imaging Sensing System
**Unified Full-Stack 3D Hardware Telemetry & Point Cloud Command Center**

---

## 🛰️ Overview
Project S.O.N.A.R.I.S. is a unified engineering command center designed to interface with spatial hardware sensors (LiDAR & IMU range telemetry) and optical cameras. Hardware sensors map the physical metric room depth while optical imaging collects chrominance and RGB textures to register photorealistic, calibrated 3D point clouds (`.pcd`).

---

## 📋 System Prerequisites
Before running on another laptop or machine, ensure the following are installed:

1. **Node.js** (v18.0.0 or higher) — [Download Node.js](https://nodejs.org/)
2. **Python** (v3.10 or v3.11 recommended) — [Download Python](https://www.python.org/)
   * *Make sure to check "Add Python to PATH" during installation.*
3. **Git** (for cloning the repository) — [Download Git](https://git-scm.com/)
4. *(Optional)* **NVIDIA CUDA Toolkit** — For GPU-accelerated spatial depth processing (CPU execution is automatically supported as fallback).

---

## 🚀 Quick Setup & Installation Guide

### Step 1: Open Terminal & Navigate to Dashboard
```bash
git clone <repository-url>
cd sonaris/sonaris-dashboard
```

---

### Step 2: Install Python Backend Dependencies
```bash
pip install -r requirements.txt
```

> **Included Python Packages:**
> `fastapi`, `uvicorn`, `python-multipart`, `opencv-python`, `torch`, `torchvision`, `numpy`, `open3d`, `pillow`, `transformers`, `requests`.

---

### Step 3: Install Frontend Node Dependencies
```bash
npm install
```

---

## ⚡ Starting the Application (Single Command)
Run both the Python backend API and the React development server concurrently with:

```bash
npm start
```

This single command boots:
* **Python Hardware Backend:** `http://localhost:8000` (FastAPI + OpenCV Native Bridge)
* **React Dashboard UI:** `http://localhost:5173` (Vite)

Open **`http://localhost:5173`** in your browser.

---

## 🎮 Command Center Modules

### 1. Overview (Default Landing Page)
* **Entry Point**: Opens automatically when navigating to `http://localhost:5173/`.
* **LiDAR Topography Background**: 100% GPU-accelerated spatial elevation topography running at a locked 60 FPS with zero CPU overhead.
* **Quick Launch**: Drag-and-drop any `.pcd` file directly or click **"Open 3D Workspace"**.

### 2. Workspace (3D Point Cloud Engine)
* **Direct Three.js Engine**: Custom WebGL pipeline rendering dense point clouds (400,000+ points) at 60 FPS using Hardware Early-Z depth culling.
* **Consolidated Left Toolbar**:
  * 🧭 **360° Free Orbit**: Rotate and inspect from any angle.
  * 📐 **3D Distance Ruler**: True Euclidean metric measurement with sub-millimeter accuracy.
  * 🎨 **RGB Mode Toggle**: Switch between native photorealistic RGB color and clean monochrome.
  * 🔲 **Render Mode**: Toggle discrete points (`PNTS`) and dense surface splatting (`SURF`).
  * 🎚️ **Point Size Slider**: Adjust point diameter on the fly.
  * 🔄 **Single Axis Flip**: Cycle model orientation `0° → 90° → 180° → 270°`.
  * 🌐 **Floor Grid**: Coordinate reference plane toggle.
  * 📥 **Download .PCD**: Instant export of the active point cloud file.
  * 📦 **Benchmark Scans**: Quick-load Urban LiDAR, Warehouse SLAM, and Terrain survey environments.

### 3. Offline Processing
* **Optical File Upload**: Drag and drop `.jpg`, `.png`, `.mp4`, `.avi`, or `.mov` files.
* **Hardware Voxel Decimation**: Aligns optical frames with hardware range profiles, applies an authentic `0.03m` voxel filter, and automatically transfers the resulting `.pcd` into the Workspace.

### 4. Live Sensor Matrix (Live Camera & 3D Panorama)
* **Real-Time 30 FPS Stream**: Connected via low-latency native OpenCV bridge (`BUFFERSIZE=1`), eliminating browser MJPEG buffering delay.
* **Stream Source**: Defaults to hardware stream `http://10.14.191.188:81/stream` (with toggle for local webcam).
* **Multi-Angle Capture Workflow**:
  1. Aim camera and press **`SPACE`** to snap photos (aim for ~50% overlap).
  2. Each snap displays an animated **`✓ FRAME #X CAPTURED`** confirmation tick mark and adds a thumbnail to the sequence filmstrip.
  3. Press **`Q`** (or click **"BUILD 3D PANORAMA"**) to stitch frames using OpenCV Stitcher and generate unreduced `panorama_room.pcd`.
  4. The calibrated 3D room automatically opens in your 3D Workspace!

---

## ⌨️ Control & Shortcut Reference

| Key / Action | Context | Function |
| :--- | :--- | :--- |
| **`SPACE`** | Live Sensor Matrix | Snap optical telemetry frame |
| **`Q`** | Live Sensor Matrix | Finish sequence and build 3D panorama |
| **Left Click + Drag** | Workspace | 360° Free Orbit around model center |
| **Right Click + Drag** | Workspace | Pan camera viewport |
| **Scroll Wheel** | Workspace | Zoom in / out |
| **Left Click** | Ruler Active | Place 3D distance measurement markers |
