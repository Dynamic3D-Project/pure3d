<script lang="ts">
	import type { Credit } from '$lib/types/credits';
	import { normalizeOrcid } from '$lib/utils/credits';
	let {
		credits = $bindable<Credit[]>([]),
		disabled = false
	}: { credits: Credit[]; disabled?: boolean } = $props();

	function move(index: number, direction: number) {
		const reordered = [...credits];
		[reordered[index], reordered[index + direction]] = [
			reordered[index + direction],
			reordered[index]
		];
		credits = reordered;
	}
</script>

<div id="credits-editor" class="space-y-3">
	<h3 class="font-semibold">Creators and contributors</h3>
	<p class="text-sm text-base-content/70">
		Every individual creator needs an ORCID to submit or publish. Organizations do not. Contributors
		are optional. Linking a user does not grant access.
	</p>
	{#each credits as credit, index (credit)}
		<fieldset {disabled} class="space-y-3 rounded-box border border-base-300 p-3">
			<legend class="px-1 text-sm font-semibold">Credit {index + 1}</legend>
			<div class="grid gap-3 sm:grid-cols-2">
				<label class="form-control"
					>Name<input
						class="input-bordered input w-full"
						bind:value={credit.name}
						required
					/></label
				>
				<label class="form-control"
					>Type<select class="select-bordered select w-full" bind:value={credit.type}
						><option value="person">Person</option><option value="org">Organization</option></select
					></label
				>
				<label class="form-control"
					>Credit role<select class="select-bordered select w-full" bind:value={credit.role}
						><option value="creator">Creator</option><option value="contributor">Contributor</option
						></select
					></label
				>
				<label class="form-control"
					>ORCID<input
						class="input-bordered input w-full"
						value={credit.orcid ?? ''}
						oninput={(event) => (credit.orcid = event.currentTarget.value || null)}
						onblur={() => {
							credit.orcid = normalizeOrcid(credit.orcid) || credit.orcid;
						}}
						placeholder="https://orcid.org/0000-0000-0000-0000"
						aria-invalid={!!credit.orcid && !normalizeOrcid(credit.orcid)}
					/></label
				>
				<label class="form-control"
					>Linked user ID (optional)<input
						class="input-bordered input w-full"
						value={credit.userId ?? ''}
						oninput={(event) => {
							const value = event.currentTarget.value.trim();
							if (value) credit.userId = value;
							else delete credit.userId;
						}}
					/></label
				>
				<label class="form-control"
					>Contribution role (optional)<input
						class="input-bordered input w-full"
						bind:value={credit.contributionRole}
					/></label
				>
			</div>
			{#if credit.orcid && !normalizeOrcid(credit.orcid)}<p class="text-sm text-error">
					Enter a valid ORCID, including its checksum.
				</p>{/if}
			<div class="flex flex-wrap gap-2">
				<button
					type="button"
					class="btn btn-sm"
					disabled={index === 0}
					onclick={() => move(index, -1)}
					aria-label={`Move credit ${index + 1} up`}>Up</button
				>
				<button
					type="button"
					class="btn btn-sm"
					disabled={index === credits.length - 1}
					onclick={() => move(index, 1)}
					aria-label={`Move credit ${index + 1} down`}>Down</button
				>
				<button
					type="button"
					class="btn btn-sm"
					onclick={() => (credits = credits.filter((_, i) => i !== index))}
					aria-label={`Remove credit ${index + 1}`}>Remove</button
				>
			</div>
		</fieldset>
	{/each}
	<button
		type="button"
		class="btn btn-sm"
		{disabled}
		onclick={() =>
			(credits = [
				...credits,
				{ type: 'person', name: '', orcid: null, role: 'creator', provenance: 'manual' }
			])}>Add credit</button
	>
</div>
