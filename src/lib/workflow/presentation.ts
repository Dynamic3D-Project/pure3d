import { EditionStatus } from '../types/roles';

export const workflowStages: {
	label: string;
	statuses: EditionStatus[];
	hrefStatus: EditionStatus;
}[] = [
	{ label: 'Proposal', statuses: [EditionStatus.Draft], hrefStatus: EditionStatus.Draft },
	{
		label: 'Proposal review',
		statuses: [
			EditionStatus.ConceptSubmitted,
			EditionStatus.EditorialReview,
			EditionStatus.ConceptAccepted,
			EditionStatus.ConceptRejected
		],
		hrefStatus: EditionStatus.ConceptSubmitted
	},
	{
		label: 'Alpha Review',
		statuses: [
			EditionStatus.AlphaReview,
			EditionStatus.AlphaAccepted,
			EditionStatus.AlphaRevisions,
			EditionStatus.AlphaRejected
		],
		hrefStatus: EditionStatus.AlphaReview
	},
	{
		label: 'Final Review',
		statuses: [
			EditionStatus.FinalReview,
			EditionStatus.FinalRevisions,
			EditionStatus.FinalAccepted,
			EditionStatus.PublicationRequested
		],
		hrefStatus: EditionStatus.FinalReview
	},
	{ label: 'Published', statuses: [EditionStatus.Published], hrefStatus: EditionStatus.Published }
];

export function workflowAnchor(status: EditionStatus): string {
	if (status === EditionStatus.Draft) return '#proposal';
	if ([EditionStatus.ConceptSubmitted, EditionStatus.EditorialReview].includes(status))
		return '#proposal-summary';
	if ([EditionStatus.ConceptAccepted, EditionStatus.ConceptRejected].includes(status))
		return '#concept';
	const stage = workflowStages.find((stage) => stage.statuses.includes(status));
	if (stage?.hrefStatus === EditionStatus.AlphaReview) return '#alpha';
	if (stage?.hrefStatus === EditionStatus.FinalReview) return '#final';
	return status === EditionStatus.Published ? '#published' : '';
}
