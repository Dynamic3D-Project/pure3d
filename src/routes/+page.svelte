<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import EditionCard from '$lib/components/cards/EditionCard.svelte';
	import CollectionCard from '$lib/components/cards/CollectionCard.svelte';
	import { editionsStore, collectionsStore, fetchAllData, isStale } from '$lib/stores/data.store';

	// Reactive data from persisted stores - shows cached data immediately
	let featuredEditions = $derived($editionsStore.items.slice(0, 8));
	let collections = $derived($collectionsStore.items);
	let totalEditions = $derived($editionsStore.total);
	let totalCollections = $derived($collectionsStore.total);

	let hasCachedData = $derived(
		$editionsStore.items.length > 0 || $collectionsStore.items.length > 0
	);
	let isLoading = $state(true);

	function preloadImages(urls: string[]) {
		const validUrls = urls.filter(Boolean);
		if (!validUrls.length) return;

		const loadNext = (index: number) => {
			if (index >= validUrls.length) return;

			const img = new Image();
			img.onload = img.onerror = () => {
				if ('requestIdleCallback' in window) {
					requestIdleCallback(() => loadNext(index + 1), { timeout: 1000 });
				} else {
					setTimeout(() => loadNext(index + 1), 50);
				}
			};
			img.src = validUrls[index];
		};

		if ('requestIdleCallback' in window) {
			requestIdleCallback(() => loadNext(0), { timeout: 2000 });
		} else {
			setTimeout(() => loadNext(0), 500);
		}
	}

	let carouselContainer: HTMLDivElement | undefined = $state();

	function scrollCarousel(direction: 'left' | 'right') {
		if (!carouselContainer) return;
		const scrollAmount = 320;
		carouselContainer.scrollBy({
			left: direction === 'left' ? -scrollAmount : scrollAmount,
			behavior: 'smooth'
		});
	}

	onMount(async () => {
		const editionsStale = isStale($editionsStore.lastFetched);
		const collectionsStale = isStale($collectionsStore.lastFetched);

		if (hasCachedData && !editionsStale && !collectionsStale) {
			isLoading = false;
			const firstFoldThumbnails = [
				...$editionsStore.items.slice(0, 15).map((e) => e.thumbnail),
				...$collectionsStore.items.slice(0, 15).map((c) => c.thumbnail)
			];
			preloadImages(firstFoldThumbnails);
			return;
		}

		try {
			const { editions, collections: cols } = await fetchAllData();

			const firstFoldThumbnails = [
				...editions.slice(0, 15).map((e) => e.thumbnail),
				...cols.slice(0, 15).map((c) => c.thumbnail)
			];
			preloadImages(firstFoldThumbnails);
		} catch (error) {
			console.error('Error loading data:', error);
		} finally {
			isLoading = false;
		}
	});

	const today = new Date().toLocaleDateString('en-GB', {
		month: 'long',
		year: 'numeric'
	});
</script>

<svelte:head>
	<title>Pure 3D | Explore 3D Scholarly Editions</title>
	<meta
		name="description"
		content="Explore our 3D Scholarly Editions and create your own. Pure3D is a platform for digital humanities and heritage 3D collections."
	/>
</svelte:head>

