import { expect, test } from 'bun:test';
import { buildParticleCloud, CONCEPTUAL_PARTICLE_FORMS } from './particle-forms';

test('adds only edition forms that have sampled points and keeps form arrays synchronized', () => {
	const cloud = buildParticleCloud(64, 8, {
		anchorPoints: 4,
		editionPoints: {
			'baby-yoda': new Float32Array([0.1, 0.2, 0.3, -0.1, -0.2, -0.3])
		}
	});

	expect(cloud.formDefinitions.map(({ id }) => id)).toEqual([
		'baby-yoda',
		...CONCEPTUAL_PARTICLE_FORMS.map(({ id }) => id)
	]);
	expect(cloud.forms).toHaveLength(cloud.formDefinitions.length);
	for (const form of cloud.forms) expect(form).toHaveLength(cloud.count * 3);
});
