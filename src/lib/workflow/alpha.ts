import { wordCount } from './proposal';

export const VALUE_STATEMENT =
	'The edition explains solidly the knowledge claims, source material, process and methodology.';
export const VALUE_RATINGS = [
	'Strongly disagree',
	'Disagree',
	'Neutral',
	'Agree',
	'Strongly agree'
];
export type AlphaContext = { ready: string; focus: string; workInProgress: string };
export type AlphaAnswers = {
	technicalComments: string;
	valueRating: number;
	valueExplanation: string;
	experienceComments: string;
	generalComments: string;
	decision: '' | 'approve' | 'request_revisions';
	recommendationExplanation: string;
	collaborationInterest: '' | 'yes' | 'no';
};
export const emptyAlphaAnswers: AlphaAnswers = {
	technicalComments: '',
	valueRating: 0,
	valueExplanation: '',
	experienceComments: '',
	generalComments: '',
	decision: '',
	recommendationExplanation: '',
	collaborationInterest: ''
};
export type AlphaFeedback = Pick<
	AlphaAnswers,
	| 'technicalComments'
	| 'valueRating'
	| 'valueExplanation'
	| 'experienceComments'
	| 'generalComments'
> & { reviewer: string; round: number };
export type AlphaProgress = {
	round: number;
	total: number;
	submitted: number;
	released: boolean;
	feedback: AlphaFeedback[];
};
export function alphaContextError(data: AlphaContext): string {
	if (!data.ready.trim() || !data.focus.trim())
		return 'Describe what is ready and what reviewers should focus on.';
	return wordCount(Object.values(data).join(' ')) > 500
		? 'Review context must be 500 words or fewer in total.'
		: '';
}
export function alphaAnswersError(data: AlphaAnswers): string {
	if (
		!data.technicalComments.trim() ||
		!data.valueExplanation.trim() ||
		!data.experienceComments.trim() ||
		!data.recommendationExplanation.trim()
	)
		return 'Complete each review section and the recommendation explanation.';
	for (const [key, max] of [
		['technicalComments', 150],
		['valueExplanation', 150],
		['experienceComments', 150],
		['generalComments', 500],
		['recommendationExplanation', 500]
	] as const)
		if (wordCount(data[key]) > max)
			return `Keep each answer within its word limit (${max} words for this section).`;
	if (!Number.isInteger(data.valueRating) || data.valueRating < 1 || data.valueRating > 5)
		return 'Choose a Value rating.';
	if (!data.decision) return 'Choose whether the edition can pass Alpha Review.';
	if (!data.collaborationInterest) return 'Choose whether you are interested in collaborating.';
	return '';
}
