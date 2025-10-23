<script lang="ts">
	import { JsonView } from '@zerodevx/svelte-json-view';
	import IconX from '~icons/heroicons/x-mark';
	import IconMinus from '~icons/heroicons/minus';
	import IconPlus from '~icons/heroicons/plus';
	import IconDocumentDuplicate from '~icons/heroicons/document-duplicate';
	import IconChevronUpDown from '~icons/heroicons/chevron-up-down';

	// Sample JSON data for the debug overlay
	const sampleData = {
		user: {
			id: 'usr_123456789',
			email: 'user@example.com',
			profile: {
				firstName: 'John',
				lastName: 'Doe',
				avatar: 'https://example.com/avatar.jpg',
				preferences: {
					theme: 'dark',
					notifications: {
						email: true,
						push: false,
						sms: true
					},
					language: 'en-US'
				}
			},
			roles: ['user', 'beta-tester'],
			metadata: {
				createdAt: '2024-01-15T10:30:00Z',
				lastLogin: '2024-03-15T14:22:33Z',
				loginCount: 142,
				isVerified: true
			}
		},
		session: {
			token: 'tok_abcdef123456',
			expiresAt: '2024-03-16T14:22:33Z',
			permissions: ['read:profile', 'write:todos', 'admin:users']
		},
		todos: [
			{ id: 1, text: 'Learn SvelteKit', completed: true, priority: 'high' },
			{ id: 2, text: 'Build awesome app', completed: false, priority: 'medium' },
			{ id: 3, text: 'Deploy to production', completed: false, priority: 'low' }
		],
		appConfig: {
			version: '1.2.3',
			environment: 'development',
			features: {
				debugMode: true,
				analytics: false,
				betaFeatures: ['new-ui', 'advanced-search']
			}
		}
	};

	interface Props {
		data?: any;
		title?: string;
		onClose?: () => void;
	}

	let { data = sampleData, title = 'Debug Overlay', onClose }: Props = $props();

	// Component state
	let depth = $state(2);
	let isMinimized = $state(false);
	let isDragging = $state(false);
	let position = $state({ x: 12, y: 160 });
	let dragStart = $state({ x: 0, y: 0 });

	// Copy JSON to clipboard
	async function copyToClipboard() {
		try {
			await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
		} catch (err) {
			console.error('Failed to copy JSON:', err);
		}
	}

	// Drag functionality
	function handlePointerDown(event: PointerEvent) {
		if (
			event.target === event.currentTarget ||
			(event.target as HTMLElement)?.closest('.drag-handle')
		) {
			isDragging = true;
			dragStart.x = event.clientX - position.x;
			dragStart.y = event.clientY - position.y;
			(event.target as HTMLElement).setPointerCapture(event.pointerId);
		}
	}

	function handlePointerMove(event: PointerEvent) {
		if (isDragging) {
			position.x = event.clientX - dragStart.x;
			position.y = event.clientY - dragStart.y;
		}
	}

	function handlePointerUp(event: PointerEvent) {
		if (isDragging) {
			isDragging = false;
			(event.target as HTMLElement).releasePointerCapture(event.pointerId);
		}
	}
</script>

<div
	class="debug-overlay bg-base-100/95 border-base-300 fixed z-50 max-w-2xl min-w-80 rounded-lg border shadow-2xl backdrop-blur-md"
	style="left: {position.x}px; top: {position.y}px"
	onpointerdown={handlePointerDown}
	onpointermove={handlePointerMove}
	onpointerup={handlePointerUp}
>
	<!-- Header -->
	<div
		class="drag-handle border-base-300 flex cursor-move items-center justify-between border-b p-3"
	>
		<div class="flex items-center gap-2">
			<IconChevronUpDown class="text-base-content/50 h-4 w-4" />
			<h3 class="text-base-content text-sm font-semibold">{title}</h3>
		</div>

		<div class="flex items-center gap-1">
			<!-- Depth control -->
			<div class="flex items-center gap-2 text-xs">
				<span class="text-base-content/70">Depth:</span>
				<button
					onclick={() => (depth = Math.max(1, depth - 1))}
					class="btn btn-ghost btn-xs"
					disabled={depth <= 1}
				>
					<IconMinus class="h-3 w-3" />
				</button>
				<span class="w-4 text-center font-mono">{depth}</span>
				<button
					onclick={() => (depth = Math.min(10, depth + 1))}
					class="btn btn-ghost btn-xs"
					disabled={depth >= 10}
				>
					<IconPlus class="h-3 w-3" />
				</button>
			</div>

			<!-- Copy button -->
			<button onclick={copyToClipboard} class="btn btn-ghost btn-xs" title="Copy JSON to clipboard">
				<IconDocumentDuplicate class="h-3 w-3" />
			</button>

			<!-- Minimize button -->
			<button
				onclick={() => (isMinimized = !isMinimized)}
				class="btn btn-ghost btn-xs"
				title={isMinimized ? 'Expand' : 'Minimize'}
			>
				<IconMinus class="h-3 w-3" />
			</button>

			<!-- Close button -->
			<button
				onclick={onClose}
				class="btn btn-ghost btn-xs text-error hover:bg-error hover:text-error-content"
				title="Close debug overlay"
			>
				<IconX class="h-3 w-3" />
			</button>
		</div>
	</div>

	<!-- Content -->
	{#if !isMinimized}
		<div class="max-h-96 overflow-auto p-4">
			<JsonView json={data} {depth} />
		</div>
	{/if}
</div>

<style>
	.debug-overlay {
		user-select: none;
	}

	.debug-overlay :global(.json-view) {
		font-family:
			'JetBrains Mono', 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New',
			monospace;
		font-size: 12px;
		line-height: 1.4;
	}

	/* Theme customization for the JSON viewer */
	.debug-overlay :global(.json-view) {
		--json-view-key-color: hsl(var(--pc));
		--json-view-string-color: hsl(var(--su));
		--json-view-number-color: hsl(var(--wa));
		--json-view-boolean-color: hsl(var(--in));
		--json-view-null-color: hsl(var(--er));
		--json-view-background: transparent;
		--json-view-color: hsl(var(--bc));
		--json-view-punctuation-color: hsl(var(--bc) / 0.7);
		--json-view-bracket-color: hsl(var(--bc) / 0.8);
	}

	/* Dragging state styling */
	.debug-overlay:has(.drag-handle:active) {
		cursor: grabbing;
		opacity: 0.9;
	}

	.drag-handle:hover {
		background-color: hsl(var(--b2));
	}
</style>
