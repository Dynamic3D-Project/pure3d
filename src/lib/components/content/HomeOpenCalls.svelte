<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { resolve } from '$app/paths';
	import type { RecordModel } from 'pocketbase';
	import { pb } from '$lib/database/client';
	import { cleanContent } from '$lib/utils/content-html';
	import ContentRenderer from './ContentRenderer.svelte';

	let calls = $state<(RecordModel & { excerpt: string })[]>([]);
	let selected = $state<RecordModel | null>(null);
	let dialog: HTMLDialogElement;
	const date = (value: string) =>
		new Intl.DateTimeFormat('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			timeZone: 'UTC'
		}).format(new Date(value));

	onMount(async () => {
		try {
			const records = await pb.collection('open_calls').getFullList({
				filter: pb.filter('isPublished = true && (deadline = "" || deadline >= {:today})', {
					today: `${new Date().toISOString().slice(0, 10)} 00:00:00.000Z`
				}),
				sort: 'order,deadline,title'
			});
			calls = records.map((call) => {
				const document = new DOMParser().parseFromString(
					cleanContent(call.body || ''),
					'text/html'
				);
				const paragraph =
					Array.from(document.querySelectorAll('p'))
						.find((node) => (node.textContent?.trim().length || 0) > 100)
						?.textContent?.replace(/\s+/g, ' ')
						.trim() || '';
				const excerpt =
					paragraph.length > 175 ? `${paragraph.slice(0, 175).replace(/\s+\S*$/, '')}…` : paragraph;
				return { ...call, excerpt };
			});
		} catch {
			// Keep the rest of the landing page available if calls cannot be loaded.
			calls = [];
		}
	});

	async function openCall(call: RecordModel) {
		selected = call;
		await tick();
		dialog.showModal();
	}
</script>

