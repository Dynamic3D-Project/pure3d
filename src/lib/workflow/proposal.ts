export const PROPOSAL_TYPES = [
	['research', 'Research'],
	['teaching', 'Teaching'],
	['public-engagement', 'Public engagement'],
	['other', 'Other']
] as const;

export const PROPOSAL_AUDIENCES = [
	['general-public', 'General public'],
	['academics', 'Academics'],
	['specialists', 'Specialists / non-academics'],
	['primary-students', 'Primary students'],
	['secondary-students', 'Secondary students'],
	['university-students', 'University students']
] as const;

export const MODEL_SOURCES = [
	['computer-graphic-reconstruction', 'Computer graphic reconstruction'],
	['structured-light-scan', 'Structured light scan'],
	['medical-xray-computed-tomography', 'Medical X-ray computed tomography'],
	['photogrammetry', 'Photogrammetry'],
	['ct-scan', 'CT scan'],
	['magnetic-resonance-imaging', 'Magnetic resonance imaging'],
	['confocal-image-stacking', 'Confocal image stacking'],
	['infrared-scanning', 'Infrared scanning'],
	['micro-xray-computed-tomography', 'Micro X-ray computed tomography']
] as const;

export type ProposalData = {
	proposalType: string;
	title: string;
	credits: Array<{ role?: string }>;
	purpose: string;
	argument: string;
	threeDRationale: string;
	audiences: string[];
	contextualMaterial: string;
	hasExistingModel: boolean;
	modelSources: string[];
	copyrightOwnership: string;
	digitisationSituation: string;
	hasModelFile: boolean;
	supportingLinks?: string[];
};

const writtenFields: Array<
	[
		keyof Pick<ProposalData, 'purpose' | 'argument' | 'threeDRationale' | 'contextualMaterial'>,
		string
	]
> = [
	['purpose', 'Purpose'],
	['argument', 'Research argument and model centrality'],
	['threeDRationale', 'Why 3D is appropriate'],
	['contextualMaterial', 'Contextual material description']
];

export function wordCount(value: string): number {
	return value.trim() ? value.trim().split(/\s+/).length : 0;
}

export function proposalErrors(proposal: ProposalData): string[] {
	if (!PROPOSAL_TYPES.some(([value]) => value === proposal.proposalType))
		return ['Select a proposal type.'];
	if (!proposal.title.trim()) return ['Title is required.'];
	if (!proposal.credits.some((credit) => credit.role === 'creator'))
		return ['Add at least one author.'];
	for (const [field, label] of writtenFields) {
		if (!proposal[field].trim()) return [`${label} is required.`];
		if (wordCount(proposal[field]) > 150) return [`${label} must be 150 words or fewer.`];
	}
	if (proposal.audiences.length === 0) return ['Select at least one intended audience.'];
	if (proposal.hasExistingModel) {
		if (!proposal.hasModelFile) return ['Upload an existing 3D model before submitting.'];
		if (proposal.modelSources.length === 0) return ['Select at least one model source.'];
		if (!proposal.copyrightOwnership.trim())
			return ['Explain copyright ownership and permissions.'];
		if (wordCount(proposal.copyrightOwnership) > 150)
			return ['Copyright ownership must be 150 words or fewer.'];
	} else {
		if (!proposal.digitisationSituation.trim()) return ['Describe the digitisation situation.'];
		if (wordCount(proposal.digitisationSituation) > 150)
			return ['Digitisation situation must be 150 words or fewer.'];
	}
	if (proposal.supportingLinks?.some((link) => !isProposalLink(link)))
		return ['Supporting links must be valid HTTP or HTTPS URLs.'];
	return [];
}

export function isProposalLink(value: string): boolean {
	try {
		const url = new URL(value);
		return ['https:', 'http:'].includes(url.protocol);
	} catch {
		return false;
	}
}

export function proposalIsDirty(saved: string, current: string): boolean {
	return saved !== current;
}
