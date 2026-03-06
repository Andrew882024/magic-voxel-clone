import { type VoxelMap, voxelKey } from "../scene/shared";

export const TREE_TRUNK_COLOR = "#8b5a2b";
export const TREE_LEAF_COLOR = "#22c55e";

export function stampTree(
  voxels: VoxelMap,
  origin: [number, number, number]
): VoxelMap {
  const [originX, originY, originZ] = origin;
  const next = { ...voxels };

  const setVoxel = (x: number, y: number, z: number, color: string) => {
    next[voxelKey(originX + x, originY + y, originZ + z)] = color;
  };

  for (let y = 0; y < 4; y++) {
    setVoxel(0, y, 0, TREE_TRUNK_COLOR);
  }

  for (let x = -1; x <= 1; x++) {
    for (let z = -1; z <= 1; z++) {
      setVoxel(x, 3, z, TREE_LEAF_COLOR);
      setVoxel(x, 4, z, TREE_LEAF_COLOR);
    }
  }

  for (let x = -2; x <= 2; x++) {
    for (let z = -2; z <= 2; z++) {
      if (Math.abs(x) + Math.abs(z) <= 3) {
        setVoxel(x, 5, z, TREE_LEAF_COLOR);
      }
    }
  }

  setVoxel(0, 6, 0, TREE_LEAF_COLOR);
  setVoxel(1, 6, 0, TREE_LEAF_COLOR);
  setVoxel(-1, 6, 0, TREE_LEAF_COLOR);
  setVoxel(0, 6, 1, TREE_LEAF_COLOR);
  setVoxel(0, 6, -1, TREE_LEAF_COLOR);

  return next;
}
