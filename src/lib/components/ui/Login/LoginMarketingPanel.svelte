<script lang="ts">
	import { get } from 'svelte/store';
	import { editionsStore, fetchEditions } from '$lib/stores/data.store';

	const FALLBACK_IMAGE = '/images/P3D-Slider.jpg';

	const slides = [
		{
			headline: 'Interactive 3D Editions',
			description:
				'Create rich, annotated 3D experiences for cultural heritage objects with full scholarly context.'
		},
		{
			headline: 'Peer-Reviewed Publishing',
			description:
				'Publish 3D digital editions with academic rigor through integrated peer review workflows.'
		},
		{
			headline: 'Collaborative Research',
			description:
				'Work together across institutions to annotate, discuss, and share 3D cultural heritage data.'
		}
	];

	let currentSlide = $state(0);
	let backgroundImages = $state<string[]>([FALLBACK_IMAGE, FALLBACK_IMAGE, FALLBACK_IMAGE]);

	function pickRandomImages(thumbnails: string[]): string[] {
		if (thumbnails.length === 0) return slides.map(() => FALLBACK_IMAGE);

		const shuffled = [...thumbnails].sort(() => Math.random() - 0.5);
		return slides.map((_, i) => shuffled[i % shuffled.length]);
	}

	$effect(() => {
		const cached = get(editionsStore);
		const thumbnails = cached.items.map((e) => e.thumbnail).filter(Boolean);
		backgroundImages = pickRandomImages(thumbnails);

		if (!cached.lastFetched) {
			fetchEditions().then(() => {
				const fresh = get(editionsStore);
				const freshThumbnails = fresh.items.map((e) => e.thumbnail).filter(Boolean);
				backgroundImages = pickRandomImages(freshThumbnails);
			});
		}
	});

	function goToSlide(index: number) {
		currentSlide = index;
	}

	$effect(() => {
		const interval = setInterval(() => {
			currentSlide = (currentSlide + 1) % slides.length;
		}, 5000);

		return () => clearInterval(interval);
	});
</script>

<div id="login-marketing-panel" class="relative flex h-full flex-col overflow-hidden">
	{#each backgroundImages as src, i (i)}
		<img
			{src}
			alt="Pure3D edition"
			class="absolute inset-0 h-full w-full object-cover transition-opacity duration-700"
			class:opacity-100={i === currentSlide}
			class:opacity-0={i !== currentSlide}
		/>
	{/each}

	<div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20"></div>

	<div class="relative z-10 p-8">
		<div class="flex items-center gap-3">
			<span class="text-2xl font-bold text-white">Pure3D</span>
		</div>
	</div>

	<div class="relative z-10 mt-auto p-8">
		{#each slides as slide, i (slide.headline)}
			<div
				class="transition-all duration-500"
				class:opacity-100={i === currentSlide}
				class:opacity-0={i !== currentSlide}
				class:absolute={i !== currentSlide}
				class:pointer-events-none={i !== currentSlide}
			>
				<h2 class="mb-2 text-3xl font-bold text-white">{slide.headline}</h2>
				<p class="max-w-sm text-base text-white/80">{slide.description}</p>
			</div>
		{/each}

		<div class="mt-6 flex gap-2">
			{#each slides as _, i (i)}
				<button
					type="button"
					onclick={() => goToSlide(i)}
					aria-label="Go to slide {i + 1}"
					class="h-2 rounded-full transition-all duration-300 {i === currentSlide
						? 'w-8 bg-white'
						: 'w-2 bg-white/50 hover:bg-white/70'}"
				></button>
			{/each}
		</div>
	</div>
</div>
