import type { ParticleCloud } from './particle-forms';
import { POINTER_TRAIL_MIN_SETTLE_SECONDS, POINTER_TRAIL_SAMPLES } from './particle-pointer';

/** Everything the shader needs for one frame. The caller reuses a single object. */
export interface FieldFrame {
	from: number;
	to: number;
	morph: number;
	yaw: number;
	pitch: number;
	/** Pointer position in normalised device coordinates. */
	pointerX: number;
	pointerY: number;
	pointerStrength: number;
	/** Recent brush positions retain their disturbance while the grains settle. */
	pointerTrail: Float32Array;
	burst: number;
	time: number;
	/** Height of the scanning band in model space; far outside the form hides it. */
	scan: number;
}

/** Where the form sits on the canvas, in CSS pixels from its top-left corner. */
export interface FieldFocus {
	x: number;
	y: number;
	/** Radius the form should fill on screen. */
	radius: number;
}

/** Letters drawn into square atlas cells, which replace the round points. */
export interface ParticleGlyphs {
	/** White letters with a dark outline; both sides must be powers of two for mipmapping. */
	atlas: TexImageSource;
	columns: number;
	rows: number;
	/** Atlas cell of every particle, counted left to right and top to bottom. */
	cells: Float32Array;
}

/** Sets the letters for a cloud of `count` particles from the text inside `copy`. */
export type GlyphSource = (copy: HTMLElement, count: number) => Promise<ParticleGlyphs>;

export interface FieldOptions {
	/** Particle size at the centre of the form, in CSS pixels. */
	pointScale: number;
	/** Largest particle, in CSS pixels. */
	maxPointSize?: number;
	glyphs?: ParticleGlyphs;
}

const POINT_DEFINES = `
#define ACCENT_SIZE 1.3
#define SCAN_SIZE 0.8
`;

// Letters grow less for annotations and the scan band, so they stay separate and readable.
const GLYPH_DEFINES = `
#define GLYPHS
#define ACCENT_SIZE 0.6
#define SCAN_SIZE 0.3
`;