<div id="home-open-calls">
	{#if calls.length}
		<section aria-labelledby="home-open-calls-title" class="calls-section">
			<div class="calls-shell">
				<header class="calls-heading">
					<div>
						<p class="eyebrow">
							<span class="signal" aria-hidden="true"></span> Open for proposals
						</p>
						<h2 id="home-open-calls-title">Thematic Calls</h2>
					</div>
				</header>
				<div class="calls-grid">
					{#each calls as call (call.id)}
						<article class="call-card">
							<div class="card-top">
								<span>Thematic call</span>
							</div>
							<h3>{call.title}</h3>
							{#if call.excerpt}<p class="excerpt">{call.excerpt}</p>{/if}
							<div class="card-footer">
								<div class="deadline">
									<span>{call.deadline ? 'Proposal deadline' : 'Applications'}</span><strong
										>{call.deadline ? date(call.deadline) : 'Open'}</strong
									>
								</div>
								<button
									type="button"
									onclick={() => openCall(call)}
									aria-label={`Read call: ${call.title}`}
									aria-haspopup="dialog"
									>Read call <span class="arrow" aria-hidden="true">↗</span></button
								>
							</div>
						</article>
					{/each}
				</div>
			</div>
		</section>
	{/if}
	<dialog
		bind:this={dialog}
		aria-labelledby="home-call-dialog-title"
		onclose={() => (selected = null)}
	>
		{#if selected}
			<div class="dialog-toolbar">
				<span class="eyebrow">Thematic call</span><button
					type="button"
					class="close-button"
					aria-label="Close open call"
					onclick={() => dialog.close()}>✕</button
				>
			</div>
			<div class="dialog-body">
				<h2 id="home-call-dialog-title">{selected.title}</h2>
				{#if selected.deadline}<p class="dialog-deadline">
						Proposal deadline · {date(selected.deadline)}
					</p>{/if}
				{#key selected.id}<ContentRenderer
						content={selected.body || ''}
						renderOpenCalls={false}
					/>{/key}
				<a class="btn mt-8 btn-primary" href={resolve('/documentation/submission')}
					>Read submission guidelines <span aria-hidden="true">→</span></a
				>
			</div>
		{/if}
	</dialog>
</div>

<style>
	.calls-section {
		background: var(--color-base-200);
		border-bottom: 1px solid var(--rule);
		padding: clamp(48px, 6vw, 88px) 0;
	}
	.calls-shell {
		max-width: 1320px;
		margin: 0 auto;
		padding: 0 clamp(20px, 4vw, 48px);
	}
	.calls-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 32px;
		margin-bottom: 34px;
	}
	.eyebrow {
		display: flex;
		align-items: center;
		gap: 9px;
		font: 500 11px/1.4 var(--font-sans);
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.signal {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--color-vermillion-ink);
	}
	h2 {
		margin: 17px 0 0;
		font: 500 clamp(34px, 4vw, 52px) / 1.04 var(--font-sans);
		letter-spacing: -0.045em;
	}
	.calls-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 20px;
	}
	.call-card {
		display: flex;
		flex-direction: column;
		position: relative;
		padding: clamp(24px, 3vw, 36px);
		border-radius: 4px;
		background: var(--color-base-100);
		border-top: 2px solid var(--color-forest);
	}
	.card-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
		margin-bottom: 28px;
		font-size: 10px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--color-ink-3);
	}
	h3 {
		max-width: 30ch;
		margin: 0 0 18px;
		font-size: clamp(21px, 2vw, 27px);
		font-weight: 500;
		line-height: 1.22;
		letter-spacing: -0.03em;
		text-wrap: balance;
	}
	.excerpt {
		max-width: 54ch;
		margin: 0 0 30px;
		color: var(--color-ink-3);
		font-size: 14px;
		line-height: 1.65;
	}
	.card-footer {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 20px;
		margin-top: auto;
		padding-top: 22px;
		border-top: 1px solid var(--rule);
	}
	.deadline {
		display: grid;
		gap: 5px;
	}
	.deadline > span {
		font-size: 10px;
		letter-spacing: 0.06em;
		color: var(--color-ink-3);
		text-transform: uppercase;
	}
	.deadline strong {
		font: 500 19px/1.2 var(--font-sans);
		letter-spacing: -0.03em;
	}
	.card-footer button {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 44px;
		cursor: pointer;
		font-size: 13px;
		font-weight: 500;
		white-space: nowrap;
	}
	.card-footer button::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
	}
	.card-footer button:focus-visible {
		outline: none;
	}
	.call-card:has(button:focus-visible) {
		outline: 2px solid var(--color-base-content);
		outline-offset: 4px;
	}
	.arrow {
		display: grid;
		place-items: center;
		width: 38px;
		height: 38px;
		border-radius: 50%;
		background: var(--color-base-200);
		font-size: 21px;
		transition:
			background 0.18s,
			color 0.18s;
	}
	.call-card:hover .arrow {
		background: var(--color-forest);
		color: white;
	}
	dialog {
		width: min(880px, calc(100% - 32px));
		max-height: calc(100dvh - 48px);
		margin: auto;
		padding: 0;
		border: 0;
		border-radius: 12px;
		background: var(--color-base-100);
		color: var(--color-base-content);
		box-shadow: 0 24px 90px #0004;
	}
	dialog::backdrop {
		background: #12121199;
		backdrop-filter: blur(5px);
	}
	.dialog-toolbar {
		position: sticky;
		top: 0;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 24px;
		padding: 12px 24px;
		background: var(--color-base-100);
		border-bottom: 1px solid var(--rule);
	}
	.close-button {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		cursor: pointer;
		border-radius: 50%;
		background: var(--color-base-200);
	}
	.dialog-body {
		padding: clamp(24px, 4vw, 48px);
	}
	.dialog-body h2 {
		margin: 0;
		font-size: clamp(28px, 4vw, 40px);
		line-height: 1.15;
		letter-spacing: -0.035em;
	}
	.dialog-deadline {
		margin: 20px 0 32px;
		color: var(--color-vermillion-ink);
		font-size: 14px;
		font-weight: 500;
	}
	@media (max-width: 640px) {
		.calls-heading {
			align-items: start;
			flex-direction: column;
			gap: 24px;
		}
		.calls-grid {
			grid-template-columns: minmax(0, 1fr);
		}
		.card-top {
			margin-bottom: 22px;
		}
		h3 {
			max-width: none;
		}
		.card-footer {
			gap: 12px;
		}
		.deadline strong {
			font-size: 17px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.arrow {
			transition: none;
		}
	}
</style>
