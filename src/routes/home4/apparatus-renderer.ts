import { STRIDE, type ApparatusScene } from './apparatus-scene';

/** Everything the shader needs for one frame. The caller reuses a single object. */
export interface ApparatusFrame {
	yaw: number;
	pitch: number;
	/** Visibility of each layer from 0 to 1, in the order of `LAYERS`. */
	layers: Float32Array;
	/** Centre of the interpretation lens in normalised device coordinates. */
	lensX: number;
	lensY: number;
	/** Lens radius in units of half the canvas height. */
	lensRadius: number;
	lens: number;
	/** Height of the capture sweep that draws the evidence in, from 0 to 1. */
	reveal: number;
	/** Height of the ambient scanning band in model space; far outside the vessel hides it. */
	scan: number;
	time: number;
	/** 1 while the annotation markers breathe, 0 when motion is paused. */
	pulse: number;
}

/** Where the vessel sits on the canvas, in CSS pixels from its top-left corner. */
export interface ApparatusFocus {
	x: number;
	y: number;
	/** Radius the vessel and its frame should fill on screen. */
	radius: number;
}

/** A projected point in CSS pixels; `front` runs from 0 at the back of the vessel to 1 at the front. */
export interface Projected {
	x: number;
	y: number;
	front: number;
}

const VERTEX_SHADER = `
precision highp float;

attribute vec3 aPosition;
attribute vec3 aData;

uniform mat4 uProjection;
uniform vec2 uRotation;
uniform float uDistance;
uniform vec2 uOffset;
uniform float uAspect;
uniform vec4 uLayers;
uniform float uFrameLayer;
uniform vec4 uLens;
uniform float uReveal;
uniform float uScan;
uniform float uTime;
uniform float uPulse;
uniform float uPointSize;
uniform float uMarkerSize;
uniform float uMaxPointSize;
uniform float uLines;

varying vec4 vColor;
varying float vMarker;
varying float vDash;
varying float vDashed;
varying float vLine;

const vec3 PAPER = vec3(0.957, 0.945, 0.922);
const vec3 WARM = vec3(0.97, 0.76, 0.66);
const vec3 VERMILLION = vec3(0.93, 0.4, 0.26);
const vec3 SAGE = vec3(0.6, 0.8, 0.66);

void main() {
	float layer = aData.x;
	float flag = aData.y;
	float weight = layer < 0.5 ? uLayers.x
		: layer < 1.5 ? uLayers.y
		: layer < 2.5 ? uLayers.z
		: layer < 3.5 ? uLayers.w
		: uFrameLayer;

	vec3 p = aPosition;
	float cy = cos(uRotation.x);
	float sy = sin(uRotation.x);
	float x = cy * p.x - sy * p.z;
	float z = sy * p.x + cy * p.z;
	p.x = x;
	p.z = z;
	float cp = cos(uRotation.y);
	float sp = sin(uRotation.y);
	float y = cp * p.y - sp * p.z;
	z = sp * p.y + cp * p.z;
	p.y = y;
	p.z = z;

	vec4 view = vec4(p.xy, p.z - uDistance, 1.0);
	gl_Position = uProjection * view;
	gl_Position.xy += uOffset * gl_Position.w;

	// The lens shows the hypothesis over the evidence wherever the reader points.
	vec2 delta = gl_Position.xy / gl_Position.w - uLens.xy;
	delta.x *= uAspect;
	float lens = uLens.w * (1.0 - smoothstep(uLens.z * 0.82, uLens.z, length(delta)));

	// Evidence is drawn in by a rising capture sweep; the other layers follow once it is done.
	float sweep = uReveal * 2.5 - 1.25;
	float recorded = 1.0 - smoothstep(sweep - 0.03, sweep + 0.03, aPosition.y);
	float rise = (aPosition.y - sweep) * 18.0;
	float front = exp(-rise * rise) * step(uReveal, 0.999);
	float settled = smoothstep(0.6, 1.0, uReveal);
	float scan = (aPosition.y - uScan) * 16.0;
	float band = exp(-scan * scan);
	float depth = clamp(0.5 + p.z * 0.42, 0.0, 1.0);

	vec3 color = PAPER;
	float alpha = 0.0;
	vMarker = 0.0;
	vDashed = 0.0;
	if (layer < 0.5) {
		float inner = step(1.5, flag);
		float edge = step(0.5, flag) * (1.0 - inner);
		color = mix(PAPER, WARM, edge + front);
		alpha = weight * recorded * mix(0.62, 1.0, edge) * mix(1.0, 0.45, inner);
		alpha *= 1.0 - lens * 0.62;
		alpha += band * 0.35 * weight;
	} else if (layer < 1.5) {
		color = VERMILLION;
		alpha = weight * settled;
		vMarker = 1.0;
	} else if (layer < 2.5) {
		// Surviving wall shows the hypothesis faintly; inferred wall is dashed and bright.
		color = SAGE;
		float shown = max(weight, lens);
		alpha = shown * settled * mix(0.14, 0.9, flag);
		vDashed = flag;
	} else if (layer < 3.5) {
		color = PAPER;
		alpha = weight * settled * mix(0.42, 0.3, flag);
		vDashed = flag;
	} else {
		color = mix(PAPER, VERMILLION, flag * 0.35);
		alpha = weight * settled * mix(0.36, 0.6, flag);
	}
	alpha *= mix(0.32, 1.0, depth);

	vColor = vec4(color, alpha);
	vDash = aData.z * 28.0;
	vLine = uLines;

	if (alpha < 0.004) {
		// Hidden layers cost no fragments.
		gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
		gl_PointSize = 0.0;
		return;
	}

	float range = max(-view.z, 0.05);
	float size = vMarker > 0.5
		? uMarkerSize * (1.0 + 0.14 * uPulse * sin(uTime * 2.6 + aData.z * 6.28))
		: uPointSize / range * (1.0 + step(0.5, flag) * 0.35 + band * 0.6 + front * 0.8);
	gl_PointSize = uLines > 0.5 ? 1.0 : min(size, uMaxPointSize);
}
`;

