"use client";

import { useCallback, useReducer, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { parseVox, serializeVox } from "@/app/lib/voxFormat";
import { CUBE_STAMP_SIZE } from "./stamps/cubeStamp";
import { FLOOR_STAMP_SIZE } from "./stamps/floorStamp";
import { Scene } from "./Scene";
import {
  DEFAULT_LIGHT_POSITION,
  DEFAULT_LIGHT_STRENGTH,
  MAX_HISTORY,
  type HistoryAction,
  type VoxelMap,
} from "./shared";

const PALETTE = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#8b5cf6", "#ec4899", "#f43f5e", "#ffffff",
  "#a1a1aa", "#404040",
];

const CONTROL_SECTIONS = [
  {
    title: "Mouse",
    items: [
      ["Left click", "Place voxel"],
      ["Shift + left click", "Remove voxel"],
      ["Left click + drag", "Orbit camera"],
      ["Right click + drag", "Pan camera"],
      ["Scroll wheel", "Zoom"],
    ],
  },
  {
    title: "Trackpad",
    items: [
      ["Click", "Place voxel"],
      ["Shift + click", "Remove voxel"],
      ["Click + drag", "Orbit camera"],
      ["Ctrl / Shift / Command + drag", "Pan camera"],
      ["Pinch", "Zoom"],
    ],
  },
  {
    title: "Editor",
    items: [
      ["Painting mode", "Drag across voxels to recolor them"],
      [`${CUBE_STAMP_SIZE}x${CUBE_STAMP_SIZE}x${CUBE_STAMP_SIZE} cube`, "Click once, then click the scene to place it"],
      [`${FLOOR_STAMP_SIZE}x${FLOOR_STAMP_SIZE} floor`, "Click once, then click the scene to place it"],
      ["Tree stamp", "Click once, then click the scene to place a green tree with a brown trunk"],
      ["Undo / Redo", "Step backward or forward through edits"],
      ["Save / Load", "Export or import MagicaVoxel .vox files"],
      ["Clear all", "Remove every voxel from the scene"],
    ],
  },
];

type HistoryState = {
  voxels: VoxelMap;
  history: VoxelMap[];
  historyIndex: number;
};

type PanelKey = "painting" | "shape" | "color" | "light";

function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
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

const initialHistoryState: HistoryState = {
  voxels: {},
  history: [{}],
  historyIndex: 0,
};

function SidebarPanel({
  title,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/70">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
      >
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          {title}
        </span>
        <span className="text-sm font-semibold text-zinc-300">{isOpen ? "-" : "+"}</span>
      </button>
      {isOpen && <div className="border-t border-zinc-800 p-3">{children}</div>}
    </div>
  );
}

