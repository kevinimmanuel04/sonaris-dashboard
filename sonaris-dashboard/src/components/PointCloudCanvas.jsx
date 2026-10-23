import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader.js';

/**
 * High-Performance Direct Three.js PCD Engine
 * - Zero React virtual-DOM overhead (smooth 60 FPS)
 * - Hardware Early-Z depth testing (no transparent overdraw lag)
 * - Accurate 3D Euclidean distance measurement in true physical meters
 * - 360° unrestricted mouse orbit around model centroid
 */
export default function PointCloudCanvas({
  pcdSource = null,
  rawPoints = null,
  useColor = true,
  pointSize = 0.2,
  renderMode = 'points',
  axisRotation = 0,
  showGrid = true,
  isRotating = false,
  rotationSpeed = 1.0,
  cameraPreset = null,
  setCameraPreset = () => {},
  measureMode = false,
  measurePoints = [],
  onMeasurePointSelect = () => {},
  onPointCountChange = () => {},
  onLoadStatusChange = () => {},
  onProgressChange = () => {},
}) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const pointsMeshRef = useRef(null);
  const gridHelperRef = useRef(null);
  const measureGroupRef = useRef(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());

  // Scale factor ref for accurate physical meter conversion
  const scaleFactorRef = useRef(1.0);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Mutable props ref so effects don't churn
  const propsRef = useRef({});
  useEffect(() => {
    propsRef.current = {
      pointSize,
      useColor,
      axisRotation,
      renderMode,
      onLoadStatusChange,
      onProgressChange,
      onPointCountChange,
    };
  });

  // -------------------------------------------------------------------------
  // 1. INITIALIZE THREE.JS WEBGL RENDERER
  // -------------------------------------------------------------------------
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let width = mount.clientWidth || 800;
    let height = mount.clientHeight || 600;
    let frameId;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x06080d, 0.0018);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 8000);
    camera.position.set(0, 35, 70);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    renderer.setSize(width, height);
    // Cap pixel ratio at 1.25 for peak 60 FPS performance on high-DPI screens
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    mount.innerHTML = '';
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Minimal Ground Grid
    const gridHelper = new THREE.GridHelper(160, 80, 0x0284c7, 0x141b2b);
    gridHelper.position.y = -2;
    scene.add(gridHelper);
    gridHelperRef.current = gridHelper;

    // Measurement Group
    const measureGroup = new THREE.Group();
    scene.add(measureGroup);
    measureGroupRef.current = measureGroup;

    // Orbit Controls with Unrestricted 360 Free Rotation
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enableRotate = true;
    controls.rotateSpeed = 0.9;
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI;
    controls.minAzimuthAngle = -Infinity;
    controls.maxAzimuthAngle = Infinity;
    controls.screenSpacePanning = true;
    controls.target.set(0, 0, 0);
    controls.maxDistance = 3000;
    controlsRef.current = controls;

    // Dynamic Raycaster Threshold
    raycasterRef.current.params.Points.threshold = 0.5;

    // Render Loop
    const animate = () => {
      if (controlsRef.current) controlsRef.current.update();
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(animate);
    };
    animate();

    // Resize Handler
    const handleResize = () => {
      if (!mount) return;
      width = mount.clientWidth;
      height = mount.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.cancelAnimationFrame(frameId);
      if (controlsRef.current) controlsRef.current.dispose();
      if (rendererRef.current?.domElement && mount.contains(rendererRef.current.domElement)) {
        mount.removeChild(rendererRef.current.domElement);
      }
      scene.clear();
      renderer.dispose();
    };
  }, []);

  // -------------------------------------------------------------------------
  // 2. BULLETPROOF PCD LOADER PIPELINE
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!sceneRef.current || !pcdSource) return;

    propsRef.current.onLoadStatusChange('Extracting Point Matrix...');
    propsRef.current.onProgressChange(0);

    const isBlob = pcdSource instanceof File;
    const pcdUrl = isBlob ? URL.createObjectURL(pcdSource) : pcdSource;
    const loader = new PCDLoader();

    try {
      loader.load(
        pcdUrl,
        (points) => {
          try {
            if (pointsMeshRef.current && sceneRef.current) {
              sceneRef.current.remove(pointsMeshRef.current);
              pointsMeshRef.current.geometry?.dispose();
              pointsMeshRef.current.material?.dispose();
            }

            if (!points || !points.geometry) {
              throw new Error('Invalid PCD payload.');
            }

            // 1. Center geometry at (0, 0, 0)
            points.geometry.center();
            points.geometry.computeBoundingSphere();
            const sphere = points.geometry.boundingSphere;

            // 2. Dynamic Scale Factor (Saved for 100% accurate real meter distance calculation!)
            let scale = 1.0;
            if (sphere && sphere.radius > 0) {
              scale = 50.0 / sphere.radius;
              points.geometry.scale(scale, scale, scale);
              points.geometry.computeBoundingSphere();
            }
            scaleFactorRef.current = scale;

            // 3. Axis Rotation
            points.rotation.x = propsRef.current.axisRotation * (Math.PI / 180);

            // 4. Ultra-Fast Non-Lagging Material (Hardware DepthWrite, No Alpha Overdraw!)
            if (points.material) {
              const isSurface = propsRef.current.renderMode === 'surface';
              points.material.size = isSurface ? propsRef.current.pointSize * 1.8 : propsRef.current.pointSize;
              points.material.sizeAttenuation = true;

              const hasColors = points.geometry.hasAttribute('color');
              points.material.vertexColors = propsRef.current.useColor && hasColors;
              points.material.color = new THREE.Color(0xffffff);

              // Crucial for 60 FPS: Avoid alpha blending 400k overlapping points!
              points.material.transparent = false;
              points.material.depthWrite = true;
              points.material.depthTest = true;
            }

            sceneRef.current.add(points);
            pointsMeshRef.current = points;

            const posAttr = points.geometry.getAttribute('position');
            const count = posAttr ? posAttr.count : 0;
            propsRef.current.onPointCountChange(count);

            // Auto-frame camera
            if (controlsRef.current && cameraRef.current) {
              controlsRef.current.target.set(0, 0, 0);
              cameraRef.current.position.set(0, 35, 70);
              controlsRef.current.update();
            }

            propsRef.current.onLoadStatusChange('Ready');
            propsRef.current.onProgressChange(100);
          } catch (err) {
            console.error('Render error:', err);
            propsRef.current.onLoadStatusChange('Error: Invalid PCD');
          } finally {
            if (isBlob) URL.revokeObjectURL(pcdUrl);
          }
        },
        (xhr) => {
          if (xhr.total > 0) {
            const percent = Math.round((xhr.loaded / xhr.total) * 100);
            propsRef.current.onProgressChange(percent);
            propsRef.current.onLoadStatusChange(`Loading PCD... ${percent}%`);
          } else {
            propsRef.current.onLoadStatusChange(`Downloading... ${(xhr.loaded / 1024 / 1024).toFixed(2)} MB`);
          }
        },
        (error) => {
          console.error('PCD load error:', error);
          propsRef.current.onLoadStatusChange('Error: Failed to Load');
          if (isBlob) URL.revokeObjectURL(pcdUrl);
        }
      );
    } catch (e) {
      console.error('Loader crash:', e);
      propsRef.current.onLoadStatusChange('Error: Loader Crash');
      if (isBlob) URL.revokeObjectURL(pcdUrl);
    }
  }, [pcdSource]);

  // -------------------------------------------------------------------------
  // 3. SYNTHETIC / PRESET POINTS PIPELINE
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (pcdSource || !rawPoints || !sceneRef.current) return;

    if (pointsMeshRef.current) {
      sceneRef.current.remove(pointsMeshRef.current);
      pointsMeshRef.current.geometry?.dispose();
      pointsMeshRef.current.material?.dispose();
    }

    const count = rawPoints.length;
    if (count === 0) {
      propsRef.current.onPointCountChange(0);
      return;
    }

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    let minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < count; i++) {
      const z = rawPoints[i].z ?? 0;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    const zRange = maxZ - minZ > 0.001 ? maxZ - minZ : 1;

    for (let i = 0; i < count; i++) {
      const p = rawPoints[i];
      positions[i * 3] = p.x ?? 0;
      positions[i * 3 + 1] = p.y ?? 0;
      positions[i * 3 + 2] = p.z ?? 0;

      const t = Math.min(Math.max(((p.z ?? 0) - minZ) / zRange, 0), 1);
      const col = new THREE.Color().setHSL(0.55 - t * 0.55, 0.9, 0.55);
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.center();
    geometry.computeBoundingSphere();

    const sphere = geometry.boundingSphere;
    let scale = 1.0;
    if (sphere && sphere.radius > 0) {
      scale = 50.0 / sphere.radius;
      geometry.scale(scale, scale, scale);
    }
    scaleFactorRef.current = scale;

    const material = new THREE.PointsMaterial({
      size: propsRef.current.pointSize,
      sizeAttenuation: true,
      vertexColors: propsRef.current.useColor,
      color: new THREE.Color(0xffffff),
      transparent: false,
      depthWrite: true,
      depthTest: true,
    });

    const points = new THREE.Points(geometry, material);
    points.rotation.x = propsRef.current.axisRotation * (Math.PI / 180);
    sceneRef.current.add(points);
    pointsMeshRef.current = points;

    propsRef.current.onPointCountChange(count);
    propsRef.current.onLoadStatusChange('Ready');

    if (controlsRef.current && cameraRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      cameraRef.current.position.set(0, 35, 70);
      controlsRef.current.update();
    }
  }, [rawPoints, pcdSource]);

  // -------------------------------------------------------------------------
  // 4. INSTANT MATERIAL & VIEWPORT UPDATES (ZERO RE-LOAD OVERHEAD)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (pointsMeshRef.current?.material) {
      const isSurface = renderMode === 'surface';
      pointsMeshRef.current.material.size = isSurface ? pointSize * 1.8 : pointSize;
      pointsMeshRef.current.material.needsUpdate = true;
    }
    if (raycasterRef.current) {
      raycasterRef.current.params.Points.threshold = Math.max(pointSize * 0.8, 0.3);
    }
  }, [pointSize, renderMode]);

  useEffect(() => {
    if (pointsMeshRef.current?.material) {
      const hasColors = pointsMeshRef.current.geometry.hasAttribute('color');
      pointsMeshRef.current.material.vertexColors = useColor && hasColors;
      pointsMeshRef.current.material.needsUpdate = true;
    }
  }, [useColor]);

  useEffect(() => {
    if (pointsMeshRef.current) {
      pointsMeshRef.current.rotation.x = axisRotation * (Math.PI / 180);
    }
  }, [axisRotation]);

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = isRotating;
      controlsRef.current.autoRotateSpeed = rotationSpeed;
    }
  }, [isRotating, rotationSpeed]);

  useEffect(() => {
    if (gridHelperRef.current) {
      gridHelperRef.current.visible = showGrid;
    }
  }, [showGrid]);

  // Camera Presets
  useEffect(() => {
    if (!cameraPreset || !cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    controls.target.set(0, 0, 0);

    const dist = 70;
    switch (cameraPreset) {
      case 'top':
        camera.position.set(0, dist * 1.4, 0.001);
        break;
      case 'front':
        camera.position.set(0, 10, dist);
        break;
      case 'side':
        camera.position.set(dist, 10, 0);
        break;
      case 'iso':
        camera.position.set(dist * 0.7, dist * 0.7, dist * 0.7);
        break;
      case 'reset':
        camera.position.set(0, 35, dist);
        break;
      default:
        break;
    }
    camera.lookAt(0, 0, 0);
    controls.update();
    setCameraPreset(null);
  }, [cameraPreset, setCameraPreset]);

  // -------------------------------------------------------------------------
  // 5. 3D MEASUREMENT VISUALIZER (3D Spheres & Connecting Line)
  // -------------------------------------------------------------------------
  useEffect(() => {
    const group = measureGroupRef.current;
    if (!group) return;

    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      child.geometry?.dispose();
      child.material?.dispose();
    }

    if (!measurePoints || measurePoints.length === 0) return;

    const pA = measurePoints[0]?.markerPos;
    const pB = measurePoints[1]?.markerPos;

    if (pA) {
      const sphereA = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
      );
      sphereA.position.set(pA.x, pA.y, pA.z);
      group.add(sphereA);
    }

    if (pB) {
      const sphereB = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xf43f5e })
      );
      sphereB.position.set(pB.x, pB.y, pB.z);
      group.add(sphereB);

      const lineGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(pA.x, pA.y, pA.z),
        new THREE.Vector3(pB.x, pB.y, pB.z),
      ]);
      const lineMat = new THREE.LineDashedMaterial({
        color: 0x38bdf8,
        dashSize: 1,
        gapSize: 0.5,
      });
      const line = new THREE.Line(lineGeom, lineMat);
      line.computeLineDistances();
      group.add(line);
    }
  }, [measurePoints]);

  // -------------------------------------------------------------------------
  // 6. ACCURATE RAYCASTING (Invert Scaling & Model Orientation to True Meters)
  // -------------------------------------------------------------------------
  const handlePointerDown = (e) => {
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e) => {
    if (!measureMode || !mountRef.current || !cameraRef.current || !pointsMeshRef.current) return;

    // Reject mouse drags (orbit/pan) - only register intentional clicks
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    if (Math.hypot(dx, dy) > 5) return;

    const rect = mountRef.current.getBoundingClientRect();
    mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const intersects = raycasterRef.current.intersectObject(pointsMeshRef.current);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const scale = scaleFactorRef.current || 1.0;

      // 1. Scene position for placing the visual 3D marker
      const markerPos = {
        x: hit.point.x,
        y: hit.point.y,
        z: hit.point.z,
      };

      // 2. TRUE PHYSICAL REAL-WORLD METERS:
      // Convert world space back into local mesh coordinate system to cancel any axis flip!
      const localPoint = hit.point.clone();
      pointsMeshRef.current.worldToLocal(localPoint);

      const truePos = {
        x: localPoint.x / scale,
        y: localPoint.y / scale,
        z: localPoint.z / scale,
      };

      onMeasurePointSelect({ markerPos, truePos });
    }
  };

  return (
    <div
      ref={mountRef}
      className="point-cloud-viewport"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      style={{
        width: '100%',
        height: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
        outline: 'none',
        cursor: measureMode ? 'crosshair' : 'grab',
      }}
    />
  );
}
