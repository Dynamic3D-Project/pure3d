export type SceneLoadingPhase = 'downloading' | 'preparing' | 'complete';

export function isRuntimeSceneReady(state: {
	sceneLoaded: boolean;
	documentLoaded: boolean;
	emptyDocument: boolean;
	assetsBusy: boolean;
}): boolean {
	// Voyager never emits sceneLoaded for zero models. Verify emptiness from the downloaded
	// document, not a temporarily empty runtime graph while model nodes are being created.
	return !state.assetsBusy && (state.sceneLoaded || (state.documentLoaded && state.emptyDocument));
}

export function isEmptySceneDocument(value: unknown): boolean {
	if (!value || typeof value !== 'object') return false;
	const source = value as {
		scene?: number;
		scenes?: { nodes?: number[] }[];
		nodes?: { model?: unknown; children?: number[] }[];
	};
	const roots = source.scenes?.[source.scene ?? 0]?.nodes;
	if (!Array.isArray(roots) || !Array.isArray(source.nodes)) return false;
	const pending = [...roots];
	const visited = new Set<number>();
	while (pending.length) {
		const index = pending.pop()!;
		if (!Number.isInteger(index) || index < 0 || !source.nodes[index]) return false;
		if (visited.has(index)) continue;
		visited.add(index);
		const node = source.nodes[index];
		if (node.model !== undefined && node.model !== null) return false;
		if (node.children !== undefined && !Array.isArray(node.children)) return false;
		pending.push(...(node.children ?? []));
	}
	return true;
}

/** Tracks transfer feedback while Voyager's CVViewer sceneLoaded output owns readiness. */
export class SceneLoadingTracker {
	private activeDownloads = 0;
	private runtimeSceneLoaded = false;

	get phase(): SceneLoadingPhase {
		if (this.runtimeSceneLoaded) return 'complete';
		return this.activeDownloads ? 'downloading' : 'preparing';
	}

	downloadStarted() {
		this.activeDownloads++;
	}

	downloadFinished() {
		this.activeDownloads = Math.max(0, this.activeDownloads - 1);
	}

	modelLoaded() {
		// Voyager can emit several model-load events per source model for quality levels.
	}

	sceneLoaded() {
		this.runtimeSceneLoaded = true;
	}
}
