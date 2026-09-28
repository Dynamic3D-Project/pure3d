import type { ParticleCloud } from './particle-forms';

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
	burst: number;
	time: number;
	/** Height of the scanning band in model space; far outside the form hides it. */
	scan: number;
}

const VERTEX_SHADER = `
precision highp float;

attribute vec3 aForm0;
attribute vec3 aForm1;
attribute vec3 aForm2;
attribute vec3 aDirection;
attribute vec2 aMeta;

uniform vec3 uFrom;
uniform vec3 uTo;
uniform float uMorph;
uniform vec2 uRotation;
uniform mat4 uProjection;
uniform float uDistance;
uniform float uAspect;
uniform vec3 uPointer;
uniform float uBurst;
uniform float uTime;
uniform float uScan;
uniform float uPointSize;

varying float vAlpha;
varying float vAccent;

vec3 formAt(vec3 weights) {
	return aForm0 * weights.x + aForm1 * weights.y + aForm2 * weights.z;
}

void main() {
	float seed = aMeta.x;
	float t = clamp(uMorph * 1.5 - seed * 0.5, 0.0, 1.0);
	t = t * t * (3.0 - 2.0 * t);

	// Particles lift off one form, drift apart and settle into the next.
	vec3 p = mix(formAt(uFrom), formAt(uTo), t);
	p += aDirection * (sin(3.14159265 * t) * 0.45 + uBurst * (0.6 + seed * 0.9));
	p += aDirection * 0.006 * sin(uTime * 1.3 + seed * 40.0);

	float band = (p.y - uScan) * 16.0;
	float scan = exp(-band * band);

	float cy = cos(uRotation.x);
	float sy = sin(uRotation.x);
	p.xz = mat2(cy, sy, -sy, cy) * p.xz;
	float cp = cos(uRotation.y);
	float sp = sin(uRotation.y);
	p.yz = mat2(cp, sp, -sp, cp) * p.yz;

	vec4 view = vec4(p.xy, p.z - uDistance, 1.0);

	// Push particles away from the pointer in screen space; they spring back as it fades.
	vec4 clip = uProjection * view;
	vec2 delta = clip.xy / clip.w - uPointer.xy;
	delta.x *= uAspect;
	float reach = uPointer.z * (1.0 - smoothstep(0.0, 0.34, length(delta)));
	view.xy += normalize(delta + 1e-4) * reach * 0.32 + aDirection.xy * reach * 0.12;
	view.z += aDirection.z * reach * 0.2;

	gl_Position = uProjection * view;
	gl_PointSize = uPointSize * (1.0 + aMeta.y * 1.3 + scan * 0.8 + reach * 0.6) / -view.z;

	float front = clamp(0.5 + p.z * 0.45, 0.0, 1.0);
	vAlpha = mix(0.28, 0.9, front) * (1.0 - uBurst * 0.25) + scan * 0.35;
	vAccent = max(aMeta.y, scan * 0.75);
}
`;

const FRAGMENT_SHADER = `
precision mediump float;

uniform vec3 uInk;
uniform vec3 uAccent;

varying float vAlpha;
varying float vAccent;

void main() {
	vec2 c = gl_PointCoord - 0.5;
	float d = dot(c, c) * 4.0;
	if (d > 1.0) discard;
	float alpha = (1.0 - d) * vAlpha * 0.62;
	gl_FragColor = vec4(mix(uInk, uAccent, vAccent) * alpha, alpha);
}
`;

const ATTRIBUTES = ['aForm0', 'aForm1', 'aForm2', 'aDirection', 'aMeta'] as const;
const UNIFORMS = [
	'uFrom',
	'uTo',
	'uMorph',
	'uRotation',
	'uProjection',
	'uDistance',
	'uAspect',
	'uPointer',
	'uBurst',
	'uTime',
	'uScan',
	'uPointSize',
	'uInk',
	'uAccent'
] as const;

const FIELD_OF_VIEW = (32 * Math.PI) / 180;
const FIT_RADIUS = 1.15;
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

/** A single draw call of additive points on a transparent WebGL 1 canvas. */
export class ParticleField {
	private readonly canvas: HTMLCanvasElement;
	private readonly gl: WebGLRenderingContext;
	private readonly buffers: WebGLBuffer[] = [];
	private readonly shaders: WebGLShader[] = [];
	private readonly program: WebGLProgram;
	private readonly uniforms: Uniforms;
	private readonly projection = new Float32Array(16);
	private readonly fromWeights = new Float32Array(3);
	private readonly toWeights = new Float32Array(3);
	private readonly count: number;
	private readonly pointScale: number;
	private aspect = 1;
	private distance = 4;
	private pointSize = 1;

