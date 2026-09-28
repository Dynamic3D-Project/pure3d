<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { base, resolve } from '$app/paths';
	import CollectionCard from '$lib/components/cards/CollectionCard.svelte';
	import { homeStore, fetchHomeData, isStale } from '$lib/stores/data.store';
	import ParticleHero from './ParticleHero.svelte';
	import SpecimenStage from './SpecimenStage.svelte';
	import SpecimenTray from './SpecimenTray.svelte';
	import { fetchSpecimens, type Specimen } from './specimens';
	import type { GlyphSource } from './particle-field';

	// /home4 renders this component with letters instead of dots; /home3 passes nothing.
	let { glyphs }: { glyphs?: GlyphSource } = $props();

	let specimens = $state<Specimen[]>([]);
	let specimensLoading = $state(true);
	let activeId = $state('');
	let homeLoading = $state(true);
	// Artwork and Voyager never share the hero: opening an edition unmounts the particle canvas.
	let showEdition = $state(false);
	let editionView = $state<HTMLDivElement>();
	let inspectButton = $state<HTMLButtonElement>();

	const activeIndex = $derived(specimens.findIndex((specimen) => specimen.id === activeId));
	const active = $derived(specimens[activeIndex]);
	const collections = $derived($homeStore.collections.slice(0, 4));
	const hasCachedHome = $derived(
		$homeStore.editions.length > 0 || $homeStore.collections.length > 0
	);
	const statsPending = $derived(homeLoading && !hasCachedHome);

	async function loadSpecimens() {
		try {
			specimens = await fetchSpecimens();
			activeId = specimens[0]?.id ?? '';
		} catch {
			specimens = [];
		} finally {
			specimensLoading = false;
		}
	}

	async function loadHome() {
		try {
			if (!hasCachedHome || isStale($homeStore.lastFetched)) await fetchHomeData();
		} catch {
			// Cached figures stay visible when the catalogue cannot be refreshed.
		} finally {
			homeLoading = false;
		}
	}

	async function openEdition() {
		showEdition = true;
		await tick();
		editionView?.focus();
	}

	async function closeEdition() {
		showEdition = false;
		await tick();
		inspectButton?.focus();
	}

	onMount(() => {
		void loadSpecimens();
		void loadHome();
	});

	const storySteps = [
		{
			kicker: '01 · Capture',
			title: 'Record the object.',
			text: 'The edition starts from a scan, mesh, point cloud, or reconstruction that can be inspected directly.',
			image: '/images/landing/capture.webp',
			alt: 'Abstract capture diagram showing a 3D object being recorded'
		},
		{
			kicker: '02 · Annotate',
			title: 'Document the evidence.',
			text: 'Annotations connect parts of the model to provenance, uncertainty, bibliography, and interpretation.',
			image: '/images/landing/annotate.webp',
			alt: 'Abstract annotation diagram with evidence connected to a 3D object'
		},
		{
			kicker: '03 · Review',
			title: 'Publish a stable record.',
			text: 'Editors and reviewers evaluate the model, metadata, annotations, and interpretation before publication.',
			image: '/images/landing/review.webp',
			alt: 'Abstract review diagram showing a stable publication record'
		}
	];
	const workflow = [
		'Concept review',
		'Draft edition',
		'Alpha peer review',
		'Revision',
		'Final review',
		'Open publication'
	];
	const promiseCards = [
		{
			title: 'Publish and explore 3D work',
			text: 'PURE3D provides an infrastructure for publishing, depositing, and exploring interactive 3D worlds and objects online.'
		},
		{
			title: 'Make scholarship inspectable',
			text: '3D Scholarly Editions connect models with text, images, video, annotations, provenance, uncertainty, and paradata.'
		},
		{
			title: 'Preserve access over time',
			text: 'The platform supports long-term access by keeping 3D research findable, accessible, interoperable, and reusable.'
		}
	];
	const partnerLogos = [
		{
			name: 'Maastricht University',
			href: 'https://www.maastrichtuniversity.nl',
			image: '/images/logos/maastricht-university-logo-png-transparent.webp'
		},
		{
			name: 'Platform Digital Infrastructure',
			href: 'https://pdi-ssh.nl',
			image: '/images/logos/PDI_SSH_LOGO_B.webp'
		},
		{
			name: 'KNAW Humanities Cluster',
			href: 'https://huc.knaw.nl',
			image: '/images/logo-knaw-humanities-cluster.png'
		},
		{
			name: 'KNAW Digital Infrastructure',
			href: 'https://di.huc.knaw.nl',
			image: '/images/logos/logo-knaw-digital-infrastructure.webp'
		}
	];
