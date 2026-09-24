<script lang="ts">
	import { onMount } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import { pb } from '$lib/database/client';
	import { DraftAutosave, type SaveState } from '$lib/workflow/autosave';
	import { VALUE_STATEMENT, VALUE_RATINGS } from '$lib/workflow/alpha';
	import { emptyFinalAnswers, RECOMMENDATIONS, type FinalAnswers } from '$lib/workflow/final';
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
		context?: { changes: string; notImplemented: string; comment: string };
		onsubmitted: () => void;
	} = $props();
	let answers = $state<FinalAnswers>({ ...emptyFinalAnswers });
	let ready = $state(false),
		busy = $state(false),
		submitted = $state(false),
		error = $state('');
	let saveState = $state<SaveState>('saved');
	let id = '',
		saver: DraftAutosave<FinalAnswers> | undefined,
		dialog: HTMLDialogElement;
	const sections = [
		{
			key: 'valueExplanation',
			rating: 'valueRating',
			title: 'Criteria A: Value',
			prompt: VALUE_STATEMENT
		},
		{
			key: 'experienceComments',
			rating: null,
			title: 'Criteria B: User experience',
			prompt: 'Comment on navigation, readability and accessibility. Provisional criteria.'
		},
		{
			key: 'changesExplanation',
			rating: 'changesRating',
			title: 'Response to Alpha feedback',
			prompt: 'Have the changes suggested during Alpha Review been implemented satisfactorily?'
		},
		{
			key: 'comments',
			rating: null,
			title: 'Further comments',
			prompt: 'Any further comments to include in your review (optional).'
		}
	] as const;
	$effect(() => {
		if (ready && !submitted) saver?.set(answers);
	});
	beforeNavigate((nav) => {
		if ((busy || saver?.dirty) && !confirm('Leave with unsaved review changes?')) nav.cancel();
	});
	onMount(() => {
		let disposed = false;
		const unload = (event: BeforeUnloadEvent) => {
			if (busy || saver?.dirty) {
				event.preventDefault();
				event.returnValue = '';
			}
		};
		window.addEventListener('beforeunload', unload);
		void (async () => {
			try {
				const result = await pb.collection('editionReviews').getList(1, 1, {
					filter: pb.filter(
						'editionId = {:editionId} && reviewerId = {:reviewerId} && reviewStage = 3 && reviewRound = {:round}',
						{ editionId, reviewerId, round }
					)
				});
				if (disposed) return;
				const record = result.items[0];
				id = record?.id || '';
				answers = { ...emptyFinalAnswers, ...record?.finalAnswers };
				submitted = record?.reviewStatus === 'submitted';
				saver = new DraftAutosave(
					answers,
					async (data) => {
						const saved = id
							? await pb.collection('editionReviews').update(id, { finalAnswers: data })
							: await pb.collection('editionReviews').create({
									editionId,
									reviewerId,
									reviewStage: 3,
									reviewStatus: 'draft',
									finalAnswers: data
								});
						id = saved.id;
					},
					(status, message) => {
						saveState = status;
						error = message || '';
					}
				);
				ready = true;
			} catch {
				error = 'Could not load your review. Reload to try again.';
			}
		})();
		return () => {
			disposed = true;
			saver?.dispose();
			window.removeEventListener('beforeunload', unload);
		};
	});
	function requestSubmit() {
		error = sections.some((s) => wordCount(answers[s.key]) > 150)
			? 'Keep each explanation within 150 words.'
			: !answers.valueRating ||
				  !answers.changesRating ||
				  !answers.valueExplanation.trim() ||
				  !answers.experienceComments.trim() ||
				  !answers.changesExplanation.trim() ||
				  !answers.recommendation ||
				  !answers.attribution
				? 'Complete the ratings, explanations, recommendation and attribution choice.'
				: '';
		if (!error) dialog.showModal();
	}
	async function submit() {
		if (!saver || busy) return;
		dialog.close();
		busy = true;
		try {
			saver.set(answers);
			await saver.flush();
			await pb
				.collection('editionReviews')
				.update(id, { finalAnswers: answers, reviewStatus: 'submitted' });
			submitted = true;
			saver.dispose();
			onsubmitted();
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not submit review.';
		} finally {
			busy = false;
		}
	}
</script>

