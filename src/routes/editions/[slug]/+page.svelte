<script lang="ts">
	import EditionView from '$lib/components/editions/EditionView.svelte';
	import type { EditionViewData } from '$lib/components/editions/edition-view';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	let viewData = $state<EditionViewData>({ ...data, siblingEditions: [] });

	$effect(() => {
		const current = data;
		viewData = { ...current, siblingEditions: [] };
		Promise.resolve(current.siblingEditions).then((siblingEditions) => {
			if (data === current) viewData = { ...current, siblingEditions };
		});
	});
</script>

<div id="page"><EditionView data={viewData} /></div>
