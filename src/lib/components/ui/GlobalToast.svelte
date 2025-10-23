<script lang="ts">
	import { run } from 'svelte/legacy';

	import { Toaster } from 'svelte-french-toast';
	import { toastStore } from '$lib/stores/toast.store';

	// Subscribe to the toast store to trigger updates
	run(() => {
		$toastStore;
	});
</script>

<Toaster
	position="bottom-center"
	gutter={8}
	toastOptions={{
		style: 'background: hsl(var(--b3) / 0.9); color: hsl(var(--bc)); font-weight: 500;'
	}}
/>
