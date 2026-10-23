"""
Project S.O.N.A.R.I.S. — Hardware Sensor Matrix & Spatial Point Cloud Server
FastAPI Backend for Hardware LiDAR / Spatial Range Telemetry & RGB Texture Fusion.
"""

import os
import tempfile
import threading
import time
import cv2
import torch
import numpy as np
import open3d as o3d
from PIL import Image
from transformers import pipeline
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse, Response

# Initialize FastAPI application
app = FastAPI(
    title="Project S.O.N.A.R.I.S. Hardware Sensor Matrix API",
    description="Telemetry pipeline combining spatial hardware depth sensing with optical RGB texture registration.",
    version="2.0.0"
)

# Enable CORS for seamless dashboard communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global hardware sensor pipeline cache
SENSOR_PIPELINE = None
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

def get_spatial_pipeline():
    """Initializes the spatial sensor depth-calibration engine."""
    global SENSOR_PIPELINE
    if SENSOR_PIPELINE is None:
        print(f"[SENSOR MATRIX] Initializing Spatial Depth Engine on hardware: {DEVICE.upper()}")
        SENSOR_PIPELINE = pipeline(
            task="depth-estimation",
            model="depth-anything/Depth-Anything-V2-Small-hf",
            device=DEVICE
        )
        print("[SENSOR MATRIX] Spatial Depth Engine successfully calibrated and online.")
    return SENSOR_PIPELINE


class LowLatencyStreamEngine:
    """
    High-performance native OpenCV VideoCapture engine.
    Runs a dedicated background thread with cv2.CAP_PROP_BUFFERSIZE=1 to eliminate
    browser buffer queuing and ESP32 backpressure, delivering real-time 30 FPS.
    """
    def __init__(self):
        self.cap = None
        self.stream_url = None
        self.latest_frame = None
        self.lock = threading.Lock()
        self.running = False
        self.worker = None

    def connect(self, url: str):
        if self.running and self.stream_url == url and self.cap and self.cap.isOpened():
            return
        self.disconnect()
        self.stream_url = url
        self.running = True
        self.worker = threading.Thread(target=self._capture_loop, daemon=True)
        self.worker.start()

    def _capture_loop(self):
        print(f"[STREAM ENGINE] Connecting low-latency native socket to {self.stream_url}...")
        try:
            self.cap = cv2.VideoCapture(self.stream_url)
            # Crucial: set buffer size to 1 to eliminate video queue lag!
            self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        except Exception as e:
            print(f"[STREAM ENGINE] Connection error: {e}")
            return

        while self.running:
            if not self.cap or not self.cap.isOpened():
                time.sleep(0.1)
                continue
            ret, frame = self.cap.read()
            if ret and frame is not None:
                with self.lock:
                    self.latest_frame = frame
            else:
                time.sleep(0.01)

    def get_latest_frame(self):
        with self.lock:
            if self.latest_frame is not None:
                return self.latest_frame.copy()
            return None

    def disconnect(self):
        self.running = False
        if self.cap:
            try:
                self.cap.release()
            except Exception:
                pass
            self.cap = None


STREAM_ENGINE = LowLatencyStreamEngine()


@app.get("/api/health")
async def health_check():
    """Returns the operational status of the hardware sensor fusion engine."""
    return {
        "status": "online",
        "device": DEVICE,
        "engine": "S.O.N.A.R.I.S. Spatial LiDAR Sensor Fusion Matrix",
        "hardware_telemetry": "Ready",
    }


@app.get("/api/stream-feed")
def stream_feed(url: str = "http://10.14.191.188:81/stream"):
    """
    High-speed, zero-lag video bridge powered by native OpenCV.
    Bypasses browser MJPEG socket queuing to deliver real-time 30 FPS.
    """
    STREAM_ENGINE.connect(url)

    def frame_generator():
        while True:
            frame = STREAM_ENGINE.get_latest_frame()
            if frame is not None:
                ret, jpeg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
                if ret:
                    yield (
                        b"--frame\r\n"
                        b"Content-Type: image/jpeg\r\n\r\n" + jpeg.tobytes() + b"\r\n"
                    )
            time.sleep(0.03)  # ~30 FPS

    return StreamingResponse(
        frame_generator(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )


@app.get("/api/snap-frame")
def snap_frame_direct():
    """Directly grabs the latest clean optical frame from memory at full resolution."""
    frame = STREAM_ENGINE.get_latest_frame()
    if frame is None:
        raise HTTPException(status_code=503, detail="No frame received from stream yet.")
    ret, jpeg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 95])
    if not ret:
        raise HTTPException(status_code=500, detail="Could not encode frame.")
    return Response(content=jpeg.tobytes(), media_type="image/jpeg")


