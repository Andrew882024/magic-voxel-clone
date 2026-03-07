# Magic Voxel Clone

Short demo of the voxel editor (2 minutes):

https://www.youtube.com/watch?v=4dmchiYFsjc 

A small MagicaVoxel-inspired voxel editor built with Next.js, React, Three.js, and React Three Fiber. It runs entirely in the browser and lets you build simple voxel scenes, paint them, place preset shapes, and import or export `.vox` files.

## Features

- Place and remove voxels directly in a 3D scene
- Paint existing voxels by dragging across them
- Pick colors from a preset palette or the native color picker
- Place preset shapes with one click:
  - `5x5x5` cube stamp
  - `9x9` floor stamp
  - tree stamp
- Undo, redo, and clear the scene
- Orbit, pan, and zoom the camera
- Adjust the main light position and strength
- Save and load MagicaVoxel `.vox` files

## Tech Stack

- Next.js
- React
- TypeScript
- Three.js
- React Three Fiber
- `@react-three/drei`
- Tailwind CSS

## Getting Started

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## How To Use

### Mouse

- Left click: place a voxel
- Shift + left click: remove a voxel
- Left click + drag: orbit camera
- Right click + drag: pan camera
- Scroll wheel: zoom

### Trackpad

- Click: place a voxel
- Shift + click: remove a voxel
- Click + drag: orbit camera
- Ctrl, Shift, or Command + drag: pan camera
- Pinch: zoom

### Editor Tools

- `Color`: choose a preset color or a custom one
- `Painting`: recolor voxels by dragging over them
- `Shape`: arm a cube, floor, or tree stamp and place it with the next click
- `Light source`: show or hide the light, then tune its strength and `x/y/z` position
- `Scene (.vox)`: export the current model or load an existing one

## Project Structure

- `app/components/voxel-editor/VoxelEditor.tsx`: main editor UI and state management
- `app/components/voxel-editor/scene/Scene.tsx`: Three.js scene setup, lighting, controls, and voxel interactions
- `app/components/voxel-editor/scene/VoxelBlock.tsx`: individual voxel rendering and interaction
- `app/components/voxel-editor/scene/Floor.tsx`: floor placement surface and raycasting target
- `app/components/voxel-editor/stamps/`: reusable shape generators for cube, floor, and tree placement
- `app/lib/voxFormat.ts`: MagicaVoxel `.vox` parsing and serialization

## Data Model

Voxel data is stored as a simple object map:

```ts
type VoxelMap = Record<string, string>;
```

Each key is a coordinate string like `x,y,z`, and each value is a hex color like `#22c55e`.

## AI Usage

- AI tools were used throughout development to accelerate prototyping, debugging, and iteration.

### Rapid prototyping

- AI was first used to generate an initial **voxel editor MVP**. Within about 30 minutes it produced a basic scene with voxel placement and rendering, which provided a useful starting point for the project.

- Because AI generation is inexpensive and fast, it was helpful for exploring multiple implementation directions quickly.

### Human validation and debugging

- AI-generated code often appeared correct but required **manual verification**.

- For example, AI sometimes claimed that a feature worked (such as voxel placement), while in practice the interaction logic still needed debugging and adjustment through manual testing.

- In one case, placing voxels caused the grid to flicker. AI was first asked to fix the issue but failed. I then proposed several approaches and used AI to implement them until one successfully resolved the problem.

### Architecture considerations

- AI is very effective at generating **small features and UI interactions**, but architectural decisions still require human judgment. If the editor were built entirely around logic embedded in `VoxelBlock` components, adding new tools or object types would quickly become difficult.

- A more scalable approach would be a **tool-based architecture**, where editing behaviors are implemented as independent tools. In this design, tools operate directly on the world voxel data (e.g., the voxel map) rather than relying on individual scene objects to trigger callbacks.

- Additionally, large refactors (such as introducing `THREE.InstancedMesh` for performance optimization) can be difficult for AI to implement when constrained by earlier architectural decisions, reinforcing the importance of establishing a clean structure early.

## Design Considerations

### Rendering performance

- Each voxel is currently rendered as its own mesh. This works well for scenes with hundreds or a few thousand voxels, but very large scenes (tens of thousands of voxels) may become slow due to the number of draw calls.

- A common improvement would be to use `THREE.InstancedMesh` so that many voxels can share the same geometry. This optimization was not implemented in order to keep the project simple within the **6-hour challenge scope**.

### Tool architecture

- Most editing behavior is currently tied to the `VoxelBlock` and `Floor` components. This works well for a small editor, but if many new tools were added, a **tool-based architecture** would make the system easier to extend.

