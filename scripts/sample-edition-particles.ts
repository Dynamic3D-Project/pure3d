/**
 * Deterministically samples a Voyager GLB into the compact point format used by the home artwork.
 *
 * Usage:
 *   bun scripts/sample-edition-particles.ts INPUT.glb SCENE.svx.json OUTPUT.bin \
 *     [--include-node REGEXP] [--yaw DEGREES]
 */

const SAMPLE_COUNT = 18_000;
const SEED = 20260930;
const TARGET_HEIGHT = 1.85;
const TARGET_BOTTOM = -0.96;
const TARGET_HORIZONTAL_SPAN = 1.9;
/** Turns the source's front axis towards the artwork's existing resting camera. */
const DEFAULT_DISPLAY_YAW = 90;

type Vec3 = [number, number, number];
type Quaternion = [number, number, number, number];
type Matrix = number[];

interface Accessor {
	bufferView?: number;
	byteOffset?: number;
	componentType: number;
	count: number;
	type: string;
}

interface Gltf {
	accessors: Accessor[];
	bufferViews: Array<{
		buffer: number;
		byteOffset?: number;
		byteLength: number;
		byteStride?: number;
	}>;
	buffers: Array<{ byteLength: number; uri?: string }>;
	meshes: Array<{
		primitives: Array<{
			attributes: Record<string, number>;
			indices?: number;
			mode?: number;
			extensions?: Record<string, unknown>;
		}>;
	}>;
	nodes: Array<{
		mesh?: number;
		children?: number[];
		matrix?: number[];
		translation?: Vec3;
		rotation?: Quaternion;
		scale?: Vec3;
	}>;
	scenes: Array<{ nodes?: number[] }>;
	scene?: number;
	extensionsRequired?: string[];
}

const [inputPath, scenePath, outputPath, ...rawOptions] = Bun.argv.slice(2);
if (!inputPath || !scenePath || !outputPath) {
	throw new Error(
		'Expected INPUT.glb SCENE.svx.json OUTPUT.bin [--include-node REGEXP] [--yaw DEGREES]'
	);
}

function option(name: string) {
	const index = rawOptions.indexOf(name);
	if (index < 0) return undefined;
	const value = rawOptions[index + 1];
	if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
	return value;
}

const includeNode = option('--include-node');
const includeNodePattern = includeNode ? new RegExp(includeNode) : undefined;
const displayYawDegrees = Number(option('--yaw') ?? DEFAULT_DISPLAY_YAW);
if (!Number.isFinite(displayYawDegrees)) throw new Error('--yaw must be finite.');
const displayYaw = (displayYawDegrees * Math.PI) / 180;

function multiply(a: Matrix, b: Matrix): Matrix {
	const out = new Array<number>(16).fill(0);
	for (let column = 0; column < 4; column++) {
		for (let row = 0; row < 4; row++) {
			for (let k = 0; k < 4; k++) out[column * 4 + row] += a[k * 4 + row] * b[column * 4 + k];
		}
	}
	return out;
}

function compose(
	translation: Vec3 = [0, 0, 0],
	rotation: Quaternion = [0, 0, 0, 1],
	scale: Vec3 = [1, 1, 1]
): Matrix {
	const [x, y, z, w] = rotation;
	const [sx, sy, sz] = scale;
	return [
		(1 - 2 * (y * y + z * z)) * sx,
		2 * (x * y + z * w) * sx,
		2 * (x * z - y * w) * sx,
		0,
		2 * (x * y - z * w) * sy,
		(1 - 2 * (x * x + z * z)) * sy,
		2 * (y * z + x * w) * sy,
		0,
		2 * (x * z + y * w) * sz,
		2 * (y * z - x * w) * sz,
		(1 - 2 * (x * x + y * y)) * sz,
		0,
		translation[0],
		translation[1],
		translation[2],
		1
	];
}

function transform(matrix: Matrix, point: Vec3): Vec3 {
	return [
		matrix[0] * point[0] + matrix[4] * point[1] + matrix[8] * point[2] + matrix[12],
		matrix[1] * point[0] + matrix[5] * point[1] + matrix[9] * point[2] + matrix[13],
		matrix[2] * point[0] + matrix[6] * point[1] + matrix[10] * point[2] + matrix[14]
	];
}

function randomGenerator(seed: number) {
	return () => {
		seed = (seed + 0x6d2b79f5) | 0;
		let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	};
}

