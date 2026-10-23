<script lang="ts">
	import ContentRenderer from './ContentRenderer.svelte';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import { pb } from '$lib/database/client';

	interface Props {
		content?: string;
		imported?: boolean;
		isPublished?: boolean;
		editHref: string;
	}

	let { content = '', imported = false, isPublished = true, editHref }: Props = $props();
	const contactEmail = 'info@pure3d.eu';
	let name = $state('');
	let email = $state('');
	let subject = $state('');
	let message = $state('');
	let website = $state('');
	let isSending = $state(false);
	let sent = $state(false);
	let error = $state('');

	async function sendMessage(event: SubmitEvent) {
		event.preventDefault();
		if (isSending) return;
		isSending = true;
		error = '';
		sent = false;
		try {
			await pb.send('/api/pure3d/contact', {
				method: 'POST',
				body: { name, email, subject, message, website }
			});
			sent = true;
			name = email = subject = message = '';
		} catch {
			error = 'Your message could not be sent. Please try again later or email us directly.';
		} finally {
			isSending = false;
		}
	}
</script>

<main id="contact-page" class="mx-auto max-w-7xl px-5 py-14 md:px-10">
	{#if authStore.globalRole === 'admin'}
		<div class="mb-8 flex items-center justify-between gap-3 rounded-box bg-base-200 p-4">
			<span class="text-sm opacity-60">
				{isPublished ? 'Published page' : 'Draft preview · admins only'}
			</span>
			<a class="btn btn-outline btn-sm" href={editHref}>Edit page</a>
		</div>
	{/if}

	<header class="mb-12 max-w-3xl">
		<p class="mb-4 text-xs font-semibold tracking-[0.2em] text-vermillion uppercase">
			Contact PURE3D
		</p>
		<h1 class="text-4xl font-semibold tracking-tight md:text-6xl">Let’s start a conversation.</h1>
		<p class="mt-5 text-lg leading-relaxed text-base-content/65">
			Questions about publishing, learning materials or the PURE3D platform? Tell us what you are
			working on and how we can help.
		</p>
	</header>

	<div class="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
		<section
			class="contact-information rounded-box p-7 sm:p-9"
			aria-label="Contact information"
		>
			{#if content.trim()}
				<ContentRenderer {content} {imported} className="prose max-w-none" />
			{:else}
				<h2 class="text-2xl font-semibold">Get in touch</h2>
				<p class="mt-4 leading-relaxed">
					The PURE3D team welcomes questions from researchers, educators and cultural heritage
					professionals.
				</p>
				<p class="mt-8 text-sm">Email</p>
				<a
					class="mt-1 inline-block font-semibold break-all underline"
					href={`mailto:${contactEmail}`}
				>
					{contactEmail}
				</a>
			{/if}
		</section>

		<section class="rounded-box bg-base-200 p-7 sm:p-9" aria-labelledby="contact-form-heading">
			<h2 id="contact-form-heading" class="text-2xl font-semibold">Write your message</h2>
			<p class="mt-3 text-sm leading-relaxed text-base-content/65">
				Send your message directly to the PURE3D team. We’ll reply to the email address you provide.
			</p>
			<form class="mt-7 space-y-5" onsubmit={sendMessage} aria-busy={isSending}>
				<div class="hidden" aria-hidden="true">
					<label>Website <input tabindex="-1" autocomplete="off" bind:value={website} /></label>
				</div>
				<fieldset class="space-y-5" disabled={isSending}>
					<div class="grid gap-5 sm:grid-cols-2">
						<label class="form-control gap-2">
							<span class="font-semibold">Name</span>
							<input
								class="input-bordered input w-full"
								autocomplete="name"
								maxlength="120"
								required
								bind:value={name}
							/>
						</label>
						<label class="form-control gap-2">
							<span class="font-semibold">Email</span>
							<input
								class="input-bordered input w-full"
								type="email"
								autocomplete="email"
								maxlength="254"
								required
								bind:value={email}
							/>
						</label>
					</div>
					<label class="form-control gap-2">
						<span class="font-semibold">Subject</span>
						<input
							class="input-bordered input w-full"
							maxlength="200"
							required
							bind:value={subject}
						/>
					</label>
					<label class="form-control gap-2">
						<span class="font-semibold">Message</span>
						<textarea
							class="textarea-bordered textarea min-h-40 w-full"
							maxlength="10000"
							required
							bind:value={message}
						></textarea>
					</label>
					<button class="btn btn-primary" type="submit" disabled={isSending}>
						{isSending ? 'Sending…' : 'Send message'} <span aria-hidden="true">→</span>
					</button>
				</fieldset>
				{#if sent}<p role="status">
						Your message has been sent. Thank you for getting in touch.
					</p>{/if}
				{#if error}<p role="alert">{error}</p>{/if}
			</form>
		</section>
	</div>
</main>

<style>
	.contact-information {
		--color-base-content: var(--color-panel-content);
		background: var(--color-panel-bg);
		color: var(--color-panel-content);
	}

	.contact-information :global(#content-renderer.prose) {
		color: var(--color-base-content);
		--tw-prose-body: var(--color-base-content);
		--tw-prose-headings: var(--color-base-content);
		--tw-prose-links: var(--color-base-content);
		--tw-prose-bold: var(--color-base-content);
	}

	.contact-information :global(a) {
		color: var(--color-base-content);
		overflow-wrap: anywhere;
	}

	.form-control {
		display: flex;
		flex-direction: column;
	}
</style>