<div class="p3d">
	<!-- ============== HERO ============== -->
	<section class="hero-sec">
		<div class="shell">
			<div class="eyebrow">
				<span class="dot" aria-hidden="true"></span>
				<span>Pure 3D · scholarly publishing platform</span>
				<span class="sep" aria-hidden="true">———</span>
				<span>{today}</span>
			</div>

			<h1 class="hero-h1">
				Dimensional <em>scholarship</em>,<br />
				published for the long read.
			</h1>

			<div class="hero-grid">
				<p class="hero-lede">
					Pure 3D publishes cultural-heritage and scientific objects as interactive, citable,
					long-lived records. The interface recedes, paper, ink, and precise chrome framing the
					model itself.
				</p>
				<div class="hero-actions">
					<a href="{base}/editions" class="btn btn-primary">
						Browse editions
						<span class="arrow" aria-hidden="true">→</span>
					</a>
					<a href="{base}/collections" class="btn btn-secondary">View collections</a>
				</div>
			</div>
		</div>
	</section>

	<!-- ============== STATS STRIP ============== -->
	<section class="stats-strip">
		<div class="shell">
			<dl class="stats-grid">
				<div class="stat">
					<dt>3D Editions</dt>
					<dd>
						{#if isLoading && !hasCachedData}
							<span class="loading loading-spinner loading-sm text-primary"></span>
						{:else}
							{totalEditions}
						{/if}
					</dd>
				</div>
				<div class="stat">
					<dt>Collections</dt>
					<dd>
						{#if isLoading && !hasCachedData}
							<span class="loading loading-spinner loading-sm text-primary"></span>
						{:else}
							{totalCollections}
						{/if}
					</dd>
				</div>
				<div class="stat">
					<dt>Audience</dt>
					<dd class="stat-text">Curators · researchers · students</dd>
				</div>
				<div class="stat">
					<dt>Stance</dt>
					<dd class="stat-text">Museum-grade · quiet · precise</dd>
				</div>
			</dl>
		</div>
	</section>

	<!-- ============== FEATURED EDITIONS ============== -->
	<section class="sec">
		<div class="shell">
			<div class="sec-head">
				<div class="sec-num">§ 01 — Editions</div>
				<div class="sec-head-body">
					<h2 class="sec-title">Fresh from the <em>studio.</em></h2>
					<p class="sec-sub">
						Each edition is a citable, permalinked record of an object at a moment in time — scan,
						annotation, provenance note. Browse the most recent.
					</p>
				</div>
				<div class="sec-actions">
					<button
						onclick={() => scrollCarousel('left')}
						class="nav-btn"
						aria-label="Scroll editions left"
					>
						<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
							<path d="M10 3 L5 8 L10 13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
						</svg>
					</button>
					<button
						onclick={() => scrollCarousel('right')}
						class="nav-btn"
						aria-label="Scroll editions right"
					>
						<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
							<path d="M6 3 L11 8 L6 13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
						</svg>
					</button>
				</div>
			</div>

			{#if isLoading && !hasCachedData}
				<div class="carousel">
					{#each Array(4) as _, i (i)}
						<div class="w-64 h-80 flex-none skeleton"></div>
					{/each}
				</div>
			{:else if featuredEditions.length > 0}
				<div
					bind:this={carouselContainer}
					class="carousel scrollbar-hide"
					style="scroll-behavior: smooth; -webkit-overflow-scrolling: touch;"
				>
					{#each featuredEditions as edition (edition.id)}
						<div class="w-64 flex-none snap-start">
							<EditionCard {edition} />
						</div>
					{/each}
				</div>
			{:else}
				<div class="empty">No editions available yet.</div>
			{/if}

			<div class="sec-footer">
				<a href="{base}/editions" class="btn btn-ghost">
					View all editions
					<span class="arrow" aria-hidden="true">↗</span>
				</a>
			</div>
		</div>
	</section>

	<!-- ============== PROJECTS (COLLECTIONS) ============== -->
	<section class="sec sec-paper2">
		<div class="shell">
			<div class="sec-head">
				<div class="sec-num">§ 02 — Collections</div>
				<div class="sec-head-body">
					<h2 class="sec-title">Objects <em>gathered</em> by a curator's hand.</h2>
					<p class="sec-sub">
						A collection is not a folder — it is an argument. Each gathers a set of editions around
						a question, a period, or a material history.
					</p>
				</div>
			</div>

			{#if isLoading && !hasCachedData}
				<div class="projects-grid">
					{#each Array(4) as _, i (i)}
						<div class="skeleton h-96"></div>
					{/each}
				</div>
			{:else if collections.length > 0}
				<div class="projects-grid">
					{#each collections.slice(0, 4) as collection (collection.id)}
						<CollectionCard {collection} />
					{/each}
				</div>

				{#if collections.length > 4}
					<div class="sec-footer">
						<a href="{base}/collections" class="btn btn-ghost">
							All collections
							<span class="arrow" aria-hidden="true">↗</span>
						</a>
					</div>
				{/if}
			{:else}
				<div class="empty">No collections available yet.</div>
			{/if}
		</div>
	</section>

	<!-- ============== PUBLISH CTA ============== -->
	<section class="sec">
		<div class="shell">
			<div class="publish-plate">
				<div class="publish-head">
					<div class="eyebrow eyebrow-on-ink">
						<span class="dot" aria-hidden="true"></span>
						<span>Call for editions</span>
					</div>
					<h2 class="publish-title">
						Are you working on a 3D <em>scholarly edition?</em>
					</h2>
				</div>
				<div class="publish-body">
					<p class="publish-lede">
						Pure 3D provides the infrastructure and tools to publish your interactive 3D research.
						Join a growing community of digital humanities scholars.
					</p>
					<div class="publish-actions">
						<a href="{base}/documentation/submission" class="btn btn-accent">
							Submission guidelines
							<span class="arrow" aria-hidden="true">→</span>
						</a>
						<a href="{base}/documentation" class="btn btn-on-ink-ghost">Read the documentation</a>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- ============== PARTNERS ============== -->
	<section class="partners-sec">
		<div class="shell">
			<div class="partners-head">Supported by</div>
			<div class="partners-list">
				<span>Maastricht University</span>
				<span class="dot-sep" aria-hidden="true">·</span>
				<span>Platform Digital Infrastructure</span>
				<span class="dot-sep" aria-hidden="true">·</span>
				<span>KNAW Digital Infrastructure</span>
			</div>
		</div>
	</section>
</div>

<style>
	/* scoped reset for design-system typography on this page */
	.p3d {
		background: var(--color-base-100);
		color: var(--color-base-content);
		font-family: var(--font-sans);
		--rule: color-mix(in srgb, var(--color-base-content) 10%, transparent);
		--rule-strong: color-mix(in srgb, var(--color-base-content) 20%, transparent);
	}
	.p3d :global(em) {
		font-family: var(--font-serif);
		font-style: italic;
		font-weight: 400;
		color: var(--color-vermillion-ink);
	}

	/* layout shell */
	.shell {
		max-width: 1280px;
		margin: 0 auto;
		padding: 0 48px;
	}
	@media (max-width: 900px) {
		.shell {
			padding: 0 24px;
		}
	}

	/* eyebrow pattern (mono label with vermillion dot) */
	.eyebrow {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 12px;
		font-family: var(--font-mono);
		font-size: 11.5px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-ink-3);
	}
	.eyebrow .dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--color-vermillion);
	}
	.eyebrow .sep {
		opacity: 0.35;
	}

	/* ---------- HERO ---------- */
	.hero-sec {
		padding: 128px 0 96px;
		border-bottom: 1px solid var(--rule);
	}
	.hero-h1 {
		font-family: var(--font-sans);
		font-weight: 500;
		font-size: clamp(42px, 7.4vw, 104px);
		line-height: 0.96;
		letter-spacing: -0.035em;
		margin: 48px 0 32px;
		text-wrap: balance;
	}
	.hero-grid {
		display: grid;
		grid-template-columns: 1.3fr 1fr;
		gap: 96px;
		align-items: end;
		margin-top: 64px;
	}
	@media (max-width: 900px) {
		.hero-grid {
			grid-template-columns: 1fr;
			gap: 32px;
		}
	}
	.hero-lede {
		font-family: var(--font-serif);
		font-size: 22px;
		line-height: 1.4;
		color: var(--color-ink-2);
		max-width: 48ch;
		font-weight: 400;
		margin: 0;
		text-wrap: pretty;
	}
	.hero-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		justify-self: start;
	}

	/* ---------- BUTTONS (design-system flavor, paired with DaisyUI class names) ---------- */
	.btn {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		font-family: var(--font-sans);
		font-weight: 500;
		font-size: 14px;
		letter-spacing: -0.005em;
		padding: 12px 18px;
		border-radius: 2px;
		cursor: pointer;
		border: 1px solid transparent;
		background: transparent;
		text-decoration: none;
		transition:
			transform 0.08s ease,
			background 0.15s ease,
			border-color 0.15s ease,
			color 0.15s ease;
	}
	.btn:active {
		transform: translateY(1px);
	}
	.btn-primary {
		background: var(--color-ink);
		color: var(--color-paper);
	}
	.btn-primary:hover {
		background: var(--color-ink-2);
	}
	.btn-secondary {
		background: transparent;
		color: var(--color-ink);
		border-color: var(--rule-strong);
	}
	.btn-secondary:hover {
		border-color: var(--color-ink);
	}
	.btn-ghost {
		background: transparent;
		color: var(--color-ink-2);
		border-color: var(--rule);
	}
	.btn-ghost:hover {
		background: var(--color-paper-2);
		border-color: var(--rule-strong);
	}
	.btn-accent {
		background: var(--color-vermillion);
		color: #fff;
	}
	.btn-accent:hover {
		background: var(--color-vermillion-ink);
	}
	.btn-on-ink-ghost {
		color: var(--color-paper);
		border-color: rgba(244, 241, 235, 0.35);
	}
	.btn-on-ink-ghost:hover {
		border-color: var(--color-paper);
		background: rgba(244, 241, 235, 0.08);
	}
	.arrow {
		font-family: var(--font-sans);
		font-size: 15px;
		line-height: 1;
	}

	/* ---------- STATS STRIP ---------- */
	.stats-strip {
		padding: 40px 0;
		border-bottom: 1px solid var(--rule);
	}
	.stats-grid {
		margin: 0;
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 48px;
	}
	@media (max-width: 900px) {
		.stats-grid {
			grid-template-columns: repeat(2, 1fr);
			gap: 24px;
		}
	}
	.stat dt {
		font-family: var(--font-mono);
		font-size: 10.5px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-ink-4);
		margin-bottom: 6px;
	}
	.stat dd {
		margin: 0;
		font-family: var(--font-sans);
		font-weight: 500;
		font-size: 34px;
		letter-spacing: -0.025em;
		line-height: 1;
		color: var(--color-ink);
	}
	.stat dd.stat-text {
		font-family: var(--font-serif);
		font-style: italic;
		font-weight: 400;
		font-size: 17px;
		line-height: 1.3;
		color: var(--color-ink-2);
		letter-spacing: 0;
	}

	/* ---------- SECTIONS ---------- */
	.sec {
		padding: 128px 0;
		border-bottom: 1px solid var(--rule);
	}
	.sec-paper2 {
		background: var(--color-base-200);
	}
	@media (max-width: 900px) {
		.sec {
			padding: 80px 0;
		}
	}

	.sec-head {
		display: grid;
		grid-template-columns: 120px 1fr auto;
		gap: 32px;
		align-items: baseline;
		margin-bottom: 64px;
	}
	@media (max-width: 900px) {
		.sec-head {
			grid-template-columns: 1fr;
			gap: 8px;
		}
		.sec-actions {
			margin-top: 16px;
		}
	}
	.sec-num {
		font-family: var(--font-mono);
		font-size: 11px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-ink-4);
	}
	.sec-title {
		font-family: var(--font-sans);
		font-weight: 500;
		font-size: clamp(28px, 3.8vw, 48px);
		line-height: 1.05;
		letter-spacing: -0.025em;
		margin: 0 0 12px;
	}
	.sec-sub {
		font-family: var(--font-serif);
		font-size: 18px;
		line-height: 1.5;
		color: var(--color-ink-2);
		max-width: 60ch;
		margin: 0;
		text-wrap: pretty;
	}
	.sec-actions {
		display: flex;
		gap: 4px;
		align-self: end;
	}
	.nav-btn {
		width: 36px;
		height: 36px;
		display: grid;
		place-items: center;
		background: transparent;
		color: var(--color-ink-3);
		border: 1px solid var(--rule-strong);
		border-radius: 2px;
		cursor: pointer;
		transition:
			color 0.15s,
			border-color 0.15s;
	}
	.nav-btn:hover {
		color: var(--color-ink);
		border-color: var(--color-ink);
	}
	.sec-footer {
		margin-top: 48px;
		display: flex;
		justify-content: center;
	}
	.empty {
		padding: 48px 0;
		text-align: center;
		font-family: var(--font-serif);
		font-style: italic;
		color: var(--color-ink-4);
	}

	/* ---------- CAROUSEL ---------- */
	.carousel {
		display: flex;
		gap: 16px;
		overflow-x: auto;
		padding-bottom: 16px;
		scroll-snap-type: x mandatory;
	}
	.carousel :global(> div) {
		scroll-snap-align: start;
	}

	/* ---------- PROJECTS GRID ---------- */
	.projects-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 16px;
	}
	@media (max-width: 1100px) {
		.projects-grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}
	@media (max-width: 900px) {
		.projects-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	@media (max-width: 500px) {
		.projects-grid {
			grid-template-columns: 1fr;
		}
	}

	/* ---------- PUBLISH CTA ---------- */
	.publish-plate {
		background: var(--color-ink);
		color: var(--color-paper);
		border-radius: 8px;
		padding: 80px 64px;
		display: grid;
		grid-template-columns: 1.1fr 1fr;
		gap: 64px;
		align-items: end;
		position: relative;
		overflow: hidden;
	}
	@media (max-width: 900px) {
		.publish-plate {
			grid-template-columns: 1fr;
			gap: 32px;
			padding: 48px 32px;
		}
	}
	.publish-plate::before {
		content: '';
		position: absolute;
		inset: 0;
		background-image:
			linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
			linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
		background-size: 80px 80px;
		mask-image: radial-gradient(ellipse at center, black 30%, transparent 80%);
		pointer-events: none;
	}
	.publish-head,
	.publish-body {
		position: relative;
	}
	.eyebrow-on-ink {
		color: rgba(244, 241, 235, 0.6);
		margin-bottom: 24px;
	}
	.publish-title {
		font-family: var(--font-sans);
		font-weight: 500;
		font-size: clamp(32px, 4.2vw, 52px);
		letter-spacing: -0.028em;
		line-height: 1.02;
		margin: 0;
		text-wrap: balance;
	}
	.publish-title :global(em) {
		color: #f4b5a0;
	}
	.publish-lede {
		font-family: var(--font-serif);
		font-size: 18px;
		line-height: 1.5;
		color: rgba(244, 241, 235, 0.78);
		margin: 0 0 32px;
		max-width: 50ch;
	}
	.publish-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
	}

	/* ---------- PARTNERS ---------- */
	.partners-sec {
		padding: 64px 0 80px;
	}
	.partners-head {
		font-family: var(--font-mono);
		font-size: 11px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-ink-4);
		text-align: center;
		margin-bottom: 24px;
	}
	.partners-list {
		display: flex;
		justify-content: center;
		align-items: center;
		flex-wrap: wrap;
		gap: 12px 18px;
		font-family: var(--font-sans);
		font-size: 13.5px;
		color: var(--color-ink-3);
	}
	.partners-list .dot-sep {
		color: var(--color-ink-4);
		opacity: 0.5;
	}

	/* ---------- UTIL ---------- */
	.scrollbar-hide {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
	.scrollbar-hide::-webkit-scrollbar {
		display: none;
	}
	.w-64 {
		width: 16rem;
	}
	.flex-none {
		flex: none;
	}
	.snap-start {
		scroll-snap-align: start;
	}
	.h-80 {
		height: 20rem;
	}
	.h-96 {
		height: 24rem;
	}
	.skeleton {
		background: var(--color-base-300);
		border-radius: 4px;
		animation: pulse 1.6s ease-in-out infinite;
	}
	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.55;
		}
	}
</style>
