const HEADER_BYTES = 12;
const MAX_POINTS = 18_000;

const EDITION_CLOUDS = [
	['baby-yoda', 'baby-yoda.bin'],
	['rembrandts-birthplace', 'rembrandts-birthplace.bin'],
	['petrol-lamp', 'petrol-lamp.bin']
] as const;

export function decodeParticleFile(buffer: ArrayBuffer, filename = 'particle file') {
	if (buffer.byteLength < HEADER_BYTES || buffer.byteLength > HEADER_BYTES + MAX_POINTS * 6) {
		throw new Error(`${filename} has an invalid size.`);
	}
	const view = new DataView(buffer);
	const magic = String.fromCharCode(...new Uint8Array(buffer, 0, 4));
	const version = view.getUint16(4, true);
	const count = view.getUint32(8, true);
	if (
		magic !== 'P3DP' ||
		version !== 1 ||
		count < 1 ||
		buffer.byteLength !== HEADER_BYTES + count * 6
	) {
		throw new Error(`${filename} has an invalid header or length.`);
	}
	const points = new Float32Array(count * 3);
	for (let i = 0; i < points.length; i++) {
		const value = view.getInt16(HEADER_BYTES + i * 2, true) / 32767;
		if (!Number.isFinite(value) || Math.abs(value) > 1.001) {
			throw new Error(`${filename} contains an invalid particle.`);
		}
		points[i] = value;
	}
	return points;
}

async function loadParticleFile(
	filename: string,
	signal: AbortSignal,
	fetcher: typeof fetch,
	basePath: string
) {
	const response = await fetcher(`${basePath}/models/particles/${filename}`, {
		signal: AbortSignal.any([signal, AbortSignal.timeout(3000)])
	});
	if (!response.ok) throw new Error(`${filename} returned ${response.status}.`);
	return decodeParticleFile(await response.arrayBuffer(), filename);
}

/** Each edition loads independently, so one missing cloud cannot remove the other real forms. */
export async function loadEditionParticles(
	signal: AbortSignal,
	fetcher: typeof fetch = fetch,
	basePath = ''
) {
	const results = await Promise.allSettled(
		EDITION_CLOUDS.map(
			async ([id, filename]) =>
				[id, await loadParticleFile(filename, signal, fetcher, basePath)] as const
		)
	);
	return Object.fromEntries(
		results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))
	) as Record<string, Float32Array>;
}
