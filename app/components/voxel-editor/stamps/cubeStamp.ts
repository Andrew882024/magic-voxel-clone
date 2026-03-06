import { type VoxelMap, voxelKey } from "../shared";

export const CUBE_STAMP_SIZE = 5;

export function stampCube(
  voxels: VoxelMap,
  origin: [number, number, number],
  color: string,
  size = CUBE_STAMP_SIZE
): VoxelMap {
  const [originX, originY, originZ] = origin;
  const next = { ...voxels };

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        next[voxelKey(originX + x, originY + y, originZ + z)] = color;
      }
    }
  }

  return next;
}
