import { pbNormalize } from './pb-filename';

export type FileMap = Record<string, string>;

function basename(path: string): string {
	const slash = path.lastIndexOf('/');
	return slash === -1 ? path : path.slice(slash + 1);
}

function rewriteValue(value: unknown, fileMap: FileMap): unknown {
	if (Array.isArray(value)) {
		return value.map((item) => rewriteValue(item, fileMap));
	}
	if (value && typeof value === 'object') {
		const result: Record<string, unknown> = {};
		for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
			if (key === 'uri' && typeof v === 'string') {
				const mapped = fileMap[basename(v)] ?? fileMap[pbNormalize(basename(v))];
				result[key] = mapped ?? v;
			} else {
				result[key] = rewriteValue(v, fileMap);
			}
		}
		return result;
	}
	return value;
}

export function rewriteSceneJson<T extends object>(scene: T, fileMap: FileMap): T {
	return rewriteValue(scene, fileMap) as T;
}
