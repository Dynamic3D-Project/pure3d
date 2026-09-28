<script lang="ts">
	import { LINE_LENGTHS, signCut } from './tablet-surface';

	/**
	 * A flat line drawing of the conceptual tablet, in plate units × 100 with y running down. It
	 * stands in for the 3D model while it is prepared and wherever WebGL is unavailable.
	 */
	interface Props {
		/** Highlighted region in texture coordinates with a radius in plate units. */
		focus?: { u: number; v: number; radius: number } | null;
		grid?: boolean;
	}

	let { focus = null, grid = false }: Props = $props();

	// The break runs along x·0.6 + y·0.8 = 0.93 in plate units from the centre.
	const OUTLINE = '0,0 96.7,0 150,40 150,200 0,200';
	const PETALS = Array.from({ length: 8 }, (_, i) => i * 45);
	const SIGN_ADVANCE = 7.4;
	const SIGN_WIDTH = 5.6;
	const lines = LINE_LENGTHS.map((count, line) => {
		const left = 75 - (count * SIGN_ADVANCE - (SIGN_ADVANCE - SIGN_WIDTH)) / 2;
		return Array.from({ length: count }, (_, column) => ({
			x: left + column * SIGN_ADVANCE,
			y: 117 + line * 14,
			cut: signCut(line, column)
		}));
	});
	const gridLines = Array.from({ length: 21 }, (_, i) => i * 10);
</script>

<svg id="tablet-diagram" viewBox="-4 -4 158 208" aria-hidden="true">
	<defs>
		<clipPath id="tablet-diagram-stone">
			<polygon points={OUTLINE} />
		</clipPath>
	</defs>
	<g clip-path="url(#tablet-diagram-stone)">
		<rect class="stone" x="0" y="0" width="150" height="200" />
		<rect class="frame" x="6.5" y="6.5" width="137" height="187" />
		<rect class="frame inner" x="13.5" y="13.5" width="123" height="173" />
		<rect class="panel" x="17" y="109" width="116" height="79" />
		{#each lines as signs, line (line)}
			{#each signs as sign, column (column)}
				{#if sign.cut}
					<rect class="sign" x={sign.x} y={sign.y} width={SIGN_WIDTH} height="8.5" />
				{/if}
			{/each}
		{/each}
		<circle class="ring" cx="75" cy="60" r="40" />
		{#each PETALS as angle (angle)}
			<ellipse
				class="petal"
				cx="75"
				cy="44"
				rx="5.5"
				ry="15"
				transform={`rotate(${angle} 75 60)`}
			/>
		{/each}
		<circle class="boss" cx="75" cy="60" r="9" />
		<circle class="drill" cx="75" cy="60" r="1.6" />
		{#if grid}
			{#each gridLines as at (at)}
				<line class="grid" x1={at} y1="0" x2={at} y2="200" />
				<line class="grid" x1="0" y1={at} x2="150" y2={at} />
			{/each}
		{/if}
	</g>
	<polyline class="break" points="96.7,0 150,40" />
	{#if focus}
		<circle
			class="focus"
			cx={focus.u * 150}
			cy={(1 - focus.v) * 200}
			r={focus.radius * 100 * 1.1}
		/>
	{/if}
</svg>

<style>
	#tablet-diagram {
		display: block;
		width: 100%;
		height: 100%;
		overflow: visible;
	}
	.stone {
		fill: #e8ded0;
	}
	.frame {
		fill: none;
		stroke: #b9ab96;
		stroke-width: 3;
	}
	.frame.inner {
		stroke-width: 1;
	}
	.panel {
		fill: #dcd1c1;
		stroke: #b9ab96;
		stroke-width: 0.8;
	}
	.sign {
		fill: none;
		stroke: #6f6455;
		stroke-width: 0.7;
	}
	.ring,
	.petal,
	.boss {
		fill: #efe6da;
		stroke: #9f917c;
		stroke-width: 1;
	}
	.drill {
		fill: #6f6455;
	}
	.grid {
		stroke: rgba(20, 20, 19, 0.2);
		stroke-width: 0.4;
	}
	.break {
		fill: none;
		stroke: #6f6455;
		stroke-width: 1.2;
		stroke-dasharray: 3 2;
	}
	.focus {
		fill: none;
		stroke: var(--color-vermillion);
		stroke-width: 1.6;
	}
</style>
