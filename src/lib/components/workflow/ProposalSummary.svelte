<script lang="ts">
	import type { RecordModel } from 'pocketbase';
	import { pb } from '$lib/database/client';
	import {
		MODEL_SOURCES,
		PROPOSAL_AUDIENCES,
		PROPOSAL_TYPES,
		isProposalLink
	} from '$lib/workflow/proposal';
	import ProposalModelUploads from '$lib/components/uploads/ProposalModelUploads.svelte';
	import toast from 'svelte-french-toast';
	let { record }: { record: RecordModel } = $props();
	const questions = [
		['proposalPurpose', 'For what purpose was the model created?'],
		['proposalArgument', 'Research argument or narrative and the role of the 3D model'],
		['proposalThreeDRationale', 'Why is 3D visualisation appropriate?'],
		['proposalContextualMaterial', 'Contextual material']
	];
	function labels(values: unknown, options: ReadonlyArray<readonly [string, string]>) {
		return Array.isArray(values)
			? values.map((value) => options.find(([id]) => id === value)?.[1] || value).join(', ')
			: 'Not provided';
	}
	async function download(filename: string) {
		try {
			const token = await pb.files.getToken();
			const anchor = document.createElement('a');
			anchor.href = pb.files.getURL(record, filename, { token, download: true });
			anchor.download = filename;
			anchor.click();
		} catch {
			toast.error('Could not download the file. Please try again.');
		}
	}
</script>

<section
	id="proposal-summary"
	class="space-y-6 rounded-box border border-base-300 bg-base-100 p-5 sm:p-6"
>
	<h2 class="text-xl font-semibold">Submitted proposal</h2>
	<dl class="space-y-5 text-sm">
		<div>
			<dt class="font-semibold">Title</dt>
			<dd>{record.proposalSnapshot?.title || record.title}</dd>
		</div>
		<div>
			<dt class="font-semibold">Proposal type</dt>
			<dd>{PROPOSAL_TYPES.find(([id]) => id === record.proposalType)?.[1] || 'Not provided'}</dd>
		</div>
		<div>
			<dt class="font-semibold">Authors and affiliations</dt>
			<dd>
				<ul>
					{#each record.proposalAuthorAffiliations || [] as author, index (index)}<li>
							{author.name}{author.affiliation ? ` — ${author.affiliation}` : ''}
						</li>{/each}
				</ul>
			</dd>
		</div>
		{#each questions as [field, label] (field)}
			<div>
				<dt class="font-semibold">{label}</dt>
				<dd class="mt-1 break-words whitespace-pre-wrap">{record[field] || 'Not provided'}</dd>
			</div>
		{/each}
		<div>
			<dt class="font-semibold">Intended audience</dt>
			<dd>{labels(record.proposalAudience, PROPOSAL_AUDIENCES)}</dd>
		</div>
		<div>
			<dt class="font-semibold">Existing digital model</dt>
			<dd>{record.proposalHasExistingModel ? 'Yes' : 'No'}</dd>
		</div>
		{#if record.proposalHasExistingModel}
			<div>
				<dt class="font-semibold">Model sources</dt>
				<dd>{labels(record.proposalModelSources, MODEL_SOURCES)}</dd>
			</div>
			<div>
				<dt class="font-semibold">Copyright ownership and permissions</dt>
				<dd class="whitespace-pre-wrap">{record.proposalCopyrightOwnership}</dd>
			</div>
		{:else}
			<div>
				<dt class="font-semibold">Digitisation situation</dt>
				<dd class="whitespace-pre-wrap">{record.proposalDigitisationSituation}</dd>
			</div>
		{/if}
		{#if Array.isArray(record.proposalSupportingLinks) && record.proposalSupportingLinks.length}
			<div>
				<dt class="font-semibold">Supporting links</dt>
				<dd>
					<ul>
						{#each record.proposalSupportingLinks as link, index (index)}<li class="break-all">
								{#if isProposalLink(link)}
									<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- Validated absolute external HTTP(S) URL. -->
									<a class="link" href={link} target="_blank" rel="noreferrer">{link}</a
									>{:else}{link}{/if}
							</li>{/each}
					</ul>
				</dd>
			</div>
		{/if}
	</dl>
	{#if record.proposalModelFiles?.length}<ProposalModelUploads edition={record} readOnly />{/if}
	{#if Array.isArray(record.proposalSupportingFiles) && record.proposalSupportingFiles.length}
		<div>
			<h3 class="font-semibold">Supporting files</h3>
			<ul>
				{#each record.proposalSupportingFiles as filename (filename)}<li>
						<button
							type="button"
							class="link text-left text-sm break-all"
							onclick={() => download(filename)}>{filename}</button
						>
					</li>{/each}
			</ul>
		</div>
	{/if}
</section>
