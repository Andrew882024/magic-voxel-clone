"use client";

import { useCallback, useReducer, useRef, useState, type ChangeEvent } from "react";
import { Canvas } from "@react-three/fiber";
import { parseVox, serializeVox } from "@/app/lib/voxFormat";
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

type HistoryState = {
  voxels: VoxelMap;
  history: VoxelMap[];
  historyIndex: number;
};

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

export default function VoxelEditor() {
  const [historyState, dispatch] = useReducer(historyReducer, initialHistoryState);
  const { voxels, history, historyIndex } = historyState;
  const [selectedColor, setSelectedColor] = useState(PALETTE[0]);
  const [lightSourceVisible, setLightSourceVisible] = useState(true);
  const [lightPosition, setLightPosition] = useState<[number, number, number]>(DEFAULT_LIGHT_POSITION);
  const [lightStrength, setLightStrength] = useState(DEFAULT_LIGHT_STRENGTH);
  const [paintingMode, setPaintingMode] = useState(false);
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
        <aside className="flex w-55 shrink-0 flex-col gap-4 border-r border-zinc-800 bg-zinc-900/80 p-4">
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
              Painting
            </label>
            <button
              type="button"
              onClick={() => setPaintingMode((v) => !v)}
              className={`w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                paintingMode
                  ? "bg-amber-600 text-white hover:bg-amber-500"
                  : "bg-zinc-700 text-white hover:bg-zinc-600"
              }`}
              title={paintingMode ? "Painting on – orbit disabled, drag on voxels to paint" : "Painting off"}
            >
              {paintingMode ? "Painting on" : "Painting off"}
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
              className="h-10 w-full cursor-pointer bg-transparent"
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
              paintingMode={paintingMode}
            />
          </Canvas>
        </main>
      </div>
    </div>
  );
}
