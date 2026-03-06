"use client";

import { useRef, useState, useCallback, useReducer, useMemo, useEffect, useLayoutEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, useCursor } from "@react-three/drei";
import * as THREE from "three";
import { serializeVox, parseVox } from "@/app/lib/voxFormat";

const GRID_SIZE = 32;
const DRAG_THRESHOLD_PX = 6;
const MAX_HISTORY = 50;
const PALETTE = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#8b5cf6", "#ec4899", "#f43f5e", "#ffffff",
  "#a1a1aa", "#404040", "#18181b",
];

function voxelKey(x: number, y: number, z: number) {
  return `${x},${y},${z}`;
}

/** Returns whether a voxel exists at (x,y,z). */
function hasVoxel(voxels: VoxelMap, x: number, y: number, z: number): boolean {
  return voxelKey(x, y, z) in voxels;
}

/** For each of the 8 corners of a voxel, count how many of the 8 cells sharing that corner are filled (1–8). */
function getCornerOcclusion(
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
              if (hasVoxel(voxels, vx - 1 + cx + dx, vy - 1 + cy + dy, vz - 1 + cz + dz)) count++;
            }
          }
        }
        out.push(count);
      }
    }
  }
  return out;
}

const AO_STRENGTH = 0.55;
const BOX_CORNER_BY_VERTEX = (() => {
  const box = new THREE.BoxGeometry(1, 1, 1);
  const pos = box.attributes.position;
  const arr: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const cx = Math.round(x), cy = Math.round(y), cz = Math.round(z);
    arr.push(cx + 2 * cy + 4 * cz);
  }
  box.dispose();
  return arr;
})();

function parseVoxelKey(key: string): [number, number, number] {
  const [x, y, z] = key.split(",").map(Number);
  return [x, y, z];
}

type VoxelMap = Record<string, string>;

type HistoryState = {
  voxels: VoxelMap;
  history: VoxelMap[];
  historyIndex: number;
};

function historyReducer(state: HistoryState, action: { type: "APPLY"; next: VoxelMap } | { type: "UNDO" } | { type: "REDO" } | { type: "CLEAR" }): HistoryState {
  switch (action.type) {
    case "APPLY": {
      const truncated = [...state.history.slice(0, state.historyIndex + 1), action.next].slice(-MAX_HISTORY);
      return {
        voxels: action.next,
        history: truncated,
        historyIndex: truncated.length - 1,
      };
    }
    case "UNDO": {
      if (state.historyIndex <= 0) return state;
      const i = state.historyIndex - 1;
      return { ...state, voxels: state.history[i], historyIndex: i };
    }
    case "REDO": {
      if (state.historyIndex >= state.history.length - 1) return state;
      const i = state.historyIndex + 1;
      return { ...state, voxels: state.history[i], historyIndex: i };
    }
    case "CLEAR":
      return historyReducer(state, { type: "APPLY", next: {} });
    default:
      return state;
  }
}

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
        depthWrite={false}
      />
    </mesh>
  );
}

const sharedBoxGeometry = new THREE.BoxGeometry(1, 1, 1);

function VoxelBlock({
  position,
  color,
  voxels,
  onRemove,
  onPlaceAdjacent,
}: {
  position: [number, number, number];
  color: string;
  voxels: VoxelMap;
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
      ref={ref}
      position={[x + 0.5, y + 0.5, z + 0.5]}
      castShadow
      receiveShadow
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

const DEFAULT_LIGHT_POSITION: [number, number, number] = [6, 22, 6];
const DEFAULT_LIGHT_STRENGTH = 1.1;

function Scene({
  voxels,
  dispatch,
  selectedColor,
  lightSourceVisible,
  lightPosition,
  lightStrength,
}: {
  voxels: VoxelMap;
  dispatch: React.Dispatch<Parameters<typeof historyReducer>[1]>;
  selectedColor: string;
  lightSourceVisible: boolean;
  lightPosition: [number, number, number];
  lightStrength: number;
}) {
  const place = useCallback(
    (x: number, y: number, z: number) => {
      const key = voxelKey(x, y, z);
      dispatch({ type: "APPLY", next: { ...voxels, [key]: selectedColor } });
    },
    [selectedColor, voxels, dispatch]
  );

  const remove = useCallback(
    (key: string) => {
      const next = { ...voxels };
      delete next[key];
      dispatch({ type: "APPLY", next });
    },
    [voxels, dispatch]
  );

  const mainLightRef = useRef<THREE.DirectionalLight>(null);
  const gridRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    const light = mainLightRef.current;
    if (!light?.shadow) return;
    light.shadow.mapSize.set(2048, 2048);
    light.shadow.camera.near = 0.5;
    light.shadow.camera.far = 100;
    light.shadow.camera.left = -25;
    light.shadow.camera.right = 25;
    light.shadow.camera.top = 25;
    light.shadow.camera.bottom = -25;
    light.shadow.bias = -0.0001;
  }, []);

  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid?.material) return;
    (grid.material as THREE.Material).depthWrite = false;
  }, []);

  return (
    <>
      <ambientLight intensity={0.35} />
      <hemisphereLight
        args={["#87ceeb", "#3d2b1f", 0.6]}
        position={[0, 20, 0]}
      />
      {lightSourceVisible && (
        <mesh position={lightPosition} castShadow={false} receiveShadow={false}>
          <sphereGeometry args={[2.5, 32, 32]} />
          <meshBasicMaterial
            color="#ffdd99"
            toneMapped={false}
          />
        </mesh>
      )}
      <directionalLight
        ref={mainLightRef}
        position={lightPosition}
        intensity={lightSourceVisible ? lightStrength : 0}
        castShadow={lightSourceVisible}
      />
      <directionalLight position={[-10, 10, -10]} intensity={0.35} />
      <pointLight position={[0, 15, 5]} intensity={0.2} distance={40} />
      <OrbitControls
        enableRotate
        enablePan
        enableZoom
        minDistance={4}
        maxDistance={80}
      />
      <Grid
        ref={gridRef}
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
          voxels={voxels}
          onRemove={() => remove(key)}
          onPlaceAdjacent={place}
        />
      ))}
    </>
  );
}





