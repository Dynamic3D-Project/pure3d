<script lang="ts">
	import ContentRenderer from './ContentRenderer.svelte';
	import { authStore } from '$lib/database/stores/auth.svelte';

	interface Props {
		content?: string;
		imported?: boolean;
		isPublished?: boolean;
		editHref: string;
	}

	let { content = '', imported = false, isPublished = true, editHref }: Props = $props();
	const contactEmail = 'pure3d-fasos@maastrichtuniversity.nl';
	let name = $state('');
	let email = $state('');
	let subject = $state('');
	let message = $state('');

	function continueInEmail(event: SubmitEvent) {
		event.preventDefault();
		const body = [`Name: ${name}`, `Email: ${email}`, '', message].join('\n');
		window.location.href = `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
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
		<section class="rounded-box bg-ink p-7 text-paper sm:p-9" aria-label="Contact information">
			{#if content.trim()}
				<ContentRenderer
					content={content}
					{imported}
					className="prose prose-invert max-w-none text-paper/75"
				/>
			{:else}
				<h2 class="text-2xl font-semibold text-paper">Get in touch</h2>
				<p class="mt-4 leading-relaxed text-paper/70">
					The PURE3D team welcomes questions from researchers, educators and cultural heritage
					professionals.
				</p>
				<p class="mt-8 text-sm text-paper/60">Email</p>
				<a
					class="mt-1 inline-block font-semibold text-paper underline"
					href={`mailto:${contactEmail}`}
				>
					{contactEmail}
				</a>
			{/if}
		</section>

		<section class="rounded-box bg-base-200 p-7 sm:p-9" aria-labelledby="contact-form-heading">
			<h2 id="contact-form-heading" class="text-2xl font-semibold">Write your message</h2>
			<p class="mt-3 text-sm leading-relaxed text-base-content/65">
				This website does not send or store form submissions. Continuing opens your email app so you
				can review and send the message yourself.
			</p>
			<form class="mt-7 space-y-5" onsubmit={continueInEmail}>
				<div class="grid gap-5 sm:grid-cols-2">
					<label class="form-control gap-2">
						<span class="font-semibold">Name</span>
						<input class="input input-bordered w-full" autocomplete="name" required bind:value={name} />
					</label>
					<label class="form-control gap-2">
						<span class="font-semibold">Email</span>
						<input
							class="input input-bordered w-full"
							type="email"
							autocomplete="email"
							required
							bind:value={email}
						/>
					</label>
				</div>
				<label class="form-control gap-2">
					<span class="font-semibold">Subject</span>
					<input class="input input-bordered w-full" required bind:value={subject} />
				</label>
				<label class="form-control gap-2">
					<span class="font-semibold">Message</span>
					<textarea class="textarea textarea-bordered min-h-40 w-full" required bind:value={message}
					></textarea>
				</label>
				<button class="btn btn-primary" type="submit">
					Continue in email app <span aria-hidden="true">→</span>
				</button>
			</form>
		</section>
	</div>
</main>
