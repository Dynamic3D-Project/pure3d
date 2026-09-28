<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { base, resolve } from '$app/paths';
	import { page } from '$app/state';
	import ContentRenderer from '$lib/components/content/ContentRenderer.svelte';
	import EditionMetadata from '$lib/components/editions/EditionMetadata.svelte';
	import EditionStories from '$lib/components/voyager/EditionStories.svelte';
	import VoyagerViewer, {
		type VoyagerAPI,
		type VoyagerCapabilities
	} from '$lib/components/voyager/VoyagerViewer.svelte';
	import {
		createRuntimeScene,
		type LoadedEditionScene
	} from '$lib/components/voyager/edition-scene';
	import {
		filterAnnotations,
		localizedValue,
		normalizeEditionContent
	} from '$lib/components/voyager/edition-content';
	import { creditHref } from '$lib/utils/credits';
	import ChevronLeftIcon from '~icons/lucide/chevron-left';
	import ChevronRightIcon from '~icons/lucide/chevron-right';
	import MaximizeIcon from '~icons/lucide/maximize';
	import MinimizeIcon from '~icons/lucide/minimize';
	import MessageCircleIcon from '~icons/lucide/message-circle';
	import RotateCcwIcon from '~icons/lucide/rotate-ccw';
	import XIcon from '~icons/lucide/x';
	import {
		Demo2Unavailable,
		countScene,
		discoverRichestEdition,
		loadDemo2Scene,
		loadPublicEdition,
		type Demo2Edition,
		type Demo2Selection
	} from './demo2-edition';

	const RECORD_SECTIONS = [
		['about', 'About'],
		['metadata', 'Metadata'],
		['provenance', 'Provenance'],
		['cite', 'Cite']
	] as const;

	type Phase = 'discovering' | 'loading' | 'ready' | 'unavailable' | 'error';
	type Pane = 'guide' | 'annotations' | 'record';
	type Focus = 'annotation' | 'story' | 'tour' | null;
	type PulseHost = HTMLElement & {
		application?: {
			system?: {
				components?: {
					get?: (type: string) => { start?: () => void; stop?: () => void } | undefined;
				};
			};
		};
	};

	const requestedId = $derived(page.url.searchParams.get('edition')?.trim() ?? '');

	let phase = $state<Phase>('loading');
	let message = $state('');
	let attempt = $state(0);
	let edition = $state.raw<Demo2Edition | null>(null);
	let selection = $state.raw<Demo2Selection | null>(null);
	let loadedScene = $state.raw<LoadedEditionScene | null>(null);
	let sceneError = $state('');

	let api = $state.raw<VoyagerAPI | null>(null);
	let capabilities = $state<VoyagerCapabilities | null>(null);
	let loadedBytes = $state<number | null>(null);
	let language = $state('EN');
	let activeCategories = $state<string[]>([]);
	let selectedAnnotationId = $state<string | null>(null);
	let selectedStoryId = $state<string | null>(null);
	let activeTour = $state({ tourIndex: -1, stepIndex: -1 });
	let focus = $state<Focus>(null);
	let pane = $state<Pane>('guide');

	let stage = $state<HTMLElement>();
	let guidePane = $state<HTMLElement>();
	let recordPane = $state<HTMLElement>();
	let storiesSection = $state<HTMLElement>();
	let headerOffset = $state(77);
	let wide = $state(false);
	let reducedMotion = $state(false);
	let fullscreenSupported = $state(false);
	let isFullscreen = $state(false);
	let origin = $state('');
	let citeState = $state<'idle' | 'copied' | 'failed'>('idle');

	const scene = $derived(loadedScene?.scene ?? null);
	const counts = $derived(scene ? countScene(scene) : null);
	const runtimeOverride = $derived(
		loadedScene
			? [{ url: loadedScene.url, content: JSON.stringify(createRuntimeScene(loadedScene.source)) }]
			: undefined
	);
	const companionAssets = $derived(
		edition && Object.keys(edition.uploadedAssetMap).length
			? { baseDir: edition.voyagerRoot, byBasename: edition.uploadedAssetMap }
			: undefined
	);

	const annotationItems = $derived(
		scene ? normalizeEditionContent(scene.annotations, language, 'annotation') : []
	);
	const annotationCategories = $derived([...new Set(annotationItems.flatMap((item) => item.tags))]);
	const allCategoriesShown = $derived(
		annotationCategories.length > 0 &&
			annotationCategories.every((category) => activeCategories.includes(category))
	);
	const visibleAnnotations = $derived(filterAnnotations(annotationItems, activeCategories));
	const annotationArticles = $derived(
		new Map(scene?.annotations.map((item) => [item.id, item.articleId]) ?? [])
	);

	/** Leads are not part of the parsed scene, so read them from the scene document itself. */
	const annotationLeads = $derived.by(() => {
		const leads = new SvelteMap<string, string>();
		for (const model of list(record(loadedScene?.source).models)) {
			for (const annotation of list(record(model).annotations)) {
				const source = record(annotation);
				if (typeof source.id !== 'string' || leads.has(source.id)) continue;
				const lead = localizedValue(source, 'lead', 'leads', language);
				if (lead) leads.set(source.id, lead);
			}
		}
		return leads;
	});

	const sceneFacts = $derived.by(() => {
		const source = record(loadedScene?.source);
		const asset = record(source.asset);
		const scenes = list(source.scenes);
		const index = Number.isInteger(source.scene) ? Number(source.scene) : 0;
		return {
			generator: [text(asset.generator), text(asset.version)].filter(Boolean).join(' · '),
			copyright: text(asset.copyright),
			units: text(record(scenes[index] ?? scenes[0]).units),
			models: list(source.models).length
		};
	});

	const tour = $derived(scene?.tours[activeTour.tourIndex] ?? null);
	const tourStep = $derived(tour?.steps[activeTour.stepIndex] ?? null);
	const selectedAnnotation = $derived(
		annotationItems.find((item) => item.id === selectedAnnotationId) ?? null
	);
	const selectedStoryTitle = $derived.by(() => {
		const story = scene?.articles.find((item) => item.id === selectedStoryId);
		return story ? localizedValue(story, 'title', 'titles', language) : '';
	});
	const contextLabel = $derived.by(() => {
		if (focus === 'tour' && tour && tourStep)
			return `${localizedValue(tour, 'title', 'titles', language)} · step ${activeTour.stepIndex + 1} of ${tour.steps.length}: ${localizedValue(tourStep, 'title', 'titles', language)}`;
		if (focus === 'annotation' && selectedAnnotation)
			return `Annotation: ${selectedAnnotation.title}`;
		if (focus === 'story' && selectedStoryTitle) return `Story: ${selectedStoryTitle}`;
		return '';
	});

	const creators = $derived(edition?.credits.filter((credit) => credit.role === 'creator') ?? []);
	const primaryDoi = $derived(
		(edition?.doi[0] ?? '').replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
	);
	const doiUrl = $derived(
		primaryDoi ? `https://doi.org/${encodeURIComponent(primaryDoi).replace(/%2F/gi, '/')}` : ''
	);
	const editionPath = $derived(edition ? resolve('/editions/[slug]', { slug: edition.id }) : '');
	const canonicalUrl = $derived(origin && editionPath ? `${origin}${editionPath}` : '');
	const abstract = $derived(
		(edition?.abstract ?? '').replace(/\[\[view:[^\]|]+\|([^\]]+)\]\]/g, '$1')
	);
	const citation = $derived.by(() => {
		if (!edition) return '';
		const names = creators.map((credit) => credit.name).join(', ');
		const year = edition.created ? new Date(edition.created).getFullYear() : NaN;
		return [
			names ? `${names}.` : '',
			`${edition.title}.`,
			`Pure 3D, ed. ${String(edition.pubNum).padStart(2, '0')}${Number.isFinite(year) ? ` (${year})` : ''}.`,
			primaryDoi ? `doi:${primaryDoi}.` : '',
			canonicalUrl
		]
			.filter(Boolean)
			.join(' ');
	});
	const attribution = $derived(
		edition
			? [
					edition.rightsHolder || sceneFacts.copyright,
					edition.license || 'Licence not stated in the record'
				]
					.filter(Boolean)
					.join(' · ')
			: ''
	);

	function record(value: unknown): Record<string, unknown> {
		return value && typeof value === 'object' && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: {};
	}

	function list(value: unknown): unknown[] {
		return Array.isArray(value) ? value : [];
	}

	function text(value: unknown): string {
		return typeof value === 'string' ? value.trim() : '';
	}

	function formatDate(value: string): string {
		const date = new Date(value);
		return Number.isNaN(date.getTime())
			? ''
			: date.toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' });
	}

	function resetInteraction() {
		api = null;
		capabilities = null;
		loadedBytes = null;
		activeCategories = [];
		selectedAnnotationId = null;
		selectedStoryId = null;
		activeTour = { tourIndex: -1, stepIndex: -1 };
		focus = null;
		citeState = 'idle';
	}

	async function start(id: string, signal: AbortSignal) {
		resetInteraction();
		edition = null;
		loadedScene = null;
		selection = null;
		sceneError = '';
		message = '';
		try {
			let target = id;
			if (!target) {
				phase = 'discovering';
				const found = await discoverRichestEdition(signal);
				if (signal.aborted) return;
				if (!found) {
					phase = 'unavailable';
					message =
						'No published edition with annotations, stories or tours was found among the editions checked.';
					return;
				}
				target = found.id;
				selection = found.selection;
			}
			phase = 'loading';
			const next = await loadPublicEdition(target, signal);
			if (signal.aborted) return;
			edition = next;
			phase = 'ready';
			try {
				const loaded = await loadDemo2Scene(next, signal);
				if (signal.aborted) return;
				loadedScene = loaded;
				language = loaded.scene.defaultLanguage;
				activeCategories = loaded.scene.initialCategories;
			} catch (reason) {
				if (signal.aborted) return;
				sceneError = reason instanceof Error ? reason.message : 'The scene could not load.';
			}
		} catch (reason) {
			if (signal.aborted) return;
			phase = reason instanceof Demo2Unavailable ? 'unavailable' : 'error';
			message =
				reason instanceof Demo2Unavailable
					? reason.message
					: 'The edition could not be loaded. Check the connection and try again.';
		}
	}

	$effect(() => {
		const id = requestedId;
		void attempt;
		const controller = new AbortController();
		untrack(() => void start(id, controller.signal));
		return () => controller.abort();
	});

	function handleReady(next: VoyagerAPI) {
		api = next;
		capabilities = next.getCapabilities();
		next.setLanguage(language);
		next.setActiveTags(activeCategories);
		const step = tour?.steps[activeTour.stepIndex];
		if (tour && step) next.setTourStep(tour.sourceIndex, step.sourceIndex, false);
		else if (selectedAnnotationId) next.setActiveAnnotation(selectedAnnotationId);
	}

	/** Scrolls only the pane, never the document, so the model stays where it is. */
	async function revealInPane(target: HTMLElement | undefined, container: HTMLElement | undefined) {
		await tick();
		if (!target || !container) return;
		const offset = target.getBoundingClientRect().top - container.getBoundingClientRect().top - 12;
		container.scrollBy({ top: offset, behavior: reducedMotion ? 'auto' : 'smooth' });
	}

	function openStory(id: string | null) {
		selectedStoryId = id;
		if (!id) return;
		focus = 'story';
		pane = 'guide';
		void revealInPane(storiesSection, guidePane);
	}

	function handleViewerArticle(id: string | null) {
		if (id && id !== selectedStoryId) openStory(id);
	}

	function handleViewerTour(tourIndex: number, stepIndex: number) {
		if (tourIndex < 0) {
			if (activeTour.tourIndex >= 0) activeTour = { tourIndex: -1, stepIndex: -1 };
			if (focus === 'tour') focus = null;
			return;
		}
		const index = scene?.tours.findIndex((item) => item.sourceIndex === tourIndex) ?? -1;
		const step =
			scene?.tours[index]?.steps.findIndex((item) => item.sourceIndex === stepIndex) ?? -1;
		if (index < 0 || step < 0) return;
		if (activeTour.tourIndex === index && activeTour.stepIndex === step) return;
		activeTour = { tourIndex: index, stepIndex: step };
		focus = 'tour';
		const articleId = scene?.tours[index].steps[step].articleId;
		if (articleId) openStory(articleId);
	}

	function selectTourStep(tourIndex: number, stepIndex: number) {
		const target = scene?.tours[tourIndex];
		const step = target?.steps[stepIndex];
		if (!target || !step) return;
		activeTour = { tourIndex, stepIndex };
		focus = 'tour';
		selectedAnnotationId = null;
		activeCategories = step.categories;
		api?.setTourStep(target.sourceIndex, step.sourceIndex, !reducedMotion);
		api?.setActiveTags(step.categories);
		if (step.articleId) {
			selectedStoryId = step.articleId;
			void revealInPane(storiesSection, guidePane);
		}
	}

	function exitTour() {
		api?.stopTour();
		activeTour = { tourIndex: -1, stepIndex: -1 };
		if (focus === 'tour') focus = null;
	}

	function selectAnnotation(id: string) {
		if (activeTour.tourIndex >= 0) exitTour();
		selectedAnnotationId = id;
		focus = 'annotation';
		api?.setActiveAnnotation(id);
	}

	function setCategories(categories: string[]) {
		activeCategories = categories;
		api?.setActiveTags(categories);
	}

	function toggleCategory(category: string) {
		setCategories(
			activeCategories.includes(category)
				? activeCategories.filter((item) => item !== category)
				: [...activeCategories, category]
		);
	}

	function setLanguage(code: string) {
		language = code;
		api?.setLanguage(code);
	}

	function resetView() {
		exitTour();
		selectedAnnotationId = null;
		focus = null;
		api?.resetViewer();
	}

	async function toggleFullscreen() {
		try {
			if (document.fullscreenElement) await document.exitFullscreen();
			else await stage?.requestFullscreen();
		} catch {
			// The browser refused; the workspace layout keeps working without full screen.
		}
	}

	async function copyCitation() {
		try {
			await navigator.clipboard.writeText(citation);
			citeState = 'copied';
		} catch {
			citeState = 'failed';
		}
	}

	function showRecordSection(id: string) {
		void revealInPane(document.getElementById(`demo2-${id}`) ?? undefined, recordPane);
	}

	function copyDoi() {
		navigator.clipboard?.writeText(doiUrl).catch(() => {
			// The DOI stays visible in the record for manual copying.
		});
	}

	function paneShown(name: Pane): boolean {
		if (name === 'guide') return wide || pane === 'guide';
		if (name === 'annotations') return pane === 'annotations' || (wide && pane === 'guide');
		return pane === 'record';
	}

	onMount(() => {
		origin = window.location.origin;
		const header = document.getElementById('header');
		const measure = () => {
			if (header) headerOffset = Math.round(header.getBoundingClientRect().height);
		};
		measure();
		const resize = new ResizeObserver(measure);
		if (header) resize.observe(header);

		const wideQuery = window.matchMedia('(min-width: 1280px)');
		const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		const syncQueries = () => {
			wide = wideQuery.matches;
			reducedMotion = motionQuery.matches;
		};
		syncQueries();
		wideQuery.addEventListener('change', syncQueries);
		motionQuery.addEventListener('change', syncQueries);

		fullscreenSupported =
			document.fullscreenEnabled === true && typeof stage?.requestFullscreen === 'function';
		const syncFullscreen = () => (isFullscreen = !!stage && document.fullscreenElement === stage);
		document.addEventListener('fullscreenchange', syncFullscreen);

		return () => {
			resize.disconnect();
			wideQuery.removeEventListener('change', syncQueries);
			motionQuery.removeEventListener('change', syncQueries);
			document.removeEventListener('fullscreenchange', syncFullscreen);
		};
	});

	// Pause Voyager's render pulse while the model is scrolled out of view or the tab is hidden.
	$effect(() => {
		const element = stage;
		if (!element || !api) return;
		const viewer = element.querySelector<PulseHost>('voyager-explorer');
		const pulse = viewer?.application?.system?.components?.get?.('CPulse');
		if (!pulse || typeof pulse.start !== 'function' || typeof pulse.stop !== 'function') return;
		let visible = true;
		let paused = false;
		const sync = () => {
			const run = visible && document.visibilityState === 'visible';
			if (run && paused) {
				pulse.start?.();
				paused = false;
			} else if (!run && !paused) {
				pulse.stop?.();
				paused = true;
			}
		};
		const observer = new IntersectionObserver(([entry]) => {
			visible = entry.isIntersecting;
			sync();
		});
		observer.observe(element);
		document.addEventListener('visibilitychange', sync);
		return () => {
			observer.disconnect();
			document.removeEventListener('visibilitychange', sync);
		};
	});
