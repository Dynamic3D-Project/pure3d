<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import EditionCard from '$lib/components/cards/EditionCard.svelte';
	import CollectionCard from '$lib/components/cards/CollectionCard.svelte';
	import { editionsStore, collectionsStore, fetchAllData, isStale } from '$lib/stores/data.store';

	const storySteps = [
		{
			kicker: '01 · Capture',
			title: 'Start with the object.',
			text: 'A scan, mesh, point cloud, or reconstruction becomes the primary scholarly surface — not an illustration after the article.'
		},
		{
			kicker: '02 · Annotate',
			title: 'Attach arguments to form.',
			text: 'Hotspots, layers, provenance, uncertainty, bibliography, and interpretation stay close to the part of the model they describe.'
		},
		{
			kicker: '03 · Review',
			title: 'Make it citable and durable.',
			text: 'Editors and reviewers can evaluate both scholarship and 3D evidence before publication, preservation, and reuse.'
		}
	];

	const workflow = ['Proposal', 'Draft edition', 'Editorial review', 'Revision', 'Publication', 'Preservation'];
	const filters = ['All editions', 'Archaeology', 'Heritage', 'Architecture', 'Dynamic3D'];

	let featuredEditions = $derived($editionsStore.items.slice(0, 8));
	let collections = $derived($collectionsStore.items);
	let totalEditions = $derived($editionsStore.total);
	let totalCollections = $derived($collectionsStore.total);
	let hasCachedData = $derived($editionsStore.items.length > 0 || $collectionsStore.items.length > 0);
	let isLoading = $state(true);
	let carouselContainer: HTMLDivElement | undefined = $state();
	let activeFilter = $state(filters[0]);
	let pointerX = $state(0);
	let pointerY = $state(0);

	let heroStyle = $derived(`--mx: ${pointerX.toFixed(3)}; --my: ${pointerY.toFixed(3)};`);

	function preloadImages(urls: string[]) {
		const validUrls = urls.filter(Boolean);
		if (!validUrls.length) return;

		const loadNext = (index: number) => {
			if (index >= validUrls.length) return;
			const img = new Image();
			img.onload = img.onerror = () => {
				if ('requestIdleCallback' in window) requestIdleCallback(() => loadNext(index + 1), { timeout: 1000 });
				else setTimeout(() => loadNext(index + 1), 50);
			};
			img.src = validUrls[index];
		};

		if ('requestIdleCallback' in window) requestIdleCallback(() => loadNext(0), { timeout: 2000 });
		else setTimeout(() => loadNext(0), 500);
	}

	function scrollCarousel(direction: 'left' | 'right') {
		carouselContainer?.scrollBy({ left: direction === 'left' ? -360 : 360, behavior: 'smooth' });
	}

	function trackPointer(event: PointerEvent) {
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		pointerX = (event.clientX - rect.left) / rect.width - 0.5;
		pointerY = (event.clientY - rect.top) / rect.height - 0.5;
	}

	function resetPointer() {
		pointerX = 0;
		pointerY = 0;
	}

	onMount(async () => {
		const editionsStale = isStale($editionsStore.lastFetched);
		const collectionsStale = isStale($collectionsStore.lastFetched);

		if (hasCachedData && !editionsStale && !collectionsStale) {
			isLoading = false;
			preloadImages([
				...$editionsStore.items.slice(0, 15).map((e) => e.thumbnail),
				...$collectionsStore.items.slice(0, 15).map((c) => c.thumbnail)
			]);
			return;
		}

		try {
			const { editions, collections: cols } = await fetchAllData();
			preloadImages([
				...editions.slice(0, 15).map((e) => e.thumbnail),
				...cols.slice(0, 15).map((c) => c.thumbnail)
			]);
		} catch (error) {
			console.error('Error loading data:', error);
		} finally {
			isLoading = false;
		}
	});
</script>

<svelte:head>
	<title>Pure 3D | Interactive 3D Scholarly Editions</title>
	<meta
		name="description"
		content="Pure3D publishes interactive, citable 3D scholarly editions for cultural heritage, science, and digital humanities collections."
	/>
</svelte:head>

