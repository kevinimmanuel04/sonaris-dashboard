/**
 * Generates realistic procedural point clouds for testing, demos, and benchmarking.
 */

// 1. Autonomous Vehicle Urban Intersection Scan
export function generateUrbanScan() {
  const points = [];

  // Ground plane & LiDAR scan rings
  const numRings = 24;
  for (let r = 1; r <= numRings; r++) {
    const radius = r * 1.8;
    const ringPoints = Math.floor(radius * 12);
    for (let i = 0; i < ringPoints; i++) {
      const angle = (i / ringPoints) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      const z = (Math.random() - 0.5) * 0.08; // subtle road noise
      // Curb elevation along y = ±8
      const isCurb = Math.abs(y - 8) < 0.3 || Math.abs(y + 8) < 0.3;
      points.push({
        x: Number(x.toFixed(3)),
        y: Number(y.toFixed(3)),
        z: isCurb ? 0.25 : Number(z.toFixed(3)),
        strength: Math.min(1, Math.max(0.2, 1 - radius / 50)),
      });
    }
  }

  // Vehicles (Box point clusters)
  const cars = [
    { cx: 8, cy: 3, cz: 0.9, w: 4.2, d: 2.0, h: 1.5, rot: 0 },
    { cx: -12, cy: -4, cz: 0.9, w: 4.6, d: 2.1, h: 1.7, rot: 0.1 },
    { cx: 16, cy: -3.5, cz: 1.2, w: 5.5, d: 2.3, h: 2.2, rot: -0.05 }, // SUV
  ];

  cars.forEach((car) => {
    const numPts = 350;
    for (let i = 0; i < numPts; i++) {
      // Points on surface of car box
      const side = Math.floor(Math.random() * 5);
      let lx = 0, ly = 0, lz = 0;
      if (side === 0) { // top
        lx = (Math.random() - 0.5) * car.w;
        ly = (Math.random() - 0.5) * car.d;
        lz = car.h / 2;
      } else if (side === 1) { // left
        lx = (Math.random() - 0.5) * car.w;
        ly = -car.d / 2;
        lz = (Math.random() - 0.5) * car.h;
      } else if (side === 2) { // right
        lx = (Math.random() - 0.5) * car.w;
        ly = car.d / 2;
        lz = (Math.random() - 0.5) * car.h;
      } else if (side === 3) { // front
        lx = car.w / 2;
        ly = (Math.random() - 0.5) * car.d;
        lz = (Math.random() - 0.5) * car.h;
      } else { // rear
        lx = -car.w / 2;
        ly = (Math.random() - 0.5) * car.d;
        lz = (Math.random() - 0.5) * car.h;
      }
      points.push({
        x: Number((car.cx + lx).toFixed(3)),
        y: Number((car.cy + ly).toFixed(3)),
        z: Number((car.cz + lz).toFixed(3)),
        strength: 0.85 + Math.random() * 0.15,
      });
    }
  });

  // Street Trees (Cylindrical trunks + spherical canopy)
  const trees = [
    { x: -10, y: 12 },
    { x: 5, y: 12 },
    { x: 20, y: 12 },
    { x: -15, y: -12 },
    { x: 0, y: -12 },
    { x: 15, y: -12 },
  ];

  trees.forEach((tree) => {
    // Trunk
    for (let j = 0; j < 60; j++) {
      const h = Math.random() * 3.5;
      const angle = Math.random() * Math.PI * 2;
      const rad = 0.25;
      points.push({
        x: Number((tree.x + Math.cos(angle) * rad).toFixed(3)),
        y: Number((tree.y + Math.sin(angle) * rad).toFixed(3)),
        z: Number(h.toFixed(3)),
        strength: 0.45,
      });
    }
    // Canopy
    for (let k = 0; k < 220; k++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = Math.cbrt(Math.random()) * 2.2;
      const sinPhi = Math.sin(phi);
      const px = r * sinPhi * Math.cos(theta);
      const py = r * sinPhi * Math.sin(theta);
      const pz = r * Math.cos(phi) + 4.8;
      points.push({
        x: Number((tree.x + px).toFixed(3)),
        y: Number((tree.y + py).toFixed(3)),
        z: Number(pz.toFixed(3)),
        strength: 0.6 + Math.random() * 0.3,
      });
    }
  });

  // Building Facades (Vertical point grid walls)
  for (let bx = -25; bx <= 25; bx += 1.2) {
    for (let bz = 0; bz <= 12; bz += 0.8) {
      if (Math.random() > 0.15) {
        points.push({
          x: Number(bx.toFixed(3)),
          y: 18 + (Math.random() - 0.5) * 0.1,
          z: Number(bz.toFixed(3)),
          strength: 0.7,
        });
      }
    }
  }

  return points;
}

