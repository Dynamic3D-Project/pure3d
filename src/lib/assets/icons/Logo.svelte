<script lang="ts">
	let { class: className = '' }: { class?: string } = $props();
</script>

<span class="wm-inline {className}" aria-label="Pure 3D">
	Pure&nbsp;<span class="wm-3">3</span><svg class="wm-d" viewBox="0 0 24 24" aria-hidden="true">
		<path
			d="M3 3 L15 3 C 21 3, 22 9, 22 12 C 22 15, 21 21, 15 21 L3 21 Z"
			fill="none"
			stroke="currentColor"
			stroke-width="1.6"
			stroke-linejoin="round"
		/>
		<path
			d="M3 3 L3 21 M3 12 L22 12 M3 3 L12 12 L3 21 M12 3 L12 21 M12 12 L22 12 M12 3 L22 12 L12 21"
			fill="none"
			stroke="currentColor"
			stroke-width="1"
			stroke-linejoin="round"
			opacity="0.9"
		/>
		<circle cx="3" cy="12" r="1.4" fill="var(--color-vermillion, oklch(62% 0.19 35))" />
		<circle cx="22" cy="12" r="1" fill="currentColor" />
		<circle cx="12" cy="12" r="1" fill="currentColor" />
	</svg>
</span>

<style>
	.wm-inline {
		display: inline-flex;
		align-items: baseline;
		gap: 0;
		font-family: var(--font-sans, 'Inter Tight', sans-serif);
		font-weight: 600;
		letter-spacing: -0.015em;
		font-size: 22px;
		line-height: 1;
		color: var(--color-ink, currentColor);
		user-select: none;
	}
	.wm-3 {
		font-feature-settings: 'ss01';
	}
	.wm-d {
		width: 22px;
		height: 22px;
		margin-left: 1px;
		align-self: center;
		color: currentColor;
		flex: none;
	}
</style>
