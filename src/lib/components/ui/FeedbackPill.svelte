<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import { pb } from '$lib/database/client';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import RichTextEditor from '$lib/components/ui/RichTextEditor.svelte';
	import toast from 'svelte-french-toast';
	import type { RecordModel } from 'pocketbase';

	const categoryOptions = [
		{ value: 'bug', label: 'Bug' },
		{ value: 'confusing', label: 'Confusing' },
		{ value: 'upload_issue', label: 'Upload issue' },
		{ value: 'viewer_issue', label: '3D viewer issue' },
		{ value: 'metadata_workflow', label: 'Metadata/workflow' },
		{ value: 'missing_feature', label: 'Missing feature' },
		{ value: 'other', label: 'Other' }
	];

	const severityOptions = [
		{ value: 'minor', label: 'Minor' },
		{ value: 'important', label: 'Important' },
		{ value: 'blocking', label: 'Blocking' },
		{ value: 'suggestion', label: 'Suggestion' }
	];

	let modal: HTMLDialogElement | undefined = $state();
	let isOpen = $state(false);
	let isSubmitting = $state(false);
	let feedbackRecord: RecordModel | null = $state(null);
	let participantName = $state('');
	let participantEmail = $state('');
	let relatedUrl = $state('');
	let category = $state('confusing');
	let severity = $state('important');
	let feedbackHtml = $state('');

	let isFeedbackPage = $derived(
		$page.url.pathname === `${base}/feedback` || $page.url.pathname === '/feedback'
	);

	onMount(() => {
		participantName = authStore.user?.nickname || authStore.user?.email?.split('@')[0] || '';
		participantEmail = authStore.user?.email || '';
	});

	function openFeedback() {
		relatedUrl = window.location.href;
		isOpen = true;
		modal?.showModal();
	}

	function closeFeedback() {
		modal?.close();
		isOpen = false;
	}

	function browserInfo() {
		return {
			userAgent: navigator.userAgent,
			language: navigator.language,
			viewport: `${window.innerWidth}x${window.innerHeight}`,
			devicePixelRatio: window.devicePixelRatio
		};
	}

	async function ensureFeedbackRecord() {
		if (feedbackRecord) return feedbackRecord;
		const record = await pb.collection('feedback').create({
			participantName,
			participantEmail,
			editionUrl: relatedUrl,
			category,
			severity,
			feedbackHtml,
			pageUrl: window.location.href,
			browserInfo: browserInfo(),
			status: 'draft',
			createdBy: authStore.appUserId || ''
		});
		feedbackRecord = record;
		return record;
	}

	async function uploadFeedbackImage(file: File): Promise<string> {
		const record = await ensureFeedbackRecord();
		const form = new FormData();
		form.append('images+', file);
		const updated = await pb.collection('feedback').update(record.id, form);
		feedbackRecord = updated;
		const filenames = Array.isArray(updated.images) ? updated.images : [];
		const filename = filenames.at(-1);
		if (!filename) throw new Error('Image upload did not return a file');
		return pb.files.getURL(updated, filename);
	}

	async function submitFeedback() {
		if (!feedbackHtml || feedbackHtml === '<p></p>') {
			toast.error('Please add a short note before submitting feedback');
			return;
		}

		isSubmitting = true;
		try {
			const record = await ensureFeedbackRecord();
			await pb.collection('feedback').update(record.id, {
				participantName,
				participantEmail,
				editionUrl: relatedUrl,
				category,
				severity,
				feedbackHtml,
				pageUrl: window.location.href,
				browserInfo: browserInfo(),
				status: 'submitted',
				createdBy: authStore.appUserId || ''
			});
			toast.success('Thank you — feedback submitted');
			feedbackHtml = '';
			feedbackRecord = null;
			closeFeedback();
		} catch (error) {
			console.error('Failed to submit feedback:', error);
			toast.error((error as Error).message || 'Failed to submit feedback');
		} finally {
			isSubmitting = false;
		}
	}
</script>