const FRAGMENT_SHADER = `
precision mediump float;

// The line flag reaches this stage as a varying: a uniform shared by both stages would need the
// same precision in each.
varying vec4 vColor;
varying float vMarker;
varying float vDash;
varying float vDashed;
varying float vLine;

void main() {
	if (vLine > 0.5) {
		if (vDashed > 0.5 && fract(vDash) > 0.55) discard;
		gl_FragColor = vec4(vColor.rgb * vColor.a, vColor.a);
		return;
	}
	vec2 c = gl_PointCoord - 0.5;
	float r = length(c) * 2.0;
	float alpha;
	if (vMarker > 0.5) {
		// An annotation marker: a ring around a solid centre.
		float ring = 1.0 - smoothstep(0.05, 0.12, abs(r - 0.8));
		float core = 1.0 - smoothstep(0.3, 0.4, r);
		alpha = max(ring * 0.95, core) * vColor.a;
	} else {
		if (r > 1.0) discard;
		alpha = (1.0 - r * r) * vColor.a * 0.6;
	}
	if (alpha < 0.01) discard;
	gl_FragColor = vec4(vColor.rgb * alpha, alpha);
}
`;

const UNIFORMS = [
	'uProjection',
	'uRotation',
	'uDistance',
	'uOffset',
	'uAspect',
	'uLayers',
	'uFrameLayer',
	'uLens',
	'uReveal',
	'uScan',
	'uTime',
	'uPulse',
	'uPointSize',
	'uMarkerSize',
	'uMaxPointSize',
	'uLines'
] as const;

type Uniforms = Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;

const FIELD_OF_VIEW = (30 * Math.PI) / 180;
/** Radius of the vessel, its frame and most of the capture rig in model space. */
const FIT_RADIUS = 1.5;
const MIN_DISTANCE = 3.4;
const MAX_POINT_SIZE = 16;
const MARKER_SIZE = 22;
const BYTES = STRIDE * Float32Array.BYTES_PER_ELEMENT;

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
 * Two draw calls on a transparent WebGL 1 canvas: the line layers, then the points. Both buffers are
 * uploaded once; each frame only sets uniforms, so nothing is allocated or uploaded while it runs.
 */
