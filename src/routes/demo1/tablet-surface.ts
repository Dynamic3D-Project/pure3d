/**
 * The conceptual tablet of the /demo1 edition, the same invented slab drawn on /home6: a moulded
 * frame, a rosette around a drilled boss, a sunken panel of cut signs and a broken corner. It is
 * procedural, depicts no real object, and its signs are a pattern of cuts, not a script.
 *
 * Unlike the folio, the edition keeps the heights it bakes so annotation pins, measurements and the
 * technical record can read the surface on the CPU.
 */

export const PLATE_WIDTH = 1.5;
export const PLATE_HEIGHT = 2;
/** Height range the relief map stores, in model units. */
export const HEIGHT_MIN = -0.06;
export const HEIGHT_MAX = 0.14;

/** Sign positions per line of the inscription, top to bottom. */
export const LINE_LENGTHS = [13, 12, 13, 11, 7] as const;

export interface TabletMesh {
	vertexCount: number;
	columns: number;
	rows: number;
	/** Texture coordinates, which also place each vertex on the plate. */
	uv: Float32Array;
	/** Height of the carved form at mesh resolution; the fine cuts live in the relief map. */
	relief: Float32Array;
	indices: Uint16Array;
}

export interface TabletMap {
	width: number;
	height: number;
	/** R, G: surface normal. B: height, 0 where the stone is missing. A: cavity. */
	pixels: Uint8Array;
	/** Surface height per texel in model units, NaN where the stone is missing. */
	heights: Float32Array;
	/** Share of the plate where stone survives, 0 to 1. */
	surviving: number;
	/** Lowest and highest surviving surface, in model units. */
	low: number;
	high: number;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function smooth(edge0: number, edge1: number, value: number) {
	const t = clamp01((value - edge0) / (edge1 - edge0));
	return t * t * (3 - 2 * t);
}

const bump = (offset: number, width: number) => Math.exp(-((offset / width) ** 2));

function hash(x: number, y: number) {
	const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
	return s - Math.floor(s);
}

function noise(x: number, y: number) {
	const ix = Math.floor(x);
	const iy = Math.floor(y);
	const fx = x - ix;
	const fy = y - iy;
	const ux = fx * fx * (3 - 2 * fx);
	const uy = fy * fy * (3 - 2 * fy);
	const a = hash(ix, iy);
	const b = hash(ix + 1, iy);
	const c = hash(ix, iy + 1);
	const d = hash(ix + 1, iy + 1);
	return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x: number, y: number) {
	let sum = 0;
	let amplitude = 0.5;
	let frequency = 1;
	for (let i = 0; i < 4; i++) {
		sum += amplitude * noise(x * frequency, y * frequency);
		frequency *= 2.03;
		amplitude *= 0.5;
	}
	return sum;
}

/** Positive on the surviving stone, negative where the top-right corner has broken away. */
function fracture(x: number, y: number) {
	const across = x * 0.6 + y * 0.8;
	const along = y * 0.6 - x * 0.8;
	const jag = (noise(along * 9 + 3, 1.7) - 0.5) * 0.09 + (noise(along * 38, 4.2) - 0.5) * 0.025;
	return 0.93 + jag - across;
}

/** Frame, rosette and panel: the large forms the mesh itself is shaped to. */
function form(x: number, y: number) {
	const edge = Math.min(PLATE_WIDTH / 2 - Math.abs(x), PLATE_HEIGHT / 2 - Math.abs(y));
	let h = -0.04 * (1 - smooth(0, 0.05, edge));
	h += 0.045 * smooth(0.05, 0.075, edge) * (1 - smooth(0.11, 0.135, edge));
	h += 0.016 * bump(edge - 0.092, 0.016);
	h -= 0.012 * bump(edge - 0.15, 0.007);

	// Eight petals inside a ring, around a drilled boss.
	const ry = y - 0.4;
	const r = Math.hypot(x, ry);
	const angle = Math.atan2(ry, x);
	h += 0.04 * bump(r - 0.4, 0.02);
	h -= 0.01 * bump(r - 0.36, 0.008);
	const reach = 0.1 + 0.23 * Math.pow(Math.abs(Math.cos(angle * 4)), 0.8);
	const petal = smooth(reach, reach - 0.045, r);
	h += petal * (0.03 + 0.035 * smooth(0.34, 0.1, r));
	const sector = Math.PI / 4;
	const offset = ((((angle + sector / 2) % sector) + sector) % sector) - sector / 2;
	h -= 0.009 * petal * bump(offset * r, 0.006) * smooth(0.1, 0.14, r);
	h += 0.065 * Math.sqrt(Math.max(0, 1 - (r / 0.1) ** 2));
	h -= 0.02 * bump(r, 0.012);

	// A sunken panel carries the inscription.
	const panel = smooth(0.58, 0.56, Math.abs(x)) * smooth(-0.07, -0.09, y) * smooth(-0.9, -0.88, y);
	return h - 0.012 * panel;
}

const STROKES = [
	[0.15, 0, 0.15, 1],
	[0.85, 0, 0.85, 1],
	[0.5, 0, 0.5, 1],
	[0.15, 0, 0.85, 0],
	[0.15, 0.5, 0.85, 0.5],
	[0.15, 1, 0.85, 1],
	[0.15, 1, 0.85, 0],
	[0.15, 0, 0.85, 1]
] as const;
const LINE_TOP = -0.17;
const LINE_PITCH = 0.14;
const GLYPH_HEIGHT = 0.085;
const GLYPH_WIDTH = 0.056;
const ADVANCE = 0.074;
const CUT_WIDTH = 0.0065;
const CUT_DEPTH = 0.014;

function segmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
	const dx = bx - ax;
	const dy = by - ay;
	const t = clamp01(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy));
	return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}