const VERTEX_SHADER = `
precision highp float;

attribute vec3 aFrom;
attribute vec3 aTo;
attribute vec3 aDirection;
attribute vec3 aMeta;

uniform float uMorph;
uniform vec2 uRotation;
uniform mat4 uProjection;
uniform float uDistance;
uniform float uAspect;
uniform vec2 uOffset;
uniform vec2 uDust;
uniform float uReach;
uniform vec3 uPointer;
uniform vec4 uPointerTrail[${POINTER_TRAIL_SAMPLES}];
uniform float uBurst;
uniform float uTime;
uniform float uScan;
uniform float uPointSize;
uniform float uMaxPointSize;

varying float vAlpha;
varying float vAccent;

#ifdef GLYPHS
attribute float aGlyph;
varying float vGlyph;
#endif

void main() {
	float seed = aMeta.x;
	float dust = aMeta.z;
	float t = clamp(uMorph * 1.5 - seed * 0.5, 0.0, 1.0);
	t = t * t * (3.0 - 2.0 * t);

	// Particles lift off one form, drift apart and settle into the next.
	vec3 p = mix(aFrom, aTo, t);
	// Dust fills a cylinder sized to the camera, so it surrounds the form at any aspect ratio.
	p *= mix(vec3(1.0), vec3(uDust.x, uDust.y, uDust.x), dust);
	p += aDirection * (sin(3.14159265 * t) * 0.45 + uBurst * (0.6 + seed * 0.9));
	p += aDirection * mix(0.006, 0.05, dust) * sin(uTime * mix(1.3, 0.35, dust) + seed * 40.0);

	float band = (p.y - uScan) * 16.0;
	float scan = exp(-band * band) * (1.0 - dust);

	// The dust turns more slowly than the form and ignores pitch, which reads as parallax.
	float yaw = uRotation.x * mix(1.0, 0.35, dust);
	float cy = cos(yaw);
	float sy = sin(yaw);
	p.xz = mat2(cy, sy, -sy, cy) * p.xz;
	float pitch = uRotation.y * (1.0 - dust);
	float cp = cos(pitch);
	float sp = sin(pitch);
	p.yz = mat2(cp, sp, -sp, cp) * p.yz;

	vec4 view = vec4(p.xy, p.z - uDistance, 1.0);
	vec2 offset = uOffset * (1.0 - dust);

	// Gently stir nearby grains in their own directions, like a hand passing over sand.
	vec4 clip = uProjection * view;
	vec2 delta = clip.xy / clip.w + offset - uPointer.xy;
	delta.x *= uAspect;
	// Different offsets and elliptical brush sizes avoid a uniform circular footprint.
	vec2 brushSize = vec2(mix(0.07, 0.32, seed), mix(0.08, 0.27, fract(seed * 7.3)));
	vec2 grainOffset = aDirection.xy * 0.12;
	grainOffset += vec2(sin(p.y * 9.0 + p.z * 5.0), cos(p.x * 7.0 - p.z * 6.0)) * 0.055;
	float grainResponse = mix(0.2, 1.0, fract(seed * 31.7));
	vec2 brush = (delta + grainOffset) / brushSize;
	float reach = uPointer.z * grainResponse * exp(-dot(brush, brush));
	for (int i = 0; i < ${POINTER_TRAIL_SAMPLES}; i++) {
		vec2 trailDelta = clip.xy / clip.w + offset - uPointerTrail[i].xy;
		trailDelta.x *= uAspect;
		vec2 trailBrush = (trailDelta + grainOffset) / brushSize;
		// Each grain settles on its own gently eased timeline. Samples expire before reuse.
		float settle = 1.0 - smoothstep(0.0, ${POINTER_TRAIL_MIN_SETTLE_SECONDS.toFixed(1)} + seed * 0.4, uPointerTrail[i].w);
		reach = max(reach, uPointerTrail[i].z * settle * grainResponse * exp(-dot(trailBrush, trailBrush)));
	}
	// Varied travel distances leave grains near the surface while a few drift much farther out.
	float travel = 0.12 + seed * seed * 1.3;
	view.xy += aDirection.xy * travel * reach * uReach;
	view.z += aDirection.z * travel * reach * 0.65 * uReach;

	gl_Position = uProjection * view;
	gl_Position.xy += offset * gl_Position.w;

	float depth = max(-view.z, 0.05);
	float size = (1.0 + aMeta.y * ACCENT_SIZE + scan * SCAN_SIZE + reach * seed * 0.9) * mix(1.0, 0.7 + seed * 0.9, dust);
	gl_PointSize = min(uPointSize * size / depth, uMaxPointSize);

	float front = clamp(0.5 + p.z * 0.45, 0.0, 1.0);
	float formAlpha = mix(0.28, 0.9, front) * (1.0 - uBurst * 0.25) + scan * 0.35;
	float dustAlpha = (0.1 + seed * 0.2) * (0.6 + 0.4 * sin(uTime * 0.9 + seed * 60.0));
	vAlpha = (mix(formAlpha, dustAlpha, dust) + reach * seed * 0.1) * smoothstep(0.4, 1.6, depth);
	vAccent = max(max(max(aMeta.y, scan * 0.75), reach * step(0.9, seed) * 0.5), dust * step(0.965, seed) * 0.85);

#ifdef GLYPHS
	vGlyph = aGlyph;
#endif
}
`;

const FRAGMENT_SHADER = `
precision mediump float;

uniform vec3 uInk;
uniform vec3 uAccent;

varying float vAlpha;
varying float vAccent;

#ifdef GLYPHS
uniform sampler2D uAtlas;
uniform vec2 uGrid;

varying float vGlyph;

void main() {
	float cell = floor(vGlyph + 0.5);
	float row = floor(cell / uGrid.x);
	vec2 corner = vec2(cell - row * uGrid.x, row);
	vec4 glyph = texture2D(uAtlas, (corner + gl_PointCoord) / uGrid);
	// The atlas is premultiplied; its dark outline keeps overlapping letters apart.
	gl_FragColor = vec4(glyph.rgb * mix(uInk, uAccent, vAccent), glyph.a) * vAlpha;
}
#else
void main() {
	vec2 c = gl_PointCoord - 0.5;
	float d = dot(c, c) * 4.0;
	if (d > 1.0) discard;
	float alpha = (1.0 - d) * vAlpha * 0.62;
	gl_FragColor = vec4(mix(uInk, uAccent, vAccent) * alpha, alpha);
}
#endif
`;

const UNIFORMS = [
	'uMorph',
	'uRotation',
	'uProjection',
	'uDistance',
	'uAspect',
	'uOffset',
	'uDust',
	'uReach',
	'uPointer',
	'uPointerTrail[0]',
	'uBurst',
	'uTime',
	'uScan',
	'uPointSize',
	'uMaxPointSize',
	'uInk',
	'uAccent',
	'uAtlas',
	'uGrid'
] as const;