const glb = await Bun.file(inputPath).arrayBuffer();
const view = new DataView(glb);
if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2) {
	throw new Error('Input is not a GLB 2.0 file.');
}
const jsonLength = view.getUint32(12, true);
if (view.getUint32(16, true) !== 0x4e4f534a) throw new Error('GLB JSON chunk is missing.');
const gltf = JSON.parse(
	new TextDecoder().decode(new Uint8Array(glb, 20, jsonLength)).replace(/\0+$/, '')
) as Gltf;
const binaryHeader = 20 + jsonLength;
if (view.getUint32(binaryHeader + 4, true) !== 0x004e4942)
	throw new Error('GLB BIN chunk is missing.');
const binaryOffset = binaryHeader + 8;

if (gltf.extensionsRequired?.length) {
	throw new Error(`Unsupported required GLB extensions: ${gltf.extensionsRequired.join(', ')}`);
}
if (gltf.buffers.length !== 1 || gltf.buffers[0].uri) {
	throw new Error('Only a single embedded GLB buffer is supported.');
}

const componentSizes: Record<number, number> = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 };
const componentCounts: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

function readAccessor(index: number): number[][] {
	const accessor = gltf.accessors[index];
	if (accessor.bufferView === undefined)
		throw new Error(`Sparse accessor ${index} is unsupported.`);
	const bufferView = gltf.bufferViews[accessor.bufferView];
	if (bufferView.buffer !== 0) throw new Error(`Accessor ${index} uses an external buffer.`);
	const components = componentCounts[accessor.type];
	const componentSize = componentSizes[accessor.componentType];
	if (!components || !componentSize) throw new Error(`Accessor ${index} has an unsupported type.`);
	const stride = bufferView.byteStride ?? componentSize * components;
	const start = binaryOffset + (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
	const rows: number[][] = [];
	for (let i = 0; i < accessor.count; i++) {
		const row: number[] = [];
		for (let component = 0; component < components; component++) {
			const offset = start + i * stride + component * componentSize;
			if (accessor.componentType === 5121) row.push(view.getUint8(offset));
			else if (accessor.componentType === 5123) row.push(view.getUint16(offset, true));
			else if (accessor.componentType === 5125) row.push(view.getUint32(offset, true));
			else row.push(view.getFloat32(offset, true));
		}
		rows.push(row);
	}
	return rows;
}

const sceneDocument = JSON.parse(await Bun.file(scenePath).text());
if (sceneDocument.models?.length !== 1) {
	throw new Error(
		`Scene contains ${sceneDocument.models?.length ?? 0} models; choose and combine them explicitly before sampling.`
	);
}
const sceneModel = sceneDocument.models[0];
const sceneNodes =
	sceneDocument.nodes?.filter((node: { model?: number }) => node.model === 0) ?? [];
if (sceneNodes.length !== 1) {
	throw new Error(`Expected one scene node for model 0, found ${sceneNodes.length}.`);
}
const sceneNode = sceneNodes[0];
const voyagerTransform = multiply(
	compose(sceneNode.translation, sceneNode.rotation, sceneNode.scale),
	compose(sceneModel.translation, sceneModel.rotation, sceneModel.scale)
);

const triangles: Array<[Vec3, Vec3, Vec3]> = [];
const cumulativeAreas: number[] = [];
let totalArea = 0;
let sampledPrimitives = 0;

function visitNode(index: number, parent: Matrix, ancestors: string[] = []) {
	const node = gltf.nodes[index];
	const path = [...ancestors, node.name ?? `node-${index}`];
	const local = node.matrix ?? compose(node.translation, node.rotation, node.scale);
	const world = multiply(parent, local);
	if (
		node.mesh !== undefined &&
		(!includeNodePattern || path.some((name) => includeNodePattern.test(name)))
	) {
		for (const primitive of gltf.meshes[node.mesh].primitives) {
			if (primitive.extensions && Object.keys(primitive.extensions).length) {
				throw new Error(
					`Unsupported compressed mesh extension: ${Object.keys(primitive.extensions).join(', ')}`
				);
			}
			if ((primitive.mode ?? 4) !== 4 || primitive.indices === undefined) {
				throw new Error('Only indexed TRIANGLES primitives are supported.');
			}
			const positionIndex = primitive.attributes.POSITION;
			if (positionIndex === undefined) throw new Error('Mesh primitive has no POSITION accessor.');
			const positions = readAccessor(positionIndex).map((point) =>
				transform(multiply(voyagerTransform, world), point as Vec3)
			);
			const indices = readAccessor(primitive.indices).flat();
			sampledPrimitives++;
			for (let i = 0; i < indices.length; i += 3) {
				const a = positions[indices[i]];
				const b = positions[indices[i + 1]];
				const c = positions[indices[i + 2]];
				const ab: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
				const ac: Vec3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
				const cross: Vec3 = [
					ab[1] * ac[2] - ab[2] * ac[1],
					ab[2] * ac[0] - ab[0] * ac[2],
					ab[0] * ac[1] - ab[1] * ac[0]
				];
				const area = Math.hypot(...cross) * 0.5;
				if (!Number.isFinite(area) || area <= 1e-12) continue;
				totalArea += area;
				triangles.push([a, b, c]);
				cumulativeAreas.push(totalArea);
			}
		}
	}
	for (const child of node.children ?? []) visitNode(child, world, path);
}

const identity = compose();
for (const node of gltf.scenes[gltf.scene ?? 0].nodes ?? []) visitNode(node, identity);
if (!triangles.length || !Number.isFinite(totalArea)) {
	throw new Error(
		`No finite mesh triangles found${includeNode ? ` for node filter ${includeNode}` : ''}.`
	);
}

function triangleAt(area: number) {
	let low = 0;
	let high = cumulativeAreas.length - 1;
	while (low < high) {
		const middle = (low + high) >>> 1;
		if (area <= cumulativeAreas[middle]) high = middle;
		else low = middle + 1;
	}
	return triangles[low];
}

const random = randomGenerator(SEED);
const sampled: Vec3[] = [];
const min: Vec3 = [Infinity, Infinity, Infinity];
const max: Vec3 = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < SAMPLE_COUNT; i++) {
	const [a, b, c] = triangleAt(random() * totalArea);
	const rootU = Math.sqrt(random());
	const v = random();
	const point: Vec3 = [
		a[0] * (1 - rootU) + b[0] * rootU * (1 - v) + c[0] * rootU * v,
		a[1] * (1 - rootU) + b[1] * rootU * (1 - v) + c[1] * rootU * v,
		a[2] * (1 - rootU) + b[2] * rootU * (1 - v) + c[2] * rootU * v
	];
	for (let axis = 0; axis < 3; axis++) {
		min[axis] = Math.min(min[axis], point[axis]);
		max[axis] = Math.max(max[axis], point[axis]);
	}
	sampled.push(point);
}

