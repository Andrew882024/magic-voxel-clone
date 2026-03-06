/**
 * MagicaVoxel .vox file format (RIFF-style).
 * Spec: https://github.com/ephtracy/voxel-model/blob/master/MagicaVoxel-file-format-vox.txt
 */

export type VoxelMap = Record<string, string>;

const VOX_MAGIC = "VOX ";
const VERSION = 150;
const MAIN_ID = "MAIN";
const SIZE_ID = "SIZE";
const XYZI_ID = "XYZI";
const RGBA_ID = "RGBA";

// Default MagicaVoxel palette (ARGB). Index 0 unused; indices 1–255 map to file entries 0–254.
const DEFAULT_PALETTE_U32 = [
  0x00000000, 0xffffffff, 0xffccffff, 0xff99ffff, 0xff66ffff, 0xff33ffff, 0xff00ffff, 0xffffccff,
  0xffccccff, 0xff99ccff, 0xff66ccff, 0xff33ccff, 0xff00ccff, 0xffff99ff, 0xffcc99ff, 0xff9999ff,
  0xff6699ff, 0xff3399ff, 0xff0099ff, 0xffff66ff, 0xffcc66ff, 0xff9966ff, 0xff6666ff, 0xff3366ff,
  0xff0066ff, 0xffff33ff, 0xffcc33ff, 0xff9933ff, 0xff6633ff, 0xff3333ff, 0xff0033ff, 0xffff00ff,
  0xffcc00ff, 0xff9900ff, 0xff6600ff, 0xff3300ff, 0xff0000ff, 0xffffffcc, 0xffccffcc, 0xff99ffcc,
  0xff66ffcc, 0xff33ffcc, 0xff00ffcc, 0xffffcccc, 0xffcccccc, 0xff99cccc, 0xff66cccc, 0xff33cccc,
  0xff00cccc, 0xffff99cc, 0xffcc99cc, 0xff9999cc, 0xff6699cc, 0xff3399cc, 0xff0099cc, 0xffff66cc,
  0xffcc66cc, 0xff9966cc, 0xff6666cc, 0xff3366cc, 0xff0066cc, 0xffff33cc, 0xffcc33cc, 0xff9933cc,
  0xff6633cc, 0xff3333cc, 0xff0033cc, 0xffff00cc, 0xffcc00cc, 0xff9900cc, 0xff6600cc, 0xff3300cc,
  0xff0000cc, 0xffffff99, 0xffccff99, 0xff99ff99, 0xff66ff99, 0xff33ff99, 0xff00ff99, 0xffffcc99,
  0xffcccc99, 0xff99cc99, 0xff66cc99, 0xff33cc99, 0xff00cc99, 0xffff9999, 0xffcc9999, 0xff999999,
  0xff669999, 0xff339999, 0xff009999, 0xffff6699, 0xffcc6699, 0xff996699, 0xff666699, 0xff336699,
  0xff006699, 0xffff3399, 0xffcc3399, 0xff993399, 0xff663399, 0xff333399, 0xff003399, 0xffff0099,
  0xffcc0099, 0xff990099, 0xff660099, 0xff330099, 0xff000099, 0xffffff66, 0xffccff66, 0xff99ff66,
  0xff66ff66, 0xff33ff66, 0xff00ff66, 0xffffcc66, 0xffcccc66, 0xff99cc66, 0xff66cc66, 0xff33cc66,
  0xff00cc66, 0xffff9966, 0xffcc9966, 0xff999966, 0xff669966, 0xff339966, 0xff009966, 0xffff6666,
  0xffcc6666, 0xff996666, 0xff666666, 0xff336666, 0xff006666, 0xffff3366, 0xffcc3366, 0xff993366,
  0xff663366, 0xff333366, 0xff003366, 0xffff0066, 0xffcc0066, 0xff990066, 0xff660066, 0xff330066,
  0xff000066, 0xffffff33, 0xffccff33, 0xff99ff33, 0xff66ff33, 0xff33ff33, 0xff00ff33, 0xffffcc33,
  0xffcccc33, 0xff99cc33, 0xff66cc33, 0xff33cc33, 0xff00cc33, 0xffff9933, 0xffcc9933, 0xff999933,
  0xff669933, 0xff339933, 0xff009933, 0xffff6633, 0xffcc6633, 0xff996633, 0xff666633, 0xff336633,
  0xff006633, 0xffff3333, 0xffcc3333, 0xff993333, 0xff663333, 0xff333333, 0xff003333, 0xffff0033,
  0xffcc0033, 0xff990033, 0xff660033, 0xff330033, 0xff000033, 0xffffff00, 0xffccff00, 0xff99ff00,
  0xff66ff00, 0xff33ff00, 0xff00ff00, 0xffffcc00, 0xffcccc00, 0xff99cc00, 0xff66cc00, 0xff33cc00,
  0xff00cc00, 0xffff9900, 0xffcc9900, 0xff999900, 0xff669900, 0xff339900, 0xff009900, 0xffff6600,
  0xffcc6600, 0xff996600, 0xff666600, 0xff336600, 0xff006600, 0xffff3300, 0xffcc3300, 0xff993300,
  0xff663300, 0xff333300, 0xff003300, 0xffff0000, 0xffcc0000, 0xff990000, 0xff660000, 0xff330000,
  0xff0000ee, 0xff0000dd, 0xff0000bb, 0xff0000aa, 0xff000088, 0xff000077, 0xff000055, 0xff000044,
  0xff000022, 0xff000011, 0xff00ee00, 0xff00dd00, 0xff00bb00, 0xff00aa00, 0xff008800, 0xff007700,
  0xff005500, 0xff004400, 0xff002200, 0xff001100, 0xffee0000, 0xffdd0000, 0xffbb0000, 0xffaa0000,
  0xff880000, 0xff770000, 0xff550000, 0xff440000, 0xff220000, 0xff110000, 0xffeeeeee, 0xffdddddd,
  0xffbbbbbb, 0xffaaaaaa, 0xff888888, 0xff777777, 0xff555555, 0xff444444, 0xff222222, 0xff111111,
];

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function argbToHex(argb: number): string {
  const r = (argb >> 16) & 0xff;
  const g = (argb >> 8) & 0xff;
  const b = argb & 0xff;
  return "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
}

