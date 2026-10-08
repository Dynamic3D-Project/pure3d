<script lang="ts">
	import { PROPOSAL_AUDIENCES, wordCount } from '$lib/workflow/proposal';
	let {
		purpose = $bindable(''),
		argument = $bindable(''),
		rationale = $bindable(''),
		context = $bindable(''),
		audience = $bindable<string[]>([]),
		readOnly = false
	} = $props();
	const questions = $derived([
		{
			id: 'proposal-purpose',
			label: 'For what purpose was the model created?',
			hint: 'Please provide links to existing websites, research publications, videos, or graphics.',
			value: purpose,
			change: (value: string) => (purpose = value)
		},
		{
			id: 'proposal-argument',
			label:
				'What research argument or narrative would you like to develop, and how will the 3D model be its central component?',
			hint: '',
			value: argument,
			change: (value: string) => (argument = value)
		},
		{
			id: 'proposal-3d-rationale',
			label:
				'Why is 3D visualisation an appropriate means of presenting your argument or narrative?',
			hint: '',
			value: rationale,
			change: (value: string) => (rationale = value)
		},
		{
			id: 'proposal-context',
			label: 'What material do you have available to contextualise your 3D models?',
			hint: 'Indicate formats and quantities, including archival material, images, videos, or audio recordings.',
			value: context,
			change: (value: string) => (context = value)
		}
	]);
</script>

<section
	id="proposal-questionnaire"
	class="space-y-4 overflow-hidden rounded-box border border-base-300 bg-base-100 p-5"
>
	<div class="-mx-5 -mt-5 border-b border-base-300 bg-base-200 px-5 py-3">
		<h2 class="text-base font-semibold">Submission Questionnaire</h2>
	</div>
	{#each questions as field (field.id)}
		<div class="form-control">
			{#if readOnly}
				<h3 class="label-text font-semibold">{field.label}</h3>
			{:else}
				<label class="label-text font-semibold" for={field.id}>{field.label}</label>
			{/if}
			{#if field.hint}<span class="mt-1 text-sm text-base-content/75">{field.hint}</span>{/if}
			{#if readOnly}
				<p class="mt-2 min-h-12 rounded-lg bg-base-200/50 p-3 text-sm whitespace-pre-wrap">
					{field.value || 'Not provided'}
				</p>
			{:else}
				<textarea
					id={field.id}
					class="textarea-bordered textarea mt-2 min-h-20 w-full"
					rows="3"
					value={field.value}
					aria-invalid={wordCount(field.value) > 150}
					oninput={(event) => {
						field.change(event.currentTarget.value);
						event.currentTarget.style.height = 'auto';
						event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
					}}
					required
				></textarea>
				<span class="mt-1 text-right text-xs text-base-content/75"
					>{wordCount(field.value)}/150 words</span
				>
			{/if}
		</div>
	{/each}
	{#if readOnly}
		<div>
			<h3 class="font-semibold">Intended audience</h3>
			<div class="mt-2 flex min-h-12 flex-wrap items-center gap-2 rounded-lg bg-base-200/50 p-3">
				{#each PROPOSAL_AUDIENCES.filter(([value]) => audience.includes(value)) as [value, label] (value)}
					<span class="badge badge-outline">{label}</span>
				{:else}
					<span class="text-sm">Not provided</span>
				{/each}
			</div>
		</div>
	{:else}
		<fieldset class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			<legend class="font-semibold">Intended audience</legend>
			{#each PROPOSAL_AUDIENCES as [value, label] (value)}
				<label class="flex items-center gap-2 text-sm"
					><input
						type="checkbox"
						class="checkbox checkbox-sm"
						bind:group={audience}
						{value}
					/>{label}</label
				>
			{/each}
		</fieldset>
	{/if}
</section>
