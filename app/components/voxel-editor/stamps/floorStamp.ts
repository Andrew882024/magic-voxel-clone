import { type VoxelMap, voxelKey } from "../shared";

export const FLOOR_STAMP_SIZE = 9;

export function stampFloor(
  voxels: VoxelMap,
  origin: [number, number, number],
  color: string,
  size = FLOOR_STAMP_SIZE
): VoxelMap {
  const [originX, originY, originZ] = origin;
  const next = { ...voxels };

  for (let x = 0; x < size; x++) {
    for (let z = 0; z < size; z++) {
      next[voxelKey(originX + x, originY, originZ + z)] = color;
    }
  }

  return next;
}
