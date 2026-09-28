<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import EditionViewer from './EditionViewer.svelte';
	import { ANNOTATIONS, CATEGORIES, EDITION, STORIES, type ModelFacts } from './edition-content';
	import {
		HEIGHT_MAX,
		HEIGHT_MIN,
		PLATE_HEIGHT,
		PLATE_WIDTH,
		inscriptionCounts
	} from './tablet-surface';

	let facts = $state<ModelFacts | null>(null);
	let pageUrl = $state('/demo1');
	let citeState = $state<'idle' | 'copied' | 'failed'>('idle');
	let reducedMotion = $state(false);

	const lines = inscriptionCounts();
	const positions = lines.reduce((sum, line) => sum + line.positions, 0);
	const cut = lines.reduce((sum, line) => sum + line.cut, 0);
	const chapterCount = STORIES.reduce((sum, story) => sum + story.chapters.length, 0);
	const categoryLabel = (id: string) => CATEGORIES.find((item) => item.id === id)?.label ?? id;
	const citation = $derived(
		`Pure3D (n.d.). ${EDITION.title}: ${EDITION.subtitle.replace(/^A /, 'a ')} [design prototype; not a publication]. ${pageUrl}`
	);

	const SECTIONS = [
		['object', 'The object'],
		['paradata', 'Paradata'],
		['technical', 'Technical record'],
		['index', 'Annotation index'],
		['credits', 'Credits'],
		['rights', 'Rights and access'],
		['cite', 'Cite'],
		['status', 'Status and versions']
	] as const;

	onMount(() => {
		pageUrl = `${window.location.origin}${window.location.pathname}`;
		reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	});

	async function copyCitation() {
		try {
			await navigator.clipboard.writeText(citation);
			citeState = 'copied';
		} catch {
			citeState = 'failed';
		}
	}

	/** Index links select an annotation through the address, then bring the model into view. */
	function showOnModel(event: MouseEvent, id: string) {
		event.preventDefault();
		const hash = `#annotation=${id}`;
		if (window.location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
		else window.location.hash = hash;
		document
			.getElementById('edition-viewer')
			?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
	}
</script>

<svelte:head>
	<title>{EDITION.title} · Demonstration edition | Pure 3D</title>
	<meta
		name="description"
		content="A demonstration of a 3D scholarly edition on Pure3D: a procedural carved tablet with annotations, guided stories and an edition record."
	/>
	<meta name="robots" content="noindex" />
</svelte:head>

<div id="demo1">
	<header class="masthead">
		<div class="shell masthead-grid">
			<div class="masthead-main">
				<nav class="crumbs" aria-label="Breadcrumb">
					<ol>
						<li><a href={resolve('/editions')}>Editions</a></li>
						<li aria-current="page">Demonstration</li>
					</ol>
				</nav>
				<h1>{EDITION.title}</h1>
				<p class="subtitle">
					{EDITION.subtitle} · procedural object, illustrative commentary
				</p>
			</div>
			<div class="masthead-side">
				<ul class="flags" aria-label="Edition status">
					<li class="flag-demo">Demonstration edition</li>
					<li>Procedural object</li>
					<li>Not peer reviewed</li>
				</ul>
				<div class="masthead-links">
					<a href="#demo1-record">Edition record <span aria-hidden="true">↓</span></a>
					<a href="#demo1-cite">Cite <span aria-hidden="true">↓</span></a>
				</div>
			</div>
		</div>
	</header>

	<EditionViewer onready={(next) => (facts = next)} />

	<section id="demo1-record" class="record" aria-labelledby="demo1-record-title">
		<div class="shell record-grid">
			<div class="record-side">
				<p class="eyebrow"><span class="dot" aria-hidden="true"></span> Edition record</p>
				<h2 id="demo1-record-title">What stays with <em>the model.</em></h2>
				<nav class="toc" aria-label="Edition record">
					<ol>
						{#each SECTIONS as [id, label] (id)}
							<li><a href="#demo1-{id}">{label}</a></li>
						{/each}
					</ol>
				</nav>
			</div>

			<div class="record-body">
				<section id="demo1-object" aria-labelledby="demo1-object-title">
					<h3 id="demo1-object-title">The object</h3>
					<p>
						A rectangular slab, {PLATE_WIDTH} by {PLATE_HEIGHT} model units, with a moulded frame, an
						eight-petalled rosette around a drilled boss in the upper half, and a sunken panel of incised
						signs below. The upper-right corner is broken away.
					</p>
					<p>
						The panel holds {lines.length} lines with {positions} sign positions, of which {cut} carry
						cuts. The signs are built from straight V-cuts and spell nothing: the tablet is invented
						so that the edition's tools can be shown without making claims about a real inscription.
					</p>
					<table class="lines">
						<caption>Sign positions by line, read from the model</caption>
						<thead>
							<tr>
								<th scope="col">Line</th>
								<th scope="col">Positions</th>
								<th scope="col">With cuts</th>
							</tr>
						</thead>
						<tbody>
							{#each lines as line, index (index)}
								<tr>
									<th scope="row">{index + 1}</th>
									<td>{line.positions}</td>
									<td>{line.cut}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</section>

				<section id="demo1-paradata" aria-labelledby="demo1-paradata-title">
					<h3 id="demo1-paradata-title">Paradata: how this model was made</h3>
					<ol class="steps">
						<li>
							<strong>Generated, not captured.</strong> The surface is computed in your browser from
							a height function: frame, rosette, panel, cut signs, a fracture line and noise for texture.
							No scan, photograph or measurement of a real object was used.
						</li>
						<li>
							<strong>Baked to a relief map.</strong> Heights are sampled on a grid and stored with surface
							normals and a cavity term, which drive the lighting, shadows and contours.
						</li>
						<li>
							<strong>Shaped as a mesh.</strong> A regular grid of vertices follows the large forms;
							the fine cuts live in the relief map. The mesh view shows this grid.
						</li>
						<li>
							<strong>Nothing reconstructed.</strong> Where the corner is broken no geometry is drawn,
							and no missing carving is restored.
						</li>
						<li>
							<strong>Lit on screen.</strong> Shadows are traced across the height map towards the lamp,
							so raking light reveals the cuts as it would across a real surface.
						</li>
					</ol>
				</section>

				<section id="demo1-technical" aria-labelledby="demo1-technical-title">
					<h3 id="demo1-technical-title">Technical record</h3>
					<dl class="facts">
						<div>
							<dt>Plate</dt>
							<dd>{PLATE_WIDTH} × {PLATE_HEIGHT} model units; no real-world scale</dd>
						</div>
						<div>
							<dt>Relief range stored</dt>
							<dd>{HEIGHT_MIN} to {HEIGHT_MAX} model units</dd>
						</div>
						{#if facts}
							<div>
								<dt>Mesh</dt>
								<dd>
									{facts.vertices.toLocaleString('en')} vertices, {facts.triangles.toLocaleString(
										'en'
									)}
									triangles
								</dd>
							</div>
							<div>
								<dt>Relief map</dt>
								<dd>{facts.mapWidth} × {facts.mapHeight} texels</dd>
							</div>
							<div>
								<dt>Surviving surface</dt>
								<dd>{(facts.surviving * 100).toFixed(1)}% of the plate</dd>
							</div>
							<div>
								<dt>Surface heights</dt>
								<dd>{facts.low.toFixed(3)} to {facts.high.toFixed(3)} model units</dd>
							</div>
						{:else}
							<div>
								<dt>Mesh and map</dt>
								<dd>Figures appear here once the 3D model has been built in this browser.</dd>
							</div>
						{/if}
						<div>
							<dt>Viewer</dt>
							<dd>
								A WebGL renderer written for this demonstration, with a flat diagram where WebGL is
								unavailable
							</dd>
						</div>
					</dl>
					<p class="small">
						Mesh and map sizes depend on the device: smaller screens and slower processors get a
						lighter model.
					</p>
				</section>

				<section id="demo1-index" aria-labelledby="demo1-index-title">
					<h3 id="demo1-index-title">Annotation index</h3>
					<p>
						{ANNOTATIONS.length} annotations in {CATEGORIES.length} categories, used across {STORIES.length}
						stories and {chapterCount} chapters.
					</p>
					<ol class="index">
						{#each ANNOTATIONS as item (item.id)}
							<li>
								<span class="index-number">{item.number}</span>
								<span class="index-title">{item.title}</span>
								<span class="index-category">{categoryLabel(item.category)}</span>
								<a
									href="#annotation={item.id}"
									onclick={(event) => showOnModel(event, item.id)}
									aria-label={`Show annotation ${item.number}, ${item.title}, on the model`}
									>Show on model <span aria-hidden="true">↑</span></a
								>
							</li>
						{/each}
					</ol>
				</section>

				<section id="demo1-credits" aria-labelledby="demo1-credits-title">
					<h3 id="demo1-credits-title">Credits</h3>
					<dl class="facts">
						<div>
							<dt>Object and model</dt>
							<dd>Procedural, generated by the code of this page</dd>
						</div>
						<div>
							<dt>Edition text</dt>
							<dd>Written for this demonstration; notes marked Illustrative are examples only</dd>
						</div>
						<div>
							<dt>Editor, reviewers</dt>
							<dd>None assigned. A published edition names its editors and reviewers here.</dd>
						</div>
						<div>
							<dt>Platform</dt>
							<dd>Pure3D</dd>
						</div>
					</dl>
				</section>

				<section id="demo1-rights" aria-labelledby="demo1-rights-title">
					<h3 id="demo1-rights-title">Rights and access</h3>
					<p>
						No licence has been assigned to this demonstration. A published edition states its
						licence and rights holder here, for the model, the text and any images separately.
					</p>
				</section>

				<section id="demo1-cite" aria-labelledby="demo1-cite-title">
					<h3 id="demo1-cite-title">Cite</h3>
					<p>
						This page is a design prototype and should not be cited as scholarship. A published
						edition offers a formatted citation and, where one has been assigned, a DOI. The format
						would look like this:
					</p>
					<p class="citation">{citation}</p>
					<div class="cite-actions">
						<button type="button" class="button button-outline" onclick={copyCitation}>
							Copy citation format
						</button>
						<p class="cite-status" role="status">
							{#if citeState === 'copied'}Copied.{:else if citeState === 'failed'}Copying is not
								available here; select the text above instead.{/if}
						</p>
					</div>
					<p class="small">No DOI or persistent identifier has been assigned.</p>
				</section>

				<section id="demo1-status" aria-labelledby="demo1-status-title">
					<h3 id="demo1-status-title">Status and versions</h3>
					<dl class="facts">
						<div>
							<dt>Status</dt>
							<dd>{EDITION.status}</dd>
						</div>
						<div>
							<dt>Version</dt>
							<dd>{EDITION.version}</dd>
						</div>
						<div>
							<dt>Peer review</dt>
							<dd>Not reviewed. Reviewed editions carry a badge on their page.</dd>
						</div>
					</dl>
				</section>
			</div>
		</div>
	</section>
</div>

<style>
	#demo1 {
		--rule: color-mix(in srgb, var(--color-ink) 12%, transparent);
		--rule-strong: color-mix(in srgb, var(--color-ink) 24%, transparent);
		overflow-x: clip;
		background: var(--color-paper);
		color: var(--color-ink);
		font-family: var(--font-sans);
	}
	#demo1 :global(em) {
		font-family: var(--font-serif);
		font-style: italic;
		font-weight: 400;
		color: var(--color-vermillion-ink);
	}
	#demo1 a:focus-visible,
	#demo1 button:focus-visible {
		outline: 2px solid var(--color-vermillion);
		outline-offset: 3px;
	}

	.shell {
		max-width: 1320px;
		margin: 0 auto;
		padding: 0 clamp(16px, 4vw, 48px);
	}

	/* ---------- masthead ---------- */
	.masthead {
		padding: 56px 0 20px;
	}
	.masthead-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: end;
		gap: 16px 40px;
	}
	.crumbs ol {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin: 0 0 10px;
		padding: 0;
		list-style: none;
		font: 500 11.5px/1.4 var(--font-mono);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-ink-3);
	}
	.crumbs li + li::before {
		content: '/';
		margin-right: 8px;
		color: var(--color-ink-4);
	}
	.crumbs a {
		color: inherit;
		text-underline-offset: 4px;
	}
	h1 {
		margin: 0;
		font: 400 clamp(30px, 3.6vw, 52px) / 1.02 var(--font-serif);
		letter-spacing: -0.02em;
		text-wrap: balance;
	}
	.subtitle {
		margin: 8px 0 0;
		font-size: 16px;
		line-height: 1.45;
		color: var(--color-ink-3);
	}
	.masthead-side {
		display: grid;
		justify-items: end;
		gap: 10px;
	}
	.flags {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 6px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.flags li {
		padding: 6px 10px;
		border: 1px solid var(--rule-strong);
		border-radius: var(--radius-round);
		font: 500 11px/1 var(--font-mono);
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--color-ink-2);
	}
	.flags .flag-demo {
		border-color: var(--color-vermillion);
		background: var(--color-vermillion-wash);
		color: var(--color-vermillion-ink);
	}
	.masthead-links {
		display: flex;
		gap: 16px;
	}
	.masthead-links a {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 40px;
		font: 500 14px/1 var(--font-sans);
		color: var(--color-ink-2);
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 5px;
	}
	.masthead-links a:hover {
		text-decoration-color: var(--color-vermillion);
	}

	/* ---------- record ---------- */
	.record {
		padding: clamp(64px, 8vw, 112px) 0 clamp(64px, 8vw, 96px);
	}
	.record-grid {
		display: grid;
		grid-template-columns: minmax(220px, 0.34fr) minmax(0, 1fr);
		gap: clamp(32px, 5vw, 80px);
		align-items: start;
	}
	.record-side {
		position: sticky;
		top: 88px;
		display: grid;
		gap: 16px;
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
		flex: none;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--color-vermillion);
	}
	h2 {
		margin: 0;
		font: 400 clamp(30px, 3.2vw, 46px) / 1.04 var(--font-serif);
		letter-spacing: -0.02em;
		text-wrap: balance;
	}
	.toc ol {
		display: grid;
		margin: 8px 0 0;
		padding: 0;
		list-style: none;
		border-top: 1px solid var(--color-ink);
	}
	.toc a {
		display: flex;
		align-items: center;
		min-height: 40px;
		border-bottom: 1px solid var(--rule);
		font-size: 15px;
		color: var(--color-ink-2);
		text-decoration: none;
	}
	.toc a:hover {
		color: var(--color-vermillion-ink);
	}

	.record-body {
		display: grid;
		gap: clamp(40px, 5vw, 64px);
		min-width: 0;
	}
	.record-body section {
		display: grid;
		gap: 14px;
		padding-top: 20px;
		border-top: 1px solid var(--color-ink);
		scroll-margin-top: 88px;
	}
	h3 {
		margin: 0;
		font: 500 clamp(21px, 2vw, 26px) / 1.15 var(--font-sans);
		letter-spacing: -0.015em;
	}
	.record-body p {
		margin: 0;
		max-width: 64ch;
		font-size: 16.5px;
		line-height: 1.6;
		color: var(--color-ink-2);
		text-wrap: pretty;
	}
	.record-body p.small {
		font-size: 14px;
		color: var(--color-ink-3);
	}

	.lines {
		width: 100%;
		max-width: 28rem;
		border-collapse: collapse;
		font-variant-numeric: tabular-nums;
	}
	.lines caption {
		padding-bottom: 8px;
		font: 500 11px/1.4 var(--font-mono);
		letter-spacing: 0.08em;
		text-align: left;
		text-transform: uppercase;
		color: var(--color-ink-3);
	}
	.lines th,
	.lines td {
		padding: 8px 12px 8px 0;
		border-bottom: 1px solid var(--rule);
		font-size: 15px;
		text-align: left;
	}
	.lines thead th {
		font: 500 11px/1.4 var(--font-mono);
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--color-ink-3);
	}

	.steps {
		display: grid;
		gap: 12px;
		max-width: 64ch;
		margin: 0;
		padding-left: 1.4em;
		font-size: 16px;
		line-height: 1.55;
		color: var(--color-ink-2);
	}
	.steps strong {
		color: var(--color-ink);
	}

	.facts {
		display: grid;
		max-width: 52rem;
		margin: 0;
	}
	.facts div {
		display: grid;
		grid-template-columns: minmax(9rem, 0.35fr) minmax(0, 1fr);
		gap: 16px;
		padding: 10px 0;
		border-bottom: 1px solid var(--rule);
	}
	.facts dt {
		font: 500 11px/1.6 var(--font-mono);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-ink-3);
	}
	.facts dd {
		margin: 0;
		font-size: 15.5px;
		line-height: 1.5;
		font-variant-numeric: tabular-nums;
	}

	.index {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
		border-top: 1px solid var(--rule);
	}
	.index li {
		display: grid;
		grid-template-columns: 2.5rem minmax(0, 1fr) auto auto;
		align-items: center;
		gap: 12px;
		min-height: 52px;
		border-bottom: 1px solid var(--rule);
	}
	.index-number {
		font: 500 13px/1 var(--font-mono);
		color: var(--color-vermillion-ink);
	}
	.index-title {
		font-size: 16px;
		font-weight: 500;
	}
	.index-category {
		font: 400 11px/1 var(--font-mono);
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--color-ink-3);
	}
	.index a {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 40px;
		font-size: 14px;
		color: var(--color-ink-2);
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 4px;
	}
	.index a:hover {
		text-decoration-color: var(--color-vermillion);
	}

	.record-body p.citation {
		padding: 16px 18px;
		border-left: 3px solid var(--color-forest);
		background: var(--color-paper-2);
		font: 400 15px/1.55 var(--font-serif);
		overflow-wrap: anywhere;
	}
	.cite-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
	}
	.record-body p.cite-status {
		font: 500 12px/1.4 var(--font-mono);
		color: var(--color-ink-3);
	}
	.button {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 44px;
		padding: 10px 16px;
		border: 1px solid transparent;
		border-radius: var(--radius-control);
		font: 500 14px/1.2 var(--font-sans);
		cursor: pointer;
	}
	.button-outline {
		border-color: var(--rule-strong);
		background: transparent;
		color: var(--color-ink);
	}
	.button-outline:hover {
		border-color: var(--color-ink);
	}

	@media (max-width: 900px) {
		.masthead {
			padding-top: 40px;
		}
		.masthead-grid,
		.record-grid {
			grid-template-columns: minmax(0, 1fr);
		}
		.masthead-side {
			justify-items: start;
		}
		.flags {
			justify-content: flex-start;
		}
		.record-side {
			position: static;
		}
	}
	@media (max-width: 640px) {
		.index li {
			grid-template-columns: 2rem minmax(0, 1fr);
			gap: 4px 12px;
			padding: 10px 0;
		}
		.index-category,
		.index a {
			grid-column: 2;
		}
		.facts div {
			grid-template-columns: minmax(0, 1fr);
			gap: 4px;
		}
	}
</style>
