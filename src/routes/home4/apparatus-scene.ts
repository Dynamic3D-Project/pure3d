/**
 * Geometry for the landing-page apparatus: a procedural, broken amphora with the layers a 3D
 * edition adds around its model. The vessel is conceptual; nothing here is derived from a scan.
 */

export interface ApparatusLayer {
	id: 'evidence' | 'annotation' | 'interpretation' | 'paradata' | 'frame';
	label: string;
	note: string;
}

export const LAYERS: ApparatusLayer[] = [
	{
		id: 'evidence',
		label: 'Evidence',
		note: 'The recorded surface: only what survives of the object. Here a procedural vessel stands in for a scan.'
	},
	{
		id: 'annotation',
		label: 'Annotation',
		note: 'Notes anchored to places on the model, linking them to provenance, uncertainty and bibliography.'
	},
	{
		id: 'interpretation',
		label: 'Interpretation',
		note: 'A reconstruction hypothesis, drawn apart from the evidence so the reader can see where the record ends and the argument begins.'
	},
	{
		id: 'paradata',
		label: 'Paradata',
		note: 'How the model was made: capture positions, processing, and the decisions taken along the way.'
	},
	{
		id: 'frame',
		label: 'Frame',
		note: 'Axes, units and bounds: a fixed frame of reference that lets the record be compared, cited and preserved.'
	}
];

export interface ApparatusNote {
	id: string;
	label: string;
	note: string;
	position: [number, number, number];
}

export interface ApparatusScene {
	/** Interleaved x, y, z, layer, flag, seed. */
	points: Float32Array;
	pointCount: number;
	/** Interleaved x, y, z, layer, flag, dash distance; pairs of vertices form segments. */
	lines: Float32Array;
	lineCount: number;
	notes: ApparatusNote[];
}

/** Values per vertex in both buffers. */
export const STRIDE = 6;

type Vec3 = [number, number, number];
type Random = () => number;

const TAU = Math.PI * 2;
const HEIGHT = 2.1;
const MAX_RADIUS = 0.56;
const SCAN_PASSES = 64;
const WALL = 0.035;
/** Centre of the large loss in the vessel wall, in radians around the axis. */
const LOSS_CENTRE = 1.9;
const HANDLE_TUBE = 0.034;

const EVIDENCE = 0;
const ANNOTATION = 1;
const INTERPRETATION = 2;
const PARADATA = 3;
const FRAME = 4;