{#if !isFeedbackPage}
	<button type="button" class="feedback-pill btn btn-primary shadow-lg" onclick={openFeedback}>
		Full Feedback
	</button>
{/if}

<dialog bind:this={modal} class="modal" onclose={() => (isOpen = false)}>
	<div class="modal-box max-w-3xl border border-base-300 bg-base-100 p-0 shadow-2xl">
		<div class="border-b border-base-300 bg-base-200/60 px-5 py-4">
			<div class="flex items-start justify-between gap-4">
				<div>
					<p class="text-xs font-semibold uppercase tracking-wide text-primary">Full Feedback</p>
					<h2 class="text-xl font-bold">What did you notice?</h2>
					<p class="mt-1 text-sm text-base-content/60">
						Bugs, confusion, screenshots, slow moments, and ideas are all useful.
					</p>
				</div>
				<button type="button" class="btn btn-circle btn-ghost btn-sm" onclick={closeFeedback}>✕</button>
			</div>
		</div>

		{#if isOpen}
			<form
				class="space-y-5 p-5"
				onsubmit={(event) => {
					event.preventDefault();
					submitFeedback();
				}}
			>
				<div class="rounded-box border border-base-300 bg-base-200/30 p-4">
					<div class="grid gap-4 md:grid-cols-2">
						<label class="form-control gap-1">
							<span class="label-text text-xs font-medium text-base-content/70">Name</span>
							<input class="feedback-field input input-bordered input-sm w-full" bind:value={participantName} />
						</label>

						<label class="form-control gap-1">
							<span class="label-text text-xs font-medium text-base-content/70">Email optional</span>
							<input
								class="feedback-field input input-bordered input-sm w-full"
								type="email"
								bind:value={participantEmail}
							/>
						</label>

						<label class="form-control gap-1 md:col-span-2">
							<span class="label-text text-xs font-medium text-base-content/70">Related page</span>
							<input class="feedback-field input input-bordered input-sm w-full" bind:value={relatedUrl} />
						</label>

						<label class="form-control gap-1">
							<span class="label-text text-xs font-medium text-base-content/70">Category</span>
							<select class="feedback-field select select-bordered select-sm w-full" bind:value={category}>
								{#each categoryOptions as option}
									<option value={option.value}>{option.label}</option>
								{/each}
							</select>
						</label>

						<label class="form-control gap-1">
							<span class="label-text text-xs font-medium text-base-content/70">Severity</span>
							<select class="feedback-field select select-bordered select-sm w-full" bind:value={severity}>
								{#each severityOptions as option}
									<option value={option.value}>{option.label}</option>
								{/each}
							</select>
						</label>
					</div>
				</div>

				<div class="feedback-editor">
					<RichTextEditor
						content={feedbackHtml}
						placeholder="Write feedback here. You can paste screenshots."
						minHeight="220px"
						enableImagePaste
						uploadImage={uploadFeedbackImage}
						onchange={(html) => (feedbackHtml = html)}
					/>
				</div>

				<div class="flex items-center justify-between gap-3 border-t border-base-300 pt-4">
					<a class="link text-sm link-primary" href="{base}/feedback">Open Full Feedback page</a>
					<div class="flex gap-2">
						<button type="button" class="btn btn-ghost btn-sm" onclick={closeFeedback}>Cancel</button>
						<button class="btn btn-primary btn-sm" disabled={isSubmitting}>
							{#if isSubmitting}<span class="loading loading-spinner loading-xs"></span>{/if}
							Submit
						</button>
					</div>
				</div>
			</form>
		{/if}
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>Close</button>
	</form>
</dialog>

<style>
	.feedback-pill {
		position: fixed;
		right: max(1rem, env(safe-area-inset-right));
		bottom: max(1rem, env(safe-area-inset-bottom));
		z-index: 60;
		border-radius: 999px;
		min-height: 2.5rem;
		padding-inline: 1.25rem;
	}

	.feedback-field {
		background: #ffffff;
		border-color: color-mix(in srgb, var(--color-base-content, #111111) 16%, transparent);
		box-shadow: 0 1px 0 rgb(0 0 0 / 0.03);
	}

	.feedback-field:focus,
	.feedback-field:focus-within {
		background: #ffffff;
		border-color: var(--color-primary);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 16%, transparent);
		outline: none;
	}

	.feedback-editor :global(.rounded-box) {
		background: #ffffff;
		box-shadow: 0 1px 0 rgb(0 0 0 / 0.03);
	}

	.feedback-editor :global(.editor-wrapper),
	.feedback-editor :global(.tiptap) {
		background: #ffffff;
	}

	.feedback-editor :global(.editor-wrapper) {
		border-bottom-right-radius: var(--radius-box, 1rem);
		border-bottom-left-radius: var(--radius-box, 1rem);
	}

	@media (max-width: 640px) {
		.feedback-pill {
			right: 0.75rem;
			bottom: 0.75rem;
			min-height: 2.25rem;
			padding-inline: 1rem;
		}
	}
</style>
