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

	let isSubmitting = $state(false);
	let feedbackRecord: RecordModel | null = $state(null);
	let participantName = $state('');
	let participantEmail = $state('');
	let relatedUrl = $state('');
	let category = $state('confusing');
	let severity = $state('important');
	let feedbackHtml = $state('');

	onMount(() => {
		participantName = authStore.user?.nickname || authStore.user?.email?.split('@')[0] || '';
		participantEmail = authStore.user?.email || '';
		relatedUrl = $page.url.searchParams.get('from') || '';
	});

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
			feedbackRecord = await pb.collection('feedback').update(record.id, {
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
		} catch (error) {
			console.error('Failed to submit feedback:', error);
			toast.error((error as Error).message || 'Failed to submit feedback');
		} finally {
			isSubmitting = false;
		}
	}
</script>

<svelte:head>
	<title>Feedback | Pure3D</title>
</svelte:head>

<div class="container mx-auto max-w-5xl px-4 py-10">
	<div class="mb-8 rounded-3xl bg-primary/10 p-6 ring-1 ring-primary/20 md:p-8">
		<p class="mb-2 text-sm font-semibold uppercase tracking-wide text-primary">Feedback</p>
		<h1 class="text-3xl font-bold md:text-4xl">Tell us what you notice</h1>
		<p class="mt-3 max-w-3xl text-base-content/70">
			Open the platform in a new tab and use it as naturally as possible. Try browsing,
			creating a 3D edition, uploading files, editing metadata, and viewing the result. You do
			not need to finish everything. If something is confusing, broken, slow, or unclear, that is
			exactly what we want to know.
		</p>
		<a class="btn btn-primary mt-5" href="{base}/" target="_blank" rel="noreferrer">
			Open Pure3D
		</a>
	</div>

	<section class="rounded-box border border-base-300 bg-base-100 p-6 shadow-sm">
		<div class="mb-5">
			<h2 class="text-xl font-semibold">Feedback form</h2>
			<p class="mt-1 text-sm text-base-content/60">
				Anything you find is valid: bugs, confusing wording, missing labels, visual issues,
				unexpected behavior, or ideas. You can paste screenshots directly into the rich text box.
			</p>
		</div>

		<form
			class="space-y-4"
			onsubmit={(event) => {
				event.preventDefault();
				submitFeedback();
			}}
		>
			<div class="grid gap-4 md:grid-cols-2">
				<label class="form-control">
					<span class="label pb-1 pt-0"><span class="label-text text-xs">Name</span></span>
					<input class="input input-bordered" bind:value={participantName} />
				</label>

				<label class="form-control">
					<span class="label pb-1 pt-0"><span class="label-text text-xs">Email optional</span></span>
					<input class="input input-bordered" type="email" bind:value={participantEmail} />
				</label>
			</div>

			<label class="form-control">
				<span class="label pb-1 pt-0">
					<span class="label-text text-xs">Related page or edition URL optional</span>
				</span>
				<input
					class="input input-bordered"
					placeholder="Paste the page or edition URL if relevant"
					bind:value={relatedUrl}
				/>
			</label>

			<div class="grid gap-4 md:grid-cols-2">
				<label class="form-control">
					<span class="label pb-1 pt-0"><span class="label-text text-xs">Category</span></span>
					<select class="select select-bordered" bind:value={category}>
						{#each categoryOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</label>
				<label class="form-control">
					<span class="label pb-1 pt-0"><span class="label-text text-xs">Severity</span></span>
					<select class="select select-bordered" bind:value={severity}>
						{#each severityOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</label>
			</div>

			<RichTextEditor
				content={feedbackHtml}
				placeholder="What did you notice? You can paste screenshots here."
				minHeight="300px"
				enableImagePaste
				uploadImage={uploadFeedbackImage}
				onchange={(html) => (feedbackHtml = html)}
			/>

			<div class="flex justify-end">
				<button class="btn btn-primary" disabled={isSubmitting}>
					{#if isSubmitting}<span class="loading loading-spinner loading-xs"></span>{/if}
					Submit feedback
				</button>
			</div>
		</form>
	</section>
</div>