let rotatedMinX = Infinity;
let rotatedMaxX = -Infinity;
let rotatedMinZ = Infinity;
let rotatedMaxZ = -Infinity;
for (const point of sampled) {
	const rotatedX = point[0] * Math.cos(displayYaw) + point[2] * Math.sin(displayYaw);
	const rotatedZ = -point[0] * Math.sin(displayYaw) + point[2] * Math.cos(displayYaw);
	rotatedMinX = Math.min(rotatedMinX, rotatedX);
	rotatedMaxX = Math.max(rotatedMaxX, rotatedX);
	rotatedMinZ = Math.min(rotatedMinZ, rotatedZ);
	rotatedMaxZ = Math.max(rotatedMaxZ, rotatedZ);
}
const scale = Math.min(
	TARGET_HEIGHT / (max[1] - min[1]),
	TARGET_HORIZONTAL_SPAN / Math.max(rotatedMaxX - rotatedMinX, rotatedMaxZ - rotatedMinZ)
);
const rotatedCentreX = (rotatedMinX + rotatedMaxX) * 0.5;
const rotatedCentreZ = (rotatedMinZ + rotatedMaxZ) * 0.5;
const output = new ArrayBuffer(12 + SAMPLE_COUNT * 3 * 2);
const outputView = new DataView(output);
for (const [index, character] of [...'P3DP'].entries())
	outputView.setUint8(index, character.charCodeAt(0));
outputView.setUint16(4, 1, true);
outputView.setUint32(8, SAMPLE_COUNT, true);
for (let i = 0; i < sampled.length; i++) {
	const x = sampled[i][0];
	const z = sampled[i][2];
	const normalized = [
		(x * Math.cos(displayYaw) + z * Math.sin(displayYaw)) * scale - rotatedCentreX * scale,
		TARGET_BOTTOM + (sampled[i][1] - min[1]) * scale,
		(-x * Math.sin(displayYaw) + z * Math.cos(displayYaw)) * scale - rotatedCentreZ * scale
	];
	for (let axis = 0; axis < 3; axis++) {
		if (!Number.isFinite(normalized[axis]) || Math.abs(normalized[axis]) > 1) {
			throw new Error(`Normalised point is outside finite int16 range: ${normalized.join(', ')}`);
		}
		outputView.setInt16(12 + (i * 3 + axis) * 2, Math.round(normalized[axis] * 32767), true);
	}
}

await Bun.write(outputPath, output);
console.log(
	JSON.stringify({
		output: outputPath,
		points: SAMPLE_COUNT,
		triangles: triangles.length,
		primitives: sampledPrimitives,
		bytes: output.byteLength,
		sourceBounds: { min, max },
		scale,
		displayYawDegrees,
		includeNode: includeNode ?? null
	})
);
