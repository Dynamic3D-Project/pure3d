<script lang="ts">
	interface Props {
		/** Shows a layer in the hero diagram. */
		onshow: (layer: number) => void;
		/** Moves to the review workflow further down the page. */
		onreview: () => void;
	}

	interface Stratum {
		name: string;
		question: string;
		text: string;
		/** Layer of the hero diagram that draws this stratum, if any. */
		layer?: number;
	}

	let { onshow, onreview }: Props = $props();

	const STRATA: Stratum[] = [
		{
			name: 'Evidence',
			question: 'What was recorded?',
			text: 'The edition starts from a scan, mesh, point cloud, or reconstruction that can be inspected directly.',
			layer: 0
		},
		{
			name: 'Annotation',
			question: 'Where is the evidence?',
			text: 'Annotations connect parts of the model to provenance, uncertainty, bibliography, and interpretation.',
			layer: 1
		},
		{
			name: 'Interpretation',
			question: 'What is being argued?',
			text: 'Text, images, and video sit alongside the model, so an argument can be read against the object and a reconstruction stays distinguishable from what survives.',
			layer: 2
		},
		{
			name: 'Paradata',
			question: 'How was it made?',
			text: 'Paradata documents how a model came to be: how it was captured and processed, and the decisions taken along the way, so that others can assess them.',
			layer: 3
		},
		{
			name: 'Review',
			question: 'Who has checked it?',
			text: 'Editors and reviewers evaluate the model, metadata, annotations, and interpretation before publication.'
		},
		{
			name: 'Preservation',
			question: 'Will it still be there?',
			text: 'Published editions are citable, permalinked records, kept findable, accessible, interoperable, and reusable for long-term access.',
			layer: 4
		}
	];
</script>

