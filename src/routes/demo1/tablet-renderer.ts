import {
	HEIGHT_MAX,
	HEIGHT_MIN,
	PLATE_HEIGHT,
	PLATE_WIDTH,
	sampleHeight,
	type TabletMap,
	type TabletMesh
} from './tablet-surface';

/** How the surface is shaded; the order matches the fragment shader. */
export const RENDER_MODES = ['stone', 'specular', 'normals', 'height', 'mesh'] as const;
export type RenderMode = (typeof RENDER_MODES)[number];

/** Everything the shaders need for one frame. The caller reuses a single object. */
export interface TabletFrame {
	/** Turn of the plate about its vertical axis and lean away from the viewer, in radians. */
	yaw: number;
	tilt: number;
	/** 1 fits the whole plate; larger values move the camera closer. */
	zoom: number;
	/** Point of the plate held at the middle of the view, in plate units from its centre. */
	panX: number;
	panY: number;
	/** Lamp direction around the plate and height above it, in radians. */
	azimuth: number;
	elevation: number;
	mode: RenderMode;
	contour: number;
	grid: number;
	/** Highlighted region in texture coordinates with its radius in plate units. */
	focusU: number;
	focusV: number;
	focusRadius: number;
	/** 0 shows the whole plate evenly; 1 dims everything outside the highlighted region. */
	focus: number;
}

export interface TabletOptions {
	/** Samples per cast-shadow ray; fewer on small or slow devices. */
	shadowSteps: number;
}

export interface ScreenPoint {
	x: number;
	y: number;
	/** False when the point falls outside the canvas or faces away from the camera. */
	visible: boolean;
}

const VERTEX_SHADER = `
precision highp float;

attribute vec2 aUv;
attribute float aRelief;

uniform mat4 uProjection;
uniform mat3 uRotation;
uniform float uDistance;
uniform vec2 uCenter;
uniform vec2 uPlate;

varying vec2 vUv;
varying float vHeight;
varying vec3 vView;

void main() {
	vec3 local = vec3((aUv - 0.5) * uPlate, aRelief);
	vec3 world = uRotation * local;
	gl_Position = uProjection * vec4(world.xy - uCenter, world.z - uDistance, 1.0);
	vUv = aUv;
	vHeight = aRelief;
	// Direction to the camera in the plate's own space, where the lamp is defined too.
	vView = (vec3(uCenter, uDistance) - world) * uRotation;
}
`;

