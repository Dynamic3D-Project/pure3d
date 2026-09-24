<script lang="ts">
	import type { Credit } from '$lib/types/credits';
	import { normalizeOrcid } from '$lib/utils/credits';
	let {
		credits = $bindable<Credit[]>([]),
		disabled = false,
		authorsOnly = false,
		affiliations = {}
	}: {
		credits: Credit[];
		disabled?: boolean;
		authorsOnly?: boolean;
		affiliations?: Record<string, string>;
	} = $props();

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
	{#if !authorsOnly}<h3 class="font-semibold">Creators and contributors</h3>{/if}
	<p class="text-sm text-base-content/70">
		{#if authorsOnly}Each individual author needs an ORCID before submission. Adding a co-author
			credits them; it does not grant editing access.
		{:else}Every individual creator needs an ORCID to submit or publish. Organizations do not.
			Contributors are optional. Linking a user does not grant access.{/if}
	</p>
	{#each credits as credit, index (credit)}
		<fieldset {disabled} class="space-y-3 rounded-box border border-base-300 p-3">
			<legend class="px-1 text-sm font-semibold"
				>{authorsOnly ? 'Author' : 'Credit'} {index + 1}</legend
			>
			<div class="grid gap-3 sm:grid-cols-2">
				<label class="form-control"
					>Name<input
						class="input-bordered input w-full"
						bind:value={credit.name}
						required
					/></label
				>
				{#if authorsOnly}
					<label class="flex flex-col"
						>Affiliation<input
							class="input-bordered input w-full"
							readonly
							value={credit.userId ? affiliations[credit.userId] || '' : ''}
							placeholder="From the author’s profile"
						/></label
					>
				{:else}
					<label class="form-control"
						>Type<select class="select-bordered select w-full" bind:value={credit.type}
							><option value="person">Person</option><option value="org">Organization</option
							></select
						></label
					>
					<label class="form-control"
						>Credit role<select class="select-bordered select w-full" bind:value={credit.role}
							><option value="creator">Creator</option><option value="contributor"
								>Contributor</option
							></select
						></label
					>
				{/if}
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
				{#if !authorsOnly}
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
				{/if}
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
			])}>{authorsOnly ? 'Add co-author' : 'Add credit'}</button
	>
</div>
