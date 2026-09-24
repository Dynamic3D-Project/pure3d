<script lang="ts">
	import { onMount } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { pb } from '$lib/database/client';
	import { DraftAutosave, type SaveState } from '$lib/workflow/autosave';
	import {
		emptyAlphaAnswers,
		alphaAnswersError,
		VALUE_RATINGS,
		VALUE_STATEMENT,
		type AlphaAnswers,
		type AlphaContext
	} from '$lib/workflow/alpha';
	import { wordCount } from '$lib/workflow/proposal';
	let {
		editionId,
		reviewerId,
		round,
		context,
		onsubmitted
	}: {
		editionId: string;
		reviewerId: string;
		round: number;
		context?: AlphaContext;
		onsubmitted: () => void;
	} = $props();
	let answers = $state<AlphaAnswers>({ ...emptyAlphaAnswers });
	let ready = $state(false);
	let saving = $state<SaveState>('saved');
	let error = $state('');
	let submitting = $state(false);
	let submitted = $state(false);
	let reviewId = '';
	let confirmation: HTMLDialogElement;
	let autosave: DraftAutosave<AlphaAnswers> | undefined;
	const commentSections = [
		{
			key: 'technicalComments',
			title: 'General technical questions',
			prompt: 'Comment on loading, model display, and any technical problems.',
			max: 150
		},
		{
			key: 'experienceComments',
			title: 'Criteria B: User experience',
			prompt: 'Comment on navigation, readability, and your experience exploring the edition.',
			max: 150
		},
		{
			key: 'generalComments',
			title: 'General comments',
			prompt: 'Any other feedback for the authors (optional).',
			max: 500
		}
	] as const;
	beforeNavigate((navigation) => {
		if (autosave?.dirty && !confirm('Leave with unsaved review changes?')) navigation.cancel();
	});
	$effect(() => {
		if (ready && !submitted) autosave?.set(answers);
	});
	onMount(() => {
		let disposed = false;
		const beforeUnload = (event: BeforeUnloadEvent) => {
			if (autosave?.dirty) {
				event.preventDefault();
				event.returnValue = '';
			}
		};
		window.addEventListener('beforeunload', beforeUnload);
		void (async () => {
			try {
				const result = await pb.collection('editionReviews').getList(1, 1, {
					filter: pb.filter(
						'editionId = {:editionId} && reviewerId = {:reviewerId} && reviewStage = 2 && reviewRound = {:round}',
						{ editionId, reviewerId, round }
					)
				});
				if (disposed) return;
				const record = result.items[0];
				if (record) {
					reviewId = record.id;
					for (const key of Object.keys(emptyAlphaAnswers) as Array<keyof AlphaAnswers>)
						Object.assign(answers, { [key]: record[key] ?? emptyAlphaAnswers[key] });
					submitted = record.reviewStatus === 'submitted';
				}
				autosave = new DraftAutosave(
					answers,
					async (data) => {
						const payload = {
							...data,
							editionId,
							reviewerId,
							reviewStage: 2,
							reviewStatus: 'draft'
						};
						const saved = reviewId
							? await pb.collection('editionReviews').update(reviewId, data)
							: await pb.collection('editionReviews').create(payload);
						if (!('reviewStatus' in saved))
							throw new Error('The Alpha Review migration is required.');
						reviewId = saved.id;
					},
					(state, message) => {
						saving = state;
						error = message || '';
					}
				);
				ready = true;
			} catch {
				error = 'Could not load your review. Reload the page to try again.';
			}
		})();
		return () => {
			disposed = true;
			autosave?.dispose();
			window.removeEventListener('beforeunload', beforeUnload);
		};
	});
	function requestSubmit() {
		error = alphaAnswersError(answers);
		if (!error) confirmation.showModal();
	}
	async function submit() {
		if (!autosave || submitting) return;
		confirmation.close();
		submitting = true;
		try {
			autosave.set(answers);
			await autosave.flush();
			await pb
				.collection('editionReviews')
				.update(reviewId, { ...answers, reviewStatus: 'submitted' });
			submitted = true;
			autosave.dispose();
			onsubmitted();
		} catch (cause) {
			error =
				cause instanceof Error ? cause.message : 'Could not submit. Your draft is still available.';
		} finally {
			submitting = false;
		}
	}
</script>