/** Whether a sign position holds cuts; about one in seven is left blank. */
export function signCut(line: number, column: number) {
	return hash(line * 17 + 3, column * 31 + 7) >= 0.14;
}

/** V-cut strokes arranged in lines, like an inscription, but spelling nothing. */
function inscription(x: number, y: number) {
	const down = LINE_TOP - y;
	const line = Math.floor(down / LINE_PITCH);
	if (line < 0 || line >= LINE_LENGTHS.length) return 0;
	const gy = down - line * LINE_PITCH;
	if (gy > GLYPH_HEIGHT + CUT_WIDTH) return 0;
	const count = LINE_LENGTHS[line];
	const left = -(count * ADVANCE - (ADVANCE - GLYPH_WIDTH)) / 2;
	const column = Math.floor((x - left) / ADVANCE);
	if (column < 0 || column >= count) return 0;
	if (!signCut(line, column)) return 0;

	const gx = x - left - column * ADVANCE;
	let bits = Math.floor(hash(column * 13 + line, line * 7 + column * 3) * 255);
	if (bits === 0) bits = 4;
	let distance = Infinity;
	let used = 0;
	for (let i = 0; i < STROKES.length && used < 3; i++) {
		if (!(bits & (1 << i))) continue;
		used++;
		const [ax, ay, bx, by] = STROKES[i];
		distance = Math.min(
			distance,
			segmentDistance(
				gx,
				gy,
				ax * GLYPH_WIDTH,
				ay * GLYPH_HEIGHT,
				bx * GLYPH_WIDTH,
				by * GLYPH_HEIGHT
			)
		);
	}
	return -CUT_DEPTH * Math.max(0, 1 - distance / CUT_WIDTH);
}

/** Cut and blank sign positions of each line, read from the same pattern that carves them. */
export function inscriptionCounts() {
	return LINE_LENGTHS.map((count, line) => {
		let cut = 0;
		for (let column = 0; column < count; column++) if (signCut(line, column)) cut++;
		return { positions: count, cut };
	});
}

/** The stone drops away towards the break. */
const fractureDrop = (edge: number) => 0.05 * (1 - smooth(0, 0.06, edge));

/** Full surface height, or NaN where the stone is missing. */
function surface(x: number, y: number) {
	const edge = fracture(x, y);
	if (edge < 0) return Number.NaN;
	let h = form(x, y) + inscription(x, y);
	h += (fbm(x * 7 + 11, y * 7) - 0.47) * 0.012 + (noise(x * 70, y * 70) - 0.5) * 0.002;
	h -= 0.006 * smooth(0.72, 0.9, noise(x * 26 + 5, y * 26 - 3));
	return h - fractureDrop(edge) * (0.6 + 0.4 * noise(x * 30, y * 30));
}

