/**
 * Exports point cloud data to standard ASCII Point Cloud Data (.pcd v0.7) format
 * Supports both Float32Array positions and array of point objects.
 */

export function exportToPCD(pointsData, filename = "scan.pcd") {
  let count = 0;
  let lines = [];
  let hasRGB = false;

  if (pointsData && pointsData.positions instanceof Float32Array) {
    count = pointsData.count;
    const pos = pointsData.positions;
    const col = pointsData.colors;
    hasRGB = !!col;

    for (let i = 0; i < count; i++) {
      const x = pos[i * 3];
      const y = pos[i * 3 + 1];
      const z = pos[i * 3 + 2];
      if (hasRGB) {
        const r = Math.round((col[i * 3] || 1) * 255);
        const g = Math.round((col[i * 3 + 1] || 1) * 255);
        const b = Math.round((col[i * 3 + 2] || 1) * 255);
        const rgbPacked = (r << 16) | (g << 8) | b;
        lines.push(`${x} ${y} ${z} ${rgbPacked}`);
      } else {
        lines.push(`${x} ${y} ${z}`);
      }
    }
  } else if (Array.isArray(pointsData)) {
    count = pointsData.length;
    lines = pointsData.map((p) => {
      const x = typeof p.x === 'number' && !isNaN(p.x) ? p.x : 0;
      const y = typeof p.y === 'number' && !isNaN(p.y) ? p.y : 0;
      const z = typeof p.z === 'number' && !isNaN(p.z) ? p.z : 0;
      return `${x} ${y} ${z}`;
    });
  }

  const fields = hasRGB ? 'FIELDS x y z rgb' : 'FIELDS x y z';
  const size = hasRGB ? 'SIZE 4 4 4 4' : 'SIZE 4 4 4';
  const type = hasRGB ? 'TYPE F F F U' : 'TYPE F F F';
  const countField = hasRGB ? 'COUNT 1 1 1 1' : 'COUNT 1 1 1';

  const header = [
    '# .PCD v0.7 - Point Cloud Data file format',
    'VERSION .7',
    fields,
    size,
    type,
    countField,
    `WIDTH ${count}`,
    'HEIGHT 1',
    'VIEWPOINT 0 0 0 1 0 0 0',
    `POINTS ${count}`,
    'DATA ascii'
  ].join('\n');

  const pcdContent = count > 0 ? `${header}\n${lines.join('\n')}\n` : `${header}\n`;

  const blob = new Blob([pcdContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename.endsWith('.pcd') ? filename : `${filename}.pcd`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
