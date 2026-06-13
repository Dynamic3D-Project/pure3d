<script lang="ts">
	import { autoUpdate, computePosition, flip, offset, shift, size } from '@floating-ui/dom';
	import type { Placement } from '@floating-ui/dom';
	import type { Snippet } from 'svelte';

	interface Props {
		open: boolean;
		referenceElement?: HTMLElement;
		id?: string;
		labelledby?: string;
		placement?: Placement;
		maxWidth?: number;
		maxHeight?: number;
		onclose: () => void;
		header: Snippet;
		children: Snippet;
		footer?: Snippet;
	}

	let {
		open,
		referenceElement = $bindable(),
		id,
		labelledby,
		placement = 'bottom-end',
		maxWidth = 896,
		maxHeight = 760,
		onclose,
		header,
		children,
		footer
	}: Props = $props();

	let modalElement: HTMLDivElement | undefined = $state();
	let cleanupPosition: (() => void) | undefined;
	let contentOverflows = $state(false);

	function updateContentOverflow() {
		if (!modalElement) return;
		const body = modalElement.querySelector('[data-floating-modal-body]');
		contentOverflows = !!body && body.scrollHeight > body.clientHeight + 1;
	}

	function updatePosition() {
		if (!referenceElement || !modalElement) return;

		computePosition(referenceElement, modalElement, {
			placement,
			strategy: 'fixed',
			middleware: [
				offset(12),
				flip({ fallbackPlacements: ['bottom-start', 'top-end', 'top-start'] }),
				shift({ padding: 16 }),
				size({
					padding: 16,
					apply({ availableWidth, availableHeight }) {
						if (!modalElement) return;
						modalElement.style.width = `${Math.min(maxWidth, availableWidth)}px`;
						modalElement.style.maxHeight = `${Math.min(maxHeight, availableHeight)}px`;
					}
				})
			]
		}).then(({ x, y }) => {
			if (!modalElement) return;
			Object.assign(modalElement.style, {
				left: `${x}px`,
				top: `${y}px`,
				visibility: 'visible'
			});
			updateContentOverflow();
		});
	}

	$effect(() => {
		if (open && referenceElement && modalElement) {
			cleanupPosition?.();
			cleanupPosition = autoUpdate(referenceElement, modalElement, updatePosition, {
				ancestorScroll: true,
				ancestorResize: true,
				elementResize: true,
				layoutShift: true
			});
		} else {
			cleanupPosition?.();
			cleanupPosition = undefined;
		}

		return () => {
			cleanupPosition?.();
			cleanupPosition = undefined;
		};
	});

	$effect(() => {
		if (!open) return;

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') onclose();
		}

		window.addEventListener('keydown', handleKeyDown);

		return () => {
			window.removeEventListener('keydown', handleKeyDown);
		};
	});
</script>

{#if open}
	<div
		class="fixed inset-0 z-40 bg-black/25 backdrop-blur-[1px]"
		aria-hidden="true"
		onclick={onclose}
	></div>
	<div
		{id}
		bind:this={modalElement}
		role="dialog"
		aria-modal="true"
		aria-labelledby={labelledby}
		class="fixed z-50 flex min-h-0 flex-col overflow-hidden rounded-box border border-base-300 bg-base-200 shadow-2xl outline-none"
		style="visibility: hidden;"
	>
		<div class="shrink-0 border-b border-base-300/60 px-4 py-4">
			{@render header()}
		</div>

		<div
			data-floating-modal-body
			class="min-h-0 flex-1 overflow-y-auto px-4 py-4"
			class:border-b={footer && contentOverflows}
			class:border-base-300={footer && contentOverflows}
		>
			{@render children()}
		</div>

		{#if footer}
			<div class="shrink-0 bg-base-200 px-4 py-3">
				{@render footer()}
			</div>
		{/if}
	</div>
{/if}