/** A grid of `columns` cells across the plate, with as many rows as keeps the cells square. */
export function buildTabletMesh(columns: number): TabletMesh {
	const rows = Math.round((columns * PLATE_HEIGHT) / PLATE_WIDTH);
	const stride = columns + 1;
	const vertexCount = stride * (rows + 1);
	if (vertexCount > 65536) throw new Error('The tablet mesh is too dense for 16-bit indices.');

	const uv = new Float32Array(vertexCount * 2);
	const relief = new Float32Array(vertexCount);

	for (let j = 0; j <= rows; j++) {
		for (let i = 0; i <= columns; i++) {
			const k = j * stride + i;
			const u = i / columns;
			const v = j / rows;
			const x = (u - 0.5) * PLATE_WIDTH;
			const y = (v - 0.5) * PLATE_HEIGHT;
			uv[k * 2] = u;
			uv[k * 2 + 1] = v;
			relief[k] = form(x, y) - fractureDrop(Math.max(0, fracture(x, y)));
		}
	}

	const indices = new Uint16Array(columns * rows * 6);
	let n = 0;
	for (let j = 0; j < rows; j++) {
		for (let i = 0; i < columns; i++) {
			const a = j * stride + i;
			const b = a + 1;
			const c = a + stride;
			const d = c + 1;
			indices.set([a, b, d, a, d, c], n);
			n += 6;
		}
	}

	return { vertexCount, columns, rows, uv, relief, indices };
}

/** Longest stretch of baking between yields to the main thread, in milliseconds. */
const SLICE_MS = 10;

const nextTask = () => new Promise<void>((done) => setTimeout(done, 0));

/**
 * Bakes the full-resolution surface into a texture: normals for the lighting, height for the cast
 * shadows and contours, and cavity for the dirt that collects in cuts. The work is sliced so input
 * stays responsive; an aborted signal stops it early.
 */
export async function bakeTabletMap(width: number, signal?: AbortSignal): Promise<TabletMap> {
	const height = Math.round((width * PLATE_HEIGHT) / PLATE_WIDTH);
	const heights = new Float32Array(width * height);
	let sliceStart = performance.now();
	let surviving = 0;
	let low = Infinity;
	let high = -Infinity;
	for (let j = 0; j < height; j++) {
		const y = ((j + 0.5) / height - 0.5) * PLATE_HEIGHT;
		for (let i = 0; i < width; i++) {
			const h = surface(((i + 0.5) / width - 0.5) * PLATE_WIDTH, y);
			heights[j * width + i] = h;
			if (Number.isNaN(h)) continue;
			surviving++;
			low = Math.min(low, h);
			high = Math.max(high, h);
		}
		if (performance.now() - sliceStart > SLICE_MS) {
			await nextTask();
			if (signal?.aborted) throw new Error('Baking was cancelled.');
			sliceStart = performance.now();
		}
	}

	const at = (i: number, j: number, fallback: number) => {
		const value =
			heights[Math.min(height - 1, Math.max(0, j)) * width + Math.min(width - 1, Math.max(0, i))];
		return Number.isNaN(value) ? fallback : value;
	};
	const dx = PLATE_WIDTH / width;
	const dy = PLATE_HEIGHT / height;
	const pixels = new Uint8Array(width * height * 4);

	for (let j = 0; j < height; j++) {
		for (let i = 0; i < width; i++) {
			const k = j * width + i;
			const o = k * 4;
			const h = heights[k];
			if (Number.isNaN(h)) {
				pixels[o] = 128;
				pixels[o + 1] = 128;
				continue;
			}
			const gx = (at(i + 1, j, h) - at(i - 1, j, h)) / (2 * dx);
			const gy = (at(i, j + 1, h) - at(i, j - 1, h)) / (2 * dy);
			const length = Math.hypot(gx, gy, 1);
			const around = (at(i - 2, j, h) + at(i + 2, j, h) + at(i, j - 2, h) + at(i, j + 2, h)) / 4;
			pixels[o] = Math.round((0.5 - (0.5 * gx) / length) * 255);
			pixels[o + 1] = Math.round((0.5 - (0.5 * gy) / length) * 255);
			pixels[o + 2] = 1 + Math.round(clamp01((h - HEIGHT_MIN) / (HEIGHT_MAX - HEIGHT_MIN)) * 254);
			pixels[o + 3] = Math.round(clamp01((around - h) / 0.008) * 255);
		}
	}

	return {
		width,
		height,
		pixels,
		heights,
		surviving: surviving / (width * height),
		low,
		high
	};
}

/** Height of the baked surface at a plate position, or NaN off the stone. */
export function sampleHeight(map: TabletMap, u: number, v: number) {
	if (u < 0 || u > 1 || v < 0 || v > 1) return Number.NaN;
	const i = Math.min(map.width - 1, Math.floor(u * map.width));
	const j = Math.min(map.height - 1, Math.floor(v * map.height));
	return map.heights[j * map.width + i];
}
