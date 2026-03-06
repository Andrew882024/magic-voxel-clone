import * as THREE from "three";

export const GRID_SIZE = 32;
export const DRAG_THRESHOLD_PX = 6;
export const MAX_HISTORY = 50;

export const DEFAULT_LIGHT_POSITION: [number, number, number] = [6, 22, 6];
export const DEFAULT_LIGHT_STRENGTH = 1.1;

export type VoxelMap = Record<string, string>;

export type HistoryAction =
  | { type: "APPLY"; next: VoxelMap }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "CLEAR" };

export function voxelKey(x: number, y: number, z: number) {
  return `${x},${y},${z}`;
}

export function parseVoxelKey(key: string): [number, number, number] {
  const [x, y, z] = key.split(",").map(Number);
  return [x, y, z];
}

function hasVoxel(voxels: VoxelMap, x: number, y: number, z: number): boolean {
  return voxelKey(x, y, z) in voxels;
}

export function getCornerOcclusion(
  vx: number,
  vy: number,
  vz: number,
  voxels: VoxelMap
): number[] {
  const out: number[] = [];

  for (let cz = 0; cz <= 1; cz++) {
    for (let cy = 0; cy <= 1; cy++) {
      for (let cx = 0; cx <= 1; cx++) {
        let count = 0;
        for (let dz = 0; dz <= 1; dz++) {
          for (let dy = 0; dy <= 1; dy++) {
            for (let dx = 0; dx <= 1; dx++) {
              if (hasVoxel(voxels, vx - 1 + cx + dx, vy - 1 + cy + dy, vz - 1 + cz + dz)) {
                count++;
              }
            }
          }
        }
        out.push(count);
      }
    }
  }

  return out;
}

export const BOX_CORNER_BY_VERTEX = (() => {
  const box = new THREE.BoxGeometry(1, 1, 1);
  const pos = box.attributes.position;
  const arr: number[] = [];

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const cx = Math.round(x);
    const cy = Math.round(y);
    const cz = Math.round(z);
    arr.push(cx + 2 * cy + 4 * cz);
  }

  box.dispose();
  return arr;
})();
