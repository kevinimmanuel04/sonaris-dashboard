/**
 * Parser for PCD (Point Cloud Data) supporting ASCII, Binary, and Binary-Compressed formats,
 * as well as CSV and JSON coordinate streams.
 */

import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader.js';

export async function parsePointFile(file) {
  const filename = file.name.toLowerCase();

  if (filename.endsWith('.pcd')) {
    const arrayBuffer = await file.arrayBuffer();
    return parsePCDWithThree(arrayBuffer, file.name);
  } else if (filename.endsWith('.csv') || filename.endsWith('.txt')) {
    const text = await file.text();
    return parseCSV(text, file.name);
  } else if (filename.endsWith('.json')) {
    const text = await file.text();
    return parseJSON(text, file.name);
  } else {
    // Try binary/ASCII PCD first
    try {
      const arrayBuffer = await file.arrayBuffer();
      return parsePCDWithThree(arrayBuffer, file.name);
    } catch {
      const text = await file.text();
      return parseCSV(text, file.name);
    }
  }
}

/**
 * Universal PCD Parser using Three.js PCDLoader
 * Supports:
 * - DATA ascii
 * - DATA binary
 * - DATA binary_compressed
 * - x y z coordinates
 * - rgb color channel
 * - intensity, normals
 */
export function parsePCDWithThree(arrayBuffer, filename = 'imported.pcd') {
  const loader = new PCDLoader();
  const pointsMesh = loader.parse(arrayBuffer);
  const geometry = pointsMesh.geometry;

  const posAttr = geometry.getAttribute('position');
  if (!posAttr || posAttr.count === 0) {
    throw new Error('PCD file contains no point coordinates.');
  }

  const count = posAttr.count;
  const positions = new Float32Array(posAttr.array);

  const colorAttr = geometry.getAttribute('color');
  let colors = null;
  let hasRGB = false;

  if (colorAttr && colorAttr.count === count) {
    colors = new Float32Array(colorAttr.array);
    hasRGB = true;
  }

  // Compute exact bounding metrics & centroid
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  let sumX = 0, sumY = 0, sumZ = 0;

  for (let i = 0; i < count; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];

    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;

    sumX += x;
    sumY += y;
    sumZ += z;
  }

  const cx = sumX / count;
  const cy = sumY / count;
  const cz = sumZ / count;

  return {
    name: filename,
    format: 'PCD v0.7 (ASCII / Binary / Compressed)',
    count,
    positions,
    colors,
    hasRGB,
    bounds: {
      minX: Number(minX.toFixed(3)),
      maxX: Number(maxX.toFixed(3)),
      minY: Number(minY.toFixed(3)),
      maxY: Number(maxY.toFixed(3)),
      minZ: Number(minZ.toFixed(3)),
      maxZ: Number(maxZ.toFixed(3)),
      sizeX: Number((maxX - minX).toFixed(3)),
      sizeY: Number((maxY - minY).toFixed(3)),
      sizeZ: Number((maxZ - minZ).toFixed(3)),
      centroid: {
        x: Number(cx.toFixed(3)),
        y: Number(cy.toFixed(3)),
        z: Number(cz.toFixed(3)),
      },
    },
  };
}

/**
 * CSV / TXT parser for tabular coordinates (x, y, z[, r, g, b])
 */
