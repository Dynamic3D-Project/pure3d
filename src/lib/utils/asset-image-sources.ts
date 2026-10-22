import { base } from '$app/paths';
import publishedManifest from './card-image-derivatives.json';
import editionCoverDimensions from './edition-cover-dimensions.json';

export interface CardImageSources {
	src: string;
	srcset?: string;
	width?: number;
	height?: number;
}

export interface CardImageDerivativeManifest {
	version: 1;
	images: Record<string, Array<{ url: string; width: number; height?: number }>>;
}

function resolveDerivativeUrl(url: string): string {
	const legacyPrefix = 'https://dynamic3d-project.github.io/pure3d/card-images/';
	if (url.startsWith(legacyPrefix)) {
		return `${base}/card-images/${url.slice(legacyPrefix.length)}`;
	}
	if (url.startsWith('/card-images/')) return `${base}${url}`;
	return url;
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

function getEditionCoverDimensions(url: string) {
	try {
		const pathname = new URL(url, 'https://local.invalid').pathname;
		const key = pathname.includes('/project/')
			? pathname.slice(pathname.indexOf('/project/'))
			: pathname;
		return (editionCoverDimensions as Record<string, { width: number; height: number }>)[key];
	} catch {
		return undefined;
	}
}

export function getCardImageSources(
	url: string,
	manifest: CardImageDerivativeManifest = publishedManifest as CardImageDerivativeManifest
): CardImageSources {
	const dimensions = getEditionCoverDimensions(url);
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
		.map((candidate) => ({ ...candidate, url: resolveDerivativeUrl(candidate.url) }))
		.sort((left, right) => left.width - right.width);

	if (candidates?.length) {
		const largest = candidates.at(-1)!;
		return {
			...dimensions,
			...(Number.isInteger(largest.height) && largest.height! > 0
				? { width: largest.width, height: largest.height }
				: {}),
			src: largest.url,
			srcset: candidates.map((candidate) => `${candidate.url} ${candidate.width}w`).join(', ')
		};
	}

	return { ...dimensions, src: originalImageUrl(url), srcset: undefined };
}
