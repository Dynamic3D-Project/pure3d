<script lang="ts">
	import { onMount } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import type { RecordModel } from 'pocketbase';
	import { pb } from '$lib/database/client';
	import { DraftAutosave, type SaveState } from '$lib/workflow/autosave';
	import { alphaContextError, type AlphaContext } from '$lib/workflow/alpha';
	import { wordCount } from '$lib/workflow/proposal';
	let {
		edition,
		disabled = false,
		canRequest = true,
		beforeSubmit,
		onstatuschange,
		onbusychange,
		onsubmitted
	}: {
		edition: RecordModel;
		disabled?: boolean;
		canRequest?: boolean;
		beforeSubmit: () => Promise<void>;
		onstatuschange?: (state: SaveState) => void;
		onbusychange: (busy: boolean) => void;
		onsubmitted: (record: RecordModel) => void;
	} = $props();
	let context = $state<AlphaContext>({ ready: '', focus: '', workInProgress: '' });
	let saving = $state<SaveState>('saved');
	let ready = $state(false);
	let submitting = $state(false);
	let error = $state('');
	let confirmation: HTMLDialogElement;
	let autosave: DraftAutosave<AlphaContext>;
	const fields = [
		['ready', 'What is ready to review?'],
		['focus', 'What should reviewers focus on?'],
		['workInProgress', 'What is still work in progress? (optional)']
	] as const;
	$effect(() => {
		if (ready) autosave.set(context);
	});
	beforeNavigate((navigation) => {
		if (autosave?.dirty && !confirm('Leave with unsaved review-request changes?'))
			navigation.cancel();
	});
	onMount(() => {
		const saved = edition.alphaRequest || {};
		context = {
			ready: saved.ready || '',
			focus: saved.focus || '',
			workInProgress: saved.workInProgress || ''
		};
		autosave = new DraftAutosave(
			context,
			async (data) => {
				await pb.collection('editions').update(edition.id, { alphaRequest: data });
			},
			(state, message) => {
				saving = state;
				onstatuschange?.(state);
				error = message || '';
			}
		);
		ready = true;
		const unload = (event: BeforeUnloadEvent) => {
			if (autosave.dirty || submitting) {
				event.preventDefault();
				event.returnValue = '';
			}
		};
		window.addEventListener('beforeunload', unload);
		return () => {
			autosave.dispose();
			window.removeEventListener('beforeunload', unload);
		};
	});
	function requestSubmit() {
		error = alphaContextError(context);
		if (!error) confirmation.showModal();
	}
	async function submit() {
		if (submitting || disabled || !canRequest) return;
		confirmation.close();
		submitting = true;
		onbusychange(true);
		try {
			autosave.set(context);
			await autosave.flush();
			await beforeSubmit();
			const record = await pb
				.collection('editions')
				.update(edition.id, { alphaRequest: context, status: 'alpha_review' });
			ready = false;
			autosave.dispose();
			onsubmitted(record);
		} catch (cause) {
			error =
				cause instanceof Error
					? cause.message
					: 'Could not request review. Your edition remains editable.';
		} finally {
			submitting = false;
			onbusychange(false);
		}
	}
</script>

<section id="alpha-request-form" class="space-y-4">
	<div>
		<h2 class="text-lg font-semibold">Request Alpha Review</h2>
		<p class="mt-2 text-sm text-base-content/70">
			Give reviewers context about this version. Your edition will be locked while the review takes
			place.
		</p>
	</div>
	<fieldset disabled={disabled || submitting} class="space-y-4">
		{#each fields as [key, label] (key)}<label
				class="flex flex-col gap-2 text-sm"
				for={`alpha-request-${key}`}
				><span class="font-semibold">{label}</span><textarea
					id={`alpha-request-${key}`}
					class="textarea-bordered textarea w-full"
					rows="3"
					bind:value={context[key]}
				></textarea></label
			>{/each}
		<p class="text-right text-xs text-base-content/65">
			{wordCount(Object.values(context).join(' '))}/500 words total
		</p>
		<div class="flex flex-wrap items-center justify-between gap-3">
			<span class="text-xs" role="status"
				>{saving === 'saved'
					? 'Review context saved'
					: saving === 'saving'
						? 'Saving…'
						: saving === 'error'
							? 'Could not save'
							: 'Unsaved changes'}</span
			>{#if saving === 'error'}<button
					type="button"
					class="btn btn-outline btn-sm"
					onclick={() => autosave.flush().catch(() => {})}>Retry save</button
				>{/if}<button
				type="button"
				class="btn btn-primary"
				disabled={!ready || !canRequest}
				onclick={requestSubmit}>{submitting ? 'Submitting…' : 'Submit for Alpha Review'}</button
			>
		</div>
	</fieldset>
	{#if !canRequest}<p class="text-sm text-base-content/70">
			Only an author or editor can submit the edition for review.
		</p>{/if}
	{#if error}<p
			role="alert"
			class="rounded-box border border-error/30 bg-error/10 p-3 text-sm text-base-content"
		>
			{error}
		</p>{/if}
	<dialog bind:this={confirmation} class="modal" aria-labelledby="alpha-request-title">
		<div class="modal-box">
			<h2 id="alpha-request-title" class="text-xl font-semibold">
				Submit edition for Alpha Review?
			</h2>
			<p class="mt-3">
				All saved content will be available to assigned reviewers. You and your collaborators cannot
				edit the edition until the editors complete this review stage.
			</p>
			<div class="modal-action">
				<button class="btn" type="button" onclick={() => confirmation.close()}>Keep editing</button
				><button class="btn btn-primary" type="button" onclick={submit}
					>Submit for Alpha Review</button
				>
			</div>
		</div>
	</dialog>
</section>
