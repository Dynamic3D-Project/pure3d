export const RECOMMENDATIONS = {
	without_changes: 'Recommend without changes',
	minor_changes: 'Recommend with minor changes',
	major_changes: 'Recommend with major changes',
	do_not_recommend: 'Do not recommend'
} as const;
export const emptyFinalAnswers = {
	valueRating: 0,
	valueExplanation: '',
	experienceComments: '',
	changesRating: 0,
	changesExplanation: '',
	recommendation: '',
	comments: '',
	attribution: ''
};
export type FinalAnswers = typeof emptyFinalAnswers;
export type FinalFeedback = FinalAnswers & { reviewer: string; round: number };
