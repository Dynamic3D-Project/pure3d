import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const particleHero = await readFile(
	fileURLToPath(new URL('./ParticleHero.svelte', import.meta.url)),
	'utf8'
);
const home = await readFile(fileURLToPath(new URL('./Home3.svelte', import.meta.url)), 'utf8');

test('model controls wrap in both directions without replacing the idle cycle', () => {
	expect(particleHero).toContain(
		'showForm((formIndex - 1 + activeForms.length) % activeForms.length)'
	);
	expect(particleHero).toContain('showForm((formIndex + 1) % activeForms.length)');
	expect(particleHero).toContain('showForm((frame.to + 1) % activeForms.length)');
	expect(particleHero).toContain('aria-label="Previous model"');
	expect(particleHero).toContain('aria-label="Next model"');
});

test('model controls expose the requested idle, group-active, and touch emphasis', () => {
	expect(particleHero).toContain('opacity: 0.1;');
	expect(particleHero).toContain('.model-navigation:hover button,');
	expect(particleHero).toContain('.model-navigation:focus-within button');
	expect(particleHero).toContain('opacity: 0.85;');
	expect(particleHero).toContain('@media (hover: none)');
	expect(particleHero).toContain('opacity: 0.5;');
});

test('landing reveals use IntersectionObserver while reduced motion and no-JS keep content visible', () => {
	const reducedMotionGuard = home.indexOf("matchMedia('(prefers-reduced-motion: reduce)').matches");
	const pendingClass = home.indexOf("classList.add('reveal-pending')");
	expect(reducedMotionGuard).toBeGreaterThan(-1);
	expect(reducedMotionGuard).toBeLessThan(pendingClass);
	expect(home).toContain('new IntersectionObserver(');
	expect(home).toContain("classList.add('reveal-visible')");
	expect(home.match(/use:reveal/g)?.length).toBeGreaterThanOrEqual(10);
	expect(home).not.toContain('animation-timeline: view()');
	expect(home).not.toContain('<p class="eyebrow');
});
