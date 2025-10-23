<script lang="ts">
	import { dev } from '$app/environment';
	import Database from '~icons/lucide/database';
	import Server from '~icons/lucide/server';
	import User from '~icons/lucide/user';

	interface Props {
		dbInfo: {
			host: string;
			database: string;
			user: string;
		};
	}

	let { dbInfo }: Props = $props();
</script>

{#if dev}
	<div
		class="bg-warning text-warning-content fixed bottom-0 left-0 w-full px-4 py-2 text-xs shadow-lg"
	>
		<div class="flex items-center justify-start gap-6">
			<div class="flex items-center gap-1">
				<span class="font-semibold">Development Environment</span>
			</div>
			<div class="flex items-center gap-1">
				<Server class="size-4" />
				<span>{dbInfo.host}</span>
			</div>
			<div class="flex items-center gap-1">
				<User class="size-4" />
				<span>{dbInfo.user}</span>
			</div>
			<div class="flex items-center gap-1">
				<Database class="size-4" />
				<span>{dbInfo.database}</span>
			</div>
		</div>
	</div>
{/if}
