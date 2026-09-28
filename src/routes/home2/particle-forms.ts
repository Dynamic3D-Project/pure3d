/**
 * Procedural point clouds for the landing-page artwork. The forms are conceptual: they suggest the
 * kinds of objects 3D editions document, but none of them is derived from a real scan.
 */

export interface ParticleForm {
	id: string;
	label: string;
	title: string;
	note: string;
}

export const PARTICLE_FORMS: ParticleForm[] = [
	{
		id: 'vessel',
		label: 'Vessel',
		title: 'A turned vessel',
		note: 'Surface points gathered in horizontal passes, the way a scanner records a ceramic object.'
	},
	{
		id: 'column',
		label: 'Column',
		title: 'An architectural member',
		note: 'A fluted column on its stylobate, at the scale of a building survey.'
	},
	{
		id: 'site',
		label: 'Site',
		title: 'An excavated landscape',
		note: 'Terrain, trenches, survey grid and wall footings, as photogrammetry records a site.'
	}
];

export interface ParticleCloud {
	count: number;
	/** One xyz array per form, in the order of `PARTICLE_FORMS`. */
	forms: Float32Array[];
	/** Unit vectors each particle travels along when the cloud disperses. */
	directions: Float32Array;
	/** x: stagger seed in 0..1, y: 1 for annotation-marker particles. */
	meta: Float32Array;
}

type Random = () => number;
type Sampler = (random: Random, out: Float32Array, index: number) => void;

const TAU = Math.PI * 2;
const SCAN_PASSES = 56;
const ANCHORS = 5;
const ANCHOR_POINTS = 36;