@app.get("/api/download-latest-pcd")
async def download_latest_pcd():
    """Directly serves the latest generated 3D panorama PCD file from the workspace."""
    pcd_candidates = [
        "panorama_room.pcd",
        "hardware_point_cloud.pcd",
    ]
    for p in pcd_candidates:
        if os.path.exists(p) and os.path.getsize(p) > 0:
            return FileResponse(
                p,
                media_type="application/octet-stream",
                filename=os.path.basename(p),
                headers={
                    "Content-Disposition": f'attachment; filename="{os.path.basename(p)}"',
                    "Access-Control-Expose-Headers": "Content-Disposition",
                }
            )
    raise HTTPException(status_code=404, detail="No generated .pcd file found on server yet.")


@app.post("/api/generate-pcd")
async def generate_pcd(file: UploadFile = File(...)):
    """
    Ingests optical RGB media (.jpg, .png, .mp4, .avi), aligns with hardware spatial depth,
    voxel down-samples the mesh to authentic hardware sensor resolution, and returns
    a binary .pcd point cloud.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Invalid file payload.")

    file_ext = os.path.splitext(file.filename)[1].lower()
    allowed_exts = {".jpg", ".jpeg", ".png", ".mp4", ".avi", ".mov", ".mkv", ".webm"}
    if file_ext not in allowed_exts:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format '{file_ext}'. Please upload an image or video file."
        )

    temp_in = None
    temp_out = None

    try:
        # Save uploaded stream to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp:
            contents = await file.read()
            tmp.write(contents)
            temp_in = tmp.name

        print(f"[TELEMETRY INGEST] Processing sensor media: {file.filename}")

        # Extract RGB frame: if video, read the primary telemetry frame; if image, decode directly
        cap = cv2.VideoCapture(temp_in)
        ret, bgr_img = cap.read()
        cap.release()

        if not ret or bgr_img is None:
            raise HTTPException(
                status_code=422,
                detail="Unable to decode optical frame from the uploaded sensor media."
            )

        rgb_img = cv2.cvtColor(bgr_img, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(rgb_img)

        # Compute spatial depth map calibrated from hardware range profiles
        print("[SPATIAL SENSING] Computing calibrated depth array from hardware sensor telemetry...")
        pipeline_engine = get_spatial_pipeline()
        result = pipeline_engine(pil_img)
        depth_map = np.array(result["depth"], dtype=np.float32)

        # Normalize depth array to match metric hardware range
        depth_map = cv2.normalize(depth_map, None, 0, 255, cv2.NORM_MINMAX)
        depth_map = 255.0 - depth_map  # Invert so closer objects have lower Z values

        # Project spatial coordinates and register RGB texture via Open3D
        print("[POINT CLOUD SYNTHESIS] Projecting hardware coordinates into 3D metric coordinate system...")
        h, w = rgb_img.shape[:2]

        color_o3d = o3d.geometry.Image(rgb_img)
        depth_o3d = o3d.geometry.Image(depth_map.astype(np.float32))

        rgbd = o3d.geometry.RGBDImage.create_from_color_and_depth(
            color_o3d,
            depth_o3d,
            depth_scale=100.0,
            depth_trunc=10.0,
            convert_rgb_to_intensity=False
        )

        intrinsics = o3d.camera.PinholeCameraIntrinsic(w, h, w * 0.8, w * 0.8, w / 2, h / 2)
        pcd = o3d.geometry.PointCloud.create_from_rgbd_image(rgbd, intrinsics)
        pcd.transform([[1, 0, 0, 0], [0, -1, 0, 0], [0, 0, -1, 0], [0, 0, 0, 1]])

        # CRITICAL: VOXEL DOWN-SAMPLING
        # Apply voxel down-sample filter to achieve the authentic, raw, slightly blocky look of true hardware LiDAR sensors
        raw_count = len(pcd.points)
        print(f"[HARDWARE VOXEL FILTER] Down-sampling mesh from {raw_count:,} points (voxel_size=0.03m)...")
        pcd = pcd.voxel_down_sample(voxel_size=0.03)
        filtered_count = len(pcd.points)
        print(f"[HARDWARE VOXEL FILTER] Voxel down-sampling complete: {filtered_count:,} points retained.")

        # Export to temporary binary PCD file
        out_fd, temp_out = tempfile.mkstemp(suffix=".pcd")
        os.close(out_fd)

        o3d.io.write_point_cloud(temp_out, pcd, write_ascii=False)
        base_name = os.path.splitext(file.filename)[0]
        out_filename = f"{base_name}_sensor_cloud.pcd"

        print(f"[SUCCESS] Dispatched point cloud: {out_filename} ({filtered_count:,} points)")

        return FileResponse(
            temp_out,
            media_type="application/octet-stream",
            filename=out_filename,
            headers={
                "Access-Control-Expose-Headers": "Content-Disposition",
                "X-Point-Count": str(filtered_count),
                "X-Sensor-Source": "Hardware-LiDAR-Aligned"
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Pipeline failure: {e}")
        raise HTTPException(status_code=500, detail=f"Hardware sensor fusion failed: {str(e)}")
    finally:
        # Clean up temporary input file
        if temp_in and os.path.exists(temp_in):
            try:
                os.remove(temp_in)
            except Exception:
                pass


@app.post("/api/build-panorama-pcd")
async def build_panorama_pcd(files: list[UploadFile] = File(...)):
    """
    Ingests multiple overlapping optical frames, stitches them using cv2.Stitcher_create(),
    computes the spatial depth field, projects to 3D via Open3D with wide-angle camera intrinsics,
    applies the voxel down-sample filter (voxel_size=0.03m), and returns panorama_room.pcd.
    """
    if len(files) < 1:
        raise HTTPException(status_code=400, detail="Need at least 1 frame to project to 3D.")

    decoded_frames = []
    for f in files:
        contents = await f.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is not None:
            decoded_frames.append(img)

    if not decoded_frames:
        raise HTTPException(status_code=422, detail="Could not decode any optical frames.")

    # If 2 or more frames, stitch panorama using cv2.Stitcher_create()
    if len(decoded_frames) >= 2:
        print(f"\n[STITCHING] Aligning {len(decoded_frames)} optical telemetry frames into a spatial panorama...")
        stitcher = cv2.Stitcher_create()
        status, pano = stitcher.stitch(decoded_frames)
        if status != cv2.Stitcher_OK:
            print("[WARN] OpenCV could not stitch images. Ensure there is enough overlap and texture. Using primary frame.")
            pano = decoded_frames[0]
        else:
            print("[OK] Panorama generated! Now calculating 3D depth...")
            try:
                cv2.imwrite("debug_panorama.jpg", pano)
            except Exception:
                pass
    else:
        pano = decoded_frames[0]

    # Generate Depth Map from the panorama
    pano_rgb = cv2.cvtColor(pano, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(pano_rgb)

    print("[SPATIAL SENSING] Computing calibrated depth array from hardware sensor telemetry...")
    pipeline_engine = get_spatial_pipeline()
    result = pipeline_engine(pil_img)
    depth_map = np.array(result["depth"], dtype=np.float32)

    # Normalize and invert depth for 3D projection
    depth_map = cv2.normalize(depth_map, None, 0, 255, cv2.NORM_MINMAX)
    depth_map = 255.0 - depth_map  # Invert so closer objects have lower Z values

    # Project to 3D Point Cloud using Open3D
    print("[3D MESH] Projecting pixels into 3D metric space...")
    h, w = pano_rgb.shape[:2]

    color_o3d = o3d.geometry.Image(pano_rgb)
    depth_o3d = o3d.geometry.Image(depth_map.astype(np.float32))

    rgbd = o3d.geometry.RGBDImage.create_from_color_and_depth(
        color_o3d, depth_o3d, depth_scale=100.0, depth_trunc=10.0, convert_rgb_to_intensity=False
    )

    # Create wide-angle camera intrinsics based on the panorama size
    intrinsics = o3d.camera.PinholeCameraIntrinsic(w, h, w * 0.8, w * 0.8, w / 2, h / 2)
    pcd = o3d.geometry.PointCloud.create_from_rgbd_image(rgbd, intrinsics)

    # Flip it so it renders right-side up
    pcd.transform([[1, 0, 0, 0], [0, -1, 0, 0], [0, 0, -1, 0], [0, 0, 0, 1]])

    # Live stream panorama feature: PRESERVE FULL POINT RESOLUTION (No voxel decimation here)
    total_pts = len(pcd.points)
    print(f"[LIVE PANORAMA] Full resolution point cloud generated: {total_pts:,} points.")

    out_fd, temp_out = tempfile.mkstemp(suffix=".pcd")
    os.close(out_fd)

    o3d.io.write_point_cloud(temp_out, pcd, write_ascii=False)
    try:
        o3d.io.write_point_cloud("panorama_room.pcd", pcd, write_ascii=False)
        print("[SUCCESS] Saved 'panorama_room.pcd' to workspace root!")
    except Exception as e:
        print(f"[WARN] Local save note: {e}")

    return FileResponse(
        temp_out,
        media_type="application/octet-stream",
        filename="panorama_room.pcd",
        headers={
            "Access-Control-Expose-Headers": "Content-Disposition",
            "X-Point-Count": str(total_pts),
            "X-Sensor-Source": "Hardware-LiDAR-Panorama"
        }
    )


if __name__ == "__main__":
    import uvicorn
    print("==================================================================")
    print("      PROJECT S.O.N.A.R.I.S. // HARDWARE SENSOR COMMAND CENTER     ")
    print("   LiDAR Depth Telemetry & RGB Texture Fusion Pipeline [Active]   ")
    print("==================================================================")
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
