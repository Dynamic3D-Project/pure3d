<script lang="ts">
	import { base } from '$app/paths';
	let currentSlide = $state(0);

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
	<img
		src="{base}/images/P3D-Slider.jpg"
		alt="Pure3D cultural heritage visualization"
		class="absolute inset-0 h-full w-full object-cover"
	/>

	<div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20"></div>

	<div class="relative z-10 p-8">
		<div class="flex items-center gap-3">
			<span class="text-2xl font-bold text-white">Pure3D</span>
		</div>
	</div>

	<div class="relative z-10 mt-auto p-8">
		<div class="relative h-24">
			{#each slides as slide, i (slide.headline)}
				<div
					class="absolute inset-0 transition-opacity duration-500"
					class:opacity-100={i === currentSlide}
					class:opacity-0={i !== currentSlide}
					class:pointer-events-none={i !== currentSlide}
				>
					<h2 class="mb-2 text-3xl font-bold text-white">{slide.headline}</h2>
					<p class="max-w-sm text-base text-white/80">{slide.description}</p>
				</div>
			{/each}
		</div>

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