export default function VoxelEditor() {
  const [historyState, dispatch] = useReducer(historyReducer, initialHistoryState);
  const { voxels, history, historyIndex } = historyState;
  const [selectedColor, setSelectedColor] = useState(PALETTE[0]);
  const [lightSourceVisible, setLightSourceVisible] = useState(true);
  const [lightPosition, setLightPosition] = useState<[number, number, number]>(DEFAULT_LIGHT_POSITION);
  const [lightStrength, setLightStrength] = useState(DEFAULT_LIGHT_STRENGTH);
  const [paintingMode, setPaintingMode] = useState(false);
  const [cubePlacementArmed, setCubePlacementArmed] = useState(false);
  const [floorPlacementArmed, setFloorPlacementArmed] = useState(false);
  const [treePlacementArmed, setTreePlacementArmed] = useState(false);
  const [openPanels, setOpenPanels] = useState<Record<PanelKey, boolean>>({
    painting: false,
    shape: false,
    color: true,
    light: false,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const togglePanel = useCallback((panel: PanelKey) => {
    setOpenPanels((current) => ({ ...current, [panel]: !current[panel] }));
  }, []);

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
    (e: ChangeEvent<HTMLInputElement>) => {
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
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-5 py-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-white">
            Voxel Editor
          </h1>
        </div>
        <div className="relative group">
          <div
            className="cursor-default select-none rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
            aria-label="Usage guide"
          >
            Guide
          </div>
          <div className="pointer-events-none absolute right-0 top-full z-20 mt-2 w-80 rounded-xl border border-zinc-800 bg-zinc-900/95 p-4 opacity-0 shadow-2xl transition duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
            <h2 className="text-sm font-semibold text-white">How to use</h2>
            <p className="mt-1 text-xs leading-5 text-zinc-400">
              Basic controls for placing voxels and moving around the scene.
            </p>
            <div className="mt-3 space-y-3">
              {CONTROL_SECTIONS.map((section) => (
                <div key={section.title}>
                  <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                    {section.title}
                  </h3>
                  <ul className="mt-2 space-y-1.5 text-sm text-zinc-300">
                    {section.items.map(([action, description]) => (
                      <li key={action} className="leading-5">
                        <span className="font-semibold text-white">{action}</span>
                        <span className="text-zinc-400"> - {description}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="flex w-55 shrink-0 flex-col gap-4 overflow-y-auto border-r border-zinc-800 bg-zinc-900/80 p-4">
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
          <SidebarPanel
            title="Color"
            isOpen={openPanels.color}
            onToggle={() => togglePanel("color")}
          >
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
            <div className="mt-3">
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-500">
                Custom
              </label>
              <input
                type="color"
                value={selectedColor}
                onChange={(e) => setSelectedColor(e.target.value)}
                className="h-10 w-full cursor-pointer bg-transparent"
              />
            </div>
          </SidebarPanel>
          <SidebarPanel
            title="Painting"
            isOpen={openPanels.painting}
            onToggle={() => togglePanel("painting")}
          >
            <button
              type="button"
              onClick={() =>
                setPaintingMode((v) => {
                  const next = !v;
                  if (next) {
                    setCubePlacementArmed(false);
                    setFloorPlacementArmed(false);
                    setTreePlacementArmed(false);
                  }
                  return next;
                })
              }
              className={`w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                paintingMode
                  ? "bg-amber-600 text-white hover:bg-amber-500"
                  : "bg-zinc-700 text-white hover:bg-zinc-600"
              }`}
              title={paintingMode ? "Painting on - orbit disabled, drag on voxels to paint" : "Painting off"}
            >
              {paintingMode ? "Painting on" : "Painting off"}
            </button>
          </SidebarPanel>
          <SidebarPanel
            title="Shape"
            isOpen={openPanels.shape}
            onToggle={() => togglePanel("shape")}
          >
            <button
              type="button"
              onClick={() =>
                setCubePlacementArmed((v) => {
                  const next = !v;
                  if (next) {
                    setPaintingMode(false);
                    setFloorPlacementArmed(false);
                    setTreePlacementArmed(false);
                  }
                  return next;
                })
              }
              className={`w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                cubePlacementArmed
                  ? "bg-sky-600 text-white hover:bg-sky-500"
                  : "bg-zinc-700 text-white hover:bg-zinc-600"
              }`}
              title={
                cubePlacementArmed
                  ? `Next click will place a ${CUBE_STAMP_SIZE}x${CUBE_STAMP_SIZE}x${CUBE_STAMP_SIZE} cube`
                  : `Arm a one-click ${CUBE_STAMP_SIZE}x${CUBE_STAMP_SIZE}x${CUBE_STAMP_SIZE} cube placement`
              }
            >
              {cubePlacementArmed
                ? `${CUBE_STAMP_SIZE}x${CUBE_STAMP_SIZE}x${CUBE_STAMP_SIZE} cube armed`
                : `Place ${CUBE_STAMP_SIZE}x${CUBE_STAMP_SIZE}x${CUBE_STAMP_SIZE} cube`}
            </button>
            <p className="mt-2 text-xs leading-5 text-zinc-400">
              Click this once, then click anywhere in the scene to drop the cube at that position.
            </p>
            <button
              type="button"
              onClick={() =>
                setFloorPlacementArmed((v) => {
                  const next = !v;
                  if (next) {
                    setPaintingMode(false);
                    setCubePlacementArmed(false);
                    setTreePlacementArmed(false);
                  }
                  return next;
                })
              }
              className={`mt-3 w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                floorPlacementArmed
                  ? "bg-cyan-600 text-white hover:bg-cyan-500"
                  : "bg-zinc-700 text-white hover:bg-zinc-600"
              }`}
              title={
                floorPlacementArmed
                  ? `Next click will place a ${FLOOR_STAMP_SIZE}x${FLOOR_STAMP_SIZE} floor`
                  : `Arm a one-click ${FLOOR_STAMP_SIZE}x${FLOOR_STAMP_SIZE} floor placement`
              }
            >
              {floorPlacementArmed
                ? `${FLOOR_STAMP_SIZE}x${FLOOR_STAMP_SIZE} floor armed`
                : `Place ${FLOOR_STAMP_SIZE}x${FLOOR_STAMP_SIZE} floor`}
            </button>
            <p className="mt-2 text-xs leading-5 text-zinc-400">
              Places a flat floor using your currently selected color.
            </p>
            <button
              type="button"
              onClick={() =>
                setTreePlacementArmed((v) => {
                  const next = !v;
                  if (next) {
                    setPaintingMode(false);
                    setCubePlacementArmed(false);
                    setFloorPlacementArmed(false);
                  }
                  return next;
                })
              }
              className={`mt-3 w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                treePlacementArmed
                  ? "bg-emerald-600 text-white hover:bg-emerald-500"
                  : "bg-zinc-700 text-white hover:bg-zinc-600"
              }`}
              title={
                treePlacementArmed
                  ? "Next click will place a tree"
                  : "Arm a one-click tree placement"
              }
            >
              {treePlacementArmed ? "Tree stamp armed" : "Place tree"}
            </button>
            <p className="mt-2 text-xs leading-5 text-zinc-400">
              Places a stylized tree with a bark-brown trunk and green leaves.
            </p>
          </SidebarPanel>
          <SidebarPanel
            title="Light source"
            isOpen={openPanels.light}
            onToggle={() => togglePanel("light")}
          >
            <button
              type="button"
              onClick={() => setLightSourceVisible((v) => !v)}
              className="w-full rounded-lg bg-zinc-700 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-600"
            >
              {lightSourceVisible ? "Hide" : "Show"}
            </button>
            {lightSourceVisible && (
              <div className="mt-2 max-w-[98%] space-y-2">
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">
                    Strength
                  </label>
                  <div className="flex max-w-full items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={3}
                      step={0.1}
                      value={lightStrength}
                      onChange={(e) =>
                        setLightStrength(Number(e.target.value))
                      }
                      className="min-w-0 flex-1 accent-amber-500"
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
                <div className="flex max-w-full items-center gap-2">
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
                    className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-white"
                    step={1}
                  />
                </div>
                <div className="flex max-w-full items-center gap-2">
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
                    className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-white"
                    step={1}
                  />
                </div>
                <div className="flex max-w-full items-center gap-2">
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
                    className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-white"
                    step={1}
                  />
                </div>
              </div>
            )}
          </SidebarPanel>
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
              cubePlacementArmed={cubePlacementArmed}
              onCubePlacementConsumed={() => setCubePlacementArmed(false)}
              floorPlacementArmed={floorPlacementArmed}
              onFloorPlacementConsumed={() => setFloorPlacementArmed(false)}
              treePlacementArmed={treePlacementArmed}
              onTreePlacementConsumed={() => setTreePlacementArmed(false)}
              lightSourceVisible={lightSourceVisible}
              lightPosition={lightPosition}
              lightStrength={lightStrength}
              paintingMode={paintingMode}
            />
          </Canvas>
        </main>
      </div>
    </div>
  );
}