/**
 * Serialize VoxelMap to MagicaVoxel .vox format.
 * Voxels are normalized to 0-based coordinates; dimensions are bounding box.
 */
export function serializeVox(voxels: VoxelMap): ArrayBuffer {
  const entries = Object.entries(voxels);
  if (entries.length === 0) {
    // Empty model: 1x1x1, 0 voxels
    const sizeChunk = new ArrayBuffer(12);
    const sizeDv = new DataView(sizeChunk);
    sizeDv.setUint32(0, 1, true);
    sizeDv.setUint32(4, 1, true);
    sizeDv.setUint32(8, 1, true);
    const xyziChunk = new ArrayBuffer(4);
    new DataView(xyziChunk).setUint32(0, 0, true);
    const mainChildren = new Uint8Array(sizeChunk.byteLength + 8 + 8 + 4 + xyziChunk.byteLength + 8 + 8 + 4 + 1024);
    let off = 0;
    const cdv = new DataView(mainChildren.buffer, mainChildren.byteOffset, mainChildren.byteLength);
    cdv.setUint8(off, SIZE_ID.charCodeAt(0)); cdv.setUint8(off + 1, SIZE_ID.charCodeAt(1)); cdv.setUint8(off + 2, SIZE_ID.charCodeAt(2)); cdv.setUint8(off + 3, SIZE_ID.charCodeAt(3));
    cdv.setUint32(off + 4, 12, true); cdv.setUint32(off + 8, 0, true);
    off += 12; new Uint8Array(mainChildren.buffer, mainChildren.byteOffset + off, 12).set(new Uint8Array(sizeChunk)); off += 12;
    cdv.setUint8(off, XYZI_ID.charCodeAt(0)); cdv.setUint8(off + 1, XYZI_ID.charCodeAt(1)); cdv.setUint8(off + 2, XYZI_ID.charCodeAt(2)); cdv.setUint8(off + 3, XYZI_ID.charCodeAt(3));
    cdv.setUint32(off + 4, 4, true); cdv.setUint32(off + 8, 0, true);
    off += 12; cdv.setUint32(off, 0, true); off += 4;
    const rgba = new Uint8Array(1024);
    for (let i = 0; i < 255; i++) {
      const c = DEFAULT_PALETTE_U32[i + 1];
      rgba[i * 4] = (c >> 16) & 0xff;
      rgba[i * 4 + 1] = (c >> 8) & 0xff;
      rgba[i * 4 + 2] = c & 0xff;
      rgba[i * 4 + 3] = 255;
    }
    cdv.setUint8(off, RGBA_ID.charCodeAt(0)); cdv.setUint8(off + 1, RGBA_ID.charCodeAt(1)); cdv.setUint8(off + 2, RGBA_ID.charCodeAt(2)); cdv.setUint8(off + 3, RGBA_ID.charCodeAt(3));
    cdv.setUint32(off + 4, 1024, true); cdv.setUint32(off + 8, 0, true);
    off += 12; new Uint8Array(mainChildren.buffer, mainChildren.byteOffset + off, 1024).set(rgba);
    const total = 8 + 12 + mainChildren.byteLength;
    const out = new ArrayBuffer(total);
    const dv = new DataView(out);
    dv.setUint8(0, VOX_MAGIC.charCodeAt(0)); dv.setUint8(1, VOX_MAGIC.charCodeAt(1)); dv.setUint8(2, VOX_MAGIC.charCodeAt(2)); dv.setUint8(3, VOX_MAGIC.charCodeAt(3));
    dv.setUint32(4, VERSION, true);
    dv.setUint8(8, MAIN_ID.charCodeAt(0)); dv.setUint8(9, MAIN_ID.charCodeAt(1)); dv.setUint8(10, MAIN_ID.charCodeAt(2)); dv.setUint8(11, MAIN_ID.charCodeAt(3));
    dv.setUint32(12, 0, true); dv.setUint32(16, mainChildren.byteLength, true);
    new Uint8Array(out, 20).set(mainChildren);
    return out;
  }

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  const uniqueColors: string[] = [];
  const colorToIndex = new Map<string, number>();

  for (const [key, color] of entries) {
    const [x, y, z] = key.split(",").map(Number);
    minX = Math.min(minX, x); minY = Math.min(minY, y); minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); maxZ = Math.max(maxZ, z);
    if (!colorToIndex.has(color)) {
      colorToIndex.set(color, uniqueColors.length + 1);
      uniqueColors.push(color);
    }
  }

  const sx = maxX - minX + 1;
  const sy = maxY - minY + 1;
  const sz = maxZ - minZ + 1;

  if (sx > 256 || sy > 256 || sz > 256) {
    throw new Error("Voxel dimensions exceed .vox limit (256 per axis)");
  }

  // Build palette: use unique colors, then fill with default up to 255
  const paletteRgb: [number, number, number][] = [];
  for (const hex of uniqueColors) {
    paletteRgb.push(hexToRgb(hex));
  }
  const defaultRgb = DEFAULT_PALETTE_U32.slice(1, 256).map((c) => [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff] as [number, number, number]);
  while (paletteRgb.length < 255) {
    paletteRgb.push(defaultRgb[paletteRgb.length % defaultRgb.length]);
  }

  const xyziData = new Uint8Array(4 + entries.length * 4);
  const xyziDv = new DataView(xyziData.buffer);
  xyziDv.setUint32(0, entries.length, true);
  let i = 0;
  for (const [key, color] of entries) {
    const [x, y, z] = key.split(",").map(Number);
    const idx = colorToIndex.get(color)!;
    xyziData[4 + i * 4] = x - minX;
    xyziData[4 + i * 4 + 1] = y - minY;
    xyziData[4 + i * 4 + 2] = z - minZ;
    xyziData[4 + i * 4 + 3] = idx;
    i++;
  }

  const sizeChunk = new ArrayBuffer(12);
  const sizeDv = new DataView(sizeChunk);
  sizeDv.setUint32(0, sx, true);
  sizeDv.setUint32(4, sy, true);
  sizeDv.setUint32(8, sz, true);

  const rgbaChunk = new Uint8Array(1024);
  for (let p = 0; p < 255; p++) {
    const [r, g, b] = paletteRgb[p];
    rgbaChunk[p * 4] = r;
    rgbaChunk[p * 4 + 1] = g;
    rgbaChunk[p * 4 + 2] = b;
    rgbaChunk[p * 4 + 3] = 255;
  }

  const sizeChunkWithHeader = new Uint8Array(12 + 12);
  const sh = new DataView(sizeChunkWithHeader.buffer);
  sh.setUint8(0, SIZE_ID.charCodeAt(0)); sh.setUint8(1, SIZE_ID.charCodeAt(1)); sh.setUint8(2, SIZE_ID.charCodeAt(2)); sh.setUint8(3, SIZE_ID.charCodeAt(3));
  sh.setUint32(4, 12, true); sh.setUint32(8, 0, true);
  sizeChunkWithHeader.set(new Uint8Array(sizeChunk), 12);

  const xyziChunkWithHeader = new Uint8Array(12 + xyziData.byteLength);
  const xh = new DataView(xyziChunkWithHeader.buffer);
  xh.setUint8(0, XYZI_ID.charCodeAt(0)); xh.setUint8(1, XYZI_ID.charCodeAt(1)); xh.setUint8(2, XYZI_ID.charCodeAt(2)); xh.setUint8(3, XYZI_ID.charCodeAt(3));
  xh.setUint32(4, xyziData.byteLength, true); xh.setUint32(8, 0, true);
  xyziChunkWithHeader.set(xyziData, 12);

  const rgbaChunkWithHeader = new Uint8Array(12 + 1024);
  const rh = new DataView(rgbaChunkWithHeader.buffer);
  rh.setUint8(0, RGBA_ID.charCodeAt(0)); rh.setUint8(1, RGBA_ID.charCodeAt(1)); rh.setUint8(2, RGBA_ID.charCodeAt(2)); rh.setUint8(3, RGBA_ID.charCodeAt(3));
  rh.setUint32(4, 1024, true); rh.setUint32(8, 0, true);
  rgbaChunkWithHeader.set(rgbaChunk, 12);

  const mainChildren = new Uint8Array(sizeChunkWithHeader.byteLength + xyziChunkWithHeader.byteLength + rgbaChunkWithHeader.byteLength);
  mainChildren.set(sizeChunkWithHeader, 0);
  mainChildren.set(xyziChunkWithHeader, sizeChunkWithHeader.byteLength);
  mainChildren.set(rgbaChunkWithHeader, sizeChunkWithHeader.byteLength + xyziChunkWithHeader.byteLength);

  const total = 8 + 12 + mainChildren.byteLength;
  const out = new ArrayBuffer(total);
  const dv = new DataView(out);
  dv.setUint8(0, VOX_MAGIC.charCodeAt(0)); dv.setUint8(1, VOX_MAGIC.charCodeAt(1)); dv.setUint8(2, VOX_MAGIC.charCodeAt(2)); dv.setUint8(3, VOX_MAGIC.charCodeAt(3));
  dv.setUint32(4, VERSION, true);
  dv.setUint8(8, MAIN_ID.charCodeAt(0)); dv.setUint8(9, MAIN_ID.charCodeAt(1)); dv.setUint8(10, MAIN_ID.charCodeAt(2)); dv.setUint8(11, MAIN_ID.charCodeAt(3));
  dv.setUint32(12, 0, true);
  dv.setUint32(16, mainChildren.byteLength, true);
  new Uint8Array(out, 20).set(mainChildren);
  return out;
}

