"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCursor } from "@react-three/drei";
import * as THREE from "three";
import {
  BOX_CORNER_BY_VERTEX,
  DRAG_THRESHOLD_PX,
  getCornerOcclusion,
  type VoxelMap,
  voxelKey,
} from "./shared";

const AO_STRENGTH = 0.55;
const sharedBoxGeometry = new THREE.BoxGeometry(1, 1, 1);

type VoxelBlockProps = {
  position: [number, number, number];
  color: string;
  voxels: VoxelMap;
  onRemove: () => void;
  onPlaceAdjacent: (x: number, y: number, z: number) => void;
  paintingMode?: boolean;
  onPaint?: (key: string) => void;
  getIsPointerDown?: () => boolean;
  setPaintPointerDown?: (down: boolean) => void;
};

export function VoxelBlock({
  position,
  color,
  voxels,
  onRemove,
  onPlaceAdjacent,
  paintingMode,
  onPaint,
  getIsPointerDown,
  setPaintPointerDown,
}: VoxelBlockProps) {
  const [hovered, setHovered] = useState(false);
  const pending = useRef<{
    shiftKey: boolean;
    adjacent: [number, number, number] | null;
    clientX: number;
    clientY: number;
  } | null>(null);

  useCursor(hovered, "pointer");

  const [x, y, z] = position;
  const geometry = useMemo(() => {
    const occlusion = getCornerOcclusion(x, y, z, voxels);
    const geom = sharedBoxGeometry.clone();
    const base = new THREE.Color(color);
    const colors = new Float32Array(BOX_CORNER_BY_VERTEX.length * 3);

    for (let i = 0; i < BOX_CORNER_BY_VERTEX.length; i++) {
      const c = BOX_CORNER_BY_VERTEX[i];
      const t = 1 - AO_STRENGTH * (occlusion[c] / 8);
      const shaded = base.clone().multiplyScalar(t);
      colors[i * 3] = shaded.r;
      colors[i * 3 + 1] = shaded.g;
      colors[i * 3 + 2] = shaded.b;
    }

    geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geom;
  }, [color, x, y, z, voxels]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh
      position={[x + 0.5, y + 0.5, z + 0.5]}
      castShadow
      receiveShadow
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.stopPropagation();

        if (paintingMode && onPaint) {
          setPaintPointerDown?.(true);
          onPaint(voxelKey(x, y, z));
          return;
        }

        let adjacent: [number, number, number] | null = null;
        const n = e.face?.normal;
        if (n) {
          const nx = Math.round(n.x);
          const ny = Math.round(n.y);
          const nz = Math.round(n.z);
          adjacent = [x + nx, y + ny, z + nz];
        }

        pending.current = {
          shiftKey: e.shiftKey,
          adjacent,
          clientX: e.clientX,
          clientY: e.clientY,
        };
      }}
      onPointerUp={(e) => {
        if (e.button !== 0) return;
        if (paintingMode) return;

        const p = pending.current;
        pending.current = null;
        if (!p) return;

        const dx = e.clientX - p.clientX;
        const dy = e.clientY - p.clientY;
        if (dx * dx + dy * dy > DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return;

        if (p.shiftKey) {
          onRemove();
        } else if (p.adjacent) {
          onPlaceAdjacent(...p.adjacent);
        }
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);

        if (paintingMode && getIsPointerDown?.() && onPaint) {
          onPaint(voxelKey(x, y, z));
        }
      }}
      onPointerOut={() => {
        setHovered(false);
        pending.current = null;
      }}
      onContextMenu={(e) => e.nativeEvent.preventDefault()}
    >
      <primitive object={geometry} attach="geometry" />
      <meshStandardMaterial
        color="#ffffff"
        vertexColors
        emissive={hovered ? color : "#000000"}
        emissiveIntensity={hovered ? 0.25 : 0}
      />
    </mesh>
  );
}