<section id="edition-strata" aria-labelledby="edition-strata-title">
	<div class="shell">
		<header class="head">
			<p class="eyebrow"><span class="dot" aria-hidden="true"></span> The edition in section</p>
			<h2 id="edition-strata-title">A 3D edition is read in <em>layers.</em></h2>
			<p class="sub">
				Like an excavation section, a 3D Scholarly Edition has strata. PURE3D keeps the object, its
				documentation and its interpretation together, so each one can be inspected, reviewed, and
				preserved, down to the record that holds them all.
			</p>
		</header>
	</div>

	<ol class="cut">
		{#each STRATA as stratum, index (stratum.name)}
			<li class="stratum" style={`--depth: ${index}`}>
				<div class="shell row">
					<p class="depth">
						<span class="depth-label">Stratum</span>
						<span class="depth-number">{String(index + 1).padStart(2, '0')}</span>
					</p>
					<div class="text">
						<h3>{stratum.name}</h3>
						<p>{stratum.text}</p>
					</div>
					<div class="aside">
						<p class="question">{stratum.question}</p>
						{#if stratum.layer !== undefined}
							{@const layer = stratum.layer}
							<button type="button" class="link" onclick={() => onshow(layer)}>
								Show in the diagram <span aria-hidden="true">↑</span>
							</button>
						{:else}
							<button type="button" class="link" onclick={onreview}>
								Follow the workflow <span aria-hidden="true">↓</span>
							</button>
						{/if}
					</div>
				</div>
			</li>
		{/each}
	</ol>
</section>

<style>
	#edition-strata {
		padding-top: clamp(80px, 10vw, 136px);
		background: var(--color-paper);
		color: var(--color-ink);
	}
	.shell {
		max-width: 1320px;
		margin: 0 auto;
		padding: 0 clamp(20px, 4vw, 48px);
	}
	.head {
		display: grid;
		gap: 16px;
		max-width: 62ch;
		margin-bottom: clamp(40px, 6vw, 72px);
	}
	.eyebrow {
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 0;
		font-family: var(--font-mono);
		font-size: 11.5px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-ink-3);
	}
	.dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--color-vermillion);
	}
	h2 {
		margin: 0;
		font-weight: 500;
		font-size: clamp(30px, 4vw, 52px);
		line-height: 1.04;
		letter-spacing: -0.028em;
		text-wrap: balance;
	}
	.sub {
		margin: 0;
		font-family: var(--font-serif);
		font-size: 18px;
		line-height: 1.5;
		color: var(--color-ink-2);
		text-wrap: pretty;
	}

	/* Each stratum is darker than the one above it; the record that preserves them is the bedrock. */
	.cut {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.stratum {
		--ground: var(--color-paper);
		--text: var(--color-ink);
		--muted: var(--color-ink-3);
		--rule: color-mix(in srgb, var(--color-ink) 16%, transparent);
		--accent: var(--color-vermillion-ink);
		position: relative;
		border-top: 1px solid var(--rule);
		background: var(--ground);
		color: var(--text);
	}
	.stratum:nth-child(2) {
		--ground: var(--color-paper-2);
	}
	.stratum:nth-child(3) {
		--ground: var(--color-paper-3);
	}
	.stratum:nth-child(4) {
		--ground: #cdd3c4;
	}
	.stratum:nth-child(5) {
		--ground: var(--color-forest);
		--text: var(--color-paper);
		--muted: rgba(244, 241, 235, 0.76);
		--rule: rgba(244, 241, 235, 0.16);
		--accent: #f4b5a0;
	}
	.stratum:nth-child(6) {
		--ground: var(--color-ink);
		--text: var(--color-paper);
		--muted: rgba(244, 241, 235, 0.76);
		--rule: rgba(244, 241, 235, 0.16);
		--accent: #f4b5a0;
	}
	/* Sediment texture in the depth column, denser with depth. */
	.stratum::before {
		content: '';
		position: absolute;
		inset: 0 auto 0 0;
		width: clamp(8px, 1.2vw, 16px);
		background: repeating-linear-gradient(
			180deg,
			color-mix(in srgb, var(--text) 30%, transparent) 0 1px,
			transparent 1px calc(10px - var(--depth) * 1px)
		);
		opacity: 0.6;
	}
	.row {
		display: grid;
		grid-template-columns: 9rem minmax(0, 1.3fr) minmax(0, 1fr);
		gap: 20px clamp(24px, 4vw, 56px);
		align-items: start;
		padding-block: calc(clamp(28px, 3.4vw, 44px) + var(--depth) * 3px);
	}
	.depth {
		display: grid;
		gap: 4px;
		margin: 0;
		font-family: var(--font-mono);
	}
	.depth-label {
		font-size: 10.5px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--muted);
	}
	.depth-number {
		font-size: clamp(28px, 3vw, 40px);
		line-height: 1;
		letter-spacing: -0.02em;
		color: var(--accent);
	}
	.text {
		display: grid;
		gap: 10px;
	}
	h3 {
		margin: 0;
		font-weight: 500;
		font-size: clamp(24px, 2.6vw, 34px);
		line-height: 1.05;
		letter-spacing: -0.02em;
	}
	.text p {
		margin: 0;
		max-width: 52ch;
		font-family: var(--font-serif);
		font-size: 17px;
		line-height: 1.5;
		color: var(--muted);
	}
	.aside {
		display: grid;
		justify-items: start;
		gap: 12px;
	}
	.question {
		margin: 0;
		font: italic 400 clamp(20px, 2vw, 26px) / 1.2 var(--font-serif);
		color: var(--text);
	}
	.link {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 44px;
		padding: 0;
		border: 0;
		background: none;
		font: 500 14px/1 var(--font-sans);
		color: var(--text);
		text-decoration: underline;
		text-decoration-color: color-mix(in srgb, var(--text) 35%, transparent);
		text-underline-offset: 5px;
		cursor: pointer;
	}
	.link:hover {
		text-decoration-color: var(--color-vermillion);
	}
	.link:focus-visible {
		outline: 2px solid var(--color-vermillion);
		outline-offset: 3px;
	}

	@media (max-width: 960px) {
		.row {
			grid-template-columns: 5.5rem minmax(0, 1fr);
		}
		.aside {
			grid-column: 2;
		}
	}
	@media (max-width: 520px) {
		.row {
			grid-template-columns: minmax(0, 1fr);
			padding-left: calc(clamp(20px, 4vw, 48px) + 8px);
		}
		.depth {
			grid-auto-flow: column;
			justify-content: start;
			align-items: baseline;
			gap: 10px;
		}
		.depth-number {
			font-size: 22px;
		}
		.aside {
			grid-column: 1;
		}
	}
</style>