const FRAGMENT_SHADER = `
#ifdef DERIVATIVES
#extension GL_OES_standard_derivatives : enable
#endif
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform sampler2D uMap;
uniform vec2 uPlate;
uniform vec3 uLight;
uniform float uMode;
uniform float uContour;
uniform float uGrid;
uniform vec2 uMesh;
uniform vec3 uFocus;
uniform float uFocusStrength;

varying vec2 vUv;
varying float vHeight;
varying vec3 vView;

const vec3 STONE = vec3(0.91, 0.87, 0.8);
const vec3 CLAY = vec3(0.78, 0.78, 0.76);
const vec3 INK = vec3(0.08, 0.08, 0.075);
const vec3 LAMP = vec3(1.0, 0.93, 0.82);
const vec3 FILL = vec3(0.16, 0.22, 0.19);
const vec3 FOREST = vec3(0.16, 0.24, 0.19);
const vec3 PAPER = vec3(0.957, 0.945, 0.922);
const vec3 ACCENT = vec3(0.89, 0.37, 0.24);

float heightAt(vec2 uv) {
	return mix(HMIN, HMAX, (texture2D(uMap, uv).b * 255.0 - 1.0) / 254.0);
}

// Width of one pixel in the units of coord, for anti-aliased lines.
float pixel(float coord) {
#ifdef DERIVATIVES
	return max(fwidth(coord), 1e-4);
#else
	return 0.03;
#endif
}

float cell(float coord) {
	return abs(fract(coord + 0.5) - 0.5);
}

// A line along every whole number of coord, halfWidth wide on each side plus a soft pixel edge.
float line(float coord, float halfWidth) {
	return 1.0 - smoothstep(halfWidth, halfWidth + pixel(coord) * 1.5, cell(coord));
}

void main() {
	vec4 map = texture2D(uMap, vUv);
	// Stone that is missing is not drawn: the break stays a break.
	if (map.b < 0.6 / 255.0) discard;

	vec2 nxy = map.rg * 2.0 - 1.0;
	vec3 n = normalize(vec3(nxy, sqrt(max(1.0 - dot(nxy, nxy), 0.0))));
	float h = heightAt(vUv);
	float cavity = map.a;
	vec3 L = normalize(uLight);
	float diffuse = max(dot(n, L), 0.0);

	// March towards the lamp through the height map; low light throws long shadows.
	float shadow = 1.0;
	float run = length(L.xy);
	if (run > 0.05) {
		vec2 stepUv = L.xy / run * SHADOW_STEP / uPlate;
		float rise = L.z / run;
		float blocked = 0.0;
		for (int i = 1; i <= SHADOW_STEPS; i++) {
			float t = float(i);
			float above = heightAt(vUv + stepUv * t) - h - t * SHADOW_STEP * rise;
			blocked = max(blocked, above * 70.0);
		}
		shadow = 1.0 - clamp(blocked, 0.0, 1.0) * 0.82;
	}

	vec3 halfway = normalize(L + normalize(vView));
	float facing = max(dot(n, halfway), 0.0);
	float tone = clamp((h - HMIN) / (HMAX - HMIN), 0.0, 1.0);
	vec3 ambient = FILL * (0.7 + 0.5 * n.z) + 0.1;
	vec3 color;

	if (uMode < 0.5) {
		// Stone: lit albedo with dirt in the cuts.
		vec3 albedo = STONE * (0.93 + 0.1 * tone) * (1.0 - cavity * 0.4);
		vec3 gloss = LAMP * pow(facing, 28.0) * 0.16 * shadow;
		color = albedo * (ambient + LAMP * diffuse * shadow * 1.05) + gloss;
	} else if (uMode < 1.5) {
		// Specular enhancement: colour removed, a hard glossy highlight exaggerates slope changes.
		float gloss = pow(facing, 60.0) * 1.1;
		color = CLAY * (0.18 + diffuse * 0.55 * shadow) + vec3(gloss * shadow);
	} else if (uMode < 2.5) {
		// Surface normals as colour: direction, independent of any lamp.
		color = n * 0.5 + 0.5;
	} else if (uMode < 3.5) {
		// Height: low surfaces forest, high surfaces paper, lightly shaded to keep the form legible.
		vec3 ramp = mix(FOREST, PAPER, smoothstep(0.0, 0.62, tone));
		ramp = mix(ramp, ACCENT, smoothstep(0.62, 1.0, tone));
		color = ramp * (0.72 + 0.34 * diffuse);
	} else {
		// Mesh: clay shading with the grid the geometry is built on.
		color = CLAY * (ambient + LAMP * diffuse * shadow);
		float mesh = max(line(vUv.x * uMesh.x, 0.0), line(vUv.y * uMesh.y, 0.0));
		color = mix(color, FOREST, mesh * 0.55);
	}

	if (uContour > 0.001) {
		float contour = line(vHeight / 0.008 + 0.5, 0.0);
		color = mix(color, ACCENT, contour * uContour * 0.75);
	}

	// Record view: a 10 cm-style reference grid in plate units and a ruled frame.
	if (uGrid > 0.001) {
		vec2 q = vUv * uPlate / 0.1;
		float grid = max(line(q.x, 0.0), line(q.y, 0.0));
		color = mix(color, INK, grid * uGrid * 0.28);
		vec2 margin = min(vUv, 1.0 - vUv) * uPlate;
		float frame = 1.0 - smoothstep(0.004, 0.008, abs(min(margin.x, margin.y) - 0.018));
		color = mix(color, ACCENT, frame * uGrid);
	}

	// The region an annotation or chapter concerns stays lit; the rest steps back.
	if (uFocusStrength > 0.001) {
		float r = length((vUv - uFocus.xy) * uPlate);
		float inside = 1.0 - smoothstep(uFocus.z, uFocus.z * 1.25 + 0.01, r);
		float ring = 1.0 - smoothstep(0.002, 0.006, abs(r - uFocus.z * 1.1 - 0.004));
		color *= mix(1.0, 0.42 + 0.58 * inside, uFocusStrength);
		color = mix(color, ACCENT, ring * uFocusStrength * 0.85);
	}

	gl_FragColor = vec4(color, 1.0);
}
`;

