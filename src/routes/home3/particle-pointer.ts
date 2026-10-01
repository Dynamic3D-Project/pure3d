export const POINTER_TRAIL_SAMPLES = 24;
export const POINTER_TRAIL_STRIDE = 4;
export const POINTER_TRAIL_SAVE_INTERVAL_MS = 180;
export const POINTER_TRAIL_MIN_SETTLE_SECONDS = 1.8;
export const POINTER_TRAIL_MAX_SETTLE_SECONDS = 2.2;

const POINTER_SPEED_FLOOR = 60;
const POINTER_SPEED_RANGE = 1800;
const POINTER_STRENGTH_MAX = 0.75;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Maps mouse speed to brush strength; slow movement stays calm and fast sweeps saturate. */
export function pointerStrengthFromSpeed(speed: number) {
	return (
		Math.pow(clamp((speed - POINTER_SPEED_FLOOR) / POINTER_SPEED_RANGE, 0, 1), 1.4) *
		POINTER_STRENGTH_MAX
	);
}

export function decayPointerTarget(target: number, seconds: number) {
	return target * Math.exp(-seconds * 0.9);
}

export function easePointerStrength(current: number, target: number, seconds: number) {
	const rate = target > current ? 2.8 : 2.4;
	return current + (target - current) * (1 - Math.exp(-seconds * rate));
}

/** Ages every sample and clears expired strength before that ring-buffer slot can be reused. */
export function advancePointerTrail(trail: Float32Array, seconds: number) {
	for (let index = 0; index < trail.length; index += POINTER_TRAIL_STRIDE) {
		trail[index + 3] += seconds;
		if (trail[index + 3] >= POINTER_TRAIL_MAX_SETTLE_SECONDS) trail[index + 2] = 0;
	}
}

interface SaveTrailSample {
	trail: Float32Array;
	trailIndex: number;
	lastSavedAt: number;
	now: number;
	x: number;
	y: number;
	strength: number;
}

/** Writes only into an expired slot, preventing a live trail sample from jumping on overwrite. */
export function savePointerTrailSample({
	trail,
	trailIndex,
	lastSavedAt,
	now,
	x,
	y,
	strength
}: SaveTrailSample) {
	const index = trailIndex * POINTER_TRAIL_STRIDE;
	if (
		now - lastSavedAt <= POINTER_TRAIL_SAVE_INTERVAL_MS ||
		strength <= 0.02 ||
		trail[index + 2] >= 0.002
	) {
		return { trailIndex, lastSavedAt, saved: false };
	}
	trail[index] = x;
	trail[index + 1] = y;
	trail[index + 2] = strength;
	trail[index + 3] = 0;
	return {
		trailIndex: (trailIndex + 1) % POINTER_TRAIL_SAMPLES,
		lastSavedAt: now,
		saved: true
	};
}

function smoothstep(edge0: number, edge1: number, value: number) {
	const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
	return t * t * (3 - 2 * t);
}

/** Mirrors the shader's per-grain restoration envelope for focused timing tests. */
export function pointerTrailSettle(age: number, seed: number) {
	const duration = POINTER_TRAIL_MIN_SETTLE_SECONDS + clamp(seed, 0, 1) * 0.4;
	return 1 - smoothstep(0, duration, age);
}