<section id="final-review-form" class="space-y-4">
	<h2 class="text-xl font-semibold">Final Review</h2>
	<p class="rounded-box border border-info/30 bg-info/10 p-3 text-sm text-base-content">
		This review will be public when the edition is published. Choose below whether your name
		appears. Do not include confidential information in your answers.
	</p>
	{#if context}<details class="rounded-box border border-base-300 p-3" open>
			<summary class="cursor-pointer font-semibold">Author response to Alpha feedback</summary
			>{#each [['Changes made', context.changes], ['Not implemented and reasons', context.notImplemented], ['Additional context', context.comment]] as [label, text] (label)}<h3
					class="mt-3 text-sm font-semibold"
				>
					{label}
				</h3>
				<p class="text-sm whitespace-pre-wrap">{text || 'None noted.'}</p>{/each}
		</details>{/if}
	{#if ready}<form
			onsubmit={(event) => {
				event.preventDefault();
				requestSubmit();
			}}
		>
			<fieldset disabled={busy || submitted} class="space-y-4">
				{#each sections as section (section.key)}<details
						class="rounded-box border border-base-300 p-4"
						open
					>
						<summary class="cursor-pointer font-semibold">{section.title}</summary>
						<p class="mt-3 text-sm">{section.prompt}</p>
						{#if section.rating}<fieldset class="my-3">
								<legend class="sr-only">{section.title} rating</legend>
								<div class="flex flex-wrap gap-3">
									{#each VALUE_RATINGS as label, index (label)}<label
											class="flex items-center gap-2 text-xs"
											><input
												type="radio"
												class="radio radio-sm"
												bind:group={answers[section.rating]}
												value={index + 1}
											/>{label}</label
										>{/each}
								</div>
							</fieldset>{/if}<label class="mt-3 block text-sm" for={`final-${section.key}`}
							>Explanation<textarea
								id={`final-${section.key}`}
								class="textarea-bordered textarea mt-2 w-full"
								rows="3"
								bind:value={answers[section.key]}
								aria-invalid={wordCount(answers[section.key]) > 150}
							></textarea></label
						>
						<p class="text-right text-xs">{wordCount(answers[section.key])}/150 words</p>
					</details>{/each}
				<fieldset class="space-y-2">
					<legend class="mb-2 font-semibold">Recommendation for publication</legend
					>{#each Object.entries(RECOMMENDATIONS) as [value, label] (value)}<label
							class="flex items-center gap-2 text-sm"
							><input
								type="radio"
								class="radio radio-sm"
								bind:group={answers.recommendation}
								{value}
							/>{label}</label
						>{/each}
				</fieldset>
				<fieldset class="space-y-2">
					<legend class="mb-2 font-semibold">Name on the public review</legend><label
						class="flex items-center gap-2 text-sm"
						><input
							type="radio"
							class="radio radio-sm"
							value="named"
							bind:group={answers.attribution}
						/>Publish my profile name with this review</label
					><label class="flex items-center gap-2 text-sm"
						><input
							type="radio"
							class="radio radio-sm"
							value="anonymous"
							bind:group={answers.attribution}
						/>Publish without my name</label
					>
				</fieldset>
				<div class="flex flex-wrap items-center justify-between gap-3">
					<span role="status" class="text-xs"
						>{saveState === 'saved'
							? 'All changes saved'
							: saveState === 'saving'
								? 'Saving…'
								: saveState === 'error'
									? 'Could not save'
									: 'Unsaved changes'}</span
					>{#if saveState === 'error'}<button
							type="button"
							class="btn btn-outline btn-sm"
							onclick={() => saver?.flush().catch(() => {})}>Retry save</button
						>{/if}<button class="btn btn-primary" type="submit">Submit Final Review</button>
				</div>
			</fieldset>
		</form>{:else if !error}<p role="status">Loading review…</p>{/if}
	{#if error}<p role="alert" class="text-sm text-error">{error}</p>{/if}
	<dialog bind:this={dialog} class="modal" aria-labelledby="final-review-confirm-title">
		<div class="modal-box">
			<h2 id="final-review-confirm-title" class="text-xl font-semibold">Submit Final Review?</h2>
			<p class="mt-3">
				Your answers become read-only and edition access closes until publication or a new
				invitation. Editors release feedback after all reviews arrive. Your review will become
				public on publication, using your chosen attribution.
			</p>
			<div class="modal-action">
				<button type="button" class="btn" onclick={() => dialog.close()}>Keep editing</button
				><button type="button" class="btn btn-primary" onclick={submit}
					>Confirm review submission</button
				>
			</div>
		</div>
	</dialog>
</section>