<div class="p3d-landing">
	<section class="hero" style={heroStyle} onpointermove={trackPointer} onpointerleave={resetPointer}>
		<div class="ambient ambient-a"></div>
		<div class="ambient ambient-b"></div>
		<div class="shell hero-shell">
			<div class="hero-copy">
				<p class="eyebrow"><span></span> Pure3D editions · interactive scholarly objects</p>
				<h1>Publish 3D scholarship as an experience people can explore.</h1>
				<p class="lede">
					Pure3D turns scans, reconstructions, annotations, and curatorial context into durable,
					citable editions — immersive enough to invite attention, rigorous enough to earn trust.
				</p>
				<div class="hero-actions">
					<a class="button primary" href="{base}/editions">Explore editions <span>→</span></a>
					<a class="button ghost" href="{base}/documentation/submission">Publish an edition</a>
				</div>
			</div>

			<div class="object-stage" aria-label="Interactive abstract 3D scholarly model preview">
				<div class="stage-ui top"><span>Model</span><strong>Object layer</strong></div>
				<div class="stage-ui right"><span>Annotation</span><strong>12 notes</strong></div>
				<div class="stage-ui bottom"><span>Citation</span><strong>Versioned DOI-ready record</strong></div>
				<div class="orbit orbit-one"></div>
				<div class="orbit orbit-two"></div>
				<div class="model-core">
					<div class="facet f1"></div>
					<div class="facet f2"></div>
					<div class="facet f3"></div>
					<div class="facet f4"></div>
					<div class="hotspot h1"></div>
					<div class="hotspot h2"></div>
					<div class="hotspot h3"></div>
				</div>
				{#each Array(24) as _, i (i)}
					<i class="point" style={`--i:${i}; --x:${(i * 37) % 100}; --y:${(i * 53) % 100};`}></i>
				{/each}
			</div>
		</div>
	</section>

	<section class="metrics" aria-label="Pure3D archive metrics">
		<div class="shell metric-grid">
			<div><span>{isLoading && !hasCachedData ? '…' : totalEditions}</span><p>published 3D editions</p></div>
			<div><span>{isLoading && !hasCachedData ? '…' : totalCollections}</span><p>curated collections</p></div>
			<div><span>3D</span><p>models, annotations, provenance</p></div>
			<div><span>∞</span><p>static-first preservation mindset</p></div>
		</div>
	</section>

	<section class="story">
		<div class="shell story-grid">
			<div class="sticky-panel">
				<p class="eyebrow"><span></span> From object to argument</p>
				<h2>The model is not decoration. It is the reading interface.</h2>
				<p>
					The landing page should behave like a scholarly instrument: cursor movement reveals depth,
					scroll reveals evidence, and each interaction clarifies what can be cited, reviewed, and preserved.
				</p>
			</div>
			<div class="story-steps">
				{#each storySteps as step}
					<article>
						<span>{step.kicker}</span>
						<h3>{step.title}</h3>
						<p>{step.text}</p>
					</article>
				{/each}
			</div>
		</div>
	</section>

	<section class="editions-section">
		<div class="shell">
			<div class="section-head">
				<div>
					<p class="eyebrow"><span></span> Highlighted collection</p>
					<h2>Browse editions like curated releases.</h2>
				</div>
				<div class="carousel-controls">
					<button onclick={() => scrollCarousel('left')} aria-label="Scroll editions left">←</button>
					<button onclick={() => scrollCarousel('right')} aria-label="Scroll editions right">→</button>
				</div>
			</div>

			<div class="filter-bar" aria-label="Edition filters">
				{#each filters as filter}
					<button class:active={activeFilter === filter} onclick={() => (activeFilter = filter)}>{filter}</button>
				{/each}
			</div>

			{#if isLoading && !hasCachedData}
				<div class="edition-rail">
					{#each Array(4) as _, i (i)}<div class="skeleton-card"></div>{/each}
				</div>
			{:else if featuredEditions.length > 0}
				<div bind:this={carouselContainer} class="edition-rail">
					{#each featuredEditions as edition (edition.id)}
						<div class="edition-wrap"><EditionCard {edition} /></div>
					{/each}
				</div>
			{:else}
				<div class="empty">No editions available yet.</div>
			{/if}
			<a class="text-link" href="{base}/editions">View the full archive ↗</a>
		</div>
	</section>

	<section class="collections-section">
		<div class="shell">
			<div class="section-head narrow">
				<p class="eyebrow"><span></span> Collections</p>
				<h2>Every collection is a guided argument through objects.</h2>
			</div>

			{#if isLoading && !hasCachedData}
				<div class="collection-grid">{#each Array(4) as _, i (i)}<div class="skeleton-card tall"></div>{/each}</div>
			{:else if collections.length > 0}
				<div class="collection-grid">
					{#each collections.slice(0, 4) as collection (collection.id)}
						<CollectionCard {collection} />
					{/each}
				</div>
			{:else}
				<div class="empty">No collections available yet.</div>
			{/if}
		</div>
	</section>

	<section class="workflow-section">
		<div class="shell workflow-card">
			<div>
				<p class="eyebrow inverse"><span></span> Editorial infrastructure</p>
				<h2>From proposal to preserved edition.</h2>
				<p>
					A beautiful 3D archive still needs boring infrastructure: review states, metadata,
					versioning, documentation, and long-term access. PURE3D makes those parts visible without making them heavy.
				</p>
			</div>
			<ol>
				{#each workflow as item, i}
					<li><span>{String(i + 1).padStart(2, '0')}</span>{item}</li>
				{/each}
			</ol>
		</div>
	</section>

	<section class="final-cta">
		<div class="shell cta-panel">
			<p class="eyebrow"><span></span> Dynamic3D ready</p>
			<h2>Let objects carry uncertainty, hypotheses, and time.</h2>
			<p>
				The next version of 3D scholarship should not flatten complexity. It should let readers move through it.
			</p>
			<div class="hero-actions center">
				<a class="button primary" href="{base}/documentation">Read documentation</a>
				<a class="button ghost" href="{base}/collections">View collections</a>
			</div>
		</div>
	</section>
</div>

<style>
	.p3d-landing {
		--paper: #f4f1eb;
		--paper-2: #ebe4d6;
		--ink: #11110f;
		--muted: #676154;
		--rule: rgba(17, 17, 15, 0.12);
		--red: oklch(62% 0.19 35);
		--blue: #73d5ff;
		--green: #b7ffcf;
		background:
			radial-gradient(circle at 50% -20%, rgba(255, 97, 54, 0.16), transparent 36rem),
			linear-gradient(180deg, #f8f4eb 0%, var(--paper) 42%, #e8dfce 100%);
		color: var(--ink);
		font-family: var(--font-sans);
		overflow: clip;
	}
	.p3d-landing :global(a),
	.p3d-landing button { -webkit-tap-highlight-color: transparent; }
	.shell { width: min(1180px, calc(100% - 40px)); margin: 0 auto; }
	.eyebrow { display: flex; align-items: center; gap: 0.7rem; margin: 0 0 1.2rem; color: var(--muted); font-family: var(--font-mono); font-size: 0.72rem; letter-spacing: 0.12em; text-transform: uppercase; }
	.eyebrow span { width: 0.48rem; height: 0.48rem; border-radius: 999px; background: var(--red); box-shadow: 0 0 24px rgba(239, 83, 45, 0.8); }
	.eyebrow.inverse { color: rgba(244, 241, 235, 0.64); }

	.hero { min-height: 92svh; position: relative; display: grid; place-items: center; padding: 7rem 0 5rem; isolation: isolate; }
	.hero::before { content: ''; position: absolute; inset: 0; background-image: linear-gradient(rgba(17,17,15,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(17,17,15,.055) 1px, transparent 1px); background-size: 72px 72px; mask-image: radial-gradient(circle at 65% 40%, #000, transparent 72%); z-index: -2; }
	.ambient { position: absolute; border-radius: 999px; filter: blur(60px); opacity: .75; z-index: -1; transform: translate(calc(var(--mx) * 60px), calc(var(--my) * 60px)); }
	.ambient-a { width: 42vw; height: 42vw; right: -12vw; top: 12vh; background: rgba(115, 213, 255, 0.28); }
	.ambient-b { width: 32vw; height: 32vw; left: -10vw; bottom: 4vh; background: rgba(255, 83, 45, 0.26); }
	.hero-shell { display: grid; grid-template-columns: minmax(0, 0.96fr) minmax(360px, 1.04fr); gap: clamp(2rem, 6vw, 6rem); align-items: center; }
	.hero h1 { max-width: 11ch; margin: 0; font-size: clamp(4rem, 10vw, 9.6rem); line-height: .82; letter-spacing: -0.075em; font-weight: 600; text-wrap: balance; }
	.lede { max-width: 42rem; margin: 2rem 0 0; color: #38342d; font-family: var(--font-serif); font-size: clamp(1.2rem, 2vw, 1.75rem); line-height: 1.35; }
	.hero-actions { display: flex; flex-wrap: wrap; gap: .8rem; margin-top: 2rem; }
	.hero-actions.center { justify-content: center; }
	.button { display: inline-flex; align-items: center; justify-content: center; gap: .65rem; min-height: 3.1rem; padding: 0 1.2rem; border: 1px solid var(--rule); border-radius: 999px; color: var(--ink); text-decoration: none; font-weight: 600; transition: transform .18s ease, background .18s ease, border-color .18s ease; }
	.button:hover { transform: translateY(-2px); border-color: rgba(17,17,15,.3); }
	.button.primary { background: var(--ink); color: var(--paper); border-color: var(--ink); box-shadow: 0 18px 50px rgba(17,17,15,.22); }
	.button.ghost { background: rgba(255,255,255,.28); backdrop-filter: blur(18px); }

	.object-stage { min-height: 620px; position: relative; display: grid; place-items: center; perspective: 1100px; transform-style: preserve-3d; }
	.object-stage::before { content: ''; position: absolute; width: min(44vw, 560px); aspect-ratio: 1; border-radius: 999px; background: radial-gradient(circle, rgba(255,255,255,.72), rgba(255,255,255,.08) 42%, transparent 68%); transform: translate3d(calc(var(--mx) * -28px), calc(var(--my) * -28px), -80px); }
	.model-core { width: min(34vw, 420px); aspect-ratio: 1; position: relative; transform-style: preserve-3d; transform: rotateX(calc(var(--my) * -22deg + 58deg)) rotateZ(calc(var(--mx) * 22deg - 30deg)); transition: transform .2s ease-out; }
	.facet { position: absolute; inset: 16%; border: 1px solid rgba(255,255,255,.42); background: linear-gradient(135deg, rgba(255,255,255,.75), rgba(115,213,255,.28), rgba(255,84,45,.26)); box-shadow: inset 0 0 50px rgba(255,255,255,.42), 0 28px 90px rgba(17,17,15,.24); clip-path: polygon(50% 0, 100% 32%, 84% 100%, 16% 100%, 0 32%); }
	.f1 { transform: translateZ(74px); }
	.f2 { transform: rotateY(72deg) translateZ(74px); opacity: .74; }
	.f3 { transform: rotateY(-72deg) translateZ(74px); opacity: .7; }
	.f4 { transform: rotateX(72deg) translateZ(74px); opacity: .58; }
	.orbit { position: absolute; width: min(42vw, 540px); aspect-ratio: 1; border: 1px solid rgba(17,17,15,.18); border-radius: 50%; transform: rotateX(72deg) rotateZ(calc(var(--mx) * 18deg)); }
	.orbit-two { width: min(32vw, 420px); transform: rotateX(62deg) rotateY(38deg) rotateZ(calc(var(--my) * -24deg)); border-color: rgba(239,83,45,.3); }
	.hotspot, .point { position: absolute; border-radius: 50%; background: var(--red); box-shadow: 0 0 0 8px rgba(239,83,45,.12), 0 0 22px rgba(239,83,45,.72); }
	.hotspot { width: 12px; height: 12px; transform: translateZ(116px); animation: pulse 2.2s ease-in-out infinite; }
	.h1 { top: 25%; left: 52%; } .h2 { top: 62%; left: 28%; animation-delay: .5s; } .h3 { top: 52%; right: 18%; animation-delay: 1s; }
	.point { width: 4px; height: 4px; left: calc(var(--x) * 1%); top: calc(var(--y) * 1%); opacity: .44; background: #111; transform: translate(calc(var(--mx) * 30px), calc(var(--my) * 30px)); animation: float 5s ease-in-out infinite; animation-delay: calc(var(--i) * -0.14s); }
	.stage-ui { position: absolute; z-index: 2; display: grid; gap: .18rem; padding: .75rem .9rem; border: 1px solid rgba(17,17,15,.13); border-radius: 18px; background: rgba(248,244,235,.6); backdrop-filter: blur(20px); box-shadow: 0 14px 50px rgba(17,17,15,.08); transform: translate(calc(var(--mx) * -18px), calc(var(--my) * -18px)); }
	.stage-ui span { color: var(--muted); font-family: var(--font-mono); font-size: .66rem; text-transform: uppercase; letter-spacing: .1em; }
	.stage-ui strong { font-size: .92rem; } .stage-ui.top { top: 7%; left: 16%; } .stage-ui.right { right: 3%; top: 39%; } .stage-ui.bottom { bottom: 11%; left: 7%; }

	.metrics { border-block: 1px solid var(--rule); background: rgba(255,255,255,.25); backdrop-filter: blur(18px); }
	.metric-grid { display: grid; grid-template-columns: repeat(4, 1fr); }
	.metric-grid div { padding: 1.6rem 1.2rem; border-right: 1px solid var(--rule); }
	.metric-grid div:last-child { border-right: 0; }
	.metric-grid span { display: block; font-size: clamp(2rem, 4vw, 4rem); line-height: .9; letter-spacing: -.05em; font-weight: 600; }
	.metric-grid p { margin: .5rem 0 0; color: var(--muted); font-family: var(--font-mono); font-size: .74rem; text-transform: uppercase; letter-spacing: .08em; }

	.story, .editions-section, .collections-section, .workflow-section, .final-cta { padding: clamp(5rem, 9vw, 8rem) 0; }
	.story-grid { display: grid; grid-template-columns: .82fr 1.18fr; gap: clamp(2rem, 7vw, 7rem); align-items: start; }
	.sticky-panel { position: sticky; top: 6rem; }
	.sticky-panel h2, .section-head h2, .workflow-card h2, .cta-panel h2 { margin: 0; font-size: clamp(2.4rem, 6vw, 6rem); line-height: .9; letter-spacing: -.06em; text-wrap: balance; }
	.sticky-panel p:not(.eyebrow), .workflow-card p, .cta-panel p { color: #474238; font-family: var(--font-serif); font-size: 1.2rem; line-height: 1.55; }
	.story-steps { display: grid; gap: 1rem; }
	.story-steps article { min-height: 56vh; display: flex; flex-direction: column; justify-content: end; padding: clamp(1.4rem, 4vw, 3rem); border: 1px solid var(--rule); border-radius: 34px; background: linear-gradient(145deg, rgba(255,255,255,.62), rgba(255,255,255,.14)); box-shadow: 0 24px 90px rgba(17,17,15,.08); }
	.story-steps span { color: var(--red); font-family: var(--font-mono); font-size: .75rem; text-transform: uppercase; letter-spacing: .1em; }
	.story-steps h3 { margin: 1rem 0; font-size: clamp(2rem, 5vw, 4.8rem); line-height: .9; letter-spacing: -.055em; }
	.story-steps p { max-width: 38rem; margin: 0; color: var(--muted); font-family: var(--font-serif); font-size: 1.24rem; line-height: 1.45; }

	.section-head { display: flex; align-items: end; justify-content: space-between; gap: 2rem; margin-bottom: 2rem; }
	.section-head.narrow { display: block; max-width: 760px; }
	.carousel-controls { display: flex; gap: .5rem; }
	.carousel-controls button { width: 3rem; height: 3rem; border: 1px solid var(--rule); border-radius: 50%; background: rgba(255,255,255,.42); cursor: pointer; font-size: 1.2rem; }
	.filter-bar { display: flex; gap: .55rem; overflow-x: auto; padding-bottom: 1rem; margin-bottom: 1rem; scrollbar-width: none; }
	.filter-bar button { flex: 0 0 auto; padding: .7rem 1rem; border: 1px solid var(--rule); border-radius: 999px; background: transparent; color: var(--muted); cursor: pointer; font-weight: 600; }
	.filter-bar button.active { background: var(--ink); border-color: var(--ink); color: var(--paper); }
	.edition-rail { display: flex; gap: 1rem; overflow-x: auto; padding: .5rem 0 1.4rem; scroll-snap-type: x mandatory; scrollbar-width: none; }
	.edition-rail::-webkit-scrollbar, .filter-bar::-webkit-scrollbar { display: none; }
	.edition-wrap { flex: 0 0 18rem; scroll-snap-align: start; transition: transform .18s ease; }
	.edition-wrap:hover { transform: translateY(-6px) rotate(-.5deg); }
	.text-link { display: inline-flex; margin-top: 1rem; color: var(--ink); font-weight: 700; text-decoration-thickness: 1px; text-underline-offset: 5px; }
	.collection-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1rem; margin-top: 2rem; }
	.skeleton-card, .empty { min-height: 22rem; border-radius: 28px; border: 1px solid var(--rule); background: linear-gradient(90deg, rgba(255,255,255,.26), rgba(255,255,255,.62), rgba(255,255,255,.26)); animation: shimmer 1.8s infinite linear; }
	.skeleton-card.tall { min-height: 27rem; }
	.empty { display: grid; place-items: center; color: var(--muted); font-family: var(--font-serif); animation: none; }

	.workflow-section { background: #11110f; color: var(--paper); position: relative; }
	.workflow-section::before { content: ''; position: absolute; inset: 0; background-image: linear-gradient(rgba(244,241,235,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(244,241,235,.055) 1px, transparent 1px); background-size: 74px 74px; mask-image: radial-gradient(circle at center, #000, transparent 78%); }
	.workflow-card { position: relative; display: grid; grid-template-columns: .9fr 1.1fr; gap: clamp(2rem, 7vw, 7rem); align-items: center; }
	.workflow-card h2 { color: var(--paper); }
	.workflow-card p { color: rgba(244,241,235,.72); }
	.workflow-card ol { list-style: none; margin: 0; padding: 0; display: grid; gap: .75rem; counter-reset: step; }
	.workflow-card li { display: flex; align-items: center; gap: 1rem; padding: 1rem; border: 1px solid rgba(244,241,235,.14); border-radius: 18px; background: rgba(244,241,235,.055); color: var(--paper); font-weight: 600; }
	.workflow-card li span { display: grid; place-items: center; width: 2.2rem; height: 2.2rem; border-radius: 50%; background: var(--red); color: white; font-family: var(--font-mono); font-size: .72rem; }

	.final-cta { text-align: center; }
	.cta-panel { padding: clamp(2rem, 7vw, 6rem); border: 1px solid var(--rule); border-radius: 42px; background: radial-gradient(circle at 50% 0, rgba(255,83,45,.18), transparent 44%), rgba(255,255,255,.34); box-shadow: 0 30px 110px rgba(17,17,15,.1); }
	.cta-panel .eyebrow { justify-content: center; }
	.cta-panel p { max-width: 42rem; margin-inline: auto; }

	@keyframes pulse { 50% { transform: translateZ(116px) scale(1.4); opacity: .62; } }
	@keyframes float { 50% { translate: 0 -12px; opacity: .88; } }
	@keyframes shimmer { from { background-position: -300px 0; } to { background-position: 300px 0; } }

	@media (max-width: 980px) {
		.hero-shell, .story-grid, .workflow-card { grid-template-columns: 1fr; }
		.object-stage { min-height: 520px; order: -1; }
		.hero h1 { max-width: 9ch; }
		.metric-grid, .collection-grid { grid-template-columns: repeat(2, 1fr); }
		.sticky-panel { position: static; }
		.story-steps article { min-height: 360px; }
	}
	@media (max-width: 620px) {
		.shell { width: min(100% - 28px, 1180px); }
		.hero { min-height: auto; padding-top: 4.5rem; }
		.object-stage { min-height: 390px; }
		.model-core { width: 280px; }
		.orbit { width: 330px; }
		.stage-ui { display: none; }
		.metric-grid, .collection-grid { grid-template-columns: 1fr; }
		.metric-grid div { border-right: 0; border-bottom: 1px solid var(--rule); }
		.section-head { align-items: start; flex-direction: column; }
	}
	@media (prefers-reduced-motion: reduce) {
		*, *::before, *::after { animation: none !important; scroll-behavior: auto !important; transition-duration: .01ms !important; }
		.model-core, .ambient, .stage-ui, .point { transform: none !important; }
	}
</style>
