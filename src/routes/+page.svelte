<script lang="ts">
	import { onMount } from 'svelte';
	import { base, resolve } from '$app/paths';
	import EditionCard from '$lib/components/cards/EditionCard.svelte';
	import CollectionCard from '$lib/components/cards/CollectionCard.svelte';
	import { editionsStore, collectionsStore, fetchAllData, isStale } from '$lib/stores/data.store';

	// Reactive data from persisted stores - shows cached data immediately
	let featuredEditions = $derived($editionsStore.items.slice(0, 8));
	const heroRotation = Math.random();
	let heroEditions = $derived.by(() => {
		const editions = $editionsStore.items.filter((edition) => edition.thumbnail);
		if (editions.length <= 5) return editions;

		const start = Math.floor(heroRotation * editions.length);
		return Array.from({ length: 5 }, (_, index) => editions[(start + index) % editions.length]);
	});
	let collections = $derived(
		$collectionsStore.items.filter(
			(collection) => collection.isVisible && (collection.editionCount ?? 0) > 0
		)
	);
	let totalEditions = $derived($editionsStore.total);
	let totalCollections = $derived(collections.length);

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

	onMount(() => {
		async function loadData() {
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
		}

		loadData();
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
	const heroSkeletons = [0, 1, 2, 3, 4];
	const cardSkeletons = [0, 1, 2, 3];
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

<div class="p3d">
	<!-- ============== HERO ============== -->
	<section class="hero-sec">
		<div class="shell">
			<div class="eyebrow">
				<span class="dot" aria-hidden="true"></span>
				<span>PURE3D · 3D scholarly publishing infrastructure</span>
			</div>

			<h1 class="hero-h1">
				An infrastructure for the preservation and publication of <em>3D scholarship</em>
			</h1>

			<div class="hero-grid">
				<p class="hero-lede">
					PURE3D is an infrastructure for publishing, depositing, preserving, and exploring
					interactive 3D Scholarly Editions: annotated, reviewable, citable records that connect
					models with evidence, interpretation, paradata, and long-term access.
				</p>
				<div class="hero-side">
					<div class="hero-editions" aria-label="Recent editions">
						<div class="hero-editions-label">Recent editions</div>
						<div class="hero-cover-row">
							{#if isLoading && !hasCachedData}
								{#each heroSkeletons as i (i)}
									<div
										class="hero-cover hero-cover-skeleton skeleton"
										class:hero-cover-raised={i % 2 === 1}
									></div>
								{/each}
							{:else}
								{#each heroEditions as edition, i (edition.id)}
									<a
										href={resolve('/editions/[slug]', { slug: edition.slug })}
										class="hero-cover"
										class:hero-cover-raised={i % 2 === 1}
										aria-label={`View ${edition.title}`}
									>
										<img
											src={edition.thumbnail}
											alt={edition.title}
											loading={i < 2 ? 'eager' : 'lazy'}
										/>
									</a>
								{/each}
							{/if}
						</div>
					</div>

					<div class="hero-actions">
						<a href={resolve('/editions')} class="btn btn-primary">
							Browse editions
							<span class="arrow" aria-hidden="true">→</span>
						</a>
						<a href={resolve('/documentation/submission')} class="btn btn-secondary"
							>Publish with us</a
						>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- ============== STATS STRIP ============== -->
	<section class="stats-strip">
		<div class="shell">
			<dl class="stats-grid">
				<a class="stat-link stat" href={resolve('/editions')}>
					<dt>3D Editions</dt>
					<dd>
						{#if isLoading && !hasCachedData}
							<span class="loading loading-sm loading-spinner text-primary"></span>
						{:else}
							{totalEditions}
						{/if}
					</dd>
				</a>
				<a class="stat-link stat" href={resolve('/collections')}>
					<dt>Collections</dt>
					<dd>
						{#if isLoading && !hasCachedData}
							<span class="loading loading-sm loading-spinner text-primary"></span>
						{:else}
							{totalCollections}
						{/if}
					</dd>
				</a>
				<div class="stat">
					<dt>Authors trained</dt>
					<dd>100+</dd>
				</div>
				<div class="stat">
					<dt>Presentations & workshops</dt>
					<dd>45</dd>
				</div>
			</dl>
		</div>
	</section>

	<!-- ============== PROJECTS (COLLECTIONS) ============== -->
	<section class="sec">
		<div class="shell">
			<div class="sec-head">
				<div class="sec-head-body">
					<h2 class="sec-title">Collections as <em>scholarly contexts</em></h2>
					<p class="sec-sub">
						Collections organise 3D editions by theme, period, provenance, institution, or material
						context.
					</p>
				</div>
			</div>

			{#if isLoading && !hasCachedData}
				<div class="projects-grid">
					{#each cardSkeletons as i (i)}
						<div class="h-96 skeleton"></div>
					{/each}
				</div>
			{:else if collections.length > 0}
				<div class="projects-grid">
					{#each collections.slice(0, 4) as collection (collection.id)}
						<CollectionCard {collection} showDescription={false} />
					{/each}
				</div>

				{#if collections.length > 4}
					<div class="sec-footer">
						<a href={resolve('/collections')} class="btn btn-ghost">
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
					<h2 class="publish-title">Propose your own <em>edition.</em></h2>
				</div>
				<div class="publish-body">
					<p class="publish-lede">
						Pure 3D provides the infrastructure and tools to publish interactive 3D research. Join
						our growing community edition editors/authors.
					</p>
					<div class="publish-actions">
						<a href={resolve('/documentation/submission')} class="btn btn-accent">
							Submission guidelines
							<span class="arrow" aria-hidden="true">→</span>
						</a>
						<a href={resolve('/documentation')} class="btn-on-ink-ghost btn"
							>Read the documentation</a
						>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- ============== FEATURED EDITIONS ============== -->
	<section class="sec sec-paper2">
		<div class="shell">
			<div class="sec-head">
				<div class="sec-head-body">
					<h2 class="sec-title">Recent <em>scholarly editions</em></h2>
					<p class="sec-sub">
						Each edition is a citable, permalinked record of a 3D object that includes descriptive
						metadata, annotations, background and contextual information.
					</p>
				</div>
				<div class="sec-actions">
					<button
						onclick={() => scrollCarousel('left')}
						class="nav-btn"
						aria-label="Scroll editions left"
					>
						<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
							<path
								d="M10 3 L5 8 L10 13"
								stroke="currentColor"
								stroke-width="1.4"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
					</button>
					<button
						onclick={() => scrollCarousel('right')}
						class="nav-btn"
						aria-label="Scroll editions right"
					>
						<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
							<path
								d="M6 3 L11 8 L6 13"
								stroke="currentColor"
								stroke-width="1.4"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
					</button>
				</div>
			</div>

			{#if isLoading && !hasCachedData}
				<div class="carousel">
					{#each cardSkeletons as i (i)}
						<div class="h-80 w-64 flex-none skeleton"></div>
					{/each}
				</div>
			{:else if featuredEditions.length > 0}
				<div
					bind:this={carouselContainer}
					class="scrollbar-hide carousel"
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
				<a href={resolve('/editions')} class="btn btn-ghost">
					View all editions
					<span class="arrow" aria-hidden="true">↗</span>
				</a>
			</div>
		</div>
	</section>

	<!-- ============== CORE PROMISES ============== -->
	<section class="sec promise-sec">
		<div class="shell">
			<div class="sec-head">
				<div class="sec-head-body">
					<h2 class="sec-title">What <em>PURE3D</em> brings together.</h2>
					<p class="sec-sub">
						The platform serves both creators and readers of 3D research: researchers, educators,
						cultural heritage managers, students, public audiences, and academic reviewers.
					</p>
				</div>
			</div>

			<div class="promise-grid">
				{#each promiseCards as card, i (card.title)}
					<article class="promise-card">
						<span>{String(i + 1).padStart(2, '0')}</span>
						<h3>{card.title}</h3>
						<p>{card.text}</p>
					</article>
				{/each}
			</div>
		</div>
	</section>

	<section class="story">
		<div class="shell story-grid">
			<div class="sticky-panel">
				<p class="eyebrow"><span></span> 3D evidence</p>
				<h2>A Model as source</h2>
				<p class="mt-4">
					A 3D edition makes the object, its documentation and its interpretation available in the
					same place, so can be inspected, cited, reviewed, and preserved.
				</p>
			</div>
			<div class="story-steps">
				{#each storySteps as step (step.kicker)}
					<article>
						<img
							class="story-step-image"
							src={`${base}${step.image}`}
							alt={step.alt}
							loading="lazy"
						/>
						<span>{step.kicker}</span>
						<h3>{step.title}</h3>
						<p>{step.text}</p>
					</article>
				{/each}
			</div>
		</div>
	</section>

	<!-- ============== Proposal steps ============== -->
	<section class="workflow-section">
		<div class="shell workflow-card">
			<div>
				<p class="eyebrow inverse"><span></span> Editorial infrastructure</p>
				<h2>From proposal to published edition</h2>
				<p>
					Pure3D provides a supportive environment for authors/editors to publish 3D scholarship,
					including training and mentorship, throughout the publishing process.
				</p>
			</div>
			<ol>
				{#each workflow as item, i (item)}
					<li><span>{String(i + 1).padStart(2, '0')}</span>{item}</li>
				{/each}
			</ol>
		</div>
	</section>

	<!-- ============== PARTNERS ============== -->
	<section class="partners-sec">
		<div class="shell">
			<div class="partners-head">Supported by</div>
			<div class="partners-list">
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				{#each partnerLogos as partner (partner.name)}
					<a href={partner.href} target="_blank" rel="noreferrer" aria-label={partner.name}>
						<img src={`${base}${partner.image}`} alt={partner.name} loading="lazy" />
					</a>
				{/each}
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
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
	/* ---------- HERO ---------- */
	.hero-sec {
		position: relative;
		isolation: isolate;
		overflow: hidden;
		padding: 128px 0 96px;
		border-bottom: 1px solid var(--rule);
		background: linear-gradient(180deg, var(--color-base-100) 0%, var(--color-base-200) 100%);
	}
	.hero-sec::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		background-image:
			linear-gradient(
				color-mix(in srgb, var(--color-base-content) 5%, transparent) 1px,
				transparent 1px
			),
			linear-gradient(
				90deg,
				color-mix(in srgb, var(--color-base-content) 5%, transparent) 1px,
				transparent 1px
			);
		background-size: 72px 72px;
		mask-image: radial-gradient(circle at 64% 36%, black, transparent 74%);
		pointer-events: none;
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
		align-items: start;
		margin-top: 48px;
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
	.hero-side {
		display: grid;
		gap: 22px;
		justify-items: start;
	}
	.hero-editions {
		width: min(100%, 520px);
	}
	.hero-editions-label {
		font-family: var(--font-mono);
		font-size: 10.5px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-ink-4);
		margin-bottom: 10px;
	}
	.hero-cover-row {
		display: flex;
		align-items: flex-end;
		gap: 8px;
		min-height: 112px;
		overflow-x: auto;
		overflow-y: hidden;
		padding: 4px 2px 10px;
		perspective: 900px;
		scroll-snap-type: x proximity;
		-webkit-overflow-scrolling: touch;
	}
	.hero-cover-row::-webkit-scrollbar {
		display: none;
	}
	.hero-cover-row {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
	.hero-cover {
		position: relative;
		flex: 0 0 86px;
		height: 108px;
		display: block;
		overflow: hidden;
		border: 1px solid var(--rule-strong);
		border-radius: 3px;
		background: var(--color-paper-2);
		box-shadow: 0 12px 28px rgba(16, 16, 15, 0.08);
		transform: translateY(0);
		transition:
			transform 0.16s ease,
			border-color 0.16s ease,
			box-shadow 0.16s ease;
		scroll-snap-align: start;
	}
	.hero-cover:hover {
		border-color: var(--color-ink);
		box-shadow: 0 16px 34px rgba(16, 16, 15, 0.12);
		transform: translateY(-3px);
	}
	.hero-cover-raised {
		transform: translateY(-10px);
	}
	.hero-cover-raised:hover {
		transform: translateY(-13px);
	}
	.hero-cover img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	@media (max-width: 900px) {
		.hero-grid {
			margin-top: 40px;
		}
		.hero-side {
			gap: 24px;
		}
		.hero-editions {
			width: 100%;
		}
		.hero-cover {
			flex-basis: 84px;
			height: 106px;
		}
	}
	@media (max-width: 520px) {
		.hero-cover-row {
			margin-right: -24px;
			padding-right: 24px;
		}
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
	.stat-link {
		text-decoration: none;
		transition: opacity 0.15s ease;
	}
	.stat-link:hover,
	.stat-link:focus-visible {
		opacity: 0.72;
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
		grid-template-columns: 1fr auto;
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
	.promise-sec {
		background: var(--color-base-100);
	}
	.promise-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 16px;
	}
	.promise-card {
		min-height: 260px;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: clamp(24px, 4vw, 40px);
		border: 1px solid var(--rule);
		border-radius: 28px;
		background: linear-gradient(
			145deg,
			var(--color-paper),
			color-mix(in srgb, var(--color-paper) 72%, transparent)
		);
		box-shadow: 0 20px 70px rgba(16, 16, 15, 0.06);
	}
	.promise-card span {
		font-family: var(--font-mono);
		font-size: 11px;
		letter-spacing: 0.12em;
		color: var(--color-vermillion);
	}
	.promise-card h3 {
		margin: auto 0 16px;
		font-family: var(--font-sans);
		font-weight: 500;
		font-size: clamp(24px, 2.6vw, 34px);
		line-height: 1.05;
		letter-spacing: -0.025em;
	}
	.promise-card p {
		margin: 0;
		font-family: var(--font-serif);
		font-size: 17px;
		line-height: 1.5;
		color: var(--color-ink-2);
	}
	@media (max-width: 900px) {
		.promise-grid {
			grid-template-columns: 1fr;
		}
		.promise-card {
			min-height: 220px;
		}
	}

	/* ---------- STORY ---------- */
	.story {
		padding: 128px 0;
		border-bottom: 1px solid var(--rule);
		background:
			radial-gradient(
				circle at 80% 20%,
				color-mix(in srgb, var(--color-vermillion) 12%, transparent),
				transparent 34rem
			),
			var(--color-base-100);
	}
	.story-grid {
		display: grid;
		grid-template-columns: 0.82fr 1.18fr;
		gap: clamp(32px, 7vw, 112px);
		align-items: start;
	}
	.sticky-panel {
		position: sticky;
		top: 96px;
	}
	.story .eyebrow > span {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--color-vermillion);
		box-shadow: 0 0 24px color-mix(in srgb, var(--color-vermillion) 70%, transparent);
	}
	.sticky-panel h2 {
		margin: 0;
		font-family: var(--font-sans);
		font-weight: 500;
		font-size: clamp(28px, 3.8vw, 48px);
		line-height: 1.05;
		letter-spacing: -0.025em;
		text-wrap: balance;
	}
	.sticky-panel p:not(.eyebrow),
	.story-steps p {
		font-family: var(--font-serif);
		font-size: 18px;
		line-height: 1.5;
		color: var(--color-ink-2);
	}
	.story-steps {
		display: grid;
		gap: 16px;
	}
	.story-steps article {
		display: flex;
		flex-direction: column;
		justify-content: start;
		overflow: hidden;
		padding: clamp(24px, 4vw, 48px);
		border: 1px solid var(--rule);
		border-radius: 34px;
		background: linear-gradient(
			145deg,
			color-mix(in srgb, var(--color-paper) 72%, transparent),
			color-mix(in srgb, var(--color-paper) 18%, transparent)
		);
		box-shadow: 0 24px 90px rgba(16, 16, 15, 0.08);
	}
	.story-steps span {
		color: var(--color-vermillion);
		font-family: var(--font-mono);
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}
	.story-step-image {
		width: min(118%, 860px);
		max-width: none;
		height: clamp(320px, 35vw, 500px);
		margin: -24px auto 20px;
		object-fit: contain;
		object-position: center;
		opacity: 0.86;
		filter: saturate(0.9) contrast(0.96);
	}
	.story-steps h3 {
		margin: 16px 0;
		font-family: var(--font-sans);
		font-weight: 500;
		font-size: clamp(28px, 3.8vw, 48px);
		line-height: 1.05;
		letter-spacing: -0.025em;
	}
	.story-steps p {
		max-width: 38rem;
		margin: 0;
		color: var(--color-ink-3);
	}
	@media (max-width: 900px) {
		.story {
			padding: 80px 0;
		}
		.story-grid {
			grid-template-columns: 1fr;
		}
		.sticky-panel {
			position: static;
		}
		.story-steps article {
			min-height: 0;
		}
		.story-step-image {
			width: min(108%, 560px);
			height: clamp(240px, 62vw, 360px);
			margin: 0 auto auto;
		}
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
		color: var(--color-paper);
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

	/* ---------- WORKFLOW ---------- */
	.workflow-section {
		position: relative;
		overflow: hidden;
		padding: 112px 0;
		background: var(--color-ink);
		color: var(--color-paper);
	}
	.workflow-section::before {
		content: '';
		position: absolute;
		inset: 0;
		background-image:
			linear-gradient(rgba(244, 241, 235, 0.04) 1px, transparent 1px),
			linear-gradient(90deg, rgba(244, 241, 235, 0.04) 1px, transparent 1px);
		background-size: 80px 80px;
		mask-image: radial-gradient(ellipse at center, black 30%, transparent 80%);
		pointer-events: none;
	}
	.workflow-card {
		position: relative;
		display: grid;
		grid-template-columns: 0.9fr 1.1fr;
		gap: clamp(32px, 7vw, 96px);
		align-items: center;
	}
	.workflow-section .eyebrow.inverse {
		color: rgba(244, 241, 235, 0.6);
	}
	.workflow-card .eyebrow > span {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--color-vermillion);
	}
	.workflow-section .workflow-card h2 {
		margin: 0;
		font-family: var(--font-sans);
		font-weight: 500;
		font-size: clamp(32px, 4.2vw, 52px);
		line-height: 1.02;
		letter-spacing: -0.028em;
		color: #f4f1eb;
		text-wrap: balance;
	}
	.workflow-section .workflow-card p:not(.eyebrow) {
		max-width: 52ch;
		margin: 24px 0 0;
		font-family: var(--font-serif);
		font-weight: 400;
		font-size: 18px;
		line-height: 1.5;
		color: rgba(244, 241, 235, 0.78);
	}
	.workflow-card ol {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 12px;
	}
	.workflow-section .workflow-card li {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 16px;
		border: 1px solid rgba(244, 241, 235, 0.14);
		border-radius: 8px;
		background: rgba(244, 241, 235, 0.055);
		color: #f4f1eb;
		font-family: var(--font-sans);
		font-weight: 500;
	}
	.workflow-card li span {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--color-vermillion);
		color: #fff;
		font-family: var(--font-mono);
		font-size: 11px;
		letter-spacing: 0.06em;
	}
	@media (max-width: 900px) {
		.workflow-section {
			padding: 80px 0;
		}
		.workflow-card {
			grid-template-columns: 1fr;
		}
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
		gap: 16px;
	}
	.partners-list a {
		display: grid;
		place-items: center;
		width: 190px;
		height: 88px;
		padding: 18px;
		border: 1px solid var(--rule);
		border-radius: 12px;
		background: color-mix(in srgb, var(--color-paper) 84%, transparent);
		transition:
			border-color 0.15s ease,
			opacity 0.15s ease;
	}
	.partners-list a:hover,
	.partners-list a:focus-visible {
		border-color: var(--rule-strong);
		opacity: 0.76;
	}
	.partners-list img {
		max-width: 100%;
		max-height: 48px;
		object-fit: contain;
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
