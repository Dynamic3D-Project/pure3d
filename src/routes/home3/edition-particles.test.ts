import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { decodeParticleFile, loadEditionParticles } from './edition-particles';

const particleDirectory = fileURLToPath(
	new URL('../../../static/models/particles/', import.meta.url)
);

test('decodes every checked-in edition cloud as finite normalized xyz points', async () => {
	for (const filename of ['baby-yoda.bin', 'rembrandts-birthplace.bin', 'petrol-lamp.bin']) {
		const bytes = await readFile(`${particleDirectory}${filename}`);
		const points = decodeParticleFile(Uint8Array.from(bytes).buffer, filename);
		expect(points).toHaveLength(18_000 * 3);
		expect(points.every((value) => Number.isFinite(value) && Math.abs(value) <= 1.001)).toBeTrue();
	}
});

test('keeps valid edition clouds when another file fails', async () => {
	const valid = await readFile(`${particleDirectory}baby-yoda.bin`);
	const fetcher = (async (input: RequestInfo | URL) => {
		const url = String(input);
		return url.endsWith('petrol-lamp.bin')
			? new Response('missing', { status: 404 })
			: new Response(Uint8Array.from(valid));
	}) as typeof fetch;

	const clouds = await loadEditionParticles(new AbortController().signal, fetcher);
	expect(Object.keys(clouds)).toEqual(['baby-yoda', 'rembrandts-birthplace']);
	expect(clouds['baby-yoda']).toHaveLength(18_000 * 3);
});

test('rejects a particle file whose declared count and bytes disagree', () => {
	const malformed = new ArrayBuffer(18);
	const view = new DataView(malformed);
	for (const [index, character] of [...'P3DP'].entries()) {
		view.setUint8(index, character.charCodeAt(0));
	}
	view.setUint16(4, 1, true);
	view.setUint32(8, 2, true);
	expect(() => decodeParticleFile(malformed)).toThrow('invalid header or length');
});