const FIELD_OF_VIEW = (32 * Math.PI) / 180;
/** Radius of the forms and their turntable ring in model space. */
const FIT_RADIUS = 1.25;
/** Keeps the camera clear of scattered particles when the form is drawn very large. */
const MIN_DISTANCE = 3.4;
/** Camera distance the pointer and dust tuning was drawn at. */
const REFERENCE_DISTANCE = 4.4;
const MAX_POINT_SIZE = 18;
const PAPER = [0.957, 0.945, 0.922];
const VERMILLION = [0.89, 0.37, 0.24];

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

type Uniforms = Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;

/**
 * A single draw call of blended points on a transparent WebGL 1 canvas. Every form stays in its own
 * GPU buffer; a transition only rebinds the current and target buffers to two attributes, so the
 * number of forms never touches the vertex attribute limit and nothing is uploaded per frame.
 */
export class ParticleField {
	private readonly canvas: HTMLCanvasElement;
	private readonly gl: WebGLRenderingContext;
	private readonly buffers: WebGLBuffer[] = [];
	private readonly forms: WebGLBuffer[];
	private readonly shaders: WebGLShader[] = [];
	private readonly program: WebGLProgram;
	private readonly uniforms: Uniforms;
	private readonly fromLocation: number;
	private readonly toLocation: number;
	private readonly texture: WebGLTexture | null = null;
	private readonly projection = new Float32Array(16);
	private readonly offset = new Float32Array(2);
	private readonly dust = new Float32Array(2);
	private readonly bound = [-1, -1];
	private readonly count: number;
	private readonly pointScale: number;
	private readonly maxPointScale: number;
	private readonly pointLimit: number;
	private aspect = 1;
	private distance = REFERENCE_DISTANCE;
	private pointSize = 1;
	private maxPointSize = MAX_POINT_SIZE;

	private constructor(
		canvas: HTMLCanvasElement,
		gl: WebGLRenderingContext,
		cloud: ParticleCloud,
		{ pointScale, maxPointSize = MAX_POINT_SIZE, glyphs }: FieldOptions
	) {
		this.canvas = canvas;
		this.gl = gl;
		this.pointScale = pointScale;
		this.maxPointScale = maxPointSize;
		this.count = cloud.count;
		const range = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array | null;
		this.pointLimit = range?.[1] ?? 64;

		const defines = glyphs ? GLYPH_DEFINES : POINT_DEFINES;
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

		// Upload every form once; `bindForms` points the morph attributes at two of them.
		this.forms = cloud.forms.map((data) => this.upload(data));
		this.fromLocation = gl.getAttribLocation(program, 'aFrom');
		this.toLocation = gl.getAttribLocation(program, 'aTo');
		gl.enableVertexAttribArray(this.fromLocation);
		gl.enableVertexAttribArray(this.toLocation);
		this.bindForms(0, 0);
		this.attach('aDirection', cloud.directions, 3);
		this.attach('aMeta', cloud.meta, 3);
		if (glyphs) this.attach('aGlyph', glyphs.cells, 1);

		this.uniforms = Object.fromEntries(
			UNIFORMS.map((name) => [name, gl.getUniformLocation(program, name)])
		) as Uniforms;
		gl.uniform3fv(this.uniforms.uInk, PAPER);
		gl.uniform3fv(this.uniforms.uAccent, VERMILLION);

		if (glyphs) {
			const texture = gl.createTexture();
			if (!texture) throw new Error('Texture could not be created.');
			this.texture = texture;
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, glyphs.atlas);
			gl.generateMipmap(gl.TEXTURE_2D);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			gl.uniform1i(this.uniforms.uAtlas, 0);
			gl.uniform2f(this.uniforms.uGrid, glyphs.columns, glyphs.rows);
		}