function mulberry32(seed: number): Random {
	return () => {
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function write(out: Float32Array, index: number, x: number, y: number, z: number) {
	out[index * 3] = x;
	out[index * 3 + 1] = y;
	out[index * 3 + 2] = z;
}

function smoothstep(edge0: number, edge1: number, value: number) {
	const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
	return t * t * (3 - 2 * t);
}

/** Snaps a coordinate to the nearest scanner pass so parts of each form read as scan lines. */
function scanPass(value: number) {
	return Math.round(value * SCAN_PASSES) / SCAN_PASSES;
}

function sampleBox(
	random: Random,
	out: Float32Array,
	index: number,
	[cx, cy, cz]: readonly number[],
	[hx, hy, hz]: readonly number[]
) {
	const faceX = hy * hz;
	const faceY = hx * hz;
	const pick = random() * (faceX + faceY + hx * hy);
	const side = random() < 0.5 ? -1 : 1;
	let x = (random() * 2 - 1) * hx;
	let y = (random() * 2 - 1) * hy;
	let z = (random() * 2 - 1) * hz;
	if (pick < faceX) x = side * hx;
	else if (pick < faceX + faceY) y = side * hy;
	else z = side * hz;
	write(out, index, cx + x, cy + y, cz + z);
}

// ---------- vessel ----------

const VESSEL_HEIGHT = 1.9;
const VESSEL_MAX_RADIUS = 0.56;

/** Profile radius from foot (0) to rim (1). */
function vesselRadius(t: number) {
	const belly = VESSEL_MAX_RADIUS * Math.pow(Math.sin(Math.PI * Math.min(t / 0.8, 1)), 0.7);
	const neck = t > 0.55 ? 0.13 + 0.1 * smoothstep(0.9, 1, t) : 0;
	const foot = t < 0.04 ? 0.17 : 0;
	return Math.max(belly, neck, foot);
}

const vesselY = (t: number) => (t - 0.5) * VESSEL_HEIGHT;

const sampleVessel: Sampler = (random, out, index) => {
	if (random() < 0.1) {
		// Handles: a quadratic curve from neck to shoulder, mirrored on both sides.
		const s = random();
		const u = 1 - s;
		const side = random() < 0.5 ? -1 : 1;
		const x = u * u * 0.13 + 2 * u * s * 0.6 + s * s * 0.41;
		const y = u * u * vesselY(0.86) + 2 * u * s * vesselY(1) + s * s * vesselY(0.63);
		write(
			out,
			index,
			side * x + (random() - 0.5) * 0.06,
			y + (random() - 0.5) * 0.06,
			(random() - 0.5) * 0.06
		);
		return;
	}
	// Sample the height in proportion to the circumference so the surface density stays even.
	let t = random();
	while (random() * VESSEL_MAX_RADIUS > vesselRadius(t)) t = random();
	if (random() < 0.45) t = scanPass(t);
	const radius = vesselRadius(t);
	const angle = random() * TAU;
	write(out, index, radius * Math.cos(angle), vesselY(t), radius * Math.sin(angle));
};

// ---------- column ----------

const SHAFT_BOTTOM = -0.66;
const SHAFT_HEIGHT = 1.2;

const sampleColumn: Sampler = (random, out, index) => {
	const pick = random();
	if (pick < 0.1) return sampleBox(random, out, index, [0, -0.9, 0], [0.72, 0.05, 0.56]);
	if (pick < 0.18) return sampleBox(random, out, index, [0, -0.8, 0], [0.58, 0.05, 0.46]);
	const angle = random() * TAU;
	if (pick < 0.24) {
		// Torus moulding at the foot of the shaft.
		const tube = random() * TAU;
		const ring = 0.34 + 0.05 * Math.cos(tube);
		write(out, index, ring * Math.cos(angle), -0.7 + 0.05 * Math.sin(tube), ring * Math.sin(angle));
		return;
	}
	if (pick < 0.74) {
		// Tapering shaft with twenty flutes.
		let y = SHAFT_BOTTOM + random() * SHAFT_HEIGHT;
		if (random() < 0.4) y = scanPass(y);
		const radius =
			0.3 - (0.05 * (y - SHAFT_BOTTOM)) / SHAFT_HEIGHT - 0.02 * Math.abs(Math.sin(10 * angle));
		write(out, index, radius * Math.cos(angle), y, radius * Math.sin(angle));
		return;
	}
	if (pick < 0.84) {
		// Echinus flaring out to the abacus.
		const s = random();
		const radius = 0.25 + 0.15 * Math.sqrt(s);
		write(out, index, radius * Math.cos(angle), 0.54 + s * 0.12, radius * Math.sin(angle));
		return;
	}
	sampleBox(random, out, index, [0, 0.72, 0], [0.42, 0.06, 0.42]);
};

// ---------- site ----------

const TRENCHES = [
	[-0.05, -0.25],
	[0.33, -0.25],
	[-0.05, 0.13],
	[0.33, 0.13]
];
const TRENCH_HALF = 0.16;
const TRENCH_DEPTH = 0.16;
const SITE_TILT = 0.5;
const SITE_SCALE = 0.92;

function terrain(x: number, z: number) {
	return (
		0.1 * Math.sin(1.7 * x + 0.4) * Math.cos(1.3 * z) +
		0.05 * Math.sin(3.1 * x + 2.3 * z) +
		0.025 * Math.sin(6.3 * z - 1.2 * x)
	);
}

function inTrench(x: number, z: number) {
	return TRENCHES.some(
		([cx, cz]) => Math.abs(x - cx) < TRENCH_HALF && Math.abs(z - cz) < TRENCH_HALF
	);
}

const sampleSite: Sampler = (random, out, index) => {
	const pick = random();
	let x: number;
	let y: number;
	let z: number;
	if (pick < 0.12) {
		// Vertical trench sections.
		const [cx, cz] = TRENCHES[Math.floor(random() * TRENCHES.length)];
		const side = Math.floor(random() * 4);
		const along = (random() * 2 - 1) * TRENCH_HALF;
		x = cx + (side === 0 ? -TRENCH_HALF : side === 1 ? TRENCH_HALF : along);
		z = cz + (side === 2 ? -TRENCH_HALF : side === 3 ? TRENCH_HALF : along);
		y = terrain(x, z) - random() * TRENCH_DEPTH;
	} else if (pick < 0.22) {
		// Low wall footings of a rectangular building.
		const walk = random() * 4;
		const side = Math.floor(walk);
		const f = walk - side;
		const [x0, x1, z0, z1] = [-0.85, -0.45, 0.3, 0.8];
		x = side === 0 ? x0 + (x1 - x0) * f : side === 1 ? x1 : side === 2 ? x1 - (x1 - x0) * f : x0;
		z = side === 0 ? z0 : side === 1 ? z0 + (z1 - z0) * f : side === 2 ? z1 : z1 - (z1 - z0) * f;
		x += (random() - 0.5) * 0.05;
		z += (random() - 0.5) * 0.05;
		y = terrain(x, z) + random() * 0.09;
	} else {
		x = random() * 2 - 1;
		z = random() * 2 - 1;
		// Part of the ground snaps to a survey grid draped over the terrain.
		if (random() < 0.35) {
			if (random() < 0.5) x = Math.round(x * 10) / 10;
			else z = Math.round(z * 10) / 10;
		}
		y = terrain(x, z) - (inTrench(x, z) ? TRENCH_DEPTH : 0);
	}
	// Tilt the plan towards the viewer so the excavation reads from the default camera.
	const cos = Math.cos(SITE_TILT);
	const sin = Math.sin(SITE_TILT);
	y -= 0.1;
	write(
		out,
		index,
		x * SITE_SCALE,
		(y * cos - z * sin) * SITE_SCALE,
		(y * sin + z * cos) * SITE_SCALE
	);
};

const SAMPLERS: Sampler[] = [sampleVessel, sampleColumn, sampleSite];

/**
 * Builds every form for the same particles, so particle `i` has a place in each form and can travel
 * between them. The first particles gather into small clusters that stand for annotations.
 */
export function buildParticleCloud(count: number): ParticleCloud {
	const random = mulberry32(20260927);
	const markers = ANCHORS * ANCHOR_POINTS;
	const forms = SAMPLERS.map((sample) => {
		const out = new Float32Array(count * 3);
		for (let i = markers; i < count; i++) sample(random, out, i);
		for (let anchor = 0; anchor < ANCHORS; anchor++) {
			const source = (markers + Math.floor(random() * (count - markers))) * 3;
			for (let k = 0; k < ANCHOR_POINTS; k++) {
				const radius = 0.035 * Math.cbrt(random());
				const angle = random() * TAU;
				const lift = random() * 2 - 1;
				const ring = Math.sqrt(1 - lift * lift) * radius;
				write(
					out,
					anchor * ANCHOR_POINTS + k,
					out[source] + ring * Math.cos(angle),
					out[source + 1] + lift * radius,
					out[source + 2] + ring * Math.sin(angle)
				);
			}
		}
		return out;
	});

	const directions = new Float32Array(count * 3);
	const meta = new Float32Array(count * 2);
	for (let i = 0; i < count; i++) {
		const angle = random() * TAU;
		const lift = random() * 2 - 1;
		const ring = Math.sqrt(1 - lift * lift);
		write(directions, i, ring * Math.cos(angle), lift, ring * Math.sin(angle));
		meta[i * 2] = random();
		meta[i * 2 + 1] = i < markers ? 1 : 0;
	}

	return { count, forms, directions, meta };
}