const UNIFORMS = [
	'uProjection',
	'uRotation',
	'uDistance',
	'uCenter',
	'uPlate',
	'uMap',
	'uLight',
	'uMode',
	'uContour',
	'uGrid',
	'uMesh',
	'uFocus',
	'uFocusStrength'
] as const;

type Uniforms = Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;

const FIELD_OF_VIEW = (28 * Math.PI) / 180;
const FOCAL = 1 / Math.tan(FIELD_OF_VIEW / 2);
/** Room around the plate for its tilt and the raised relief. */
const FRAME_MARGIN = 1.1;
/** How far a cast-shadow ray travels across the plate, in model units. */
const SHADOW_REACH = 0.18;

const glslFloat = (value: number) => value.toFixed(5);

function compile(gl: WebGLRenderingContext, type: number, source: string) {
	const shader = gl.createShader(type);
	if (!shader) throw new Error('Shader could not be created.');
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const log = gl.getShaderInfoLog(shader);
		gl.deleteShader(shader);
		throw new Error(log ?? 'Shader failed to compile.');
	}
	return shader;
}

/** Rotation that leans the plate back by `tilt`, then turns it by `yaw`; stored column by column. */
function rotationOf(yaw: number, tilt: number, out: Float32Array) {
	const cy = Math.cos(yaw);
	const sy = Math.sin(yaw);
	const ct = Math.cos(tilt);
	const st = Math.sin(tilt);
	out[0] = cy;
	out[1] = 0;
	out[2] = -sy;
	out[3] = -sy * st;
	out[4] = ct;
	out[5] = -cy * st;
	out[6] = sy * ct;
	out[7] = st;
	out[8] = cy * ct;
	return out;
}

/**
 * One indexed draw of a lit height-field plate on a WebGL 1 canvas, with a camera the reader can
 * turn, zoom and pan. Geometry and the relief map are uploaded once; each frame only sets uniforms.
 * The same camera maps plate positions to the screen and back for pins and measurements.
 */
export class TabletRenderer {
	private readonly canvas: HTMLCanvasElement;
	private readonly gl: WebGLRenderingContext;
	private readonly map: TabletMap;
	private readonly shaders: WebGLShader[] = [];
	private readonly buffers: WebGLBuffer[] = [];
	private readonly program: WebGLProgram;
	private readonly texture: WebGLTexture;
	private readonly uniforms: Uniforms;
	private readonly indexCount: number;
	private readonly projection = new Float32Array(16);
	private readonly rotation = new Float32Array(9);
	private baseDistance = 5;
	private width = 1;
	private height = 1;
	private aspect = 1;

	private constructor(
		canvas: HTMLCanvasElement,
		gl: WebGLRenderingContext,
		mesh: TabletMesh,
		map: TabletMap,
		{ shadowSteps }: TabletOptions
	) {
		this.canvas = canvas;
		this.gl = gl;
		this.map = map;
		this.indexCount = mesh.indices.length;

		const derivatives = !!gl.getExtension('OES_standard_derivatives');
		const defines = [
			`#define SHADOW_STEPS ${Math.max(1, Math.round(shadowSteps))}`,
			`#define SHADOW_STEP ${glslFloat(SHADOW_REACH / Math.max(1, shadowSteps))}`,
			`#define HMIN ${glslFloat(HEIGHT_MIN)}`,
			`#define HMAX ${glslFloat(HEIGHT_MAX)}`,
			derivatives ? '#define DERIVATIVES' : '',
			''
		].join('\n');
		this.shaders.push(
			compile(gl, gl.VERTEX_SHADER, defines + VERTEX_SHADER),
			compile(gl, gl.FRAGMENT_SHADER, defines + FRAGMENT_SHADER)
		);
		const program = gl.createProgram();
		if (!program) throw new Error('Program could not be created.');
		this.program = program;
		for (const shader of this.shaders) gl.attachShader(program, shader);
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			throw new Error(gl.getProgramInfoLog(program) ?? 'Program failed to link.');
		}
		gl.useProgram(program);