export class ApparatusRenderer {
	private readonly canvas: HTMLCanvasElement;
	private readonly gl: WebGLRenderingContext;
	private readonly program: WebGLProgram;
	private readonly shaders: WebGLShader[] = [];
	private readonly pointBuffer: WebGLBuffer;
	private readonly lineBuffer: WebGLBuffer;
	private readonly pointCount: number;
	private readonly lineCount: number;
	private readonly uniforms: Uniforms;
	private readonly position: number;
	private readonly data: number;
	private readonly pointScale: number;
	private readonly pointLimit: number;
	private readonly projection = new Float32Array(16);
	private readonly offset = new Float32Array(2);
	private width = 1;
	private height = 1;
	private aspect = 1;
	private focal = 1;
	private distance = MIN_DISTANCE;
	private pointSize = 1;
	private markerSize = MARKER_SIZE;
	private maxPointSize = MAX_POINT_SIZE;

	private constructor(
		canvas: HTMLCanvasElement,
		gl: WebGLRenderingContext,
		scene: ApparatusScene,
		pointScale: number
	) {
		this.canvas = canvas;
		this.gl = gl;
		this.pointScale = pointScale;
		const range = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array | null;
		this.pointLimit = range?.[1] ?? 64;

		this.shaders.push(
			compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER),
			compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
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

		this.pointBuffer = this.upload(scene.points);
		this.lineBuffer = this.upload(scene.lines);
		this.pointCount = scene.pointCount;
		this.lineCount = scene.lineCount;
		this.position = gl.getAttribLocation(program, 'aPosition');
		this.data = gl.getAttribLocation(program, 'aData');
		gl.enableVertexAttribArray(this.position);
		gl.enableVertexAttribArray(this.data);

		this.uniforms = Object.fromEntries(
			UNIFORMS.map((name) => [name, gl.getUniformLocation(program, name)])
		) as Uniforms;

		gl.disable(gl.DEPTH_TEST);
		gl.enable(gl.BLEND);
		// Points and lines add up into light, which reads as density on the dark field.
		gl.blendFunc(gl.ONE, gl.ONE);
		gl.clearColor(0, 0, 0, 0);
	}

	/** Returns null when WebGL is unavailable or the shaders fail, so callers can fall back. */
	static create(
		canvas: HTMLCanvasElement,
		scene: ApparatusScene,
		pointScale: number
	): ApparatusRenderer | null {
		let gl: WebGLRenderingContext | null = null;
		try {
			gl = canvas.getContext('webgl', { antialias: true, depth: false, alpha: true });
			return gl ? new ApparatusRenderer(canvas, gl, scene, pointScale) : null;
		} catch {
			gl?.getExtension('WEBGL_lose_context')?.loseContext();
			return null;
		}
	}

	private upload(data: Float32Array) {
		const { gl } = this;
		const buffer = gl.createBuffer();
		if (!buffer) throw new Error('Buffer could not be created.');
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
		return buffer;
	}

	private bind(buffer: WebGLBuffer) {
		const { gl } = this;
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.vertexAttribPointer(this.position, 3, gl.FLOAT, false, BYTES, 0);
		gl.vertexAttribPointer(this.data, 3, gl.FLOAT, false, BYTES, 12);
	}