function mulberry32(seed: number): Random {
	return () => {
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function smoothstep(edge0: number, edge1: number, value: number) {
	const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
	return t * t * (3 - 2 * t);
}

/** Radius of the amphora from its toe (0) to its rim (1). */
function profile(t: number) {
	const swell = Math.min(1, Math.max(0, (t - 0.03) / 0.76));
	const body = MAX_RADIUS * Math.pow(Math.sin(Math.PI * swell), 0.62);
	const neck = t > 0.66 ? 0.15 + 0.06 * smoothstep(0.93, 0.99, t) : 0;
	const toe = t < 0.12 ? 0.045 + 0.45 * t : 0;
	return Math.max(body, neck, toe);
}

const heightAt = (t: number) => (t - 0.5) * HEIGHT;

function angleFrom(theta: number, centre: number) {
	const delta = (((theta - centre) % TAU) + TAU * 1.5) % TAU;
	return delta - Math.PI;
}

/** Where the wall has been lost: a broken-away side, a chipped rim and the missing toe. */
function missing(theta: number, t: number) {
	if (t < 0.075 + 0.012 * Math.sin(theta * 5)) return true;
	const lower = 0.3 + 0.05 * Math.sin(theta * 7 + 0.4);
	const upper = 0.84 + 0.04 * Math.sin(theta * 5 + 1.2);
	const halfWidth = 0.6 + 0.16 * Math.sin(t * 11 + 1) + 0.05 * Math.sin(t * 37);
	if (t > lower && t < upper && Math.abs(angleFrom(theta, LOSS_CENTRE)) < halfWidth) return true;
	const chip = Math.abs(angleFrom(theta, 4.55)) < 0.5 + 0.08 * Math.sin(theta * 13);
	return chip && t > 0.905 + 0.03 * Math.sin(theta * 11);
}

/** A surviving point next to a loss lies on a break surface. */
function onBreak(theta: number, t: number) {
	return (
		missing(theta + 0.045, t) ||
		missing(theta - 0.045, t) ||
		missing(theta, t + 0.014) ||
		missing(theta, t - 0.014)
	);
}

function surface(theta: number, t: number, inset = 0): Vec3 {
	const radius = profile(t) - inset;
	return [radius * Math.cos(theta), heightAt(t), radius * Math.sin(theta)];
}

/** A handle loops from the neck out and down to the shoulder, in the plane of angle `theta`. */
function handlePoint(theta: number, s: number): Vec3 {
	const u = 1 - s;
	const radial = u * u * profile(0.9) + 2 * u * s * 0.54 + s * s * profile(0.71);
	const y = u * u * heightAt(0.9) + 2 * u * s * heightAt(0.99) + s * s * heightAt(0.71);
	return [radial * Math.cos(theta), y, radial * Math.sin(theta)];
}

function push(target: number[], [x, y, z]: Vec3, layer: number, flag: number, extra: number) {
	target.push(x, y, z, layer, flag, extra);
}

function jitter(random: Random, [x, y, z]: Vec3, amount: number): Vec3 {
	return [
		x + (random() - 0.5) * amount,
		y + (random() - 0.5) * amount,
		z + (random() - 0.5) * amount
	];
}

/** Surface points of what survives, with break surfaces and the inner wall picked out. */
function sampleEvidence(random: Random, count: number, out: number[]) {
	let written = 0;
	while (written < count) {
		const pick = random();
		if (pick < 0.07) {
			// The surviving handle, opposite the lost one.
			const s = random();
			const angle = random() * TAU;
			const [x, y, z] = handlePoint(Math.PI, s);
			const lift = HANDLE_TUBE * Math.sin(angle);
			push(out, [x - HANDLE_TUBE * Math.cos(angle), y + lift, z], EVIDENCE, 0, random());
			written++;
			continue;
		}
		if (pick < 0.085) {
			// Scars where the lost handle was attached.
			const s = random() < 0.5 ? 0 : 1;
			const base = handlePoint(0, s);
			push(out, jitter(random, base, 0.07), EVIDENCE, 1, random());
			written++;
			continue;
		}
		// Sample height in proportion to circumference so the surface density stays even.
		let t = random();
		while (random() * MAX_RADIUS > profile(t)) t = random();
		if (random() < 0.42) t = Math.round(t * SCAN_PASSES) / SCAN_PASSES;
		const theta = random() * TAU;
		if (missing(theta, t)) continue;
		const edge = onBreak(theta, t);
		// Break surfaces show the thickness of the wall; elsewhere a share of points draws the inside.
		if (edge) {
			push(out, surface(theta, t, random() * WALL), EVIDENCE, 1, random());
		} else if (random() < 0.14) {
			push(out, surface(theta, t, WALL), EVIDENCE, 2, random());
		} else {
			push(out, surface(theta, t), EVIDENCE, 0, random());
		}
		written++;
	}
}

/** Meridians and parallels of the complete vessel; segments over a loss are the hypothesis. */
function traceReconstruction(out: number[]) {
	const meridians = 24;
	const meridianSteps = 56;
	for (let m = 0; m < meridians; m++) {
		const theta = (m / meridians) * TAU;
		let travelled = 0;
		for (let k = 0; k < meridianSteps; k++) {
			const t0 = k / meridianSteps;
			const t1 = (k + 1) / meridianSteps;
			const a = surface(theta, t0);
			const b = surface(theta, t1);
			const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
			const inferred = missing(theta, (t0 + t1) / 2) ? 1 : 0;
			push(out, a, INTERPRETATION, inferred, travelled);
			push(out, b, INTERPRETATION, inferred, travelled + length);
			travelled += length;
		}
	}
	const parallels = 22;
	const parallelSteps = 80;
	for (let p = 0; p <= parallels; p++) {
		const t = 0.03 + (p / parallels) * 0.96;
		let travelled = 0;
		for (let k = 0; k < parallelSteps; k++) {
			const theta0 = (k / parallelSteps) * TAU;
			const theta1 = ((k + 1) / parallelSteps) * TAU;
			const a = surface(theta0, t);
			const b = surface(theta1, t);
			const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
			const inferred = missing((theta0 + theta1) / 2, t) ? 1 : 0;
			push(out, a, INTERPRETATION, inferred, travelled);
			push(out, b, INTERPRETATION, inferred, travelled + length);
			travelled += length;
		}
	}
	// The lost handle, restored as two outlines of its tube.
	for (const offset of [-HANDLE_TUBE, HANDLE_TUBE]) {
		let travelled = 0;
		const steps = 28;
		for (let k = 0; k < steps; k++) {
			const a = handlePoint(0, k / steps);
			const b = handlePoint(0, (k + 1) / steps);
			a[1] += offset;
			b[1] += offset;
			const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
			push(out, a, INTERPRETATION, 1, travelled);
			push(out, b, INTERPRETATION, 1, travelled + length);
			travelled += length;
		}
	}
}

function normalise([x, y, z]: Vec3): Vec3 {
	const length = Math.hypot(x, y, z) || 1;
	return [x / length, y / length, z / length];
}

function cross([ax, ay, az]: Vec3, [bx, by, bz]: Vec3): Vec3 {
	return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
}

function along(origin: Vec3, ...terms: [Vec3, number][]): Vec3 {
	const result: Vec3 = [...origin];
	for (const [direction, amount] of terms) {
		result[0] += direction[0] * amount;
		result[1] += direction[1] * amount;
		result[2] += direction[2] * amount;
	}
	return result;
}

function segment(out: number[], a: Vec3, b: Vec3, layer: number, flag: number, start = 0) {
	const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
	push(out, a, layer, flag, start);
	push(out, b, layer, flag, start + length);
	return start + length;
}

/** Camera stations of a photogrammetric capture: three rings of small frusta around the object. */
function traceCapture(out: number[]) {
	const rings = [
		{ y: -0.5, radius: 1.72, count: 14 },
		{ y: 0.18, radius: 1.78, count: 14 },
		{ y: 0.9, radius: 1.5, count: 10 }
	];
	for (const [index, ring] of rings.entries()) {
		const stations: Vec3[] = [];
		for (let k = 0; k < ring.count; k++) {
			const angle = (k / ring.count) * TAU + index * 0.21;
			const apex: Vec3 = [ring.radius * Math.cos(angle), ring.y, ring.radius * Math.sin(angle)];
			stations.push(apex);
			const forward = normalise([-apex[0], ring.y * 0.35 - apex[1], -apex[2]]);
			const right = normalise(cross(forward, [0, 1, 0]));
			const up = cross(right, forward);
			const corners = [
				[-1, -1],
				[1, -1],
				[1, 1],
				[-1, 1]
			].map(([h, v]) => along(apex, [forward, 0.17], [right, h * 0.075], [up, v * 0.052]));
			for (let c = 0; c < 4; c++) {
				segment(out, apex, corners[c], PARADATA, 0);
				segment(out, corners[c], corners[(c + 1) % 4], PARADATA, 0);
			}
		}
		// The path the camera travelled between stations, dashed.
		let travelled = 0;
		for (let k = 0; k < stations.length; k++) {
			travelled = segment(
				out,
				stations[k],
				stations[(k + 1) % stations.length],
				PARADATA,
				1,
				travelled
			);
		}
	}
}

/** A measured bounding frame with graduated edges. */
function traceFrame(out: number[]) {
	const [x0, y0, z0] = [-0.66, -1.1, -0.66];
	const [x1, y1, z1] = [0.66, 1.1, 0.66];
	const corners: Vec3[] = [
		[x0, y0, z0],
		[x1, y0, z0],
		[x1, y0, z1],
		[x0, y0, z1],
		[x0, y1, z0],
		[x1, y1, z0],
		[x1, y1, z1],
		[x0, y1, z1]
	];
	const edges = [
		[0, 1],
		[1, 2],
		[2, 3],
		[3, 0],
		[4, 5],
		[5, 6],
		[6, 7],
		[7, 4],
		[0, 4],
		[1, 5],
		[2, 6],
		[3, 7]
	];
	for (const [a, b] of edges) segment(out, corners[a], corners[b], FRAME, 0);
	// Graduations along three edges that meet at the front-left foot of the frame.
	const origin = corners[3];
	const axes: [Vec3, number, Vec3][] = [
		[[1, 0, 0], x1 - x0, [0, -1, 0]],
		[[0, 1, 0], y1 - y0, [-1, 0, 0]],
		[[0, 0, -1], z1 - z0, [-1, 0, 0]]
	];
	for (const [direction, length, outward] of axes) {
		const divisions = Math.round(length / 0.066);
		for (let k = 0; k <= divisions; k++) {
			const base = along(origin, [direction, (k / divisions) * length]);
			const size = k % 5 === 0 ? 0.08 : 0.035;
			segment(out, base, along(base, [outward, size]), FRAME, 1);
		}
	}
}

function noteAnchors(): ApparatusNote[] {
	// The break anchor sits on the first surviving wall beside the large loss.
	let breakTheta = LOSS_CENTRE;
	while (missing(breakTheta, 0.55) && breakTheta > LOSS_CENTRE - Math.PI) breakTheta -= 0.01;
	const handle = handlePoint(0, 1);
	return [
		{
			id: 'rim',
			label: 'Rim profile',
			note: 'Where the rim survives, its profile can be measured and compared.',
			position: surface(0.55, 0.985)
		},
		{
			id: 'break',
			label: 'Break edge',
			note: 'A break records loss; the note can say what is known, and what is not, about how it happened.',
			position: surface(breakTheta, 0.55)
		},
		{
			id: 'scar',
			label: 'Handle scar',
			note: 'An attachment scar is evidence for a handle that no longer survives.',
			position: [handle[0] + 0.015, handle[1], handle[2]]
		},
		{
			id: 'parallel',
			label: 'Cited parallel',
			note: 'A note can cite comparable objects and the literature that discusses them.',
			position: surface(0.85, 0.24)
		}
	];
}

/** Builds every layer once; the renderer uploads the result and never touches it again. */
export function buildApparatusScene(evidenceCount: number): ApparatusScene {
	const random = mulberry32(20260927);
	const points: number[] = [];
	sampleEvidence(random, evidenceCount, points);
	const notes = noteAnchors();
	for (const note of notes) push(points, note.position, ANNOTATION, 1, random());

	const lines: number[] = [];
	traceReconstruction(lines);
	traceCapture(lines);
	traceFrame(lines);

	return {
		points: new Float32Array(points),
		pointCount: points.length / STRIDE,
		lines: new Float32Array(lines),
		lineCount: lines.length / STRIDE,
		notes
	};
}