		this.attach('aUv', mesh.uv, 2);
		this.attach('aRelief', mesh.relief, 1);
		const indexBuffer = gl.createBuffer();
		if (!indexBuffer) throw new Error('Buffer could not be created.');
		this.buffers.push(indexBuffer);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

		const texture = gl.createTexture();
		if (!texture) throw new Error('Texture could not be created.');
		this.texture = texture;
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RGBA,
			map.width,
			map.height,
			0,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			map.pixels
		);
		// The map is not a power of two, so it is sampled without mipmaps.
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

		this.uniforms = Object.fromEntries(
			UNIFORMS.map((name) => [name, gl.getUniformLocation(program, name)])
		) as Uniforms;
		gl.uniform1i(this.uniforms.uMap, 0);
		gl.uniform2f(this.uniforms.uPlate, PLATE_WIDTH, PLATE_HEIGHT);
		gl.uniform2f(this.uniforms.uMesh, mesh.columns, mesh.rows);

		gl.enable(gl.DEPTH_TEST);
		gl.disable(gl.BLEND);
		gl.clearColor(0, 0, 0, 0);
	}

	/** Returns null when WebGL is unavailable or the shaders fail, so callers can fall back. */
	static create(
		canvas: HTMLCanvasElement,
		mesh: TabletMesh,
		map: TabletMap,
		options: TabletOptions
	): TabletRenderer | null {
		let gl: WebGLRenderingContext | null = null;
		try {
			gl = canvas.getContext('webgl', { alpha: true, antialias: true, depth: true });
			return gl ? new TabletRenderer(canvas, gl, mesh, map, options) : null;
		} catch {
			gl?.getExtension('WEBGL_lose_context')?.loseContext();
			return null;
		}
	}

	private attach(name: string, data: Float32Array, size: number) {
		const { gl } = this;
		const buffer = gl.createBuffer();
		if (!buffer) throw new Error('Buffer could not be created.');
		this.buffers.push(buffer);
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
		const location = gl.getAttribLocation(this.program, name);
		if (location < 0) return;
		gl.enableVertexAttribArray(location);
		gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
	}

	/** Sizes the drawing buffer and finds the camera distance at which the whole plate fits. */
	resize(width: number, height: number, pixelRatio: number) {
		const { canvas, gl, projection } = this;
		this.width = Math.max(1, width);
		this.height = Math.max(1, height);
		canvas.width = Math.max(1, Math.round(width * pixelRatio));
		canvas.height = Math.max(1, Math.round(height * pixelRatio));
		gl.viewport(0, 0, canvas.width, canvas.height);

		this.aspect = this.width / this.height;
		this.baseDistance =
			Math.max(
				(PLATE_HEIGHT / 2) * FRAME_MARGIN * FOCAL,
				((PLATE_WIDTH / 2) * FRAME_MARGIN * FOCAL) / this.aspect
			) + 0.2;

		const near = 0.05;
		const far = this.baseDistance + 4;
		projection.fill(0);
		projection[0] = FOCAL / this.aspect;
		projection[5] = FOCAL;
		projection[10] = (far + near) / (near - far);
		projection[11] = -1;
		projection[14] = (2 * far * near) / (near - far);
	}

	private distanceFor(frame: TabletFrame) {
		return this.baseDistance / Math.max(0.5, frame.zoom);
	}

	/** World-space point the camera looks at: the pan point on the rotated plate. */
	private centerFor(frame: TabletFrame, rotation: Float32Array) {
		return [
			rotation[0] * frame.panX + rotation[3] * frame.panY,
			rotation[1] * frame.panX + rotation[4] * frame.panY
		] as const;
	}

	render(frame: TabletFrame) {
		const { gl, uniforms, rotation } = this;
		rotationOf(frame.yaw, frame.tilt, rotation);
		const [cx, cy] = this.centerFor(frame, rotation);

		const ce = Math.cos(frame.elevation);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		gl.uniformMatrix4fv(uniforms.uProjection, false, this.projection);
		gl.uniformMatrix3fv(uniforms.uRotation, false, rotation);
		gl.uniform1f(uniforms.uDistance, this.distanceFor(frame));
		gl.uniform2f(uniforms.uCenter, cx, cy);
		gl.uniform3f(
			uniforms.uLight,
			ce * Math.cos(frame.azimuth),
			ce * Math.sin(frame.azimuth),
			Math.sin(frame.elevation)
		);
		gl.uniform1f(uniforms.uMode, RENDER_MODES.indexOf(frame.mode));
		gl.uniform1f(uniforms.uContour, frame.contour);
		gl.uniform1f(uniforms.uGrid, frame.grid);
		gl.uniform3f(uniforms.uFocus, frame.focusU, frame.focusV, frame.focusRadius);
		gl.uniform1f(uniforms.uFocusStrength, frame.focus);
		gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
	}

	/** Plate units covered by one CSS pixel at the depth of the view centre. */
	unitsPerPixel(frame: TabletFrame) {
		return (2 * this.distanceFor(frame)) / FOCAL / this.height;
	}

	/** Where a plate position lands on the canvas, in CSS pixels. */
	project(frame: TabletFrame, u: number, v: number): ScreenPoint {
		const r = rotationOf(frame.yaw, frame.tilt, this.rotation);
		const [cx, cy] = this.centerFor(frame, r);
		const h = sampleHeight(this.map, u, v);
		const lx = (u - 0.5) * PLATE_WIDTH;
		const ly = (v - 0.5) * PLATE_HEIGHT;
		const lz = Number.isNaN(h) ? 0 : h;
		const wx = r[0] * lx + r[3] * ly + r[6] * lz - cx;
		const wy = r[1] * lx + r[4] * ly + r[7] * lz - cy;
		const wz = r[2] * lx + r[5] * ly + r[8] * lz - this.distanceFor(frame);
		const w = -wz;
		if (w <= 0.01) return { x: 0, y: 0, visible: false };
		const x = (((FOCAL / this.aspect) * wx) / w + 1) * 0.5 * this.width;
		const y = (1 - (FOCAL * wy) / w) * 0.5 * this.height;
		// The plate normal must face the camera for its front to be seen.
		const facing = r[8] > 0.05;
		const inside = x >= 0 && x <= this.width && y >= 0 && y <= this.height;
		return { x, y, visible: facing && inside && !Number.isNaN(h) };
	}

	/** The plate position under a canvas point, or null where the ray misses the stone. */
	unproject(frame: TabletFrame, x: number, y: number) {
		const r = rotationOf(frame.yaw, frame.tilt, this.rotation);
		const [cx, cy] = this.centerFor(frame, r);
		const nx = (x / this.width) * 2 - 1;
		const ny = 1 - (y / this.height) * 2;
		// Camera sits at (cx, cy, distance) looking down -z; take the ray into plate space.
		const dx = (nx * this.aspect) / FOCAL;
		const dy = ny / FOCAL;
		const dz = -1;
		const ox = cx;
		const oy = cy;
		const oz = this.distanceFor(frame);
		const lox = r[0] * ox + r[1] * oy + r[2] * oz;
		const loy = r[3] * ox + r[4] * oy + r[5] * oz;
		const loz = r[6] * ox + r[7] * oy + r[8] * oz;
		const ldx = r[0] * dx + r[1] * dy + r[2] * dz;
		const ldy = r[3] * dx + r[4] * dy + r[5] * dz;
		const ldz = r[6] * dx + r[7] * dy + r[8] * dz;
		if (Math.abs(ldz) < 1e-6) return null;
		// Meet the plane at the surface height, refining a few times as the height changes.
		let target = 0;
		let u = 0;
		let v = 0;
		for (let i = 0; i < 4; i++) {
			const t = (target - loz) / ldz;
			if (t <= 0) return null;
			u = (lox + ldx * t) / PLATE_WIDTH + 0.5;
			v = (loy + ldy * t) / PLATE_HEIGHT + 0.5;
			const h = sampleHeight(this.map, u, v);
			if (Number.isNaN(h)) return null;
			target = h;
		}
		return { u, v, h: target };
	}

	/** Frees GPU memory and hands the context back to the browser. */
	dispose() {
		const { gl } = this;
		for (const buffer of this.buffers) gl.deleteBuffer(buffer);
		for (const shader of this.shaders) gl.deleteShader(shader);
		gl.deleteTexture(this.texture);
		gl.deleteProgram(this.program);
		gl.getExtension('WEBGL_lose_context')?.loseContext();
	}
}
