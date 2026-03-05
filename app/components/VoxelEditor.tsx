"use client";

import { useRef, useState, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, useCursor } from "@react-three/drei";
import * as THREE from "three";

const GRID_SIZE = 32;
const DRAG_THRESHOLD_PX = 6;
const PALETTE = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#8b5cf6", "#ec4899", "#f43f5e", "#ffffff",
  "#a1a1aa", "#404040", "#18181b",
];

function voxelKey(x: number, y: number, z: number) {
  return `${x},${y},${z}`;
}

function parseVoxelKey(key: string): [number, number, number] {
  const [x, y, z] = key.split(",").map(Number);
  return [x, y, z];
}

type VoxelMap = Record<string, string>;

function Floor({
  onPlace,
}: {
  onPlace: (x: number, y: number, z: number) => void;
}) {
  const ref = useRef<THREE.Mesh>(null);
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
      ref={ref}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
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
        if (!p) return;
        if (p.shiftKey) return;
        const dx = e.clientX - p.clientX;
        const dy = e.clientY - p.clientY;
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
      />
    </mesh>
  );
}

function VoxelBlock({
  position,
  color,
  onRemove,
  onPlaceAdjacent,
}: {
  position: [number, number, number];
  color: string;
  onRemove: () => void;
  onPlaceAdjacent: (x: number, y: number, z: number) => void;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const pending = useRef<
    { shiftKey: boolean; adjacent: [number, number, number] | null; clientX: number; clientY: number } | null
  >(null);
  useCursor(hovered, "pointer");

  const [x, y, z] = position;
  return (
    <mesh
      ref={ref}
      position={[x + 0.5, y + 0.5, z + 0.5]}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
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
      }}
      onPointerOut={() => {
        setHovered(false);
        pending.current = null;
      }}
      onContextMenu={(e) => e.nativeEvent.preventDefault()}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={color}
        emissive={hovered ? color : "#000000"}
        emissiveIntensity={hovered ? 0.3 : 0}
      />
    </mesh>
  );
}

function Scene({
  voxels,
  setVoxels,
  selectedColor,
}: {
  voxels: VoxelMap;
  setVoxels: React.Dispatch<React.SetStateAction<VoxelMap>>;
  selectedColor: string;
}) {
  const place = useCallback(
    (x: number, y: number, z: number) => {
      const key = voxelKey(x, y, z);
      setVoxels((prev) => ({ ...prev, [key]: selectedColor }));
    },
    [selectedColor, setVoxels]
  );

  const remove = useCallback(
    (key: string) => {
      setVoxels((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    [setVoxels]
  );

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
      <directionalLight position={[-10, 10, -10]} intensity={0.4} />
      <OrbitControls
        enableRotate
        enablePan
        enableZoom
        minDistance={4}
        maxDistance={80}
      />
      <Grid
        args={[GRID_SIZE * 2, GRID_SIZE * 2]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#2a2a2a"
        sectionSize={4}
        sectionThickness={2}
        sectionColor="#444"
        fadeDistance={GRID_SIZE * 2}
        fadeStrength={1}
        infiniteGrid
        // prevent the grid shaking when the camera is moving
        position={[0, -0.01, 0]}
      />
      <Floor onPlace={place} />
      {Object.entries(voxels).map(([key, color]) => (
        <VoxelBlock
          key={key}
          position={parseVoxelKey(key)}
          color={color}
          onRemove={() => remove(key)}
          onPlaceAdjacent={place}
        />
      ))}
    </>
  );
}





export default function VoxelEditor() {
  const [voxels, setVoxels] = useState<VoxelMap>({});
  const [selectedColor, setSelectedColor] = useState(PALETTE[0]);

  return (
    <div className="flex h-screen w-full flex-col bg-zinc-950">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-3">
        <h1 className="text-lg font-semibold tracking-tight text-white">
          Voxel Editor
        </h1>
        <p className="text-sm text-zinc-400">
          Complete click to add • Shift+complete click to remove • Drag to orbit • Ctrl+drag to pan • Scroll to zoom
        </p>
      </header>


      
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="flex w-52 shrink-0 flex-col gap-4 border-r border-zinc-800 bg-zinc-900/80 p-4">
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-500">
              Color
            </label>
            <div className="grid grid-cols-4 gap-2">
              {PALETTE.map((color) => (
                <button
                  key={color}
                  type="button"
                  className="h-9 w-9 rounded-lg border-2 transition-all hover:scale-110"
                  style={{
                    backgroundColor: color,
                    borderColor: selectedColor === color ? "#fff" : "transparent",
                    boxShadow: selectedColor === color ? "0 0 0 1px rgba(0,0,0,0.3)" : undefined,
                  }}
                  onClick={() => setSelectedColor(color)}
                  title={color}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-500">
              Custom
            </label>
            <input
              type="color"
              value={selectedColor}
              onChange={(e) => setSelectedColor(e.target.value)}
              className="h-10 w-full cursor-pointer rounded-lg border border-zinc-700 bg-transparent"
            />
          </div>
          <div className="mt-auto border-t border-zinc-800 pt-4">
            <button
              type="button"
              onClick={() => setVoxels({})}
              className="w-full rounded-lg bg-zinc-700 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-600"
            >
              Clear all
            </button>
          </div>
        </aside>

        {/* Canvas */}
        <main
            className="flex-1"
            onContextMenu={(e) => e.preventDefault()}
          >
          <Canvas
            shadows
            camera={{ position: [12, 10, 12], fov: 50 }}
            gl={{ antialias: true }}
          >
            <Scene
              voxels={voxels}
              setVoxels={setVoxels}
              selectedColor={selectedColor}
            />
          </Canvas>
        </main>
      </div>
    </div>
  );
}
