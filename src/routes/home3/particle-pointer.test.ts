import { describe, expect, test } from 'bun:test';
import {
	POINTER_TRAIL_MAX_SETTLE_SECONDS,
	POINTER_TRAIL_SAMPLES,
	POINTER_TRAIL_STRIDE,
	advancePointerTrail,
	decayPointerTarget,
	easePointerStrength,
	pointerStrengthFromSpeed,
	pointerTrailSettle,
	savePointerTrailSample
} from './particle-pointer';

describe('particle pointer brush', () => {
	test('responds nonlinearly to mouse speed while slow movement stays calm', () => {
		expect(pointerStrengthFromSpeed(0)).toBe(0);
		expect(pointerStrengthFromSpeed(60)).toBe(0);
		expect(pointerStrengthFromSpeed(120)).toBeLessThan(0.01);
		expect(pointerStrengthFromSpeed(600)).toBeGreaterThan(pointerStrengthFromSpeed(300) * 2);
		expect(pointerStrengthFromSpeed(5000)).toBe(0.75);
	});

	test('builds and returns smoothly without an entrance impulse', () => {
		const firstFrame = easePointerStrength(0, pointerStrengthFromSpeed(60), 1 / 60);
		expect(firstFrame).toBe(0);

		const fastTarget = pointerStrengthFromSpeed(1860);
		const rising = easePointerStrength(0, fastTarget, 1 / 60);
		expect(rising).toBeGreaterThan(0);
		expect(rising).toBeLessThan(fastTarget);

		const decayedTarget = decayPointerTarget(fastTarget, 1);
		const returning = easePointerStrength(fastTarget, decayedTarget, 1);
		expect(decayedTarget).toBeLessThan(fastTarget);
		expect(returning).toBeGreaterThan(decayedTarget);
		expect(returning).toBeLessThan(fastTarget);
	});

	test('restores grains over seed-dependent 1.8 to 2.2 second envelopes', () => {
		expect(pointerTrailSettle(0, 0)).toBe(1);
		expect(pointerTrailSettle(1, 0.5)).toBeGreaterThan(0);
		expect(pointerTrailSettle(1.8, 0)).toBe(0);
		expect(pointerTrailSettle(2.19, 1)).toBeGreaterThan(0);
		expect(pointerTrailSettle(2.2, 1)).toBe(0);
	});

	test('expires samples before ring-buffer slots can be reused', () => {
		const trail = new Float32Array(POINTER_TRAIL_SAMPLES * POINTER_TRAIL_STRIDE);
		trail[2] = 0.7;
		trail[3] = 0.4;

		const blocked = savePointerTrailSample({
			trail,
			trailIndex: 0,
			lastSavedAt: 0,
			now: 500,
			x: 0.5,
			y: -0.5,
			strength: 0.6
		});
		expect(blocked.saved).toBe(false);
		expect(Array.from(trail.slice(0, 4))).toEqual([0, 0, expect.closeTo(0.7), expect.closeTo(0.4)]);

		advancePointerTrail(trail, POINTER_TRAIL_MAX_SETTLE_SECONDS);
		expect(trail[2]).toBe(0);

		const saved = savePointerTrailSample({
			trail,
			trailIndex: 0,
			lastSavedAt: 0,
			now: 500,
			x: 0.5,
			y: -0.5,
			strength: 0.6
		});
		expect(saved).toEqual({ trailIndex: 1, lastSavedAt: 500, saved: true });
		expect(Array.from(trail.slice(0, 4))).toEqual([
			expect.closeTo(0.5),
			expect.closeTo(-0.5),
			expect.closeTo(0.6),
			0
		]);
	});
});
