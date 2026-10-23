<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	afterNavigate(() => window.location.replace(data.destination + window.location.hash));
</script>

<main id="legacy-page-redirect" class="mx-auto max-w-3xl px-6 py-20" aria-live="polite">
	<p>Opening the current page…</p>
	<noscript>Please enable JavaScript to follow this legacy link.</noscript>
</main>