<section id="alpha-review-form" class="space-y-5">
	<div>
		<h2 class="text-xl font-semibold">Edition review</h2>
		<p class="mt-2 text-sm text-base-content/70">
			Alpha Review is anonymous to authors. Review the research value and user experience, giving
			constructive feedback before final submission.
		</p>
		<a
			class="mt-2 inline-block link text-sm"
			href={resolve('/documentation/[slug]', { slug: 'review' })}>Review process and guidelines</a
		>
	</div>
	{#if context}<details class="rounded-box border border-base-300 p-3" open>
			<summary class="cursor-pointer font-semibold">Author’s review context</summary>
			<dl class="mt-3 space-y-3 text-sm">
				{#each [['Ready for review', context.ready], ['Requested focus', context.focus], ['Work in progress', context.workInProgress]] as [label, text] (label)}<div
					>
						<dt class="font-semibold">{label}</dt>
						<dd class="whitespace-pre-wrap">{text || 'None noted.'}</dd>
					</div>{/each}
			</dl>
		</details>{/if}
	{#if !ready && !error}<p role="status">Loading your review…</p>{/if}
	{#if ready}
		<form
			onsubmit={(event) => {
				event.preventDefault();
				requestSubmit();
			}}
		>
			<fieldset disabled={submitting || submitted} class="space-y-4">
				{#each commentSections as section, index (section.key)}
					{#if index === 1}
						<details class="rounded-box border border-base-300 p-4" open>
							<summary class="cursor-pointer font-semibold">Criteria A: Value</summary>
							<fieldset class="mt-4 space-y-3">
								<legend class="text-sm font-semibold">{VALUE_STATEMENT}</legend>
								<div class="grid grid-cols-1 gap-2 sm:grid-cols-5">
									{#each VALUE_RATINGS as label, i (label)}<label
											class="flex items-center gap-2 text-xs sm:flex-col sm:text-center"
											><input
												class="radio radio-sm"
												type="radio"
												value={i + 1}
												bind:group={answers.valueRating}
											/>{label}</label
										>{/each}
								</div>
								<label class="block text-sm" for="alpha-value-explanation">Explanation</label
								><textarea
									id="alpha-value-explanation"
									class="textarea-bordered textarea w-full"
									rows="4"
									bind:value={answers.valueExplanation}
									aria-invalid={wordCount(answers.valueExplanation) > 150}
								></textarea>
								<p class="text-right text-xs text-base-content/65">
									{wordCount(answers.valueExplanation)}/150 words
								</p>
							</fieldset>
						</details>
					{/if}
					<details class="rounded-box border border-base-300 p-4" open>
						<summary class="cursor-pointer font-semibold">{section.title}</summary>
						<p class="mt-2 text-xs text-base-content/65">
							Provisional comment section — detailed criteria will be added later.
						</p>
						<label class="mt-3 block text-sm" for={`alpha-${section.key}`}>{section.prompt}</label
						><textarea
							id={`alpha-${section.key}`}
							class="textarea-bordered textarea mt-2 w-full"
							rows="4"
							bind:value={answers[section.key]}
							aria-invalid={wordCount(answers[section.key]) > section.max}
						></textarea>
						<p class="text-right text-xs text-base-content/65">
							{wordCount(answers[section.key])}/{section.max} words
						</p>
					</details>
				{/each}
				<details class="rounded-box border border-base-300 p-4" open>
					<summary class="cursor-pointer font-semibold">Final recommendation · Editors only</summary
					>
					<fieldset class="mt-4">
						<legend class="text-sm font-semibold"
							>Can this edition pass Alpha Review without a second Alpha round?</legend
						>
						<div class="mt-2 flex gap-5">
							<label class="flex items-center gap-2"
								><input
									type="radio"
									class="radio radio-sm"
									bind:group={answers.decision}
									value="approve"
								/>Yes</label
							><label class="flex items-center gap-2"
								><input
									type="radio"
									class="radio radio-sm"
									bind:group={answers.decision}
									value="request_revisions"
								/>No</label
							>
						</div>
					</fieldset>
					<label class="mt-4 block text-sm" for="alpha-recommendation"
						>Explanation — not shared with authors</label
					><textarea
						id="alpha-recommendation"
						class="textarea-bordered textarea mt-2 w-full"
						rows="4"
						bind:value={answers.recommendationExplanation}
						aria-invalid={wordCount(answers.recommendationExplanation) > 500}
					></textarea>
					<p class="text-right text-xs text-base-content/65">
						{wordCount(answers.recommendationExplanation)}/500 words
					</p>
					<fieldset class="mt-4">
						<legend class="text-sm font-semibold"
							>Would you like to be considered as a collaborator on the final edition?</legend
						>
						<p class="mt-1 text-xs text-base-content/65">
							Editors only. This does not grant access or reveal your identity to the authors.
						</p>
						<div class="mt-2 flex gap-5">
							{#each ['yes', 'no'] as value (value)}<label class="flex items-center gap-2"
									><input
										class="radio radio-sm"
										type="radio"
										bind:group={answers.collaborationInterest}
										{value}
									/>{value === 'yes' ? 'Yes' : 'No'}</label
								>{/each}
						</div>
					</fieldset>
				</details>
				<div class="flex flex-wrap items-center justify-between gap-3">
					<span class="text-xs" role="status"
						>{saving === 'saved'
							? 'All changes saved'
							: saving === 'saving'
								? 'Saving…'
								: saving === 'error'
									? 'Could not save'
									: 'Unsaved changes'}</span
					>{#if saving === 'error'}<button
							type="button"
							class="btn btn-outline btn-sm"
							onclick={() => autosave?.flush().catch(() => {})}>Retry save</button
						>{/if}<button class="btn btn-primary" type="submit"
						>{submitting ? 'Submitting…' : 'Submit review'}</button
					>
				</div>
			</fieldset>
		</form>
	{/if}
	{#if error}<p
			role="alert"
			class="rounded-box border border-error/30 bg-error/10 p-3 text-sm text-base-content"
		>
			{error}
		</p>{/if}
	<dialog bind:this={confirmation} class="modal" aria-labelledby="alpha-review-confirm-title">
		<div class="modal-box">
			<h2 id="alpha-review-confirm-title" class="text-xl font-semibold">Submit Alpha Review?</h2>
			<p class="mt-3">
				Editors will release anonymous feedback once all reviews are submitted. You will no longer
				be able to edit this review or open the edition until you receive a new review invitation.
			</p>
			<div class="modal-action">
				<button type="button" class="btn" onclick={() => confirmation.close()}>Keep editing</button
				><button type="button" class="btn btn-primary" onclick={submit}>Submit review</button>
			</div>
		</div>
	</dialog>
</section>
