import {
	HEIGHT_MAX,
	HEIGHT_MIN,
	PLATE_HEIGHT,
	PLATE_WIDTH,
	type ReliefMap,
	type ReliefMesh
} from './relief-surface';

/** Everything the shaders need for one frame. The caller reuses a single object. */
export interface ReliefFrame {
	/** 0 is the flat printed page, 1 the carved relief. */
	raise: number;
	/** Strength of the engraved plate drawn on the flat page. */
	print: number;
	/** Strength of the capture sweep and its mesh lines. */
	scan: number;
	/** Height of the capture sweep, in texture coordinates. */
	scanAt: number;
	contour: number;
	marks: number;
	/** Index of the highlighted mark, or -1. */
	markFocus: number;
	grid: number;
	/** Lean of the plate away from the viewer, in radians. */
	tilt: number;
	yaw: number;
	/** Lamp direction around the plate and height above it, in radians. */
	azimuth: number;
	elevation: number;
	time: number;
}

export interface ReliefOptions {
	/** Samples per cast-shadow ray; fewer on small or slow devices. */
	shadowSteps: number;
	/** Up to four annotation marks, in texture coordinates. */
	marks: readonly { u: number; v: number }[];
}

const VERTEX_SHADER = `
precision highp float;

attribute vec2 aUv;
attribute float aPage;
attribute vec3 aPageNormal;
attribute float aRelief;

uniform mat4 uProjection;
uniform mat3 uRotation;
uniform float uDistance;
uniform vec2 uPlate;
uniform float uRaise;

varying vec2 vUv;
varying float vRaise;
varying float vHeight;
varying vec3 vPageNormal;
varying vec3 vView;

void main() {
	// The relief rises from the top of the page down, as if a sweep were recording it.
	float r = clamp(uRaise * 1.6 - (1.0 - aUv.y) * 0.6, 0.0, 1.0);
	r = r * r * (3.0 - 2.0 * r);
	vec3 local = vec3((aUv - 0.5) * uPlate, mix(aPage, aRelief, r));
	vec3 world = uRotation * local;
	gl_Position = uProjection * vec4(world.xy, world.z - uDistance, 1.0);

	vUv = aUv;
	vRaise = r;
	vHeight = aRelief * r;
	vPageNormal = aPageNormal;
	// Direction to the camera in the plate's own space, where the lamp is defined too.
	vView = (vec3(0.0, 0.0, uDistance) - world) * uRotation;
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
uniform float uPrint;
uniform float uScan;
uniform float uScanAt;
uniform float uContour;
uniform float uMarks;
uniform float uMarkFocus;
uniform vec2 uMarksAt[4];
uniform float uGrid;
uniform float uTime;

varying vec2 vUv;
varying float vRaise;
varying float vHeight;
varying vec3 vPageNormal;
varying vec3 vView;

const vec3 STONE = vec3(0.91, 0.87, 0.8);
const vec3 PAPER = vec3(0.957, 0.945, 0.922);
const vec3 INK = vec3(0.08, 0.08, 0.075);
const vec3 LAMP = vec3(1.0, 0.93, 0.82);
const vec3 FILL = vec3(0.16, 0.22, 0.19);
const vec3 ACCENT = vec3(0.89, 0.37, 0.24);
const vec3 SCAN_LIGHT = vec3(1.0, 0.97, 0.9);
// The printed plate is always drawn as if lit from the upper left.
const vec3 PRINT_LIGHT = vec3(-0.5, 0.56, 0.66);

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

// Distance from coord to the nearest whole number.
float cell(float coord) {
	return abs(fract(coord + 0.5) - 0.5);
}

// A line along every whole number of coord, halfWidth wide on each side plus a soft pixel edge.
float line(float coord, float halfWidth) {
	return 1.0 - smoothstep(halfWidth, halfWidth + pixel(coord) * 1.5, cell(coord));
}

void main() {
	vec4 map = texture2D(uMap, vUv);
	float raise = vRaise;

	// Stone that is missing dissolves as the relief rises; the page itself stays whole.
	float missing = 1.0 - smoothstep(0.3 / 255.0, 0.8 / 255.0, map.b);
	float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
	if (missing * raise > 0.02 + grain * 0.96) discard;

	vec2 nxy = map.rg * 2.0 - 1.0;
	vec3 carved = vec3(nxy, sqrt(max(1.0 - dot(nxy, nxy), 0.0)));
	vec3 pageNormal = normalize(vPageNormal);
	vec3 n = normalize(mix(pageNormal, carved, raise));
	float h = heightAt(vUv);
	float cavity = map.a * raise;

	vec3 L = normalize(uLight);
	float diffuse = max(dot(n, L), 0.0);

	// March towards the lamp through the height map; low light throws long shadows.
	float shadow = 1.0;
	float run = length(L.xy);
	if (raise > 0.02 && run > 0.05) {
		vec2 stepUv = L.xy / run * SHADOW_STEP / uPlate;
		float rise = L.z / run;
		float blocked = 0.0;
		for (int i = 1; i <= SHADOW_STEPS; i++) {
			float t = float(i);
			float above = (heightAt(vUv + stepUv * t) - h) * raise - t * SHADOW_STEP * rise;
			blocked = max(blocked, above * 70.0);
		}
		shadow = 1.0 - clamp(blocked, 0.0, 1.0) * 0.82;
	}

	vec3 halfway = normalize(L + normalize(vView));
	float specular = pow(max(dot(n, halfway), 0.0), 28.0) * 0.16 * raise;
	float tone = clamp((h - HMIN) / (HMAX - HMIN), 0.0, 1.0);
	vec3 albedo = mix(PAPER, STONE * (0.93 + 0.1 * tone), raise) * (1.0 - cavity * 0.4);
	vec3 ambient = FILL * (0.7 + 0.5 * n.z) + 0.1;
	vec3 color = albedo * (ambient + LAMP * diffuse * shadow * 1.05) + LAMP * specular * shadow;

	// The flat page carries the tablet as an engraving: one view, one fixed light.
	if (uPrint > 0.001) {
		vec3 printLight = normalize(PRINT_LIGHT);
		float darkness = (printLight.z - dot(carved, printLight)) * 2.4 + map.a * 0.9;
		darkness = clamp(darkness, 0.0, 1.0) * (1.0 - missing);
		vec2 p = vUv * uPlate * 95.0;
		float ink = line(p.x + p.y, darkness * 0.42) * smoothstep(0.02, 0.08, darkness);
		ink = max(ink, line(p.x - p.y, (darkness - 0.5) * 0.5) * step(0.5, darkness));
		vec2 margin = min(vUv, 1.0 - vUv) * uPlate;
		float rule = abs(min(margin.x, margin.y) - 0.03);
		ink = max(ink, 1.0 - smoothstep(0.0015, 0.003, rule));
		vec3 printed = mix(PAPER, INK, ink * 0.88) * (0.82 + 0.28 * max(dot(pageNormal, L), 0.0));
		color = mix(color, printed, uPrint * (1.0 - raise));
	}

	// Capture: a band of light sweeps down and leaves the surface recorded as a mesh behind it.
	if (uScan > 0.001) {
		float offset = (vUv.y - uScanAt) * 30.0;
		float band = exp(-offset * offset) * uScan * raise;
		float recorded = smoothstep(uScanAt - 0.01, uScanAt + 0.03, vUv.y);
		float mesh = max(line(vUv.x * 44.0, 0.0), line(vUv.y * 58.0, 0.0));
		float meshStrength = uScan * raise * (0.06 + 0.12 * recorded + band * 0.7);
		color = mix(color, SCAN_LIGHT, mesh * meshStrength);
		color += ACCENT * band * 0.35;
	}

	// Evidence: contour lines of the carved form, and rings where annotations attach.
	if (uContour > 0.001) {
		float contour = line(vHeight / 0.008 + 0.5, 0.0);
		color = mix(color, ACCENT, contour * uContour * 0.75 * (1.0 - missing));
	}
	if (uMarks > 0.001) {
		float marks = 0.0;
		for (int i = 0; i < 4; i++) {
			float r = length((vUv - uMarksAt[i]) * uPlate);
			float focus = 1.0 - min(abs(float(i) - uMarkFocus), 1.0);
			float radius = 0.05 + 0.025 * focus + 0.005 * sin(uTime * 2.2 + float(i) * 1.7);
			float ring = 1.0 - smoothstep(0.003, 0.007, abs(r - radius));
			float core = 1.0 - smoothstep(0.009, 0.014, r);
			marks = max(marks, max(ring, core) * (0.6 + 0.4 * focus));
		}
		color = mix(color, ACCENT, marks * uMarks);
	}

	// Record: a reference grid and a ruled frame, the way a catalogue photograph is set up.
	if (uGrid > 0.001) {
		vec2 q = vUv * uPlate / 0.1;
		float grid = max(line(q.x, 0.0), line(q.y, 0.0));
		color = mix(color, INK, grid * uGrid * 0.28);
		vec2 margin = min(vUv, 1.0 - vUv) * uPlate;
		float frame = 1.0 - smoothstep(0.004, 0.008, abs(min(margin.x, margin.y) - 0.018));
		color = mix(color, ACCENT, frame * uGrid);
	}

	gl_FragColor = vec4(color, 1.0);
}
`;