// 2. Industrial Warehouse SLAM Map
export function generateWarehouseScan() {
  const points = [];

  // Floor
  for (let x = -20; x <= 20; x += 1.0) {
    for (let y = -15; y <= 15; y += 1.0) {
      if (Math.random() > 0.4) {
        points.push({
          x: Number((x + (Math.random() - 0.5) * 0.2).toFixed(3)),
          y: Number((y + (Math.random() - 0.5) * 0.2).toFixed(3)),
          z: Number(((Math.random() - 0.5) * 0.04).toFixed(3)),
          strength: 0.3,
        });
      }
    }
  }

  // Industrial Racks (Long aisles)
  const rackRows = [-10, -3, 4, 11];
  rackRows.forEach((ry) => {
    // 3 Tiers of shelves
    const heights = [1.5, 3.5, 5.5];
    for (let rx = -16; rx <= 16; rx += 0.4) {
      heights.forEach((h) => {
        // Shelf beam
        points.push({
          x: Number(rx.toFixed(3)),
          y: Number(ry.toFixed(3)),
          z: Number(h.toFixed(3)),
          strength: 0.8,
        });
        // Pallet goods box
        if (Math.floor(rx) % 3 === 0 && Math.random() > 0.2) {
          for (let pz = 0; pz < 4; pz++) {
            points.push({
              x: Number((rx + (Math.random() - 0.5) * 0.8).toFixed(3)),
              y: Number((ry + (Math.random() - 0.5) * 0.8).toFixed(3)),
              z: Number((h + 0.2 + pz * 0.3).toFixed(3)),
              strength: 0.9,
            });
          }
        }
      });
    }

    // Vertical Columns
    for (let colX = -16; colX <= 16; colX += 4) {
      for (let z = 0; z <= 6.2; z += 0.25) {
        points.push({
          x: colX,
          y: ry,
          z: Number(z.toFixed(3)),
          strength: 0.95,
        });
      }
    }
  });

  // Autonomous Mobile Robot in center
  for (let i = 0; i < 200; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * 0.9;
    const h = Math.random() * 0.6;
    points.push({
      x: Number((Math.cos(angle) * r).toFixed(3)),
      y: Number((-0.5 + Math.sin(angle) * r).toFixed(3)),
      z: Number(h.toFixed(3)),
      strength: 1.0,
    });
  }

  return points;
}

// 3. Topographic Ridge & Forest Survey
export function generateTerrainScan() {
  const points = [];
  const size = 30;
  const step = 0.9;

  for (let x = -size; x <= size; x += step) {
    for (let y = -size; y <= size; y += step) {
      // Natural terrain height function
      const wave1 = Math.sin(x * 0.12) * Math.cos(y * 0.12) * 3.5;
      const wave2 = Math.sin((x + y) * 0.08) * 2.0;
      const ridge = Math.exp(-Math.pow((x - y) / 12, 2)) * 4.0;
      const z = wave1 + wave2 + ridge + (Math.random() - 0.5) * 0.3;

      points.push({
        x: Number((x + (Math.random() - 0.5) * 0.1).toFixed(3)),
        y: Number((y + (Math.random() - 0.5) * 0.1).toFixed(3)),
        z: Number(z.toFixed(3)),
        strength: Math.min(1, Math.max(0.1, (z + 4) / 10)),
      });

      // Scatter vegetation on slopes
      if (z > 1 && Math.random() > 0.88) {
        const treeHeight = 1.5 + Math.random() * 2.5;
        for (let th = 0.4; th <= treeHeight; th += 0.5) {
          points.push({
            x: Number((x + (Math.random() - 0.5) * 0.4).toFixed(3)),
            y: Number((y + (Math.random() - 0.5) * 0.4).toFixed(3)),
            z: Number((z + th).toFixed(3)),
            strength: 0.75,
          });
        }
      }
    }
  }

  return points;
}
