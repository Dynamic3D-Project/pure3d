<script lang="ts">
	import { base } from '$app/paths';
	import type { Credit } from '$lib/types/credits';
	import type { EditionStatus } from '$lib/types/roles';
	import { creditHref } from '$lib/utils/credits';
	import StatusBadge from '$lib/components/workflow/StatusBadge.svelte';
	import CopyIcon from '~icons/lucide/copy';

	interface Metadata {
		id: string;
		created: string;
		pubNum: number;
		status: EditionStatus | null;
		credits: Credit[];
		dcInstitution: string[];
		usageConditions: string;
		alternativeVersion: string | null;
		modelSize: string | null;
		voyagerVersion: string;
		settingsAuthorToolName: string | null;
		settingsAuthorToolVersion: string | null;
		sceneFile: string;
	}

	let {
		edition,
		loadedModelSize,
		primaryDoi,
		citationCopied,
		oncopydoi
	}: {
		edition: Metadata;
		loadedModelSize: number | null;
		primaryDoi: string;
		citationCopied: boolean;
		oncopydoi: () => void;
	} = $props();

	function formatBytes(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function formatDate(value: string): string {
		if (!value) return '—';
		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
	}
</script>

<div id="edition-metadata" class="not-prose space-y-0">
	<section class="metadata-section">
		<div class="metadata-heading"><h2>Publication record</h2></div>
		<dl class="metadata-list">
			{#if primaryDoi}
				<div class="metadata-row">
					<dt class="text-base-content/50">DOI</dt>
					<dd class="min-w-0">
						<p class="font-mono text-xs break-all">{primaryDoi}</p>
						<button type="button" class="metadata-action" onclick={oncopydoi} title="Copy DOI">
							<CopyIcon class="h-3 w-3" aria-hidden="true" />
							{citationCopied ? 'Copied' : 'Copy DOI'}
						</button>
					</dd>
				</div>
			{/if}
			<div class="metadata-row">
				<dt class="text-base-content/50">Record created</dt>
				<dd>{formatDate(edition.created)}</dd>
			</div>
			{#if edition.pubNum}
				<div class="metadata-row">
					<dt class="text-base-content/50">Edition number</dt>
					<dd>Ed. {String(edition.pubNum).padStart(2, '0')}</dd>
				</div>
			{/if}
			{#if edition.status}
				<div class="metadata-row items-center">
					<dt class="text-base-content/50">Publication status</dt>
					<dd><StatusBadge status={edition.status} /></dd>
				</div>
			{/if}
		</dl>
	</section>

	<section class="metadata-section">
		<div class="metadata-heading"><h2>Contributors &amp; institution</h2></div>
		<dl class="metadata-list">
			{#each ['creator', 'contributor'] as role (role)}
				<div class="metadata-row">
					<dt class="text-base-content/50">{role === 'creator' ? 'Creators' : 'Contributors'}</dt>
					<dd>
						{#each edition.credits.filter((credit) => credit.role === role) as credit (credit)}
							{@const href = creditHref(credit, base)}
							<div>
								{#if href}<a
										{href}
										class="link link-hover"
										rel={credit.userId ? undefined : 'external noopener noreferrer'}
										>{credit.name}</a
									>{:else}{credit.name}{/if}{credit.contributionRole
									? ` (${credit.contributionRole})`
									: ''}
							</div>
						{:else}<span class="text-base-content/45">Not provided</span>{/each}
					</dd>
				</div>
			{/each}
			{#if edition.dcInstitution?.length}
				<div class="metadata-row">
					<dt class="text-base-content/50">Institution</dt>
					<dd>{edition.dcInstitution.join(', ')}</dd>
				</div>
			{/if}
		</dl>
	</section>

	<section class="metadata-section">
		<div class="metadata-heading"><h2>Rights &amp; access</h2></div>
		<dl class="metadata-list">
			<div class="metadata-row">
				<dt class="text-base-content/50">Usage license</dt>
				<dd>{edition.usageConditions || 'Not specified'}</dd>
			</div>
			{#if edition.alternativeVersion}
				<div class="metadata-row">
					<dt class="text-base-content/50">Other version</dt>
					<dd><a href={edition.alternativeVersion} class="link link-hover">View version</a></dd>
				</div>
			{/if}
		</dl>
	</section>

	<section class="metadata-section">
		<div class="metadata-heading"><h2>Technical provenance</h2></div>
		<dl class="metadata-list">
			{#if loadedModelSize || edition.modelSize}
				<div class="metadata-row">
					<dt class="text-base-content/50">Model size</dt>
					<dd>{loadedModelSize ? formatBytes(loadedModelSize) : String(edition.modelSize)}</dd>
				</div>
			{/if}
			{#if edition.voyagerVersion}
				<div class="metadata-row">
					<dt class="text-base-content/50">Viewer runtime</dt>
					<dd>Voyager v{edition.voyagerVersion}</dd>
				</div>
			{/if}
			{#if edition.settingsAuthorToolVersion}
				<div class="metadata-row">
					<dt class="text-base-content/50">Authoring tool</dt>
					<dd>
						{edition.settingsAuthorToolName || 'Voyager'} v{edition.settingsAuthorToolVersion}
					</dd>
				</div>
			{/if}
			{#if edition.sceneFile}
				<div class="metadata-row">
					<dt class="text-base-content/50">Scene document</dt>
					<dd class="font-mono text-xs break-all">{edition.sceneFile}</dd>
				</div>
			{/if}
			<div class="metadata-row">
				<dt class="text-base-content/50">Record ID</dt>
				<dd class="font-mono text-xs break-all">{edition.id}</dd>
			</div>
		</dl>
	</section>
</div>

<style>
	.metadata-section {
		padding: 0.125rem 0 0.875rem;
	}
	.metadata-section + .metadata-section {
		padding-top: 0.875rem;
		border-top: 1px solid var(--color-base-300);
	}
	.metadata-heading {
		margin-bottom: 0.3rem;
	}
	.metadata-heading h2 {
		font-family: var(--font-mono);
		font-size: 0.625rem;
		font-weight: 500;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: color-mix(in oklch, var(--color-base-content) 50%, transparent);
	}
	.metadata-row {
		display: grid;
		grid-template-columns: 5.75rem minmax(0, 1fr);
		gap: 0.625rem;
		padding: 0.35rem 0;
	}
	.metadata-row:last-child {
		padding-bottom: 0;
	}
	.metadata-row dt {
		font-family: var(--font-mono);
		font-size: 0.5625rem;
		line-height: 1.4;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: color-mix(in oklch, var(--color-base-content) 48%, transparent);
	}
	.metadata-row dd {
		min-width: 0;
		font-size: 0.8125rem;
		line-height: 1.45;
		color: color-mix(in oklch, var(--color-base-content) 86%, transparent);
	}
	.metadata-action {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		min-height: 1.625rem;
		margin-top: 0.25rem;
		padding: 0.2rem 0.45rem;
		border: 1px solid var(--color-base-300);
		border-radius: 0.375rem;
		font-size: 0.6875rem;
		font-weight: 500;
		transition:
			border-color 160ms ease-out,
			background 160ms ease-out;
	}
	.metadata-action:hover {
		border-color: color-mix(in oklch, var(--color-base-content) 25%, var(--color-base-300));
		background: var(--color-base-200);
	}
	@media (max-width: 480px) {
		.metadata-row {
			grid-template-columns: 5rem minmax(0, 1fr);
			gap: 0.5rem;
		}
	}
</style>