const UNIFORMS = [
	'uProjection',
	'uRotation',
	'uDistance',
	'uPlate',
	'uRaise',
	'uMap',
	'uLight',
	'uPrint',
	'uScan',
	'uScanAt',
	'uContour',
	'uMarks',
	'uMarkFocus',
	'uMarksAt',
	'uGrid',
	'uTime'
] as const;

type Uniforms = Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;

const FIELD_OF_VIEW = (28 * Math.PI) / 180;
/** Room around the plate for its tilt and the raised relief. */
const FRAME_MARGIN = 1.14;
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

/**
 * One indexed draw of a lit height-field plate on a WebGL 1 canvas. Geometry and the relief map are
 * uploaded once; each frame only sets uniforms.
 */
export class ReliefRenderer {
	private readonly canvas: HTMLCanvasElement;
	private readonly gl: WebGLRenderingContext;
	private readonly shaders: WebGLShader[] = [];
	private readonly buffers: WebGLBuffer[] = [];
	private readonly program: WebGLProgram;
	private readonly texture: WebGLTexture;
	private readonly uniforms: Uniforms;
	private readonly indexCount: number;
	private readonly projection = new Float32Array(16);
	private readonly rotation = new Float32Array(9);
	private distance = 5;

	private constructor(
		canvas: HTMLCanvasElement,
		gl: WebGLRenderingContext,
		mesh: ReliefMesh,
		map: ReliefMap,
		{ shadowSteps, marks }: ReliefOptions
	) {
		this.canvas = canvas;
		this.gl = gl;
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
		this.attach('aPage', mesh.page, 1);
		this.attach('aPageNormal', mesh.pageNormal, 3);
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
		const markPositions = new Float32Array(8).fill(-9);
		marks.slice(0, 4).forEach((mark, i) => markPositions.set([mark.u, mark.v], i * 2));
		gl.uniform2fv(this.uniforms.uMarksAt, markPositions);

		gl.enable(gl.DEPTH_TEST);
		gl.disable(gl.BLEND);
		gl.clearColor(0, 0, 0, 0);
	}