		gl.disable(gl.DEPTH_TEST);
		gl.enable(gl.BLEND);
		// Dots add up into light; letters are laid over one another so their outlines stay visible.
		gl.blendFunc(gl.ONE, glyphs ? gl.ONE_MINUS_SRC_ALPHA : gl.ONE);
		gl.clearColor(0, 0, 0, 0);
	}

	/** Returns null when WebGL is unavailable or the shaders fail, so callers can fall back. */
	static create(
		canvas: HTMLCanvasElement,
		cloud: ParticleCloud,
		options: FieldOptions
	): ParticleField | null {
		let gl: WebGLRenderingContext | null = null;
		try {
			gl = canvas.getContext('webgl', { antialias: false, depth: false, alpha: true });
			return gl ? new ParticleField(canvas, gl, cloud, options) : null;
		} catch {
			gl?.getExtension('WEBGL_lose_context')?.loseContext();
			return null;
		}
	}

	private upload(data: Float32Array) {
		const { gl } = this;
		const buffer = gl.createBuffer();
		if (!buffer) throw new Error('Buffer could not be created.');
		this.buffers.push(buffer);
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
		return buffer;
	}

	private attach(name: string, data: Float32Array, size: number) {
		const { gl } = this;
		this.upload(data);
		const location = gl.getAttribLocation(this.program, name);
		if (location < 0) return;
		gl.enableVertexAttribArray(location);
		gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
	}

	/** Points the morph attributes at the current and target forms; unchanged forms cost nothing. */
	private bindForms(from: number, to: number) {
		const { gl, bound } = this;
		if (bound[0] === from && bound[1] === to) return;
		gl.bindBuffer(gl.ARRAY_BUFFER, this.forms[from]);
		gl.vertexAttribPointer(this.fromLocation, 3, gl.FLOAT, false, 0, 0);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.forms[to]);
		gl.vertexAttribPointer(this.toLocation, 3, gl.FLOAT, false, 0, 0);
		bound[0] = from;
		bound[1] = to;
	}

	/** Sizes the drawing buffer and frames the form around `focus` on a canvas of any shape. */
	resize(width: number, height: number, pixelRatio: number, focus: FieldFocus) {
		const { canvas, gl, projection, offset, dust } = this;
		canvas.width = Math.max(1, Math.round(width * pixelRatio));
		canvas.height = Math.max(1, Math.round(height * pixelRatio));
		gl.viewport(0, 0, canvas.width, canvas.height);

		const safeHeight = Math.max(1, height);
		this.aspect = width / safeHeight;
		const focal = 1 / Math.tan(FIELD_OF_VIEW / 2);
		this.distance = Math.max(
			MIN_DISTANCE,
			(FIT_RADIUS * focal * safeHeight) / (2 * Math.max(1, focus.radius))
		);
		this.pointSize = this.pointScale * pixelRatio * this.distance;
		this.maxPointSize = Math.min(this.maxPointScale * pixelRatio, this.pointLimit);
		offset[0] = (focus.x / Math.max(1, width)) * 2 - 1;
		offset[1] = 1 - (focus.y / safeHeight) * 2;
		dust[0] = this.distance * Math.min(0.8, Math.max(0.2, 0.29 * this.aspect + 0.12));
		dust[1] = this.distance * 0.45;

		const near = 0.1;
		const far = this.distance * 2 + 4;
		projection.fill(0);
		projection[0] = focal / this.aspect;
		projection[5] = focal;
		projection[10] = (far + near) / (near - far);
		projection[11] = -1;
		projection[14] = (2 * far * near) / (near - far);
	}

	render(frame: FieldFrame) {
		const { gl, uniforms } = this;
		this.bindForms(frame.from, frame.to);

		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.uniform1f(uniforms.uMorph, frame.morph);
		gl.uniform2f(uniforms.uRotation, frame.yaw, frame.pitch);
		gl.uniformMatrix4fv(uniforms.uProjection, false, this.projection);
		gl.uniform1f(uniforms.uDistance, this.distance);
		gl.uniform1f(uniforms.uAspect, this.aspect);
		gl.uniform2fv(uniforms.uOffset, this.offset);
		gl.uniform2fv(uniforms.uDust, this.dust);
		gl.uniform1f(uniforms.uReach, this.distance / REFERENCE_DISTANCE);
		gl.uniform3f(uniforms.uPointer, frame.pointerX, frame.pointerY, frame.pointerStrength);
		gl.uniform4fv(uniforms['uPointerTrail[0]'], frame.pointerTrail);
		gl.uniform1f(uniforms.uBurst, frame.burst);
		gl.uniform1f(uniforms.uTime, frame.time);
		gl.uniform1f(uniforms.uScan, frame.scan);
		gl.uniform1f(uniforms.uPointSize, this.pointSize);
		gl.uniform1f(uniforms.uMaxPointSize, this.maxPointSize);
		gl.drawArrays(gl.POINTS, 0, this.count);
	}

	/** Frees GPU memory, including the letter atlas, and hands the context back to the browser. */
	dispose() {
		const { gl } = this;
		for (const buffer of this.buffers) gl.deleteBuffer(buffer);
		for (const shader of this.shaders) gl.deleteShader(shader);
		if (this.texture) gl.deleteTexture(this.texture);
		gl.deleteProgram(this.program);
		gl.getExtension('WEBGL_lose_context')?.loseContext();
	}
}
