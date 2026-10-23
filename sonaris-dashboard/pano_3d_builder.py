import cv2
import torch
import numpy as np
import open3d as o3d
from PIL import Image
from transformers import pipeline

# 1. Load the AI Depth Model
print("[INIT] Loading AI Depth Model...")
device = "cuda" if torch.cuda.is_available() else "cpu"
depth_estimator = pipeline(
    task="depth-estimation",
    model="depth-anything/Depth-Anything-V2-Small-hf",
    device=device
)
print(f"[OK] Ready on {device.upper()}")

def capture_frames(stream_url):
    cap = cv2.VideoCapture(stream_url)
    frames = []
    print("\n[CAPTURE] Press SPACE to take a photo. Overlap them by 50%. Press Q when done.")
    
    while True:
        ret, frame = cap.read()
        if not ret: continue
        
        cv2.putText(frame, f"Captured: {len(frames)} (Press SPACE to snap, Q to finish)", 
                    (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        cv2.imshow("Stream", frame)
        
        key = cv2.waitKey(1) & 0xFF
        if key == ord(' '):
            # Save the clean frame (without text)
            clean_frame = cap.read()[1]
            frames.append(clean_frame)
            print(f"--> Frame {len(frames)} saved.")
        elif key == ord('q'):
            break
            
    cap.release()
    cv2.destroyAllWindows()
    return frames

def build_3d_panorama(frames, output_path="panorama_room.pcd"):
    if len(frames) < 2:
        print("[ERROR] Need at least 2 frames to stitch!")
        if len(frames) == 1:
            pano = frames[0]
        else:
            return None
    else:
        # 2. Stitch the images together
        print("\n[STITCHING] AI is finding correlations and stitching panorama...")
        stitcher = cv2.Stitcher_create()
        status, pano = stitcher.stitch(frames)
        
        if status != cv2.Stitcher_OK:
            print("[ERROR] OpenCV could not stitch images. Ensure there is enough overlap and texture.")
            pano = frames[0]
            
    cv2.imwrite("debug_panorama.jpg", pano)
    print("[OK] Panorama generated! Now calculating 3D depth...")

    # 3. Generate Depth Map
    pano_rgb = cv2.cvtColor(pano, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(pano_rgb)
    
    result = depth_estimator(pil_img)
    depth_map = np.array(result["depth"], dtype=np.float32)
    
    # Normalize and invert depth for 3D projection
    depth_map = cv2.normalize(depth_map, None, 0, 255, cv2.NORM_MINMAX)
    depth_map = 255.0 - depth_map # Invert so closer objects have lower Z values
    
    # 4. Project to 3D Point Cloud using Open3D
    print("[3D MESH] Projecting pixels into 3D space...")
    h, w = pano_rgb.shape[:2]
    
    color_o3d = o3d.geometry.Image(pano_rgb)
    depth_o3d = o3d.geometry.Image(depth_map.astype(np.float32))
    
    rgbd = o3d.geometry.RGBDImage.create_from_color_and_depth(
        color_o3d, depth_o3d, depth_scale=100.0, depth_trunc=10.0, convert_rgb_to_intensity=False)
    
    # Create fake wide-angle camera intrinsics based on the panorama size
    intrinsics = o3d.camera.PinholeCameraIntrinsic(w, h, w*0.8, w*0.8, w/2, h/2)
    
    pcd = o3d.geometry.PointCloud.create_from_rgbd_image(rgbd, intrinsics)
    
    # Flip it so it renders right-side up
    pcd.transform([[1, 0, 0, 0], [0, -1, 0, 0], [0, 0, -1, 0], [0, 0, 0, 1]])
    
    # Live stream feature: DO NOT downsample - keep full rich point cloud
    o3d.io.write_point_cloud(output_path, pcd)
    print(f"\n[SUCCESS] Saved '{output_path}'! Upload this to your dashboard.")
    return pcd

if __name__ == "__main__":
    ESP_STREAM_URL = "http://10.14.191.188:81/stream"
    captured_frames = capture_frames(ESP_STREAM_URL)
    build_3d_panorama(captured_frames)
