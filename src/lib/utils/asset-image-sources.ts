import publishedManifest from './card-image-derivatives.json';

export interface CardImageSources {
	src: string;
	srcset?: string;
}

export interface CardImageDerivativeManifest {
	version: 1;
	images: Record<string, Array<{ url: string; width: number }>>;
}

function manifestKeys(url: string): string[] {
	try {
		const parsed = new URL(url, 'https://local.invalid');
		return [url, `${parsed.pathname}${parsed.search}`, parsed.pathname];
	} catch {
		return [url];
	}
}

function originalImageUrl(url: string): string {
	if (!/\/api\/files\//.test(url)) return url;
	try {
		const absolute = /^https?:\/\//.test(url);
		const parsed = new URL(url, 'https://local.invalid');
		parsed.searchParams.delete('thumb');
		return absolute ? parsed.toString() : `${parsed.pathname}${parsed.search}${parsed.hash}`;
	} catch {
		return url;
	}
}

export function getCardImageSources(
	url: string,
	manifest: CardImageDerivativeManifest = publishedManifest as CardImageDerivativeManifest
): CardImageSources {
	const candidates = manifestKeys(url)
		.map((key) => manifest.images[key])
		.find(Array.isArray)
		?.filter(
			(candidate) =>
				typeof candidate.url === 'string' &&
				candidate.url.length > 0 &&
				Number.isInteger(candidate.width) &&
				candidate.width > 0
		)
		.sort((left, right) => left.width - right.width);

	if (candidates?.length) {
		return {
			src: candidates.at(-1)!.url,
			srcset: candidates.map((candidate) => `${candidate.url} ${candidate.width}w`).join(', ')
		};
	}

	return { src: originalImageUrl(url), srcset: undefined };
}
