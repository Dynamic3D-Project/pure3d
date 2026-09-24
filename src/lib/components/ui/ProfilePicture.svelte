<script lang="ts">
	import { base } from '$app/paths';
	import ctwhomeProfile from '$lib/assets/images/ctwhome-profile.webp';
	interface Props {
		subtitle?: string;
	}

	let { subtitle = 'Product Designer & Research Software Engineer' }: Props = $props();
</script>

<!-- Profile picture -->
<a
	href="{base}/documentation/about"
	class="flex items-center gap-3 rounded-lg border border-base-200 p-2 decoration-transparent hover:decoration-primary"
>
	<img
		id="cover"
		width="40"
		height="40"
		class="my-2 mask mask-hexagon"
		src={ctwhomeProfile}
		alt="J. Gonzalez Ctwhome profile picture"
		aria-hidden="true"
	/>
	<div>
		<div class="font-bold">J. Gonzalez - Ctw</div>
		<div class="text-sm opacity-60">{subtitle}</div>
	</div>
</a>