	/** Returns null when WebGL is unavailable or the shaders fail, so callers can fall back. */
	static create(
		canvas: HTMLCanvasElement,
		mesh: ReliefMesh,
		map: ReliefMap,
		options: ReliefOptions
	): ReliefRenderer | null {
		let gl: WebGLRenderingContext | null = null;
		try {
			gl = canvas.getContext('webgl', { alpha: true, antialias: true, depth: true });
			return gl ? new ReliefRenderer(canvas, gl, mesh, map, options) : null;
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

	/** Sizes the drawing buffer and moves the camera back until the whole plate fits. */
	resize(width: number, height: number, pixelRatio: number) {
		const { canvas, gl, projection } = this;
		canvas.width = Math.max(1, Math.round(width * pixelRatio));
		canvas.height = Math.max(1, Math.round(height * pixelRatio));
		gl.viewport(0, 0, canvas.width, canvas.height);

		const aspect = width / Math.max(1, height);
		const focal = 1 / Math.tan(FIELD_OF_VIEW / 2);
		this.distance =
			Math.max(
				(PLATE_HEIGHT / 2) * FRAME_MARGIN * focal,
				((PLATE_WIDTH / 2) * FRAME_MARGIN * focal) / aspect
			) + 0.2;

		const near = 0.1;
		const far = this.distance + 4;
		projection.fill(0);
		projection[0] = focal / aspect;
		projection[5] = focal;
		projection[10] = (far + near) / (near - far);
		projection[11] = -1;
		projection[14] = (2 * far * near) / (near - far);
	}

	render(frame: ReliefFrame) {
		const { gl, uniforms, rotation } = this;
		// Lean the plate back by `tilt`, then turn it by `yaw`; stored column by column.
		const cy = Math.cos(frame.yaw);
		const sy = Math.sin(frame.yaw);
		const ct = Math.cos(frame.tilt);
		const st = Math.sin(frame.tilt);
		rotation[0] = cy;
		rotation[1] = 0;
		rotation[2] = -sy;
		rotation[3] = -sy * st;
		rotation[4] = ct;
		rotation[5] = -cy * st;
		rotation[6] = sy * ct;
		rotation[7] = st;
		rotation[8] = cy * ct;

		const ce = Math.cos(frame.elevation);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		gl.uniformMatrix4fv(uniforms.uProjection, false, this.projection);
		gl.uniformMatrix3fv(uniforms.uRotation, false, rotation);
		gl.uniform1f(uniforms.uDistance, this.distance);
		gl.uniform1f(uniforms.uRaise, frame.raise);
		gl.uniform3f(
			uniforms.uLight,
			ce * Math.cos(frame.azimuth),
			ce * Math.sin(frame.azimuth),
			Math.sin(frame.elevation)
		);
		gl.uniform1f(uniforms.uPrint, frame.print);
		gl.uniform1f(uniforms.uScan, frame.scan);
		gl.uniform1f(uniforms.uScanAt, frame.scanAt);
		gl.uniform1f(uniforms.uContour, frame.contour);
		gl.uniform1f(uniforms.uMarks, frame.marks);
		gl.uniform1f(uniforms.uMarkFocus, frame.markFocus);
		gl.uniform1f(uniforms.uGrid, frame.grid);
		gl.uniform1f(uniforms.uTime, frame.time);
		gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
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
