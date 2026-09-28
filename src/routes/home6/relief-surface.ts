/**
 * The carved tablet drawn on /home6. It is conceptual and procedural: an invented slab with a
 * moulded frame, a rosette, a made-up inscription and a broken corner. It depicts no real object and
 * no PURE3D edition; the inscription is a pattern of cuts, not a script.
 */

export const PLATE_WIDTH = 1.5;
export const PLATE_HEIGHT = 2;
/** Height range the relief map stores, in model units. */
export const HEIGHT_MIN = -0.06;
export const HEIGHT_MAX = 0.14;

export interface ReliefMesh {
	vertexCount: number;
	/** Texture coordinates, which also place each vertex on the plate. */
	uv: Float32Array;
	/** Height of the flat, slightly lifted page the tablet is printed on. */
	page: Float32Array;
	pageNormal: Float32Array;
	/** Height of the carved form at mesh resolution; the fine cuts live in the relief map. */
	relief: Float32Array;
	indices: Uint16Array;
}

export interface ReliefMap {
	width: number;
	height: number;
	/** R, G: surface normal. B: height, 0 where the stone is missing. A: cavity. */
	pixels: Uint8Array;
}

export interface ReliefMark {
	id: string;
	mark: string;
	title: string;
	text: string;
	/** Position on the plate in texture coordinates. */
	u: number;
	v: number;
	/** The lamp that shows this part of the surface best, in degrees. */
	azimuth: number;
	elevation: number;
}

/** Four places on the tablet an edition's annotations could address. */
export const RELIEF_MARKS: ReliefMark[] = [
	{
		id: 'inscription',
		mark: 'A',
		title: 'Incised text',
		text: 'Low light from the side separates cut strokes from weathering. A note could give a reading, how certain it is, and the images it was checked against.',
		u: 0.5,
		v: 0.27,
		azimuth: 176,
		elevation: 9
	},
	{
		id: 'rosette',
		mark: 'B',
		title: 'Rosette and boss',
		text: 'A note could compare the motif with other objects and cite the literature that discusses it.',
		u: 0.5,
		v: 0.7,
		azimuth: 118,
		elevation: 22
	},
	{
		id: 'fracture',
		mark: 'C',
		title: 'Broken corner',
		text: 'Paradata can record what is missing and what, if anything, was reconstructed, so readers can tell evidence from inference.',
		u: 0.83,
		v: 0.8,
		azimuth: 40,
		elevation: 16
	},
	{
		id: 'moulding',
		mark: 'D',
		title: 'Frame moulding',
		text: 'Measurements taken on the model can sit next to the method used to take them.',
		u: 0.06,
		v: 0.42,
		azimuth: 4,
		elevation: 14
	}
];

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
const LINE_LENGTHS = [13, 12, 13, 11, 7];
const CUT_WIDTH = 0.0065;
const CUT_DEPTH = 0.014;

function segmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
	const dx = bx - ax;
	const dy = by - ay;
	const t = clamp01(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy));
	return Math.hypot(px - ax - dx * t, py - ay - dy * t);
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
	if (hash(line * 17 + 3, column * 31 + 7) < 0.14) return 0;

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

/** A sheet of paper, bowed a little and lifting at one corner. */
function pageHeight(u: number, v: number) {
	const corner = smooth(0.45, 1, u) * smooth(0.5, 1, 1 - v);
	return 0.012 * Math.sin(Math.PI * u) + 0.16 * corner ** 3;
}

/** A grid of `columns` cells across the plate, with as many rows as keeps the cells square. */
export function buildReliefMesh(columns: number): ReliefMesh {
	const rows = Math.round((columns * PLATE_HEIGHT) / PLATE_WIDTH);
	const stride = columns + 1;
	const vertexCount = stride * (rows + 1);
	if (vertexCount > 65536) throw new Error('The relief mesh is too dense for 16-bit indices.');

	const uv = new Float32Array(vertexCount * 2);
	const page = new Float32Array(vertexCount);
	const pageNormal = new Float32Array(vertexCount * 3);
	const relief = new Float32Array(vertexCount);
	const e = 1e-3;

	for (let j = 0; j <= rows; j++) {
		for (let i = 0; i <= columns; i++) {
			const k = j * stride + i;
			const u = i / columns;
			const v = j / rows;
			const x = (u - 0.5) * PLATE_WIDTH;
			const y = (v - 0.5) * PLATE_HEIGHT;
			uv[k * 2] = u;
			uv[k * 2 + 1] = v;
			page[k] = pageHeight(u, v);
			const dx = (pageHeight(u + e, v) - pageHeight(u - e, v)) / (2 * e * PLATE_WIDTH);
			const dy = (pageHeight(u, v + e) - pageHeight(u, v - e)) / (2 * e * PLATE_HEIGHT);
			const length = Math.hypot(dx, dy, 1);
			pageNormal[k * 3] = -dx / length;
			pageNormal[k * 3 + 1] = -dy / length;
			pageNormal[k * 3 + 2] = 1 / length;
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

	return { vertexCount, uv, page, pageNormal, relief, indices };
}

/** Longest stretch of baking between yields to the main thread, in milliseconds. */
const SLICE_MS = 10;

const nextTask = () => new Promise<void>((done) => setTimeout(done, 0));

/**
 * Bakes the full-resolution surface into a texture: normals for the lighting, height for the cast
 * shadows and contours, and cavity for the dirt that collects in cuts. The work is sliced so
 * scrolling and input stay responsive; an aborted signal stops it early.
 */
export async function bakeReliefMap(width: number, signal?: AbortSignal): Promise<ReliefMap> {
	const height = Math.round((width * PLATE_HEIGHT) / PLATE_WIDTH);
	const heights = new Float32Array(width * height);
	let sliceStart = performance.now();
	for (let j = 0; j < height; j++) {
		const y = ((j + 0.5) / height - 0.5) * PLATE_HEIGHT;
		for (let i = 0; i < width; i++) {
			heights[j * width + i] = surface(((i + 0.5) / width - 0.5) * PLATE_WIDTH, y);
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

	return { width, height, pixels };
}
