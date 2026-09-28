<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { base, resolve } from '$app/paths';
	import CollectionCard from '$lib/components/cards/CollectionCard.svelte';
	import { homeStore, fetchHomeData, isStale } from '$lib/stores/data.store';
	import SpecimenStage from '../home3/SpecimenStage.svelte';
	import SpecimenTray from '../home3/SpecimenTray.svelte';
	import { fetchSpecimens, type Specimen } from '../home3/specimens';
	import ApparatusHero from './ApparatusHero.svelte';
	import EditionStrata from './EditionStrata.svelte';

	let hero = $state<ReturnType<typeof ApparatusHero>>();
	let reviewHeading = $state<HTMLHeadingElement>();
	let specimens = $state<Specimen[]>([]);
	let specimensLoading = $state(true);
	let activeId = $state('');
	let homeLoading = $state(true);

	const activeIndex = $derived(specimens.findIndex((specimen) => specimen.id === activeId));
	const active = $derived(specimens[activeIndex]);
	const collections = $derived($homeStore.collections.slice(0, 4));
	const hasCachedHome = $derived(
		$homeStore.editions.length > 0 || $homeStore.collections.length > 0
	);
	const statsPending = $derived(homeLoading && !hasCachedHome);
	const pad = (value: number) => String(value).padStart(2, '0');

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

	async function showReview() {
		await tick();
		const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		reviewHeading?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
		reviewHeading?.focus({ preventScroll: true });
	}

	onMount(() => {
		void loadSpecimens();
		void loadHome();
	});

	const workflow = [
		'Concept review',
		'Draft edition',
		'Alpha peer review',
		'Revision',
		'Final review',
		'Open publication'
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

<div id="home4">
	{#snippet heroTitle()}
		<p class="eyebrow on-ink rise" style="--i: 0">
			<span class="dot" aria-hidden="true"></span> PURE3D · 3D scholarly publishing infrastructure
		</p>
		<h1 id="home4-title" class="rise" style="--i: 1">
			An infrastructure for the preservation and publication of <em>3D scholarship</em>
		</h1>
	{/snippet}

	{#snippet heroBody()}
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

	<section class="hero" aria-labelledby="home4-title">
		<ApparatusHero bind:this={hero} title={heroTitle} body={heroBody} />
	</section>

	<EditionStrata onshow={(layer) => hero?.isolate(layer)} onreview={showReview} />

	<section class="record" aria-labelledby="home4-record">
		<div class="shell record-grid">
			<header class="record-head reveal">
				<p class="eyebrow"><span class="dot" aria-hidden="true"></span> From diagram to record</p>
				<h2 id="home4-record">
					The vessel above is a diagram. <em>This is a published edition.</em>
				</h2>
				<p class="section-sub">
					Taken from the PURE3D catalogue and shown with its own Voyager scene. Its details come
					from the catalogue record and from the scene document the edition publishes, including the
					annotations, articles, and tours that scene declares.
				</p>
				{#if specimens.length > 1}
					<div class="tray">
						<p class="tray-label">Recent editions</p>
						<SpecimenTray {specimens} {activeId} onselect={(id) => (activeId = id)} />
					</div>
				{/if}
				<div class="actions">
					{#if active}
						<a
							href={resolve('/editions/[slug]', { slug: active.id })}
							class="button button-primary"
						>
							Open the full edition <span aria-hidden="true">→</span>
						</a>
					{/if}
					<a class="more" href={resolve('/editions')}>
						View all editions <span aria-hidden="true">↗</span>
					</a>
				</div>
			</header>

			<div class="record-stage">
				{#if active}
					{#key active.id}
						<SpecimenStage
							specimen={active}
							plate={`Plate ${pad(activeIndex + 1)} / ${pad(specimens.length)}`}
						/>
					{/key}
				{:else if specimensLoading}
					<div class="stage-placeholder" aria-busy="true">
						<p>Loading a published edition…</p>
					</div>
				{:else}
					<div class="stage-placeholder">
						<p>No published edition could be loaded here just now.</p>
						<a class="more" href={resolve('/editions')}>
							Browse the catalogue <span aria-hidden="true">↗</span>
						</a>
					</div>
				{/if}
			</div>
		</div>
	</section>

	<section class="review" aria-labelledby="home4-review">
		<div class="shell">
			<header class="section-head reveal">
				<p class="eyebrow on-ink">
					<span class="dot" aria-hidden="true"></span> Editorial infrastructure
				</p>
				<h2 id="home4-review" bind:this={reviewHeading} tabindex="-1">
					From proposal to <em>published edition</em>
				</h2>
				<p class="section-sub">
					Pure3D provides a supportive environment for authors/editors to publish 3D scholarship,
					including training and mentorship, throughout the publishing process.
				</p>
			</header>
			<ol class="ledger">
				{#each workflow as item, i (item)}
					<li class="entry reveal" class:is-final={i === workflow.length - 1}>
						<span class="entry-number">{pad(i + 1)}</span>
						<span class="entry-name">{item}</span>
					</li>
				{/each}
			</ol>
			<div class="review-notes">
				<p>
					Editors and reviewers evaluate the model, metadata, annotations, and interpretation before
					publication.
				</p>
				<p>
					Peer review is an optional trust signal for Pure 3D editions; editions that have been peer
					reviewed say so on their page.
				</p>
			</div>
		</div>
	</section>

	<section class="collections" aria-labelledby="home4-collections">
		<div class="shell">
			<header class="section-head split reveal">
				<div>
					<h2 id="home4-collections">Collections as <em>scholarly contexts</em></h2>
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

	<section class="call" aria-labelledby="home4-call">
		<div class="shell">
			<div class="call-plate reveal">
				<div>
					<p class="eyebrow on-ink">
						<span class="dot" aria-hidden="true"></span> Call for editions
					</p>
					<h2 id="home4-call">Propose your own <em>edition.</em></h2>
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

	<section class="partners" aria-labelledby="home4-partners">
		<div class="shell">
			<h2 id="home4-partners" class="partners-head">Supported by</h2>
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
	#home4 {
		--rule: color-mix(in srgb, var(--color-base-content) 12%, transparent);
		--rule-strong: color-mix(in srgb, var(--color-base-content) 22%, transparent);
		--ease-out: cubic-bezier(0.2, 0.7, 0.1, 1);
		overflow-x: clip;
		background: var(--color-base-100);
		color: var(--color-base-content);
		font-family: var(--font-sans);
	}
	#home4 :global(em) {
		font-family: var(--font-serif);
		font-style: italic;
		font-weight: 400;
		color: var(--color-vermillion-ink);
	}
	#home4 :global(a:focus-visible),
	#home4 :global(button:focus-visible) {
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
	.eyebrow .dot {
		flex: none;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--color-vermillion);
		box-shadow: 0 0 18px color-mix(in srgb, var(--color-vermillion) 70%, transparent);
	}
	.eyebrow.on-ink {
		color: rgba(244, 241, 235, 0.66);
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
		align-items: center;
		gap: 12px 16px;
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

	/* ---------- hero copy, rendered inside the apparatus ---------- */
	.hero :global(#apparatus-hero em) {
		color: #f4b5a0;
	}
	h1 {
		margin: 0;
		font-weight: 500;
		font-size: clamp(36px, 3.9vw, 60px);
		line-height: 0.98;
		letter-spacing: -0.035em;
		text-wrap: balance;
		color: var(--color-paper);
	}
	.lede {
		margin: 0;
		max-width: 46ch;
		font-family: var(--font-serif);
		font-size: clamp(17px, 1.5vw, 20px);
		line-height: 1.45;
		color: rgba(244, 241, 235, 0.82);
		text-wrap: pretty;
	}
	.hero .button-primary {
		box-shadow: inset 0 0 0 1px rgba(244, 241, 235, 0.18);
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 18px;
		margin: 0;
		padding-top: 22px;
		border-top: 1px solid rgba(244, 241, 235, 0.16);
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
		color: rgba(244, 241, 235, 0.64);
	}
	.stat dd {
		order: 1;
		margin: 0;
		font-size: clamp(24px, 2.4vw, 32px);
		font-weight: 500;
		line-height: 1;
		letter-spacing: -0.025em;
		font-variant-numeric: tabular-nums;
		color: var(--color-paper);
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
	h2:focus {
		outline: none;
	}
	.section-sub {
		margin: 0;
		font-family: var(--font-serif);
		font-size: 18px;
		line-height: 1.5;
		color: var(--color-ink-2);
		text-wrap: pretty;
	}

	/* ---------- a published record ---------- */
	.record-grid {
		display: grid;
		grid-template-columns: minmax(0, 0.8fr) minmax(0, 1fr);
		gap: clamp(40px, 6vw, 88px);
		align-items: start;
	}
	.record-head {
		display: grid;
		gap: 22px;
	}
	.tray {
		display: grid;
		gap: 10px;
	}
	.tray-label {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 10.5px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-ink-4);
	}
	.record-stage {
		min-width: 0;
	}
	.stage-placeholder {
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 12px;
		aspect-ratio: 4 / 4.4;
		max-height: min(78vh, 720px);
		border-radius: var(--radius-surface);
		background: var(--color-paper-2);
		text-align: center;
	}
	.stage-placeholder p {
		margin: 0;
		font: italic 400 17px/1.45 var(--font-serif);
		color: var(--color-ink-3);
	}

	/* ---------- review ledger ---------- */
	.review {
		background: var(--color-forest);
		color: var(--color-paper);
	}
	.review h2 {
		color: var(--color-paper);
	}
	.review h2 :global(em),
	.call-plate h2 :global(em) {
		color: #f4b5a0;
	}
	.review .section-sub {
		color: rgba(244, 241, 235, 0.78);
	}
	.ledger {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		margin: 0;
		padding: 0;
		border-top: 1px solid rgba(244, 241, 235, 0.3);
		border-bottom: 1px solid rgba(244, 241, 235, 0.3);
		list-style: none;
	}
	.entry {
		display: grid;
		align-content: space-between;
		gap: 40px;
		min-height: 180px;
		padding: 20px 18px 22px;
		border-left: 1px solid rgba(244, 241, 235, 0.16);
	}
	.entry:first-child {
		border-left: 0;
	}
	.entry-number {
		font-family: var(--font-mono);
		font-size: 11px;
		letter-spacing: 0.08em;
		color: rgba(244, 241, 235, 0.6);
	}
	.entry-name {
		font-size: clamp(17px, 1.5vw, 20px);
		font-weight: 500;
		line-height: 1.2;
		letter-spacing: -0.01em;
	}
	.entry.is-final {
		background: var(--color-vermillion);
		color: #fff;
	}
	.entry.is-final .entry-number {
		color: rgba(255, 255, 255, 0.85);
	}
	.review-notes {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 24px clamp(32px, 5vw, 72px);
		margin-top: clamp(32px, 4vw, 48px);
	}
	.review-notes p {
		margin: 0;
		max-width: 52ch;
		font: italic 400 17px/1.5 var(--font-serif);
		color: rgba(244, 241, 235, 0.8);
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

	/* ---------- call for editions ---------- */
	.call-plate {
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
				animation-range: entry 0% entry 40%;
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
			translate: 0 28px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.button,
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
		.ledger {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
		.entry:nth-child(4) {
			border-left: 0;
		}
		.entry:nth-child(n + 4) {
			border-top: 1px solid rgba(244, 241, 235, 0.16);
		}
	}
	@media (max-width: 960px) {
		.record-grid,
		.call-plate {
			grid-template-columns: 1fr;
		}
		.review-notes {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 640px) {
		.stats {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			row-gap: 22px;
		}
		.section-head.split {
			grid-template-columns: 1fr;
		}
		.collection-grid {
			grid-template-columns: 1fr;
		}
		.ledger {
			grid-template-columns: 1fr;
		}
		.entry {
			grid-template-columns: 3rem minmax(0, 1fr);
			align-items: baseline;
			min-height: 0;
			gap: 12px;
			padding: 16px 4px;
			border-left: 0;
		}
		.entry:nth-child(n + 2) {
			border-top: 1px solid rgba(244, 241, 235, 0.16);
		}
		.entry.is-final {
			padding-inline: 12px;
		}
	}
</style>
