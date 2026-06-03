<script lang="ts">
	import { run } from 'svelte/legacy';

	import { page } from '$app/stores';

	const MEASUREMENT_ID = 'G-DHQ2TX1XM1';
	run(() => {
		if (typeof window !== 'undefined' && typeof window.gtag !== 'undefined') {
			window.gtag('config', MEASUREMENT_ID, {
				page_title: document.title,
				page_path: $page.url.pathname
			});
		}
	});
</script>

<svelte:head>
	<script async src={`https://www.googletagmanager.com/gtag/js?id=G-DHQ2TX1XM1`}>
	</script>
	<script>
		window.dataLayer = window.dataLayer || [];
		window.gtag = function gtag() {
			window.dataLayer.push(arguments);
		};

		window.gtag('js', new Date());
		window.gtag('config', 'G-DHQ2TX1XM1');
	</script>
</svelte:head>