</script>

<svelte:head>
	<title>Pure 3D | Explore 3D Scholarly Editions</title>
	<meta
		name="description"
		content="PURE3D is an infrastructure for publishing, preserving, and exploring interactive 3D Scholarly Editions."
	/>
</svelte:head>

<div id="home3">
	{#snippet heroCopy()}
		<p class="eyebrow on-ink rise" style="--i: 0">
			<span class="dot" aria-hidden="true"></span> PURE3D · 3D scholarly publishing infrastructure
		</p>
		<h1 id="home3-title" class="rise" style="--i: 1">
			An infrastructure for the preservation and publication of <em>3D scholarship</em>
		</h1>
		<p class="lede rise" style="--i: 2">
			PURE3D is an infrastructure for publishing, depositing, preserving, and exploring interactive
			3D Scholarly Editions: annotated, reviewable, citable records that connect models with
			evidence, interpretation, paradata, and long-term access.
		</p>
		<div class="actions rise" style="--i: 3">
			<a href={resolve('/editions')} class="button button-primary">
				Browse editions <span aria-hidden="true">→</span>
			</a>
			<a href={resolve('/documentation/submission')} class="button button-on-ink">
				Publish with us
			</a>
		</div>

		<dl class="rise stats" style="--i: 4">
			<div class="stat">
				<dt>3D Editions</dt>
				<dd>
					<a href={resolve('/editions')}>{statsPending ? '—' : $homeStore.editionTotal}</a>
				</dd>
			</div>
			<div class="stat">
				<dt>Collections</dt>
				<dd>
					<a href={resolve('/collections')}>{statsPending ? '—' : $homeStore.collectionTotal}</a>
				</dd>
			</div>
			<div class="stat">
				<dt>Authors trained</dt>
				<dd>100+</dd>
			</div>
			<div class="stat">
				<dt>Presentations & workshops</dt>
				<dd>45</dd>
			</div>
		</dl>
	{/snippet}

	{#snippet artworkFoot()}
		{#if active}
			<button bind:this={inspectButton} type="button" class="button inspect" onclick={openEdition}>
				<span class="dot" aria-hidden="true"></span>
				<span class="inspect-text">
					Inspect a published edition in 3D
					<small>{active.title}</small>
				</span>
			</button>
		{:else}
			<p class="stage-note" aria-busy={specimensLoading}>
				{specimensLoading
					? 'Loading a published edition…'
					: 'Each edition is a citable, permalinked record of a 3D object.'}
			</p>
		{/if}
		<a class="more" href={resolve('/editions')}>
			View all editions <span aria-hidden="true">↗</span>
		</a>
	{/snippet}

	<section class="hero" aria-labelledby="home3-title">
		{#if showEdition && active}
			<div class="shell hero-grid">
				<div class="hero-copy">
					{@render heroCopy()}
				</div>
				<div class="hero-stage">
					<div
						bind:this={editionView}
						class="edition-view"
						role="region"
						aria-label="Published edition in 3D"
						tabindex="-1"
					>
						{#key active.id}
							<SpecimenStage
								specimen={active}
								autoload
								plate={`Plate ${String(activeIndex + 1).padStart(2, '0')} / ${String(specimens.length).padStart(2, '0')}`}
							/>
						{/key}
					</div>
					<div class="stage-foot">
						{#if specimens.length > 1}
							<SpecimenTray {specimens} {activeId} onselect={(id) => (activeId = id)} />
						{/if}
						<button type="button" class="more" onclick={closeEdition}>
							<span aria-hidden="true">←</span> Back to the artwork
						</button>
						<a class="more" href={resolve('/editions')}>
							View all editions <span aria-hidden="true">↗</span>
						</a>
					</div>
				</div>
			</div>
		{:else}
			<ParticleHero copy={heroCopy} foot={artworkFoot} {glyphs} />
		{/if}
	</section>

	<section class="evidence" aria-labelledby="home3-evidence">
		<div class="shell">
			<header class="section-head reveal">
				<p class="eyebrow"><span class="dot" aria-hidden="true"></span> 3D evidence</p>
				<h2 id="home3-evidence">A model as source</h2>
				<p class="section-sub">
					A 3D edition makes the object, its documentation and its interpretation available in the
					same place, so they can be inspected, cited, reviewed, and preserved.
				</p>
			</header>
			<ol class="plates">
				{#each storySteps as step (step.kicker)}
					<li class="plate reveal">
						<img src={`${base}${step.image}`} alt={step.alt} loading="lazy" decoding="async" />
						<div>
							<span class="kicker">{step.kicker}</span>
							<h3>{step.title}</h3>
							<p>{step.text}</p>
						</div>
					</li>
				{/each}
			</ol>
		</div>
	</section>

	<section class="workflow" aria-labelledby="home3-workflow">
		<div class="shell">
			<header class="section-head reveal">
				<p class="eyebrow on-ink">
					<span class="dot" aria-hidden="true"></span> Editorial infrastructure
				</p>
				<h2 id="home3-workflow">From proposal to published edition</h2>
				<p class="section-sub">
					Pure3D provides a supportive environment for authors/editors to publish 3D scholarship,
					including training and mentorship, throughout the publishing process.
				</p>
			</header>
			<ol class="track">
				{#each workflow as item, i (item)}
					<li class="reveal" style={`--i: ${i}`}>
						<span class="node">{String(i + 1).padStart(2, '0')}</span>
						<span class="step">{item}</span>
					</li>
				{/each}
			</ol>
		</div>
	</section>

	<section class="collections" aria-labelledby="home3-collections">
		<div class="shell">
			<header class="section-head split reveal">
				<div>
					<h2 id="home3-collections">Collections as <em>scholarly contexts</em></h2>
					<p class="section-sub">
						Collections organise 3D editions by theme, period, provenance, institution, or material
						context.
					</p>
				</div>
				<a class="more" href={resolve('/collections')}>
					All collections <span aria-hidden="true">↗</span>
				</a>
			</header>
			{#if collections.length > 0}
				<div class="collection-grid">
					{#each collections as collection (collection.id)}
						<CollectionCard {collection} showDescription={false} imageLoading="lazy" />
					{/each}
				</div>
			{:else if statsPending}
				<div class="collection-grid" aria-hidden="true">
					{#each [0, 1, 2, 3] as i (i)}
						<div class="placeholder"></div>
					{/each}
				</div>
			{:else}
				<p class="empty">No collections available yet.</p>
			{/if}
		</div>
	</section>

	<section class="promises" aria-labelledby="home3-promises">
		<div class="shell">
			<header class="section-head reveal">
				<h2 id="home3-promises">What <em>PURE3D</em> brings together.</h2>
				<p class="section-sub">
					The platform serves both creators and readers of 3D research: researchers, educators,
					cultural heritage managers, students, public audiences, and academic reviewers.
				</p>
			</header>
			<div class="promise-grid">
				{#each promiseCards as card, i (card.title)}
					<article class="promise reveal">
						<span class="kicker">{String(i + 1).padStart(2, '0')}</span>
						<h3>{card.title}</h3>
						<p>{card.text}</p>
					</article>
				{/each}
			</div>
		</div>
	</section>

	<section class="call" aria-labelledby="home3-call">
		<div class="shell">
			<div class="call-plate reveal">
				<div>
					<p class="eyebrow on-ink">
						<span class="dot" aria-hidden="true"></span> Call for editions
					</p>
					<h2 id="home3-call">Propose your own <em>edition.</em></h2>
				</div>
				<div>
					<p>
						Pure 3D provides the infrastructure and tools to publish interactive 3D research. Join
						our growing community edition editors/authors.
					</p>
					<div class="actions">
						<a href={resolve('/documentation/submission')} class="button button-accent">
							Submission guidelines <span aria-hidden="true">→</span>
						</a>
						<a href={resolve('/documentation')} class="button button-on-ink">
							Read the documentation
						</a>
					</div>
				</div>
			</div>
		</div>
	</section>

	<section class="partners" aria-labelledby="home3-partners">
		<div class="shell">
			<h2 id="home3-partners" class="partners-head">Supported by</h2>
			<ul class="partner-list">
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				{#each partnerLogos as partner (partner.name)}
					<li>
						<a href={partner.href} target="_blank" rel="noreferrer">
							<img src={`${base}${partner.image}`} alt={partner.name} loading="lazy" />
						</a>
					</li>
				{/each}
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			</ul>
		</div>
	</section>
</div>

<style>
	#home3 {
		--rule: color-mix(in srgb, var(--color-base-content) 12%, transparent);
		--rule-strong: color-mix(in srgb, var(--color-base-content) 22%, transparent);
		--ease-out: cubic-bezier(0.2, 0.7, 0.1, 1);
		overflow-x: clip;
		background: var(--color-base-100);
		color: var(--color-base-content);
		font-family: var(--font-sans);
	}
	#home3 :global(em) {
		font-family: var(--font-serif);
		font-style: italic;
		font-weight: 400;
		color: var(--color-vermillion-ink);
	}
	#home3 :global(a:focus-visible),
	#home3 :global(button:focus-visible) {
		outline: 2px solid var(--color-vermillion);
		outline-offset: 3px;
	}

	.shell {
		max-width: 1320px;
		margin: 0 auto;
		padding: 0 clamp(20px, 4vw, 48px);
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
	.eyebrow .dot,
	.inspect .dot {
		flex: none;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--color-vermillion);
		box-shadow: 0 0 18px color-mix(in srgb, var(--color-vermillion) 70%, transparent);
	}
	.eyebrow.on-ink {
		color: rgba(244, 241, 235, 0.64);
	}

	.button {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		min-height: 48px;
		padding: 12px 20px;
		border: 1px solid transparent;
		border-radius: var(--radius-control);
		font: 500 15px/1.2 var(--font-sans);
		text-decoration: none;
		transition:
			background 0.18s ease,
			border-color 0.18s ease,
			translate 0.18s ease;
	}
	.button:hover {
		translate: 0 -1px;
	}
	.button-primary {
		background: var(--color-forest);
		color: var(--color-paper);
	}
	.button-primary:hover {
		background: var(--color-forest-hover);
	}
	.button-accent {
		background: var(--color-vermillion);
		color: #fff;
	}
	.button-accent:hover {
		background: var(--color-vermillion-ink);
	}
	.button-on-ink {
		border-color: rgba(244, 241, 235, 0.35);
		color: var(--color-paper);
	}
	.button-on-ink:hover {
		border-color: var(--color-paper);
		background: rgba(244, 241, 235, 0.08);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
	}
	.more {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 44px;
		font: 500 14px/1 var(--font-sans);
		color: var(--color-ink-2);
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 5px;
	}
	.more:hover {
		text-decoration-color: var(--color-vermillion);
	}

	/* ---------- hero ---------- */
	/* The hero is a full-bleed ink field; the artwork or the edition viewer sits inside it. */
	.hero {
		--on-ink: rgba(244, 241, 235, 0.8);
		--on-ink-muted: rgba(244, 241, 235, 0.64);
		--on-ink-rule: rgba(244, 241, 235, 0.16);
		position: relative;
		isolation: isolate;
		overflow: hidden;
		border-bottom: 1px solid var(--rule);
		background: var(--color-ink);
		color: var(--color-paper);
	}
	#home3 .hero em {
		color: #f4b5a0;
	}
	.hero-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.02fr);
		gap: clamp(40px, 6vw, 88px);
		align-items: start;
		padding-block: clamp(56px, 7vw, 96px);
	}
	.hero-copy {
		display: grid;
		gap: 32px;
		padding-top: clamp(0px, 3vw, 40px);
	}
	h1 {
		margin: 0;
		font-weight: 500;
		font-size: clamp(40px, 5.4vw, 80px);
		line-height: 0.98;
		letter-spacing: -0.035em;
		text-wrap: balance;
		color: var(--color-paper);
	}
	.lede {
		margin: 0;
		max-width: 46ch;
		font-family: var(--font-serif);
		font-size: clamp(18px, 1.6vw, 21px);
		line-height: 1.45;
		color: var(--on-ink);
		text-wrap: pretty;
	}
	.hero .button-primary {
		box-shadow: inset 0 0 0 1px rgba(244, 241, 235, 0.18);
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 20px;
		margin: 16px 0 0;
		padding-top: 24px;
		border-top: 1px solid var(--on-ink-rule);
	}
	.stat {
		display: grid;
		align-content: start;
		gap: 8px;
	}
	.stat a {
		color: inherit;
		text-decoration: none;
	}
	.stat a:hover {
		color: #f4b5a0;
	}
	.stat dt {
		order: 2;
		font-family: var(--font-mono);
		font-size: 10.5px;
		line-height: 1.3;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--on-ink-muted);
	}
	.stat dd {
		order: 1;
		margin: 0;
		font-size: clamp(26px, 2.6vw, 34px);
		font-weight: 500;
		line-height: 1;
		letter-spacing: -0.025em;
		font-variant-numeric: tabular-nums;
		transition: color 0.18s ease;
	}
	/* The edition viewer keeps its paper plate, set into the ink field. */
	.hero-stage {
		display: grid;
		gap: 16px;
		min-width: 0;
		padding: clamp(14px, 2vw, 20px);
		border-radius: var(--radius-surface);
		background: var(--color-paper);
		color: var(--color-ink);
		box-shadow: 0 40px 90px -30px rgba(0, 0, 0, 0.6);
	}
	.stage-foot {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
	}
	.edition-view:focus:not(:focus-visible) {
		outline: none;
	}
	.inspect {
		min-width: 0;
		max-width: 100%;
		min-height: 56px;
		padding: 10px 18px 10px 16px;
		border-color: var(--color-paper);
		background: var(--color-paper);
		color: var(--color-ink);
		cursor: pointer;
		text-align: left;
	}
	.inspect:hover {
		border-color: #f4b5a0;
		background: #fff;
	}
	.hero .more {
		color: var(--on-ink);
		text-decoration-color: rgba(244, 241, 235, 0.4);
	}
	.hero-stage .more {
		color: var(--color-ink-2);
		text-decoration-color: var(--rule-strong);
	}
	.inspect-text {
		display: grid;
		gap: 3px;
		min-width: 0;
	}
	.inspect small {
		max-width: 32ch;
		overflow: hidden;
		font: 400 12px/1.3 var(--font-mono);
		letter-spacing: 0.02em;
		color: var(--color-ink-3);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	button.more {
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
	}
	.stage-note {
		margin: 0;
		font: italic 400 16px/1.45 var(--font-serif);
		color: var(--on-ink-muted);
	}

	/* ---------- shared section chrome ---------- */
	section:not(.hero) {
		padding: clamp(80px, 10vw, 136px) 0;
		border-bottom: 1px solid var(--rule);
	}
	.section-head {
		display: grid;
		gap: 16px;
		max-width: 60ch;
		margin-bottom: clamp(40px, 6vw, 72px);
	}
	.section-head.split {
		max-width: none;
		grid-template-columns: minmax(0, 60ch) auto;
		justify-content: space-between;
		align-items: end;
	}
	.section-head.split > div {
		display: grid;
		gap: 16px;
	}
	h2 {
		margin: 0;
		font-weight: 500;
		font-size: clamp(30px, 4vw, 52px);
		line-height: 1.04;
		letter-spacing: -0.028em;
		text-wrap: balance;
	}
	h3 {
		margin: 0;
		font-weight: 500;
		letter-spacing: -0.02em;
	}
	.section-sub {
		margin: 0;
		font-family: var(--font-serif);
		font-size: 18px;
		line-height: 1.5;
		color: var(--color-ink-2);
		text-wrap: pretty;
	}
	.kicker {
		font-family: var(--font-mono);
		font-size: 11.5px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-vermillion-ink);
	}

	/* ---------- evidence plates ---------- */
	.plates {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 16px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.plate {
		display: grid;
		grid-template-rows: auto 1fr;
		overflow: hidden;
		border: 1px solid var(--rule);
		border-radius: var(--radius-surface);
		background: var(--color-paper);
	}
	.plate img {
		width: 100%;
		aspect-ratio: 4 / 3;
		object-fit: contain;
		background: #fff;
		border-bottom: 1px solid var(--rule);
	}
	.plate > div {
		display: grid;
		align-content: start;
		gap: 12px;
		padding: clamp(20px, 2.4vw, 32px);
	}
	.plate h3 {
		font-size: clamp(22px, 2.2vw, 30px);
		line-height: 1.08;
	}
	.plate p {
		margin: 0;
		font-family: var(--font-serif);
		font-size: 17px;
		line-height: 1.5;
		color: var(--color-ink-3);
	}

	/* ---------- workflow track ---------- */
	.workflow {
		position: relative;
		overflow: hidden;
		background: var(--color-ink);
		color: var(--color-paper);
	}
	.workflow h2 {
		color: var(--color-paper);
	}
	.workflow .section-sub {
		color: rgba(244, 241, 235, 0.76);
	}
	.track {
		position: relative;
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		gap: 12px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.track::before {
		content: '';
		position: absolute;
		top: 21px;
		right: 8%;
		left: 8%;
		height: 1px;
		background: linear-gradient(
			90deg,
			rgba(244, 241, 235, 0.2),
			var(--color-vermillion) 85%,
			var(--color-vermillion)
		);
	}
	.track li {
		position: relative;
		display: grid;
		justify-items: center;
		gap: 14px;
		text-align: center;
	}
	.node {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border: 1px solid rgba(244, 241, 235, 0.3);
		border-radius: 50%;
		background: var(--color-ink);
		font-family: var(--font-mono);
		font-size: 11px;
		letter-spacing: 0.06em;
	}
	.track li:last-child .node {
		border-color: var(--color-vermillion);
		background: var(--color-vermillion);
		color: #fff;
	}
	.step {
		font-size: 15px;
		font-weight: 500;
		line-height: 1.3;
	}

	/* ---------- collections ---------- */
	.collections {
		background: var(--color-base-200);
	}
	.collection-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 16px;
	}
	.placeholder {
		height: 24rem;
		border-radius: var(--radius-surface);
		background: var(--color-base-300);
	}
	.empty {
		margin: 0;
		padding: 48px 0;
		text-align: center;
		font: italic 400 17px/1.5 var(--font-serif);
		color: var(--color-ink-4);
	}

	/* ---------- promises ---------- */
	.promise-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 16px;
	}
	.promise {
		display: flex;
		flex-direction: column;
		gap: 14px;
		min-height: 260px;
		padding: clamp(24px, 3vw, 40px);
		border: 1px solid var(--rule);
		border-radius: var(--radius-surface);
		background: var(--color-paper);
	}
	.promise h3 {
		margin-top: auto;
		font-size: clamp(22px, 2.4vw, 30px);
		line-height: 1.08;
	}
	.promise p {
		margin: 0;
		font-family: var(--font-serif);
		font-size: 17px;
		line-height: 1.5;
		color: var(--color-ink-2);
	}

	/* ---------- call for editions ---------- */
	.call-plate {
		position: relative;
		overflow: hidden;
		display: grid;
		grid-template-columns: 1.1fr 1fr;
		gap: clamp(32px, 5vw, 64px);
		align-items: end;
		padding: clamp(40px, 6vw, 80px) clamp(28px, 5vw, 64px);
		border-radius: var(--radius-surface);
		background: var(--color-ink);
		color: var(--color-paper);
	}
	.call-plate > div {
		display: grid;
		gap: 24px;
	}
	.call-plate h2 {
		color: var(--color-paper);
	}
	.call-plate h2 :global(em) {
		color: #f4b5a0;
	}
	.call-plate p:not(.eyebrow) {
		margin: 0;
		max-width: 50ch;
		font-family: var(--font-serif);
		font-size: 18px;
		line-height: 1.5;
		color: rgba(244, 241, 235, 0.8);
	}

	/* ---------- partners ---------- */
	section.partners {
		padding: 64px 0 80px;
		border-bottom: 0;
	}
	.partners-head {
		margin-bottom: 24px;
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 400;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		text-align: center;
		color: var(--color-ink-4);
	}
	.partner-list {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 16px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.partner-list a {
		display: grid;
		place-items: center;
		width: 190px;
		height: 88px;
		padding: 18px;
		border: 1px solid var(--rule);
		border-radius: var(--radius-surface);
		background: var(--color-paper);
		transition: border-color 0.18s ease;
	}
	.partner-list a:hover {
		border-color: var(--rule-strong);
	}
	.partner-list img {
		max-width: 100%;
		max-height: 48px;
		object-fit: contain;
	}

	/* ---------- motion ---------- */
	@media (prefers-reduced-motion: no-preference) {
		.rise {
			animation: rise 0.9s var(--ease-out) both;
			animation-delay: calc(var(--i, 0) * 90ms + 60ms);
		}
		@supports (animation-timeline: view()) {
			.reveal {
				animation: reveal linear both;
				animation-timeline: view();
				animation-range: entry 0% entry 45%;
			}
		}
	}
	@keyframes rise {
		from {
			opacity: 0;
			translate: 0 24px;
		}
	}
	@keyframes reveal {
		from {
			opacity: 0;
			translate: 0 32px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.button,
		.stat dd,
		.partner-list a {
			transition: none;
		}
		.button:hover {
			translate: none;
		}
	}

	/* ---------- responsive ---------- */
	@media (max-width: 1100px) {
		.collection-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.track {
			grid-template-columns: repeat(3, minmax(0, 1fr));
			row-gap: 32px;
		}
		.track::before {
			display: none;
		}
	}
	@media (max-width: 960px) {
		.hero-grid,
		.call-plate {
			grid-template-columns: 1fr;
		}
		.plates,
		.promise-grid {
			grid-template-columns: 1fr;
		}
		.plate {
			grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
			grid-template-rows: none;
		}
		.plate img {
			height: 100%;
			border-right: 1px solid var(--rule);
			border-bottom: 0;
		}
		.promise {
			min-height: 0;
		}
	}
	@media (max-width: 640px) {
		.stats {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			row-gap: 24px;
		}
		.section-head.split {
			grid-template-columns: 1fr;
		}
		.collection-grid {
			grid-template-columns: 1fr;
		}
		.plate {
			grid-template-columns: 1fr;
		}
		.plate img {
			border-right: 0;
			border-bottom: 1px solid var(--rule);
		}
		.track {
			grid-template-columns: 1fr;
			justify-items: start;
		}
		.track li {
			grid-auto-flow: column;
			justify-items: start;
			align-items: center;
			text-align: left;
		}
	}
</style>
