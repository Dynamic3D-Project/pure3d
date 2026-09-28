<script lang="ts">
	interface Props {
		/** Lamp direction around the plate, in degrees; 0 is from the right, 90 from above. */
		azimuth: number;
		/** Lamp height above the surface, in degrees. */
		elevation: number;
		disabled?: boolean;
		onchange: (azimuth: number, elevation: number) => void;
	}

	let { azimuth, elevation, disabled = false, onchange }: Props = $props();

	const MIN_ELEVATION = 4;
	const MAX_ELEVATION = 88;
	const DIRECTIONS = [
		'the right',
		'the upper right',
		'above',
		'the upper left',
		'the left',
		'the lower left',
		'below',
		'the lower right'
	];

	let pad = $state<HTMLElement>();
	let dragging = $state(false);

	const direction = $derived(DIRECTIONS[Math.round(azimuth / 45) % 8]);
	const valueText = $derived(
		`Light from ${direction}, ${azimuth}°, ${elevation}° above the surface${elevation < 20 ? ', raking' : ''}`
	);
	// The rim of the dial is a grazing lamp, the centre a lamp straight overhead.
	const reach = $derived((MAX_ELEVATION - elevation) / (MAX_ELEVATION - MIN_ELEVATION));
	const dotX = $derived(50 + 42 * reach * Math.cos((azimuth * Math.PI) / 180));
	const dotY = $derived(50 - 42 * reach * Math.sin((azimuth * Math.PI) / 180));

	const wrapDegrees = (value: number) => ((Math.round(value) % 360) + 360) % 360;
	const clampElevation = (value: number) =>
		Math.round(Math.min(MAX_ELEVATION, Math.max(MIN_ELEVATION, value)));

	function fromPointer(event: PointerEvent) {
		if (!pad) return;
		const rect = pad.getBoundingClientRect();
		const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
		const y = 1 - ((event.clientY - rect.top) / rect.height) * 2;
		const distance = Math.min(1, Math.hypot(x, y) / 0.84);
		onchange(
			wrapDegrees((Math.atan2(y, x) * 180) / Math.PI),
			clampElevation(MAX_ELEVATION - distance * (MAX_ELEVATION - MIN_ELEVATION))
		);
	}

	function onpointerdown(event: PointerEvent) {
		if (disabled || event.button !== 0) return;
		event.preventDefault();
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		(event.currentTarget as HTMLElement).focus();
		dragging = true;
		fromPointer(event);
	}

	function onpointermove(event: PointerEvent) {
		if (dragging) fromPointer(event);
	}

	function onpointerup() {
		dragging = false;
	}

	function onkeydown(event: KeyboardEvent) {
		if (disabled) return;
		const turn = event.shiftKey ? 15 : 5;
		const lift = event.shiftKey ? 6 : 2;
		let next: [number, number] | null = null;
		if (event.key === 'ArrowLeft') next = [azimuth + turn, elevation];
		else if (event.key === 'ArrowRight') next = [azimuth - turn, elevation];
		else if (event.key === 'ArrowUp') next = [azimuth, elevation + lift];
		else if (event.key === 'ArrowDown') next = [azimuth, elevation - lift];
		else if (event.key === 'Home') next = [azimuth, MIN_ELEVATION];
		else if (event.key === 'End') next = [azimuth, MAX_ELEVATION];
		if (!next) return;
		event.preventDefault();
		onchange(wrapDegrees(next[0]), clampElevation(next[1]));
	}
</script>

<div id="lamp-dial" class:is-disabled={disabled}>
	<div
		bind:this={pad}
		class="pad"
		class:is-dragging={dragging}
		role="slider"
		tabindex={disabled ? -1 : 0}
		aria-label="Lamp position"
		aria-valuemin={0}
		aria-valuemax={359}
		aria-valuenow={azimuth}
		aria-valuetext={valueText}
		aria-describedby="lamp-dial-keys"
		aria-disabled={disabled}
		{onpointerdown}
		{onpointermove}
		{onpointerup}
		onpointercancel={onpointerup}
		{onkeydown}
	>
		<svg viewBox="0 0 100 100" aria-hidden="true">
			<circle class="rim" cx="50" cy="50" r="42" />
			<circle class="ring" cx="50" cy="50" r="28" />
			<circle class="ring" cx="50" cy="50" r="14" />
			<line class="axis" x1="8" y1="50" x2="92" y2="50" />
			<line class="axis" x1="50" y1="8" x2="50" y2="92" />
			<line class="beam" x1="50" y1="50" x2={dotX} y2={dotY} />
			<circle class="lamp" cx={dotX} cy={dotY} r="6" />
		</svg>
	</div>
	<p class="readout" aria-hidden="true">
		<span>{azimuth}°</span>
		<span>{elevation}° up</span>
	</p>
	<p id="lamp-dial-keys" class="sr-only">
		Left and right arrows move the lamp around the tablet; up and down raise and lower it. Hold
		Shift for larger steps.
	</p>
</div>

<style>
	#lamp-dial {
		display: grid;
		justify-items: center;
		gap: 4px;
	}
	.pad {
		width: 76px;
		height: 76px;
		border-radius: 50%;
		background: radial-gradient(circle at 50% 50%, #26352b 0%, #121915 100%);
		box-shadow: inset 0 0 0 1px rgba(244, 241, 235, 0.22);
		cursor: grab;
		touch-action: none;
	}
	.pad.is-dragging {
		cursor: grabbing;
	}
	.pad:focus-visible {
		outline: 2px solid var(--color-vermillion);
		outline-offset: 3px;
	}
	.is-disabled .pad {
		opacity: 0.45;
		cursor: not-allowed;
	}
	svg {
		display: block;
		width: 100%;
		height: 100%;
	}
	.rim,
	.ring {
		fill: none;
		stroke: rgba(244, 241, 235, 0.22);
		stroke-width: 1;
	}
	.rim {
		stroke: rgba(244, 241, 235, 0.4);
	}
	.axis {
		stroke: rgba(244, 241, 235, 0.12);
		stroke-width: 1;
	}
	.beam {
		stroke: rgba(255, 226, 190, 0.55);
		stroke-width: 1.5;
	}
	.lamp {
		fill: #ffe2be;
		stroke: var(--color-vermillion);
		stroke-width: 2;
	}
	.readout {
		display: flex;
		gap: 8px;
		margin: 0;
		font: 500 10px/1 var(--font-mono);
		letter-spacing: 0.04em;
		color: rgba(244, 241, 235, 0.72);
		font-variant-numeric: tabular-nums;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
