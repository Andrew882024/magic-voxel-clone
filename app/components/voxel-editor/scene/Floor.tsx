/**
 * Floor
 *
 * Clickable ground plane for the voxel editor scene.
 *
 * Responsibilities:
 * - capture clicks that land on empty space
 * - convert pointer hits into grid-aligned placement coordinates
 * - ignore drag gestures so camera movement does not place voxels
 * - provide cursor feedback while hovering the floor
 *
 * Relies on:
 * - `shared.ts` for grid sizing and drag-threshold constants
 * - `Scene.tsx` to supply the `onPlace` callback
 */
"use client";

import { useRef, useState } from "react";
import { useCursor } from "@react-three/drei";
import * as THREE from "three";
import { DRAG_THRESHOLD_PX, GRID_SIZE } from "./shared";

type FloorProps = {
  onPlace: (x: number, y: number, z: number) => void;
};

// The floor catches clicks that land on empty space so new voxels can still be
// placed even when the pointer is not intersecting an existing block.
export function Floor({ onPlace }: FloorProps) {
  const [hovered, setHovered] = useState(false);
  const pending = useRef<{
    position: [number, number, number];
    clientX: number;
    clientY: number;
    shiftKey: boolean;
  } | null>(null);

  useCursor(hovered, "crosshair");

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      receiveShadow
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.stopPropagation();

        const p = e.point;
        const x = Math.floor(p.x);
        const z = Math.floor(p.z);
        const y = 0;

        pending.current = {
          position: [x, y, z],
          clientX: e.clientX,
          clientY: e.clientY,
          shiftKey: e.shiftKey,
        };
      }}
      onPointerUp={(e) => {
        if (e.button !== 0) return;

        const p = pending.current;
        pending.current = null;
        if (!p || p.shiftKey) return;

        const dx = e.clientX - p.clientX;
        const dy = e.clientY - p.clientY;
        // Ignore pointer-ups that came from orbit/pan drags instead of a click.
        if (dx * dx + dy * dy <= DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
          onPlace(...p.position);
        }
      }}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => {
        setHovered(false);
        pending.current = null;
      }}
    >
      <planeGeometry args={[GRID_SIZE * 2, GRID_SIZE * 2]} />
      <meshStandardMaterial
        color="#1a1a1a"
        transparent
        opacity={0.4}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}