/**
 * Parse MagicaVoxel .vox file into VoxelMap.
 * Coordinates in the file are used as-is (0-based model space).
 */
export function parseVox(buffer: ArrayBuffer): VoxelMap {
  const dv = new DataView(buffer);
  if (buffer.byteLength < 8) throw new Error("File too short");
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
  if (magic !== VOX_MAGIC) throw new Error("Invalid .vox file: bad magic");
  dv.getUint32(4, true); // version

  let offset = 8;
  if (offset + 12 > buffer.byteLength) throw new Error("Truncated .vox");

  const mainId = String.fromCharCode(dv.getUint8(offset), dv.getUint8(offset + 1), dv.getUint8(offset + 2), dv.getUint8(offset + 3));
  const contentLen = dv.getUint32(offset + 4, true);
  const childrenLen = dv.getUint32(offset + 8, true);
  offset += 12 + contentLen;

  if (mainId !== MAIN_ID) throw new Error("Expected MAIN chunk");
  const childrenEnd = offset + childrenLen;
  let palette: number[] = DEFAULT_PALETTE_U32.slice();
  let xyziData: { x: number; y: number; z: number; i: number }[] = [];
  let voxelsLoaded = false;

  while (offset < childrenEnd && offset + 12 <= buffer.byteLength) {
    const id = String.fromCharCode(dv.getUint8(offset), dv.getUint8(offset + 1), dv.getUint8(offset + 2), dv.getUint8(offset + 3));
    const n = dv.getUint32(offset + 4, true);
    const m = dv.getUint32(offset + 8, true);
    offset += 12;

    if (id === SIZE_ID && n >= 12) {
      // Keep dimensions for next XYZI (we only load first model)
    } else if (id === XYZI_ID && n >= 4 && !voxelsLoaded) {
      const numVoxels = dv.getUint32(offset, true);
      for (let i = 0; i < numVoxels; i++) {
        const base = offset + 4 + i * 4;
        if (base + 4 > buffer.byteLength) break;
        xyziData.push({
          x: dv.getUint8(base),
          y: dv.getUint8(base + 1),
          z: dv.getUint8(base + 2),
          i: dv.getUint8(base + 3),
        });
      }
      voxelsLoaded = true;
    } else if (id === RGBA_ID && n >= 1024) {
      palette = [0x00000000];
      for (let i = 0; i < 255; i++) {
        const r = dv.getUint8(offset + i * 4);
        const g = dv.getUint8(offset + i * 4 + 1);
        const b = dv.getUint8(offset + i * 4 + 2);
        const a = dv.getUint8(offset + i * 4 + 3);
        palette.push((a << 24) | (r << 16) | (g << 8) | b);
      }
    }

    offset += n + m;
  }

  const result: VoxelMap = {};
  for (const v of xyziData) {
    const idx = v.i;
    const color = idx >= 1 && idx < palette.length ? argbToHex(palette[idx]) : "#808080";
    const key = `${v.x},${v.y},${v.z}`;
    result[key] = color;
  }
  return result;
}