const initialHistoryState: HistoryState = {
  voxels: {},
  history: [{}],
  historyIndex: 0,
};

export default function VoxelEditor() {
  const [historyState, dispatch] = useReducer(historyReducer, initialHistoryState);
  const { voxels, history, historyIndex } = historyState;
  const [selectedColor, setSelectedColor] = useState(PALETTE[0]);
  const [lightSourceVisible, setLightSourceVisible] = useState(true);
  const [lightPosition, setLightPosition] = useState<[number, number, number]>(DEFAULT_LIGHT_POSITION);
  const [lightStrength, setLightStrength] = useState(DEFAULT_LIGHT_STRENGTH);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const handleSave = useCallback(() => {
    try {
      const buffer = serializeVox(voxels);
      const blob = new Blob([buffer], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "scene.vox";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Save .vox failed:", e);
      alert("Failed to save: " + (e instanceof Error ? e.message : String(e)));
    }
  }, [voxels]);

  const handleLoad = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const buffer = reader.result as ArrayBuffer;
          const loaded = parseVox(buffer);
          dispatch({ type: "APPLY", next: loaded });
        } catch (err) {
          console.error("Load .vox failed:", err);
          alert("Failed to load .vox: " + (err instanceof Error ? err.message : String(err)));
        }
        e.target.value = "";
      };
      reader.readAsArrayBuffer(file);
    },
    [dispatch]
  );

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
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => dispatch({ type: "UNDO" })}
              disabled={!canUndo}
              className="flex-1 rounded-lg bg-zinc-700 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
              title="Undo"
            >
              Undo
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "REDO" })}
              disabled={!canRedo}
              className="flex-1 rounded-lg bg-zinc-700 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
              title="Redo"
            >
              Redo
            </button>
          </div>
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
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-500">
              Light source
            </label>
            <button
              type="button"
              onClick={() => setLightSourceVisible((v) => !v)}
              className="w-full rounded-lg bg-zinc-700 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-600"
            >
              {lightSourceVisible ? "Hide" : "Show"}
            </button>
            <div className="mt-2 space-y-2">
              <div>
                <label className="mb-1 block text-xs text-zinc-400">
                  Strength
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={3}
                    step={0.1}
                    value={lightStrength}
                    onChange={(e) =>
                      setLightStrength(Number(e.target.value))
                    }
                    className="flex-1 accent-amber-500"
                  />
                  <input
                    type="number"
                    min={0}
                    max={5}
                    step={0.1}
                    value={lightStrength}
                    onChange={(e) =>
                      setLightStrength(Math.max(0, Math.min(5, Number(e.target.value) || 0)))
                    }
                    className="w-14 rounded border border-zinc-700 bg-zinc-800 px-1.5 py-1 text-right text-sm text-white"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 text-xs text-zinc-400">X</span>
                <input
                  type="number"
                  value={lightPosition[0]}
                  onChange={(e) =>
                    setLightPosition((p) => [
                      Number(e.target.value),
                      p[1],
                      p[2],
                    ])
                  }
                  className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-white"
                  step={1}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 text-xs text-zinc-400">Y</span>
                <input
                  type="number"
                  value={lightPosition[1]}
                  onChange={(e) =>
                    setLightPosition((p) => [
                      p[0],
                      Number(e.target.value),
                      p[2],
                    ])
                  }
                  className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-white"
                  step={1}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 text-xs text-zinc-400">Z</span>
                <input
                  type="number"
                  value={lightPosition[2]}
                  onChange={(e) =>
                    setLightPosition((p) => [
                      p[0],
                      p[1],
                      Number(e.target.value),
                    ])
                  }
                  className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-white"
                  step={1}
                />
              </div>
            </div>
          </div>
          <div className="mt-auto border-t border-zinc-800 pt-4 space-y-2">
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-500">
                Scene (.vox)
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  className="flex-1 rounded-lg bg-zinc-700 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-600"
                  title="Save as MagicaVoxel .vox file"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 rounded-lg bg-zinc-700 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-600"
                  title="Load MagicaVoxel .vox file"
                >
                  Load
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".vox"
                className="hidden"
                onChange={handleLoad}
              />
            </div>
            <button
              type="button"
              onClick={() => dispatch({ type: "CLEAR" })}
              className="w-full rounded-lg bg-zinc-700 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-600"
            >
              Clear all
            </button>
          </div>
        </aside>

        {/* Canvas */}
        <main className="flex-1" onContextMenu={(e) => e.preventDefault()}>
          <Canvas
            shadows
            camera={{ position: [12, 10, 12], fov: 50 }}
            gl={{ antialias: true }}
          >
            <Scene
              voxels={voxels}
              dispatch={dispatch}
              selectedColor={selectedColor}
              lightSourceVisible={lightSourceVisible}
              lightPosition={lightPosition}
              lightStrength={lightStrength}
            />
          </Canvas>
        </main>
      </div>
    </div>
  );
}