export function parseCSV(text, filename = 'imported.csv') {
  const lines = text.split(/\r?\n/);
  const validLines = [];

  let startIndex = 0;
  if (lines.length > 0) {
    const first = lines[0].toLowerCase();
    if (first.includes('x') && first.includes('y') && first.includes('z')) {
      startIndex = 1;
    }
  }

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    validLines.push(line);
  }

  const count = validLines.length;
  const positions = new Float32Array(count * 3);
  let colors = null;
  let hasRGB = false;

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  let sumX = 0, sumY = 0, sumZ = 0;

  for (let i = 0; i < count; i++) {
    const line = validLines[i];
    const delimiter = line.includes(',') ? ',' : line.includes(';') ? ';' : /\s+/;
    const tokens = line.split(delimiter);

    const x = parseFloat(tokens[0]) || 0;
    const y = parseFloat(tokens[1]) || 0;
    const z = parseFloat(tokens[2]) || 0;

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
    sumX += x;
    sumY += y;
    sumZ += z;

    // Check if RGB columns exist (r, g, b in 0..255 or 0..1)
    if (tokens.length >= 6) {
      if (!colors) colors = new Float32Array(count * 3);
      hasRGB = true;
      const r = parseFloat(tokens[3]);
      const g = parseFloat(tokens[4]);
      const b = parseFloat(tokens[5]);
      colors[i * 3] = r > 1 ? r / 255 : r;
      colors[i * 3 + 1] = g > 1 ? g / 255 : g;
      colors[i * 3 + 2] = b > 1 ? b / 255 : b;
    }
  }

  const cx = count > 0 ? sumX / count : 0;
  const cy = count > 0 ? sumY / count : 0;
  const cz = count > 0 ? sumZ / count : 0;

  return {
    name: filename,
    format: 'CSV Point Cloud',
    count,
    positions,
    colors,
    hasRGB,
    bounds: {
      minX: Number(minX.toFixed(3)),
      maxX: Number(maxX.toFixed(3)),
      minY: Number(minY.toFixed(3)),
      maxY: Number(maxY.toFixed(3)),
      minZ: Number(minZ.toFixed(3)),
      maxZ: Number(maxZ.toFixed(3)),
      sizeX: Number((maxX - minX).toFixed(3)),
      sizeY: Number((maxY - minY).toFixed(3)),
      sizeZ: Number((maxZ - minZ).toFixed(3)),
      centroid: {
        x: Number(cx.toFixed(3)),
        y: Number(cy.toFixed(3)),
        z: Number(cz.toFixed(3)),
      },
    },
  };
}

/**
 * JSON parser for point lists
 */
export function parseJSON(text, filename = 'imported.json') {
  const data = JSON.parse(text);
  const array = Array.isArray(data) ? data : data.points || Object.values(data);
  const count = array.length;

  const positions = new Float32Array(count * 3);
  let colors = null;
  let hasRGB = false;

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  let sumX = 0, sumY = 0, sumZ = 0;

  for (let i = 0; i < count; i++) {
    const p = array[i] || {};
    const x = Number(p.x) || 0;
    const y = Number(p.y) || 0;
    const z = Number(p.z) || 0;

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
    sumX += x;
    sumY += y;
    sumZ += z;

    if (p.r !== undefined && p.g !== undefined && p.b !== undefined) {
      if (!colors) colors = new Float32Array(count * 3);
      hasRGB = true;
      colors[i * 3] = p.r > 1 ? p.r / 255 : p.r;
      colors[i * 3 + 1] = p.g > 1 ? p.g / 255 : p.g;
      colors[i * 3 + 2] = p.b > 1 ? p.b / 255 : p.b;
    }
  }

  const cx = count > 0 ? sumX / count : 0;
  const cy = count > 0 ? sumY / count : 0;
  const cz = count > 0 ? sumZ / count : 0;

  return {
    name: filename,
    format: 'JSON Point Stream',
    count,
    positions,
    colors,
    hasRGB,
    bounds: {
      minX: Number(minX.toFixed(3)),
      maxX: Number(maxX.toFixed(3)),
      minY: Number(minY.toFixed(3)),
      maxY: Number(maxY.toFixed(3)),
      minZ: Number(minZ.toFixed(3)),
      maxZ: Number(maxZ.toFixed(3)),
      sizeX: Number((maxX - minX).toFixed(3)),
      sizeY: Number((maxY - minY).toFixed(3)),
      sizeZ: Number((maxZ - minZ).toFixed(3)),
      centroid: {
        x: Number(cx.toFixed(3)),
        y: Number(cy.toFixed(3)),
        z: Number(cz.toFixed(3)),
      },
    },
  };
}
