export interface ViewerFetchOptions {
	root: () => string;
	overrides?: () => { url: string; content: string; contentType?: string }[] | undefined;
	companions?: () => { baseDir: string; byBasename: Record<string, string> } | undefined;
	progress?: (total: number, loaded: number) => void;
}

type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type FetchHost = { fetch: Fetch };
type Registration = { options: ViewerFetchOptions; active: boolean };
const registries = new WeakMap<
	FetchHost,
	{ native: Fetch; dispatch: Fetch; entries: Registration[] }
>();
const assetExtension = /\.(glb|gltf|bin|jpg|jpeg|png|webp|ktx2|draco)$/i;

function companionUrl(requested: string, options: ViewerFetchOptions): string | null {
	const assets = options.companions?.();
	if (!assets) return null;
	try {
		const url = new URL(requested);
		const directory = new URL(assets.baseDir);
		const prefix = directory.pathname.replace(/\/?$/, '/');
		if (
			url.origin !== directory.origin ||
			!url.pathname.startsWith(prefix) ||
			url.searchParams.has('token')
		)
			return null;
		const name = decodeURIComponent(url.pathname.slice(url.pathname.lastIndexOf('/') + 1));
		const dot = name.lastIndexOf('.');
		const stem = dot >= 0 ? name.slice(0, dot) : name;
		const extension = dot >= 0 ? name.slice(dot) : '';
		const key =
			stem
				.replace(/([a-z0-9])([A-Z])/g, '$1_$2')
				.replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '_')
				.replace(/_+/g, '_')
				.replace(/^_|_$/g, '') + extension.toLowerCase();
		return assets.byBasename[key] ?? null;
	} catch {
		return null;
	}
}

async function trackedResponse(response: Response, entry: Registration): Promise<Response> {
	const size = Number(response.headers.get('content-length'));
	if (!entry.active || !response.body || !Number.isFinite(size) || size <= 0) return response;
	entry.options.progress?.(size, 0);
	const reader = response.body.getReader();
	const stream = new ReadableStream<Uint8Array>({
		async pull(controller) {
			try {
				const { done, value } = await reader.read();
				if (done) {
					controller.close();
					reader.releaseLock();
					return;
				}
				if (entry.active) entry.options.progress?.(0, value.length);
				controller.enqueue(value);
			} catch (error) {
				controller.error(error);
				reader.releaseLock();
			}
		},
		async cancel(reason) {
			try {
				await reader.cancel(reason);
			} finally {
				reader.releaseLock();
			}
		}
	});
	return new Response(stream, {
		headers: response.headers,
		status: response.status,
		statusText: response.statusText
	});
}

/** A shared dispatcher prevents one viewer's teardown from restoring another's stale hooks. */
export function installViewerFetch(host: FetchHost, options: ViewerFetchOptions) {
	let registry = registries.get(host);
	if (!registry) {
		const native = host.fetch;
		const entries: Registration[] = [];
		const dispatch: Fetch = async (input, init) => {
			const requested =
				typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
			if (
				(init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase() !== 'GET'
			)
				return native.call(host, input, init);
			for (const entry of [...entries].reverse()) {
				const override = entry.options.overrides?.()?.find((item) => item.url === requested);
				if (override)
					return new Response(override.content, {
						headers: { 'content-type': override.contentType ?? 'application/json' }
					});
				const mapped = companionUrl(requested, entry.options);
				let tracked = false;
				try {
					const url = new URL(requested);
					const root = new URL(entry.options.root());
					tracked =
						url.origin === root.origin &&
						url.pathname.startsWith(root.pathname.replace(/\/?$/, '/')) &&
						assetExtension.test(url.pathname);
				} catch {
					/* Non-URL requests are passed through without tracking. */
				}
				if (!mapped && !tracked) continue;
				const redirected =
					mapped && mapped !== requested
						? input instanceof Request
							? new Request(mapped, input)
							: mapped
						: input;
				const response = await native.call(host, redirected, init);
				return tracked && entry.options.progress ? trackedResponse(response, entry) : response;
			}
			return native.call(host, input, init);
		};
		registry = { native, dispatch, entries };
		registries.set(host, registry);
		host.fetch = dispatch;
	}
	const entry = { options, active: true };
	registry.entries.push(entry);
	return () => {
		if (!entry.active) return;
		entry.active = false;
		registry.entries.splice(registry.entries.indexOf(entry), 1);
		if (!registry.entries.length) {
			if (host.fetch === registry.dispatch) host.fetch = registry.native;
			registries.delete(host);
		}
	};
}
