<script lang="ts">
	import type { Specimen } from './specimens';

	interface Props {
		specimens: Specimen[];
		activeId: string;
		onselect: (id: string) => void;
	}

	let { specimens, activeId, onselect }: Props = $props();
</script>

<div id="specimen-tray" role="group" aria-label="Choose an edition to inspect">
	{#each specimens as specimen, index (specimen.id)}
		<button
			type="button"
			class="slot"
			aria-pressed={specimen.id === activeId}
			onclick={() => onselect(specimen.id)}
		>
			<img src={specimen.cover} alt="" loading="lazy" decoding="async" />
			<span class="index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
			<span class="sr-only">Show {specimen.title}</span>
		</button>
	{/each}
</div>

<style>
	#specimen-tray {
		display: flex;
		gap: 8px;
	}
	.slot {
		position: relative;
		flex: 0 0 64px;
		height: 64px;
		padding: 0;
		overflow: hidden;
		border: 1px solid color-mix(in srgb, var(--color-base-content) 20%, transparent);
		border-radius: var(--radius-control);
		background: var(--color-paper-2);
		cursor: pointer;
		transition:
			border-color 0.2s ease,
			translate 0.2s ease;
	}
	.slot img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: grayscale(0.85) contrast(1.05);
		transition: filter 0.3s ease;
	}
	.slot:hover {
		translate: 0 -2px;
		border-color: var(--color-ink);
	}
	.slot:hover img,
	.slot[aria-pressed='true'] img {
		filter: none;
	}
	.slot[aria-pressed='true'] {
		border-color: var(--color-vermillion);
		box-shadow: 0 0 0 2px var(--color-vermillion);
	}
	.slot:focus-visible {
		outline: 2px solid var(--color-vermillion);
		outline-offset: 3px;
	}
	.index {
		position: absolute;
		left: 5px;
		bottom: 4px;
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.06em;
		color: #fff;
		text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7);
	}
	@media (prefers-reduced-motion: reduce) {
		.slot,
		.slot img {
			transition: none;
		}
		.slot:hover {
			translate: none;
		}
	}
</style>