</script>

<svelte:head>
	<title>{edition ? `${edition.title} · Edition workspace` : 'Edition workspace'} | Pure 3D</title>
	<meta name="robots" content="noindex" />
	{#if canonicalUrl}<link rel="canonical" href={canonicalUrl} />{/if}
</svelte:head>

<div id="demo2" style:--demo2-top={`${headerOffset}px`}>
	<div class="workspace" class:is-wide={wide}>
		<header class="head">
			<div class="head-main">
				<nav class="crumbs" aria-label="Breadcrumb">
					<ol>
						<li><a href={resolve('/editions')}>Editions</a></li>
						<li aria-current="page">Workspace prototype</li>
					</ol>
				</nav>
				<h1 title={edition?.title}>
					{#if edition}{edition.title}{:else if phase === 'discovering'}Finding a published edition…{:else if phase === 'loading'}Loading
						edition…{:else}Edition workspace{/if}
				</h1>
				{#if creators.length}
					<p class="byline">
						{#each creators as credit, index (credit)}
							{@const href = creditHref(credit, base)}
							{#if href}<a {href} rel={credit.userId ? undefined : 'external noopener noreferrer'}
									>{credit.name}</a
								>{:else}{credit.name}{/if}{index < creators.length - 1 ? ', ' : ''}
						{/each}
					</p>
				{/if}
			</div>
			{#if edition}
				<div class="head-side">
					<span class="flag">Prototype view of a published edition</span>
					<a class="head-link" href={resolve('/editions/[slug]', { slug: edition.id })}
						>Edition page <span aria-hidden="true">→</span></a
					>
				</div>
			{/if}
		</header>

		<section
			bind:this={stage}
			class="stage"
			class:is-fullscreen={isFullscreen}
			aria-label="3D model"
		>
			{#if phase === 'ready' && edition && loadedScene}
				{#key edition.id}
					<VoyagerViewer
						url={edition.voyagerRoot}
						document={edition.sceneFile}
						title={edition.title}
						direct
						voyagerVersion={edition.voyagerVersion}
						resourceRoot={edition.voyagerResourceRoot}
						uiMode="none"
						fetchOverrides={runtimeOverride}
						{companionAssets}
						externalContent
						height="100%"
						onReady={handleReady}
						onModelLoaded={(bytes) => (loadedBytes = bytes)}
						onAnnotationCategoriesChange={(categories) => {
							if (api) activeCategories = categories;
						}}
						onActiveArticleChange={handleViewerArticle}
						onTourChange={handleViewerTour}
					/>
				{/key}
			{:else}
				<div class="stage-state" role="status">
					{#if phase === 'discovering'}
						<p>Finding a published edition with annotations, stories and tours…</p>
					{:else if phase === 'loading' || (phase === 'ready' && !sceneError)}
						<p>Loading the edition’s scene…</p>
					{:else if phase === 'ready' && sceneError}
						<p>The 3D scene could not load: {sceneError}</p>
						<button type="button" class="action" onclick={() => (attempt += 1)}>Try again</button>
					{:else if phase === 'unavailable'}
						<p>{message}</p>
						<a class="action" href={resolve('/editions')}>Browse published editions</a>
					{:else}
						<p>{message}</p>
						<button type="button" class="action" onclick={() => (attempt += 1)}>Try again</button>
					{/if}
				</div>
			{/if}

			{#if contextLabel}
				<p class="stage-context" aria-hidden="true">{contextLabel}</p>
			{/if}
			<p class="sr-only" role="status" aria-live="polite">{contextLabel}</p>

			{#if api}
				<div class="stage-tools" role="toolbar" aria-label="Viewer controls">
					{#if scene && scene.languages.length > 1}
						<label class="stage-language">
							<span class="sr-only">Edition language</span>
							<select value={language} onchange={(event) => setLanguage(event.currentTarget.value)}>
								{#each scene.languages as code (code)}<option value={code}>{code}</option>{/each}
							</select>
						</label>
					{/if}
					{#if capabilities?.annotations && counts?.annotations}
						<button
							type="button"
							class="tool"
							onclick={() => api?.toggleAnnotations()}
							title="Show or hide annotation markers"
						>
							<MessageCircleIcon aria-hidden="true" /><span class="sr-only"
								>Show or hide annotation markers</span
							>
						</button>
					{/if}
					{#if capabilities?.reset}
						<button type="button" class="tool" onclick={resetView} title="Reset view">
							<RotateCcwIcon aria-hidden="true" /><span class="sr-only">Reset view</span>
						</button>
					{/if}
					{#if fullscreenSupported}
						<button
							type="button"
							class="tool"
							onclick={toggleFullscreen}
							aria-pressed={isFullscreen}
							title={isFullscreen ? 'Leave full screen' : 'Full screen'}
						>
							{#if isFullscreen}<MinimizeIcon aria-hidden="true" />{:else}<MaximizeIcon
									aria-hidden="true"
								/>{/if}<span class="sr-only">Full screen</span>
						</button>
					{/if}
				</div>
			{/if}

			{#if tour && tourStep}
				<div class="transport" role="group" aria-label="Tour navigation">
					<button
						type="button"
						class="tool"
						onclick={() => selectTourStep(activeTour.tourIndex, activeTour.stepIndex - 1)}
						disabled={activeTour.stepIndex <= 0}
					>
						<ChevronLeftIcon aria-hidden="true" /><span class="sr-only">Previous step</span>
					</button>
					<span class="transport-label">
						<span class="transport-count">{activeTour.stepIndex + 1}/{tour.steps.length}</span>
						<span class="transport-title"
							>{localizedValue(tourStep, 'title', 'titles', language)}</span
						>
					</span>
					<button
						type="button"
						class="tool"
						onclick={() => selectTourStep(activeTour.tourIndex, activeTour.stepIndex + 1)}
						disabled={activeTour.stepIndex >= tour.steps.length - 1}
					>
						<ChevronRightIcon aria-hidden="true" /><span class="sr-only">Next step</span>
					</button>
					<button type="button" class="tool" onclick={exitTour}>
						<XIcon aria-hidden="true" /><span class="sr-only">Exit tour</span>
					</button>
				</div>
			{/if}

			{#if attribution}
				<p class="stage-credit">{attribution}</p>
			{/if}
		</section>

		<div class="switch" role="group" aria-label="Workspace panels">
			<button
				type="button"
				class="switch-guide"
				aria-pressed={pane === 'guide' && !wide}
				aria-controls="demo2-guide"
				onclick={() => (pane = 'guide')}
			>
				Stories &amp; tours{#if counts}<span>{counts.articles + counts.tours}</span>{/if}
			</button>
			<button
				type="button"
				aria-pressed={pane === 'annotations' || (wide && pane === 'guide')}
				aria-controls="demo2-annotations"
				onclick={() => (pane = 'annotations')}
			>
				Annotations{#if counts}<span>{counts.annotations}</span>{/if}
			</button>
			<button
				type="button"
				aria-pressed={pane === 'record'}
				aria-controls="demo2-record"
				onclick={() => (pane = 'record')}
			>
				Record
			</button>
		</div>

		<section
			id="demo2-guide"
			bind:this={guidePane}
			class="pane pane-guide"
			hidden={!paneShown('guide')}
			aria-labelledby="demo2-guide-title"
		>
			<h2 id="demo2-guide-title" class="pane-title">Stories &amp; tours</h2>
			{#if !scene}
				<p class="muted">
					{phase === 'unavailable' || phase === 'error' || sceneError
						? 'Stories and tours appear once an edition scene has loaded.'
						: 'Loading…'}
				</p>
			{:else}
				{#if scene.tours.length}
					<section class="block" aria-labelledby="demo2-tours-title">
						<h3 id="demo2-tours-title">Guided tours</h3>
						<ol class="tours">
							{#each scene.tours as item, tourIndex (item.sourceIndex)}
								{@const open = activeTour.tourIndex === tourIndex}
								<li>
									<button
										type="button"
										class="tour-button"
										aria-expanded={open}
										onclick={() => (open ? exitTour() : selectTourStep(tourIndex, 0))}
									>
										<span>{localizedValue(item, 'title', 'titles', language)}</span>
										<span class="muted">{item.steps.length} steps</span>
									</button>
									{#if open}
										<ol class="steps">
											{#each item.steps as step, stepIndex (step.id)}
												<li>
													<button
														type="button"
														aria-current={activeTour.stepIndex === stepIndex ? 'step' : undefined}
														onclick={() => selectTourStep(tourIndex, stepIndex)}
													>
														<span class="step-number">{stepIndex + 1}</span>
														<span>{localizedValue(step, 'title', 'titles', language)}</span>
													</button>
												</li>
											{/each}
										</ol>
									{/if}
								</li>
							{/each}
						</ol>
					</section>
				{/if}
				<section bind:this={storiesSection} class="block" aria-labelledby="demo2-stories-title">
					<h3 id="demo2-stories-title">Stories</h3>
					{#if scene.articles.length && edition}
						<EditionStories
							articles={scene.articles}
							editionId={edition.id}
							{language}
							root={edition.voyagerRoot}
							activeArticleId={selectedStoryId}
							linkedArticleId={tourStep?.articleId ?? null}
							onArticle={openStory}
						/>
					{:else}
						<p class="muted">This edition has no stories.</p>
					{/if}
				</section>
			{/if}
		</section>

		<section
			id="demo2-annotations"
			class="pane pane-side"
			hidden={!paneShown('annotations')}
			aria-labelledby="demo2-annotations-title"
		>
			<h2 id="demo2-annotations-title" class="pane-title">
				Annotations{#if counts}<span class="muted"> · {counts.annotations}</span>{/if}
			</h2>
			{#if !scene}
				<p class="muted">
					{phase === 'unavailable' || phase === 'error' || sceneError
						? 'Annotations appear once an edition scene has loaded.'
						: 'Loading…'}
				</p>
			{:else if !annotationItems.length}
				<p class="muted">This edition has no annotations.</p>
			{:else}
				{#if annotationCategories.length}
					<div class="categories" role="group" aria-label="Annotation categories">
						{#each annotationCategories as category (category)}
							<button
								type="button"
								aria-pressed={activeCategories.includes(category)}
								onclick={() => toggleCategory(category)}>{category}</button
							>
						{/each}
						<button
							type="button"
							aria-pressed={allCategoriesShown}
							onclick={() => setCategories(allCategoriesShown ? [] : annotationCategories)}
							>All</button
						>
					</div>
				{/if}
				{#if !visibleAnnotations.length}
					<p class="muted">No category is selected. Choose one above to list its annotations.</p>
				{/if}
				<ol class="annotations">
					{#each visibleAnnotations as item, index (item.id)}
						{@const selected = selectedAnnotationId === item.id}
						{@const lead = annotationLeads.get(item.id)}
						{@const articleId = annotationArticles.get(item.id)}
						<li class:selected>
							<button
								type="button"
								aria-pressed={selected}
								onclick={() => selectAnnotation(item.id)}
							>
								<span class="annotation-number">{index + 1}</span>
								<span class="annotation-title">{item.title}</span>
							</button>
							{#if selected && (lead || articleId || item.tags.length)}
								<div class="annotation-detail">
									{#if lead}<p>{lead}</p>{/if}
									{#if item.tags.length}<p class="muted">{item.tags.join(' · ')}</p>{/if}
									{#if articleId}
										<button type="button" class="text-action" onclick={() => openStory(articleId)}
											>Read the linked story <span aria-hidden="true">→</span></button
										>
									{/if}
								</div>
							{/if}
						</li>
					{/each}
				</ol>
			{/if}
		</section>

		<section
			id="demo2-record"
			bind:this={recordPane}
			class="pane pane-side"
			hidden={!paneShown('record')}
			aria-labelledby="demo2-record-title"
		>
			<h2 id="demo2-record-title" class="pane-title">Edition record</h2>
			{#if !edition}
				<p class="muted">
					{phase === 'unavailable' || phase === 'error'
						? message
						: 'The record appears once the edition has loaded.'}
				</p>
			{:else}
				<nav class="toc" aria-label="Edition record sections">
					{#each RECORD_SECTIONS as [id, label] (id)}
						<button type="button" aria-controls="demo2-{id}" onclick={() => showRecordSection(id)}
							>{label}</button
						>
					{/each}
				</nav>

				<section id="demo2-about" class="block" aria-labelledby="demo2-about-title">
					<h3 id="demo2-about-title">About</h3>
					{#if abstract.trim()}
						<ContentRenderer className="prose prose-sm max-w-none" content={abstract} />
					{:else}
						<p class="muted">The record has no abstract.</p>
					{/if}
					<dl class="facts">
						{#if edition.collectionTitle}
							<div>
								<dt>Collection</dt>
								<dd>{edition.collectionTitle}</dd>
							</div>
						{/if}
						{#if edition.coveragePeriod}
							<div>
								<dt>Period</dt>
								<dd>{edition.coveragePeriod}</dd>
							</div>
						{/if}
						{#if edition.coveragePlace}
							<div>
								<dt>Place</dt>
								<dd>{edition.coveragePlace}</dd>
							</div>
						{/if}
						{#if edition.keywords.length}
							<div>
								<dt>Keywords</dt>
								<dd>{edition.keywords.join(', ')}</dd>
							</div>
						{/if}
						{#if edition.peerReviewKind}
							<div>
								<dt>Peer review</dt>
								<dd>{edition.peerReviewKind}</dd>
							</div>
						{/if}
					</dl>
				</section>

				<section id="demo2-metadata" class="block" aria-labelledby="demo2-metadata-title">
					<h3 id="demo2-metadata-title">Metadata</h3>
					<EditionMetadata
						edition={{
							id: edition.id,
							created: edition.created,
							pubNum: edition.pubNum,
							status: edition.status,
							credits: edition.credits,
							dcInstitution: edition.institutions,
							usageConditions: edition.license,
							alternativeVersion: null,
							modelSize: edition.modelSize,
							voyagerVersion: edition.voyagerVersion,
							settingsAuthorToolName: edition.authorToolName,
							settingsAuthorToolVersion: edition.authorToolVersion,
							sceneFile: edition.sceneFile
						}}
						loadedModelSize={loadedBytes}
						{primaryDoi}
						citationCopied={false}
						oncopydoi={copyDoi}
					/>
				</section>

				<section id="demo2-provenance" class="block" aria-labelledby="demo2-provenance-title">
					<h3 id="demo2-provenance-title">Provenance</h3>
					{#if edition.provenance}
						<p>{edition.provenance}</p>
					{:else}
						<p class="muted">The record has no provenance statement.</p>
					{/if}
					<dl class="facts">
						{#if edition.rightsHolder}
							<div>
								<dt>Rights holder</dt>
								<dd>{edition.rightsHolder}</dd>
							</div>
						{/if}
						{#if sceneFacts.copyright}
							<div>
								<dt>Scene copyright</dt>
								<dd>{sceneFacts.copyright}</dd>
							</div>
						{/if}
						{#if sceneFacts.generator}
							<div>
								<dt>Scene written by</dt>
								<dd>{sceneFacts.generator}</dd>
							</div>
						{/if}
						{#if sceneFacts.units}
							<div>
								<dt>Scene units</dt>
								<dd>{sceneFacts.units}</dd>
							</div>
						{/if}
						{#if counts}
							<div>
								<dt>Scene content</dt>
								<dd>
									{sceneFacts.models}
									{sceneFacts.models === 1 ? 'model' : 'models'}, {counts.annotations} annotations,
									{counts.articles} stories, {counts.tours}
									{counts.tours === 1 ? 'tour' : 'tours'} ({counts.steps} steps)
								</dd>
							</div>
						{/if}
						{#if edition.created}
							<div>
								<dt>Record created</dt>
								<dd>{formatDate(edition.created)}</dd>
							</div>
						{/if}
					</dl>
					{#if selection}
						<p class="small">
							This workspace opened the public edition with the most annotations, stories and tour
							steps among the {selection.checked} newest published records whose scenes it could read
							(at most {selection.limit} of the {selection.listed} listed). Add
							<code>?edition=</code> and an edition ID to the address to open another published edition.
						</p>
					{/if}
				</section>

				<section id="demo2-cite" class="block" aria-labelledby="demo2-cite-title">
					<h3 id="demo2-cite-title">Cite</h3>
					<p class="citation">{citation}</p>
					<div class="cite-actions">
						<button type="button" class="action" onclick={copyCitation}>Copy citation</button>
						<span class="muted" role="status"
							>{citeState === 'copied'
								? 'Copied.'
								: citeState === 'failed'
									? 'Copying is not available; select the text instead.'
									: ''}</span
						>
					</div>
					<dl class="facts">
						<div>
							<dt>Edition page</dt>
							<dd>
								<a href={resolve('/editions/[slug]', { slug: edition.id })}
									>{canonicalUrl || editionPath}</a
								>
							</dd>
						</div>
						{#if primaryDoi}
							<div>
								<dt>DOI</dt>
								<dd>
									<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
									<a href={doiUrl} rel="external noopener noreferrer">{primaryDoi}</a>
								</dd>
							</div>
						{/if}
						<div>
							<dt>Licence</dt>
							<dd>{edition.license || 'Not stated in the record'}</dd>
						</div>
					</dl>
				</section>
			{/if}
		</section>
	</div>
</div>

<style>
	#demo2 {
		--rule: color-mix(in srgb, var(--color-ink) 12%, transparent);
		--rule-strong: color-mix(in srgb, var(--color-ink) 24%, transparent);
		background: var(--color-paper);
		color: var(--color-ink);
		font-family: var(--font-sans);
	}
	#demo2 :is(a, button, select):focus-visible {
		outline: 2px solid var(--color-vermillion);
		outline-offset: 2px;
	}

	/* ---------- workspace grid ---------- */
	.workspace {
		display: grid;
		height: calc(100vh - var(--demo2-top));
		height: calc(100dvh - var(--demo2-top));
		min-height: 300px;
		grid-template-columns: minmax(0, 1fr) minmax(300px, 380px);
		grid-template-rows: auto auto minmax(0, 1fr);
		grid-template-areas:
			'head head'
			'stage switch'
			'stage side';
	}
	.workspace.is-wide {
		grid-template-columns: minmax(270px, 330px) minmax(0, 1fr) minmax(320px, 390px);
		grid-template-areas:
			'head head head'
			'guide stage switch'
			'guide stage side';
	}
	.head {
		grid-area: head;
	}
	.stage {
		grid-area: stage;
	}
	.switch {
		grid-area: switch;
	}
	.pane {
		grid-area: side;
	}
	.is-wide .pane-guide {
		grid-area: guide;
		border-right: 1px solid var(--rule-strong);
		border-left: 0;
	}
	.is-wide .switch-guide {
		display: none;
	}

	/* ---------- head ---------- */
	.head {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 8px 24px;
		padding: 12px clamp(12px, 2.4vw, 28px) 10px;
		border-bottom: 1px solid var(--color-ink);
	}
	.head-main {
		min-width: 0;
	}
	.crumbs ol {
		display: flex;
		gap: 8px;
		margin: 0 0 4px;
		padding: 0;
		list-style: none;
		font: 500 11px/1.4 var(--font-mono);
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
		text-underline-offset: 3px;
	}
	h1 {
		margin: 0;
		overflow: hidden;
		font: 400 clamp(22px, 2.4vw, 34px) / 1.08 var(--font-serif);
		letter-spacing: -0.015em;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.byline {
		margin: 4px 0 0;
		overflow: hidden;
		font-size: 14px;
		color: var(--color-ink-3);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.byline a {
		color: inherit;
		text-underline-offset: 3px;
	}
	.head-side {
		display: flex;
		flex: none;
		align-items: center;
		gap: 12px;
	}
	.flag {
		padding: 5px 9px;
		border: 1px solid var(--color-vermillion);
		border-radius: var(--radius-round);
		background: var(--color-vermillion-wash);
		color: var(--color-vermillion-ink);
		font: 500 10.5px/1 var(--font-mono);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.head-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 40px;
		font-size: 14px;
		font-weight: 500;
		color: var(--color-ink-2);
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 5px;
	}
	.head-link:hover {
		text-decoration-color: var(--color-vermillion);
	}

	/* ---------- stage ---------- */
	.stage {
		position: relative;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
		background: radial-gradient(ellipse at center, #35424f 0%, #03070b 100%);
		color: #f4f1ea;
	}
	.stage :global(#voyager-viewer),
	.stage :global(.voyager-container) {
		height: 100%;
	}
	.stage :global(#voyager-viewer .rounded-lg) {
		border-radius: 0;
	}
	.stage.is-fullscreen {
		width: 100vw;
		height: 100vh;
	}
	.stage-state {
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 12px;
		height: 100%;
		padding: 24px;
		text-align: center;
	}
	.stage-state p {
		max-width: 40ch;
		margin: 0;
		font-size: 15px;
		line-height: 1.5;
	}
	.stage-context,
	.stage-credit,
	.stage-tools,
	.transport {
		position: absolute;
		z-index: 20;
	}
	.stage-context {
		top: 12px;
		left: 12px;
		max-width: min(62%, 48ch);
		margin: 0;
		padding: 7px 11px;
		border-radius: var(--radius-control);
		background: rgb(8 11 15 / 0.66);
		font-size: 13px;
		line-height: 1.35;
		-webkit-backdrop-filter: blur(8px);
		backdrop-filter: blur(8px);
	}
	.stage-credit {
		bottom: 8px;
		left: 12px;
		max-width: calc(100% - 24px);
		margin: 0;
		overflow: hidden;
		font: 400 11px/1.4 var(--font-mono);
		color: rgb(244 241 234 / 0.78);
		text-overflow: ellipsis;
		text-shadow: 0 1px 2px rgb(0 0 0 / 0.6);
		white-space: nowrap;
		pointer-events: none;
	}
	.stage-tools {
		top: 12px;
		right: 12px;
		display: flex;
		gap: 6px;
	}
	.tool {
		display: inline-grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border: 1px solid rgb(244 241 234 / 0.22);
		border-radius: var(--radius-control);
		background: rgb(8 11 15 / 0.66);
		color: inherit;
		cursor: pointer;
		-webkit-backdrop-filter: blur(8px);
		backdrop-filter: blur(8px);
	}
	.tool :global(svg) {
		width: 18px;
		height: 18px;
	}
	.tool:hover:not(:disabled) {
		border-color: rgb(244 241 234 / 0.6);
	}
	.tool:disabled {
		cursor: default;
		opacity: 0.4;
	}
	.tool[aria-pressed='true'] {
		border-color: var(--color-vermillion);
	}
	.stage-language select {
		height: 44px;
		padding: 0 10px;
		border: 1px solid rgb(244 241 234 / 0.22);
		border-radius: var(--radius-control);
		background: rgb(8 11 15 / 0.66);
		color: inherit;
		font: 500 12px/1 var(--font-mono);
	}
	.transport {
		bottom: 30px;
		left: 50%;
		display: flex;
		align-items: center;
		gap: 6px;
		width: max-content;
		max-width: calc(100% - 24px);
		transform: translateX(-50%);
	}
	.transport-label {
		display: flex;
		min-width: 0;
		align-items: center;
		gap: 8px;
		height: 44px;
		padding: 0 12px;
		border-radius: var(--radius-control);
		background: rgb(8 11 15 / 0.66);
		font-size: 13px;
		-webkit-backdrop-filter: blur(8px);
		backdrop-filter: blur(8px);
	}
	.transport-count {
		flex: none;
		font: 500 12px/1 var(--font-mono);
		color: #f3b49a;
	}
	.transport-title {
		overflow: hidden;
		max-width: 34ch;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.action {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		padding: 10px 16px;
		border: 1px solid var(--rule-strong);
		border-radius: var(--radius-control);
		background: transparent;
		color: inherit;
		font: 500 14px/1.2 var(--font-sans);
		cursor: pointer;
	}
	.stage-state .action {
		border-color: rgb(244 241 234 / 0.4);
	}

	/* ---------- panel switch ---------- */
	.switch {
		display: flex;
		border-bottom: 1px solid var(--rule-strong);
		border-left: 1px solid var(--rule-strong);
		background: var(--color-paper);
	}
	.switch button {
		display: inline-flex;
		flex: 1 1 0;
		align-items: center;
		justify-content: center;
		gap: 6px;
		min-height: 44px;
		padding: 0 8px;
		border-bottom: 2px solid transparent;
		font-size: 13.5px;
		font-weight: 500;
		color: var(--color-ink-3);
		cursor: pointer;
	}
	.switch button[aria-pressed='true'] {
		border-bottom-color: var(--color-vermillion);
		color: var(--color-ink);
	}
	.switch button span {
		font: 500 11px/1 var(--font-mono);
		color: var(--color-ink-3);
	}

	/* ---------- panes ---------- */
	.pane {
		position: relative;
		min-width: 0;
		min-height: 0;
		overflow-y: auto;
		padding: 16px clamp(14px, 1.6vw, 22px) 32px;
		border-left: 1px solid var(--rule-strong);
		background: var(--color-paper);
	}
	.pane[hidden] {
		display: none;
	}
	.pane:focus {
		outline: none;
	}
	.pane-title {
		margin: 0 0 14px;
		font: 500 11px/1.4 var(--font-mono);
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-ink-3);
	}
	.block {
		display: grid;
		gap: 10px;
		padding: 14px 0 20px;
		border-top: 1px solid var(--color-ink);
		scroll-margin-top: 8px;
	}
	.block h3 {
		margin: 0;
		font: 400 21px/1.15 var(--font-serif);
		letter-spacing: -0.01em;
	}
	.block p {
		margin: 0;
		font-size: 14.5px;
		line-height: 1.6;
		color: var(--color-ink-2);
		overflow-wrap: anywhere;
	}
	.muted {
		color: var(--color-ink-3);
		font-size: 13.5px;
	}
	.block p.small {
		font-size: 13px;
		color: var(--color-ink-3);
	}
	code {
		font-family: var(--font-mono);
		font-size: 0.92em;
	}

	.tours,
	.steps,
	.annotations {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.tour-button {
		display: flex;
		width: 100%;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
		min-height: 44px;
		padding: 8px 0;
		border-bottom: 1px solid var(--rule);
		font-size: 15px;
		font-weight: 500;
		text-align: left;
		cursor: pointer;
	}
	.tour-button[aria-expanded='true'] {
		color: var(--color-vermillion-ink);
	}
	.tour-button .muted {
		flex: none;
		font: 400 11px/1 var(--font-mono);
	}
	.steps {
		padding: 4px 0 8px;
	}
	.steps button {
		display: grid;
		grid-template-columns: 2rem minmax(0, 1fr);
		width: 100%;
		align-items: baseline;
		gap: 8px;
		min-height: 40px;
		padding: 7px 8px 7px 0;
		border-left: 2px solid transparent;
		font-size: 14px;
		text-align: left;
		color: var(--color-ink-2);
		cursor: pointer;
	}
	.steps button[aria-current='step'] {
		border-left-color: var(--color-vermillion);
		background: var(--color-vermillion-wash);
		color: var(--color-ink);
	}
	.step-number,
	.annotation-number {
		font: 500 12px/1.4 var(--font-mono);
		text-align: right;
		color: var(--color-vermillion-ink);
	}

	.categories {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 12px;
	}
	.categories button {
		min-height: 36px;
		padding: 6px 11px;
		border: 1px solid var(--rule-strong);
		border-radius: var(--radius-round);
		font-size: 13px;
		cursor: pointer;
	}
	.categories button[aria-pressed='true'] {
		border-color: var(--color-ink);
		background: var(--color-ink);
		color: var(--color-paper);
	}
	.annotations {
		border-top: 1px solid var(--rule);
	}
	.annotations li {
		border-bottom: 1px solid var(--rule);
	}
	.annotations li.selected {
		background: var(--color-paper-2);
	}
	.annotations li > button {
		display: grid;
		grid-template-columns: 2rem minmax(0, 1fr);
		width: 100%;
		align-items: baseline;
		gap: 8px;
		min-height: 44px;
		padding: 10px 8px 10px 0;
		font-size: 14.5px;
		text-align: left;
		cursor: pointer;
	}
	.annotations li > button[aria-pressed='true'] .annotation-title {
		font-weight: 600;
	}
	.annotation-title {
		overflow-wrap: anywhere;
	}
	.annotation-detail {
		display: grid;
		gap: 8px;
		padding: 0 12px 14px 2.5rem;
	}
	.annotation-detail p {
		margin: 0;
		font-size: 14px;
		line-height: 1.55;
		color: var(--color-ink-2);
	}
	.text-action {
		justify-self: start;
		min-height: 36px;
		font-size: 13.5px;
		font-weight: 500;
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 4px;
		cursor: pointer;
	}

	.toc {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 14px;
		margin-bottom: 14px;
	}
	.toc button {
		display: inline-flex;
		align-items: center;
		min-height: 36px;
		font-size: 13.5px;
		color: var(--color-ink-2);
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 4px;
		cursor: pointer;
	}
	.facts {
		display: grid;
		margin: 0;
	}
	.facts div {
		display: grid;
		grid-template-columns: minmax(6.5rem, 0.4fr) minmax(0, 1fr);
		gap: 10px;
		padding: 7px 0;
		border-bottom: 1px solid var(--rule);
	}
	.facts dt {
		font: 500 10.5px/1.6 var(--font-mono);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-ink-3);
	}
	.facts dd {
		margin: 0;
		min-width: 0;
		font-size: 14px;
		line-height: 1.5;
		overflow-wrap: anywhere;
	}
	.facts a {
		color: inherit;
		text-underline-offset: 3px;
	}
	.block p.citation {
		padding: 12px 14px;
		border-left: 3px solid var(--color-forest);
		background: var(--color-paper-2);
		font: 400 14.5px/1.55 var(--font-serif);
	}
	.cite-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	/* ---------- narrow portrait: model on top, content sheet below ---------- */
	@media (max-width: 899px) and (orientation: portrait), (max-width: 599px) {
		.workspace,
		.workspace.is-wide {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: auto minmax(180px, 44%) auto minmax(0, 1fr);
			grid-template-areas:
				'head'
				'stage'
				'switch'
				'side';
		}
		.head {
			padding-top: 8px;
			padding-bottom: 8px;
		}
		.head-side .flag,
		.byline {
			display: none;
		}
		h1 {
			font-size: 20px;
		}
		.switch,
		.pane {
			border-left: 0;
		}
		.pane {
			border-top: 0;
		}
		.transport {
			bottom: 26px;
		}
		.transport-title {
			max-width: 16ch;
		}
		.stage-context {
			max-width: calc(100% - 24px - 150px);
			font-size: 12px;
		}
	}

	/* ---------- short landscape: keep every control within the viewport ---------- */
	@media (max-height: 560px) and (orientation: landscape) {
		.head {
			padding-top: 4px;
			padding-bottom: 4px;
		}
		.crumbs,
		.byline,
		.head-side .flag {
			display: none;
		}
		h1 {
			font-size: 18px;
		}
		.head-link {
			min-height: 36px;
		}
		.pane {
			padding-top: 10px;
		}
		.stage-context {
			display: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		#demo2 * {
			scroll-behavior: auto !important;
			transition: none !important;
		}
	}
</style>
