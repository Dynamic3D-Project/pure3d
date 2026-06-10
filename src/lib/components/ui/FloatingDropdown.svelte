<script lang="ts">
	import { autoUpdate, computePosition, flip, offset, shift, size } from '@floating-ui/dom';
	import type { Placement } from '@floating-ui/dom';
	import type { Snippet } from 'svelte';

	interface Props {
		open: boolean;
		referenceElement?: HTMLElement;
		placement?: Placement;
		minWidth?: number;
		maxWidth?: number;
		maxHeight?: number;
		offsetPx?: number;
		element?: HTMLDivElement;
		class?: string;
		role?: string;
		onclose: () => void;
		children: Snippet;
	}

	let {
		open,
		referenceElement = $bindable(),
		placement = 'bottom-start',
		minWidth,
		maxWidth = 420,
		maxHeight = 320,
		offsetPx = 6,
		element = $bindable(),
		class: className = '',
		role,
		onclose,
		children
	}: Props = $props();

	let dropdownElement: HTMLDivElement | undefined = $state();
	let cleanupPosition: (() => void) | undefined;

	function updatePosition() {
		if (!referenceElement || !dropdownElement) return;

		computePosition(referenceElement, dropdownElement, {
			placement,
			strategy: 'fixed',
			middleware: [
				offset(offsetPx),
				flip({ fallbackPlacements: ['bottom-start', 'bottom-end', 'top-start', 'top-end'] }),
				shift({ padding: 8 }),
				size({
					padding: 8,
					apply({ availableWidth, availableHeight, rects }) {
						if (!dropdownElement) return;
						const width = Math.max(minWidth ?? rects.reference.width, rects.reference.width);
						dropdownElement.style.width = `${Math.min(width, maxWidth, availableWidth)}px`;
						dropdownElement.style.maxHeight = `${Math.min(maxHeight, availableHeight)}px`;
					}
				})
			]
		}).then(({ x, y }) => {
			if (!dropdownElement) return;
			Object.assign(dropdownElement.style, {
				left: `${x}px`,
				top: `${y}px`,
				visibility: 'visible'
			});
		});
	}

	$effect(() => {
		element = dropdownElement;
	});

	$effect(() => {
		if (open && referenceElement && dropdownElement) {
			cleanupPosition?.();
			cleanupPosition = autoUpdate(referenceElement, dropdownElement, updatePosition, {
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

		function handlePointerDown(event: PointerEvent) {
			const target = event.target as Node;
			if (dropdownElement?.contains(target) || referenceElement?.contains(target)) return;
			onclose();
		}

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') onclose();
		}

		document.addEventListener('pointerdown', handlePointerDown, true);
		window.addEventListener('keydown', handleKeyDown);

		return () => {
			document.removeEventListener('pointerdown', handlePointerDown, true);
			window.removeEventListener('keydown', handleKeyDown);
		};
	});
</script>

{#if open}
	<div
		bind:this={dropdownElement}
		{role}
		class="fixed z-50 overflow-x-hidden overflow-y-auto rounded-box border border-base-300 bg-base-100 text-base-content shadow-lg outline-none {className}"
		style="visibility: hidden;"
	>
		{@render children()}
	</div>
{/if}
