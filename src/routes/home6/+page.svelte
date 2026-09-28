<script lang="ts">
	import { onMount } from 'svelte';
	import { base, resolve } from '$app/paths';
	import CollectionCard from '$lib/components/cards/CollectionCard.svelte';
	import EditionCard from '$lib/components/cards/EditionCard.svelte';
	import { homeStore, fetchHomeData, isStale } from '$lib/stores/data.store';
	import ReliefFolio from './ReliefFolio.svelte';

	let homeLoading = $state(true);

	const editions = $derived($homeStore.editions.slice(0, 4));
	const collections = $derived($homeStore.collections.slice(0, 4));
	const hasCachedHome = $derived(
		$homeStore.editions.length > 0 || $homeStore.collections.length > 0
	);
	const pending = $derived(homeLoading && !hasCachedHome);

	async function loadHome() {
		try {
			if (!hasCachedHome || isStale($homeStore.lastFetched)) await fetchHomeData();
		} catch {
			// Cached figures stay visible when the catalogue cannot be refreshed.
		} finally {
			homeLoading = false;
		}
	}

	onMount(() => {
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
	const audiences = [
		'Researchers',
		'Educators',
		'Cultural heritage managers',
		'Students',
		'Public audiences',
		'Academic reviewers'
	];
	const promises = [
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
	const pad = (value: number) => String(value).padStart(2, '0');
</script>

<svelte:head>
	<title>Pure 3D | Explore 3D Scholarly Editions</title>
	<meta
		name="description"
		content="PURE3D is an infrastructure for publishing, preserving, and exploring interactive 3D Scholarly Editions."
	/>
</svelte:head>

<div id="home6">
	{#snippet opening()}
		<p class="eyebrow">
			<span class="dot" aria-hidden="true"></span> PURE3D · 3D scholarly publishing infrastructure
		</p>
		<h1 id="home6-title">3D scholarship, <em>published in the round.</em></h1>
		<p class="lede">
			PURE3D is an infrastructure for publishing, depositing, preserving, and exploring interactive
			3D Scholarly Editions: annotated, reviewable, citable records that connect models with
			evidence, interpretation, paradata, and long-term access.
		</p>
		<div class="actions">
			<a href={resolve('/editions')} class="button button-primary">
				Browse editions <span aria-hidden="true">→</span>
			</a>
			<a href={resolve('/documentation/submission')} class="button button-outline">
				Publish with us
			</a>
		</div>
		<p class="cue">
			<span aria-hidden="true">↓</span> Four plates follow: how an object becomes a 3D edition.
		</p>
	{/snippet}

	<section class="folio" aria-labelledby="home6-title">
		<ReliefFolio intro={opening} />
	</section>

	<section class="catalogue" aria-labelledby="home6-catalogue">
		<div class="shell">
			<header class="head reveal">
				<p class="eyebrow"><span class="dot" aria-hidden="true"></span> From the catalogue</p>
				<h2 id="home6-catalogue">
					The tablet is invented. <em>These editions are published.</em>
				</h2>
				<p class="sub">
					Each edition is a citable, permalinked record of a 3D object that includes descriptive
					metadata, annotations, background and contextual information.
				</p>
			</header>

			<dl class="ledger reveal">
				<div>
					<dt>3D Editions</dt>
					<dd><a href={resolve('/editions')}>{pending ? '—' : $homeStore.editionTotal}</a></dd>
				</div>
				<div>
					<dt>Collections</dt>
					<dd>
						<a href={resolve('/collections')}>{pending ? '—' : $homeStore.collectionTotal}</a>
					</dd>
				</div>
				<div>
					<dt>Authors trained</dt>
					<dd>100+</dd>
				</div>
				<div>
					<dt>Presentations & workshops</dt>
					<dd>45</dd>
				</div>
			</dl>

			<div class="shelf-head">
				<h3>Recent <em>scholarly editions</em></h3>
				<a class="more" href={resolve('/editions')}>
					View all editions <span aria-hidden="true">↗</span>
				</a>
			</div>
			{#if editions.length > 0}
				<div class="shelf">
					{#each editions as edition (edition.id)}
						<EditionCard {edition} imageLoading="lazy" />
					{/each}
				</div>
			{:else if pending}
				<div class="shelf" aria-busy="true">
					{#each [0, 1, 2, 3] as i (i)}
						<div class="placeholder"></div>
					{/each}
				</div>
			{:else}
				<p class="empty">No editions available yet.</p>
			{/if}

			<div class="shelf-head">
				<div>
					<h3>Collections as <em>scholarly contexts</em></h3>
					<p>
						Collections organise 3D editions by theme, period, provenance, institution, or material
						context.
					</p>
				</div>
				<a class="more" href={resolve('/collections')}>
					All collections <span aria-hidden="true">↗</span>
				</a>
			</div>
			{#if collections.length > 0}
				<div class="shelf">
					{#each collections as collection (collection.id)}
						<CollectionCard {collection} showDescription={false} imageLoading="lazy" />
					{/each}
				</div>
			{:else if pending}
				<div class="shelf" aria-busy="true">
					{#each [0, 1, 2, 3] as i (i)}
						<div class="placeholder"></div>
					{/each}
				</div>
			{:else}
				<p class="empty">No collections available yet.</p>
			{/if}
		</div>
	</section>

	<section class="path" aria-labelledby="home6-path">
		<div class="shell">
			<header class="head reveal">
				<p class="eyebrow on-dark">
					<span class="dot" aria-hidden="true"></span> Editorial infrastructure
				</p>
				<h2 id="home6-path">From proposal to <em>published edition</em></h2>
				<p class="sub">
					Pure3D provides a supportive environment for authors/editors to publish 3D scholarship,
					including training and mentorship, throughout the publishing process.
				</p>
			</header>

			<!-- Drawn as the black-and-white scale bar that sits beside an object in a record photograph. -->
			<ol class="scale">
				{#each workflow as item, i (item)}
					<li class="reveal" class:is-final={i === workflow.length - 1}>
						<span class="segment" aria-hidden="true"></span>
						<span class="step-number">{pad(i + 1)}</span>
						<span class="step-name">{item}</span>
					</li>
				{/each}
			</ol>

			<div class="notes">
				<p>
					Editors and reviewers evaluate the model, metadata, annotations, and interpretation before
					publication.
				</p>
				<p>Editions that have been peer reviewed show it on their page, with a badge.</p>
			</div>
		</div>
	</section>

	<section class="readers" aria-labelledby="home6-readers">
		<div class="shell">
			<header class="head reveal">
				<p class="eyebrow"><span class="dot" aria-hidden="true"></span> Makers and readers</p>
				<h2 id="home6-readers">What <em>PURE3D</em> brings together.</h2>
				<p class="sub">The platform serves both creators and readers of 3D research:</p>
			</header>
			<ul class="audiences reveal">
				{#each audiences as audience (audience)}
					<li>{audience}</li>
				{/each}
			</ul>
			<div class="promises">
				{#each promises as promise, i (promise.title)}
					<article class="promise reveal">
						<span class="promise-number">{pad(i + 1)}</span>
						<h3>{promise.title}</h3>
						<p>{promise.text}</p>
					</article>
				{/each}
			</div>
		</div>
	</section>

	<!-- The call shares the footer's paper, so the page runs straight on into it. -->
	<section class="call" aria-labelledby="home6-call">
		<div class="shell">
			<div class="call-grid reveal">
				<div class="call-head">
					<p class="eyebrow"><span class="dot" aria-hidden="true"></span> Call for editions</p>
					<h2 id="home6-call">Propose your own <em>edition.</em></h2>
				</div>
				<div class="call-body">
					<p>
						Pure 3D provides the infrastructure and tools to publish interactive 3D research. Join
						our growing community of edition editors and authors.
					</p>
					<div class="actions">
						<a href={resolve('/documentation/submission')} class="button button-accent">
							Submission guidelines <span aria-hidden="true">→</span>
						</a>
						<a href={resolve('/documentation')} class="button button-outline">
							Read the documentation
						</a>
					</div>
				</div>
			</div>

			<div class="supporters">
				<h2 class="supporters-head">Supported by</h2>
				<ul>
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

			<p class="colophon">
				The carved tablet on this page is procedural and conceptual. It is generated in your browser
				for illustration and does not depict an object in any PURE3D edition.
			</p>
		</div>
	</section>
</div>

<style>
	#home6 {
		--rule: color-mix(in srgb, var(--color-ink) 12%, transparent);
		--rule-strong: color-mix(in srgb, var(--color-ink) 24%, transparent);
		--on-dark: rgba(244, 241, 235, 0.8);
		--ease-out: cubic-bezier(0.2, 0.7, 0.1, 1);
		overflow-x: clip;
		background: var(--color-paper);
		color: var(--color-ink);
		font-family: var(--font-sans);
	}
	#home6 :global(em) {
		font-family: var(--font-serif);
		font-style: italic;
		font-weight: 400;
		color: var(--color-vermillion-ink);
	}
	#home6 :global(a:focus-visible),
	#home6 :global(button:focus-visible) {
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
		flex-wrap: wrap;
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
	.eyebrow.on-dark {
		color: rgba(244, 241, 235, 0.68);
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
	.button-outline {
		border-color: var(--rule-strong);
		color: var(--color-ink);
	}
	.button-outline:hover {
		border-color: var(--color-ink);
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

	/* ---------- opening, rendered inside the folio ---------- */
	h1 {
		margin: 0;
		max-width: 13ch;
		font: 350 clamp(46px, 6vw, 96px) / 0.95 var(--font-serif);
		letter-spacing: -0.03em;
		text-wrap: balance;
	}
	h1 em {
		display: block;
		font-weight: 300;
	}
	.lede {
		margin: 0;
		max-width: 46ch;
		font-size: clamp(17px, 1.4vw, 19.5px);
		line-height: 1.55;
		color: var(--color-ink-2);
		text-wrap: pretty;
	}
	.cue {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 8px 0 0;
		font-family: var(--font-mono);
		font-size: 11px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--color-ink-3);
	}

	/* ---------- shared section chrome ---------- */
	section:not(.folio) {
		padding: clamp(80px, 10vw, 136px) 0;
	}
	.folio {
		border-bottom: 1px solid var(--color-ink);
	}
	.head {
		display: grid;
		gap: 16px;
		max-width: 62ch;
		margin-bottom: clamp(40px, 5vw, 64px);
	}
	h2 {
		margin: 0;
		font: 400 clamp(32px, 4vw, 58px) / 1.02 var(--font-serif);
		letter-spacing: -0.02em;
		text-wrap: balance;
	}
	h3 {
		margin: 0;
		font-weight: 500;
		letter-spacing: -0.015em;
	}
	.sub {
		margin: 0;
		max-width: 56ch;
		font-size: 18px;
		line-height: 1.55;
		color: var(--color-ink-2);
		text-wrap: pretty;
	}

	/* ---------- catalogue ---------- */
	.ledger {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		margin: 0 0 clamp(56px, 7vw, 96px);
		border-top: 1px solid var(--color-ink);
		border-bottom: 1px solid var(--rule);
	}
	.ledger div {
		display: grid;
		align-content: start;
		gap: 10px;
		padding: 22px 20px 24px 0;
	}
	.ledger div + div {
		padding-left: 20px;
		border-left: 1px solid var(--rule);
	}
	.ledger dt {
		order: 2;
		font-family: var(--font-mono);
		font-size: 10.5px;
		line-height: 1.3;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-ink-3);
	}
	.ledger dd {
		order: 1;
		margin: 0;
		font: 300 clamp(40px, 4.4vw, 64px) / 1 var(--font-serif);
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
	}
	.ledger a {
		color: inherit;
		text-decoration: none;
		transition: color 0.18s ease;
	}
	.ledger a:hover {
		color: var(--color-vermillion-ink);
	}

	.shelf-head {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		justify-content: space-between;
		gap: 12px 24px;
		margin-bottom: 24px;
	}
	.shelf-head:not(:first-of-type) {
		margin-top: clamp(56px, 7vw, 96px);
	}
	.shelf-head > div {
		display: grid;
		gap: 8px;
	}
	.shelf-head h3 {
		font-size: clamp(22px, 2.2vw, 30px);
		line-height: 1.1;
	}
	.shelf-head p {
		margin: 0;
		max-width: 56ch;
		font-size: 16px;
		line-height: 1.5;
		color: var(--color-ink-3);
	}
	.shelf {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 16px;
	}
	.placeholder {
		height: 22rem;
		border-radius: var(--radius-surface);
		background: var(--color-paper-3);
	}
	.empty {
		margin: 0;
		padding: 40px 0;
		font: italic 400 17px/1.5 var(--font-serif);
		color: var(--color-ink-4);
	}

	/* ---------- process as a scale bar ---------- */
	.path {
		background: var(--color-forest);
		color: var(--color-paper);
	}
	.path h2 {
		color: var(--color-paper);
	}
	.path h2 :global(em) {
		color: #f4b5a0;
	}
	.path .sub {
		color: var(--on-dark);
	}
	.scale {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		margin: 0;
		padding: 18px 0 0;
		list-style: none;
	}
	.scale li {
		display: grid;
		align-content: start;
		gap: 12px;
	}
	.segment {
		position: relative;
		height: 16px;
		border: 1px solid var(--color-paper);
		border-left-width: 0;
	}
	.scale li:first-child .segment {
		border-left-width: 1px;
	}
	.scale li:nth-child(odd) .segment {
		background: var(--color-paper);
	}
	/* A tick above the start of every stage, as on a measuring scale. */
	.segment::before {
		content: '';
		position: absolute;
		bottom: 100%;
		left: -1px;
		width: 1px;
		height: 12px;
		background: var(--color-paper);
	}
	.scale li.is-final .segment {
		border-color: var(--color-vermillion);
		background: var(--color-vermillion);
	}
	.step-number {
		padding-right: 12px;
		font-family: var(--font-mono);
		font-size: 11px;
		letter-spacing: 0.08em;
		color: rgba(244, 241, 235, 0.66);
	}
	.step-name {
		padding-right: 12px;
		font-size: clamp(16px, 1.5vw, 20px);
		font-weight: 500;
		line-height: 1.2;
	}
	.is-final .step-name {
		color: #f4b5a0;
	}
	.notes {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 20px clamp(32px, 5vw, 72px);
		margin-top: clamp(40px, 5vw, 64px);
		padding-top: 24px;
		border-top: 1px solid rgba(244, 241, 235, 0.2);
	}
	.notes p {
		margin: 0;
		max-width: 50ch;
		font: italic 400 17px/1.5 var(--font-serif);
		color: var(--on-dark);
	}

	/* ---------- readers ---------- */
	.audiences {
		display: flex;
		flex-wrap: wrap;
		gap: 0 0.45em;
		max-width: 26ch;
		margin: 0 0 clamp(56px, 7vw, 96px);
		padding: 0;
		font: italic 300 clamp(30px, 3.8vw, 56px) / 1.15 var(--font-serif);
		letter-spacing: -0.015em;
		list-style: none;
	}
	.audiences li:not(:last-child)::after {
		content: '·';
		margin-left: 0.45em;
		font-style: normal;
		color: var(--color-vermillion);
	}
	.promises {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: clamp(24px, 3vw, 40px);
	}
	.promise {
		display: grid;
		align-content: start;
		gap: 14px;
		padding-top: 20px;
		border-top: 1px solid var(--color-ink);
	}
	.promise-number {
		font-family: var(--font-mono);
		font-size: 11px;
		letter-spacing: 0.12em;
		color: var(--color-vermillion-ink);
	}
	.promise h3 {
		font-size: clamp(22px, 2.2vw, 28px);
		line-height: 1.1;
	}
	.promise p {
		margin: 0;
		font-size: 16.5px;
		line-height: 1.55;
		color: var(--color-ink-2);
	}

	/* ---------- call, running on into the site footer ---------- */
	section.call {
		padding-bottom: 48px;
		border-top: 1px solid var(--color-ink);
		background: var(--color-base-200);
	}
	.call-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
		gap: clamp(32px, 5vw, 72px);
		align-items: end;
	}
	.call-head {
		display: grid;
		gap: 20px;
	}
	.call h2 {
		font-size: clamp(44px, 6vw, 96px);
		line-height: 0.95;
	}
	.call-body {
		display: grid;
		gap: 24px;
	}
	.call-body p {
		margin: 0;
		max-width: 48ch;
		font-size: 18px;
		line-height: 1.55;
		color: var(--color-ink-2);
	}
	.supporters {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: 16px 32px;
		margin-top: clamp(64px, 8vw, 112px);
		padding-top: 28px;
		border-top: 1px solid var(--rule);
	}
	.supporters-head {
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 400;
		line-height: 1.4;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-ink-3);
	}
	.supporters ul {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 12px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.supporters a {
		display: grid;
		place-items: center;
		width: 176px;
		height: 80px;
		padding: 16px;
		border: 1px solid var(--rule);
		border-radius: var(--radius-surface);
		background: var(--color-paper);
		transition: border-color 0.18s ease;
	}
	.supporters a:hover {
		border-color: var(--rule-strong);
	}
	.supporters img {
		max-width: 100%;
		max-height: 44px;
		object-fit: contain;
	}
	.colophon {
		margin: 32px 0 0;
		max-width: 80ch;
		font-family: var(--font-mono);
		font-size: 11px;
		line-height: 1.6;
		color: var(--color-ink-3);
	}

	/* ---------- motion ---------- */
	@media (prefers-reduced-motion: no-preference) {
		@supports (animation-timeline: view()) {
			.reveal {
				animation: reveal linear both;
				animation-timeline: view();
				animation-range: entry 0% entry 40%;
			}
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
		.ledger a,
		.supporters a {
			transition: none;
		}
		.button:hover {
			translate: none;
		}
	}

	/* ---------- responsive ---------- */
	@media (max-width: 1100px) {
		.shelf {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.scale {
			grid-template-columns: repeat(3, minmax(0, 1fr));
			row-gap: 36px;
		}
		.scale li:nth-child(4) .segment {
			border-left-width: 1px;
		}
	}
	@media (max-width: 900px) {
		.ledger {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.ledger div:nth-child(3) {
			padding-left: 0;
			border-left: 0;
		}
		.ledger div:nth-child(n + 3) {
			border-top: 1px solid var(--rule);
		}
		.notes,
		.promises,
		.call-grid {
			grid-template-columns: 1fr;
		}
		.supporters {
			grid-template-columns: 1fr;
		}
		.supporters ul {
			justify-content: flex-start;
		}
	}
	@media (max-width: 640px) {
		.shelf {
			grid-template-columns: 1fr;
		}
		.scale {
			grid-template-columns: 1fr;
			row-gap: 0;
			padding: 0 0 0 12px;
		}
		.scale li {
			grid-template-columns: 16px 3rem minmax(0, 1fr);
			align-items: center;
			gap: 14px;
			min-height: 56px;
		}
		.segment {
			align-self: stretch;
			height: auto;
			border-width: 0 1px 1px;
		}
		.scale li:first-child .segment {
			border-top-width: 1px;
		}
		.segment::before {
			top: -1px;
			right: 100%;
			bottom: auto;
			left: auto;
			width: 10px;
			height: 1px;
		}
		.supporters li {
			width: calc(50% - 6px);
		}
		.supporters a {
			width: 100%;
		}
	}
</style>
