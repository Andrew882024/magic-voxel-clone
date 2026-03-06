"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type Dispatch } from "react";
import { Grid, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Floor } from "./Floor";
import { VoxelBlock } from "./VoxelBlock";
import { stampCube } from "../stamps/cubeStamp";
import { stampFloor } from "../stamps/floorStamp";
import { stampTree } from "../stamps/treeStamp";
import {
  GRID_SIZE,
  parseVoxelKey,
  type HistoryAction,
  type VoxelMap,
  voxelKey,
} from "./shared";

type SceneProps = {
  voxels: VoxelMap;
  dispatch: Dispatch<HistoryAction>;
  selectedColor: string;
  cubePlacementArmed: boolean;
  floorPlacementArmed: boolean;
  treePlacementArmed: boolean;
  lightSourceVisible: boolean;
  lightPosition: [number, number, number];
  lightStrength: number;
  paintingMode: boolean;
};

export function Scene({
  voxels,
  dispatch,
  selectedColor,
  cubePlacementArmed,
  floorPlacementArmed,
  treePlacementArmed,
  lightSourceVisible,
  lightPosition,
  lightStrength,
  paintingMode,
}: SceneProps) {
  const place = useCallback(
    (x: number, y: number, z: number) => {
      if (cubePlacementArmed) {
        dispatch({
          type: "APPLY",
          next: stampCube(voxels, [x, y, z], selectedColor),
        });
        return;
      }

      if (floorPlacementArmed) {
        dispatch({
          type: "APPLY",
          next: stampFloor(voxels, [x, y, z], selectedColor),
        });
        return;
      }

      if (treePlacementArmed) {
        dispatch({
          type: "APPLY",
          next: stampTree(voxels, [x, y, z]),
        });
        return;
      }

      const key = voxelKey(x, y, z);
      dispatch({ type: "APPLY", next: { ...voxels, [key]: selectedColor } });
    },
    [
      cubePlacementArmed,
      dispatch,
      floorPlacementArmed,
      selectedColor,
      treePlacementArmed,
      voxels,
    ]
  );

  const remove = useCallback(
    (key: string) => {
      const next = { ...voxels };
      delete next[key];
      dispatch({ type: "APPLY", next });
    },
    [dispatch, voxels]
  );

  const paintPointerDownRef = useRef(false);
  const paintVoxel = useCallback(
    (key: string) => {
      dispatch({ type: "APPLY", next: { ...voxels, [key]: selectedColor } });
    },
    [dispatch, selectedColor, voxels]
  );
  const getIsPointerDown = useCallback(() => paintPointerDownRef.current, []);
  const setPaintPointerDown = useCallback((down: boolean) => {
    paintPointerDownRef.current = down;
  }, []);

  useEffect(() => {
    if (!paintingMode) return;

    const onUp = () => {
      paintPointerDownRef.current = false;
    };

    window.addEventListener("pointerup", onUp);
    return () => window.removeEventListener("pointerup", onUp);
  }, [paintingMode]);

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
      <hemisphereLight args={["#87ceeb", "#3d2b1f", 0.6]} position={[0, 20, 0]} />
      {lightSourceVisible && (
        <mesh position={lightPosition} castShadow={false} receiveShadow={false}>
          <sphereGeometry args={[0.2, 32, 32]} />
          <meshBasicMaterial color="#ffdd99" toneMapped={false} />
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
        enableRotate={!paintingMode}
        enablePan={!paintingMode}
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
          paintingMode={paintingMode}
          onPaint={paintVoxel}
          getIsPointerDown={getIsPointerDown}
          setPaintPointerDown={setPaintPointerDown}
        />
      ))}
    </>
  );
}