	/** Sizes the drawing buffer and frames the vessel around `focus` on a canvas of any shape. */
	resize(width: number, height: number, pixelRatio: number, focus: ApparatusFocus) {
		const { canvas, gl, projection, offset } = this;
		canvas.width = Math.max(1, Math.round(width * pixelRatio));
		canvas.height = Math.max(1, Math.round(height * pixelRatio));
		gl.viewport(0, 0, canvas.width, canvas.height);

		this.width = Math.max(1, width);
		this.height = Math.max(1, height);
		this.aspect = this.width / this.height;
		this.focal = 1 / Math.tan(FIELD_OF_VIEW / 2);
		this.distance = Math.max(
			MIN_DISTANCE,
			(FIT_RADIUS * this.focal * this.height) / (2 * Math.max(1, focus.radius))
		);
		this.pointSize = this.pointScale * pixelRatio * this.distance;
		this.markerSize = Math.min(MARKER_SIZE * pixelRatio, this.pointLimit);
		this.maxPointSize = Math.min(MAX_POINT_SIZE * pixelRatio, this.pointLimit);
		offset[0] = (focus.x / this.width) * 2 - 1;
		offset[1] = 1 - (focus.y / this.height) * 2;

		const near = 0.1;
		const far = this.distance * 2 + 4;
		projection.fill(0);
		projection[0] = this.focal / this.aspect;
		projection[5] = this.focal;
		projection[10] = (far + near) / (near - far);
		projection[11] = -1;
		projection[14] = (2 * far * near) / (near - far);
	}

	/** Mirrors the vertex shader, so HTML labels can follow points on the model. */
	project([px, py, pz]: readonly number[], yaw: number, pitch: number, out: Projected) {
		const cy = Math.cos(yaw);
		const sy = Math.sin(yaw);
		const x = cy * px - sy * pz;
		let z = sy * px + cy * pz;
		const cp = Math.cos(pitch);
		const sp = Math.sin(pitch);
		const y = cp * py - sp * z;
		z = sp * py + cp * z;
		const w = Math.max(0.05, this.distance - z);
		const ndcX = ((this.focal / this.aspect) * x) / w + this.offset[0];
		const ndcY = (this.focal * y) / w + this.offset[1];
		out.x = ((ndcX + 1) / 2) * this.width;
		out.y = ((1 - ndcY) / 2) * this.height;
		out.front = Math.min(1, Math.max(0, 0.5 + z * 1.4));
		return out;
	}

	render(frame: ApparatusFrame) {
		const { gl, uniforms } = this;
		const { layers } = frame;
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.uniformMatrix4fv(uniforms.uProjection, false, this.projection);
		gl.uniform2f(uniforms.uRotation, frame.yaw, frame.pitch);
		gl.uniform1f(uniforms.uDistance, this.distance);
		gl.uniform2fv(uniforms.uOffset, this.offset);
		gl.uniform1f(uniforms.uAspect, this.aspect);
		gl.uniform4f(uniforms.uLayers, layers[0], layers[1], layers[2], layers[3]);
		gl.uniform1f(uniforms.uFrameLayer, layers[4]);
		gl.uniform4f(uniforms.uLens, frame.lensX, frame.lensY, frame.lensRadius, frame.lens);
		gl.uniform1f(uniforms.uReveal, frame.reveal);
		gl.uniform1f(uniforms.uScan, frame.scan);
		gl.uniform1f(uniforms.uTime, frame.time);
		gl.uniform1f(uniforms.uPulse, frame.pulse);
		gl.uniform1f(uniforms.uPointSize, this.pointSize);
		gl.uniform1f(uniforms.uMarkerSize, this.markerSize);
		gl.uniform1f(uniforms.uMaxPointSize, this.maxPointSize);

		gl.uniform1f(uniforms.uLines, 1);
		this.bind(this.lineBuffer);
		gl.drawArrays(gl.LINES, 0, this.lineCount);

		gl.uniform1f(uniforms.uLines, 0);
		this.bind(this.pointBuffer);
		gl.drawArrays(gl.POINTS, 0, this.pointCount);
	}

	/** Frees GPU memory and hands the context back to the browser. */
	dispose() {
		const { gl } = this;
		gl.deleteBuffer(this.pointBuffer);
		gl.deleteBuffer(this.lineBuffer);
		for (const shader of this.shaders) gl.deleteShader(shader);
		gl.deleteProgram(this.program);
		gl.getExtension('WEBGL_lose_context')?.loseContext();
	}
}
