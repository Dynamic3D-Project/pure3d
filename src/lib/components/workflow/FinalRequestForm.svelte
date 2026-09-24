<script lang="ts">
	import { onMount } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import type { RecordModel } from 'pocketbase';
	import { pb } from '$lib/database/client';
	import { DraftAutosave, type SaveState } from '$lib/workflow/autosave';
	import { wordCount } from '$lib/workflow/proposal';
	let {
		edition,
		publication = false,
		disabled = false,
		canRequest = true,
		beforeSubmit,
		onbusychange,
		onsubmitted,
		onstatuschange
	}: {
		edition: RecordModel;
		publication?: boolean;
		disabled?: boolean;
		canRequest?: boolean;
		beforeSubmit: () => Promise<void>;
		onbusychange: (busy: boolean) => void;
		onsubmitted: () => void;
		onstatuschange?: (state: SaveState) => void;
	} = $props();
	let changes = $state(''),
		notImplemented = $state(''),
		comment = $state(''),
		rightsConfirmed = $state(false);
	let ready = $state(false),
		busy = $state(false),
		error = $state('');
	let saveState = $state<SaveState>('saved');
	let dialog: HTMLDialogElement;
	let saver: DraftAutosave<Record<string, string | boolean>>;
	const field = $derived(publication ? 'publicationRequest' : 'finalRequest');
	const label = $derived(publication ? 'publication' : 'Final Review');
	const payload = $derived.by((): Record<string, string | boolean> => {
		if (publication) return { comment, rightsConfirmed };
		return { changes, notImplemented, comment };
	});
	const count = $derived(
		wordCount([comment, ...(publication ? [] : [changes, notImplemented])].join(' '))
	);
	$effect(() => {
		if (ready) saver.set(payload as Record<string, string | boolean>);
	});
	beforeNavigate((nav) => {
		if ((busy || saver?.dirty) && !confirm('Leave with unsaved submission changes?')) nav.cancel();
	});
	onMount(() => {
		const saved = edition[field] || {};
		changes = saved.changes || '';
		notImplemented = saved.notImplemented || '';
		comment = saved.comment || '';
		rightsConfirmed = saved.rightsConfirmed === true;
		saver = new DraftAutosave(
			payload,
			async (data) => {
				await pb.collection('editions').update(edition.id, { [field]: data });
			},
			(status, message) => {
				saveState = status;
				error = message || '';
				onstatuschange?.(status);
			}
		);
		ready = true;
		const unload = (event: BeforeUnloadEvent) => {
			if (busy || saver.dirty) {
				event.preventDefault();
				event.returnValue = '';
			}
		};
		window.addEventListener('beforeunload', unload);
		return () => {
			saver.dispose();
			window.removeEventListener('beforeunload', unload);
		};
	});
	function confirmSubmit() {
		error =
			count > 500
				? 'Use no more than 500 words in total.'
				: publication
					? rightsConfirmed
						? ''
						: 'Confirm the rights declaration.'
					: changes.trim()
						? ''
						: 'Explain how you addressed the Alpha feedback.';
		if (!error) dialog.showModal();
	}
	async function submit() {
		if (busy || disabled || !canRequest) return;
		dialog.close();
		busy = true;
		onbusychange(true);
		try {
			saver.set(payload as Record<string, string | boolean>);
			await saver.flush();
			await beforeSubmit();
			await pb.collection('editions').update(edition.id, {
				[field]: payload,
				status: publication ? 'publication_requested' : 'final_review'
			});
			ready = false;
			saver.dispose();
			onsubmitted();
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Submission failed; your draft is retained.';
		} finally {
			busy = false;
			onbusychange(false);
		}
	}
</script>

<section id="final-request-form" class="space-y-4">
	<h2 class="text-lg font-semibold">Submit for {label}</h2>
	<p class="text-sm text-base-content/75">
		{publication
			? 'Final Review is complete. Make your final revisions and check all materials before requesting editorial publication.'
			: 'Explain your response to the Alpha feedback. Complete the description, language, licence and creator credits, and save the Voyager scene before submitting.'}
	</p>
	<fieldset disabled={disabled || busy} class="space-y-4">
		{#if !publication}
			<label class="block text-sm" for="final-changes"
				>Changes made in response to Alpha feedback<textarea
					id="final-changes"
					class="textarea-bordered textarea mt-2 w-full"
					rows="4"
					bind:value={changes}
				></textarea></label
			>
			<label class="block text-sm" for="final-not-implemented"
				>Recommendations not implemented and your reasons (optional)<textarea
					id="final-not-implemented"
					class="textarea-bordered textarea mt-2 w-full"
					rows="3"
					bind:value={notImplemented}
				></textarea></label
			>
		{/if}
		<label class="block text-sm" for="final-author-comment"
			>{publication
				? 'Final revisions and comments for the editors (optional)'
				: 'Additional context for reviewers (optional)'}<textarea
				id="final-author-comment"
				class="textarea-bordered textarea mt-2 w-full"
				rows="3"
				bind:value={comment}
			></textarea></label
		>
		<p class="text-right text-xs">{count}/500 words total</p>
		{#if publication}<label class="flex items-start gap-3 text-sm"
				><input class="checkbox mt-1" type="checkbox" bind:checked={rightsConfirmed} /><span
					>I confirm that the authors hold the rights or have obtained permission for all models,
					text, images, audio, video and other materials used in this edition, and that these
					permissions allow publication under the stated licence.</span
				></label
			>{/if}
		<p class="rounded-box border border-info/30 bg-info/10 p-3 text-sm text-base-content">
			Submitting locks edition editing. {publication
				? 'Only the editorial team can publish or return it. Published editions cannot be edited.'
				: 'Editing resumes after the editorial decision.'}
		</p>
		<div class="flex flex-wrap items-center justify-between gap-3">
			<span role="status" class="text-xs"
				>{saveState === 'saved'
					? 'All changes saved'
					: saveState === 'error'
						? 'Could not save'
						: saveState === 'saving'
							? 'Saving…'
							: 'Unsaved changes'}</span
			>{#if saveState === 'error'}<button
					type="button"
					class="btn btn-outline btn-sm"
					onclick={() => saver.flush().catch(() => {})}>Retry save</button
				>{/if}<button
				type="button"
				class="btn btn-primary"
				disabled={!ready || !canRequest}
				onclick={confirmSubmit}>Submit for {label}</button
			>
		</div>
	</fieldset>
	{#if error}<p role="alert" class="text-sm text-error">{error}</p>{/if}
	<dialog bind:this={dialog} class="modal" aria-labelledby="final-submit-title">
		<div class="modal-box">
			<h2 id="final-submit-title" class="text-xl font-semibold">Submit for {label}?</h2>
			<p class="mt-3">
				Your saved edition and statement will be submitted. You and collaborators cannot edit while
				it is under consideration.
			</p>
			<div class="modal-action">
				<button type="button" class="btn" onclick={() => dialog.close()}>Keep editing</button
				><button type="button" class="btn btn-primary" onclick={submit}>Confirm submission</button>
			</div>
		</div>
	</dialog>
</section>