	private constructor(
		canvas: HTMLCanvasElement,
		gl: WebGLRenderingContext,
		cloud: ParticleCloud,
		pointScale: number
	) {
		this.canvas = canvas;
		this.gl = gl;
		this.pointScale = pointScale;
		this.count = cloud.count;
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

		const data = [...cloud.forms, cloud.directions, cloud.meta];
		ATTRIBUTES.forEach((name, index) => {
			const buffer = gl.createBuffer();
			if (!buffer) throw new Error('Buffer could not be created.');
			this.buffers.push(buffer);
			gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
			gl.bufferData(gl.ARRAY_BUFFER, data[index], gl.STATIC_DRAW);
			const location = gl.getAttribLocation(program, name);
			if (location < 0) return;
			gl.enableVertexAttribArray(location);
			gl.vertexAttribPointer(location, name === 'aMeta' ? 2 : 3, gl.FLOAT, false, 0, 0);
		});

		this.uniforms = Object.fromEntries(
			UNIFORMS.map((name) => [name, gl.getUniformLocation(program, name)])
		) as Uniforms;
		gl.uniform3fv(this.uniforms.uInk, PAPER);
		gl.uniform3fv(this.uniforms.uAccent, VERMILLION);

		gl.disable(gl.DEPTH_TEST);
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.ONE, gl.ONE);
		gl.clearColor(0, 0, 0, 0);
	}

	/** Returns null when WebGL is unavailable or the shaders fail, so callers can fall back. */
	static create(
		canvas: HTMLCanvasElement,
		cloud: ParticleCloud,
		pointScale: number
	): ParticleField | null {
		let gl: WebGLRenderingContext | null = null;
		try {
			gl = canvas.getContext('webgl', { antialias: false, depth: false, alpha: true });
			return gl ? new ParticleField(canvas, gl, cloud, pointScale) : null;
		} catch {
			gl?.getExtension('WEBGL_lose_context')?.loseContext();
			return null;
		}
	}

	resize(width: number, height: number, pixelRatio: number) {
		const { canvas, gl, projection } = this;
		canvas.width = Math.max(1, Math.round(width * pixelRatio));
		canvas.height = Math.max(1, Math.round(height * pixelRatio));
		gl.viewport(0, 0, canvas.width, canvas.height);

		this.aspect = width / Math.max(1, height);
		const focal = 1 / Math.tan(FIELD_OF_VIEW / 2);
		this.distance = (FIT_RADIUS * focal) / Math.min(this.aspect, 1) + 0.4;
		this.pointSize = this.pointScale * pixelRatio * this.distance;

		const near = 0.1;
		const far = 20;
		projection.fill(0);
		projection[0] = focal / this.aspect;
		projection[5] = focal;
		projection[10] = (far + near) / (near - far);
		projection[11] = -1;
		projection[14] = (2 * far * near) / (near - far);
	}

	render(frame: FieldFrame) {
		const { gl, uniforms, fromWeights, toWeights } = this;
		fromWeights.fill(0);
		toWeights.fill(0);
		fromWeights[frame.from] = 1;
		toWeights[frame.to] = 1;

		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.uniform3fv(uniforms.uFrom, fromWeights);
		gl.uniform3fv(uniforms.uTo, toWeights);
		gl.uniform1f(uniforms.uMorph, frame.morph);
		gl.uniform2f(uniforms.uRotation, frame.yaw, frame.pitch);
		gl.uniformMatrix4fv(uniforms.uProjection, false, this.projection);
		gl.uniform1f(uniforms.uDistance, this.distance);
		gl.uniform1f(uniforms.uAspect, this.aspect);
		gl.uniform3f(uniforms.uPointer, frame.pointerX, frame.pointerY, frame.pointerStrength);
		gl.uniform1f(uniforms.uBurst, frame.burst);
		gl.uniform1f(uniforms.uTime, frame.time);
		gl.uniform1f(uniforms.uScan, frame.scan);
		gl.uniform1f(uniforms.uPointSize, this.pointSize);
		gl.drawArrays(gl.POINTS, 0, this.count);
	}

	/** Frees GPU memory and hands the context back to the browser. */
	dispose() {
		const { gl } = this;
		for (const buffer of this.buffers) gl.deleteBuffer(buffer);
		for (const shader of this.shaders) gl.deleteShader(shader);
		gl.deleteProgram(this.program);
		gl.getExtension('WEBGL_lose_context')?.loseContext();
	}
}
