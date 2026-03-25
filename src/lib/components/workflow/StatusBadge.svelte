<script lang="ts">
	import { EditionStatus, STATUS_LABELS } from '$lib/types/roles';

	let { status, size = 'sm' }: { status: EditionStatus; size?: 'xs' | 'sm' | 'md' } = $props();

	const badgeClass: Record<EditionStatus, string> = {
		[EditionStatus.Draft]: 'badge-ghost',
		[EditionStatus.ConceptSubmitted]: 'badge-info',
		[EditionStatus.EditorialReview]: 'badge-warning',
		[EditionStatus.ConceptAccepted]: 'badge-success',
		[EditionStatus.ConceptRejected]: 'badge-error',
		[EditionStatus.AlphaReview]: 'badge-warning',
		[EditionStatus.AlphaRevisions]: 'badge-info',
		[EditionStatus.AlphaAccepted]: 'badge-success',
		[EditionStatus.AlphaRejected]: 'badge-error',
		[EditionStatus.FinalReview]: 'badge-warning',
		[EditionStatus.FinalRevisions]: 'badge-info',
		[EditionStatus.Published]: 'badge-primary'
	};
</script>

<span id="status-badge" class="badge badge-{size} {badgeClass[status] || 'badge-ghost'}">
	{STATUS_LABELS[status] || status}
</span>
