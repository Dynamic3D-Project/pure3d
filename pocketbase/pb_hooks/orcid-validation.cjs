// CommonJS and synchronous JS: shared by Bun tests and PocketBase's Goja runtime.
function orcidEndpoints(issuer) {
	if (issuer !== 'https://orcid.org' && issuer !== 'https://sandbox.orcid.org')
		throw new Error('Unsupported ORCID issuer');
	return {
		issuer,
		publicApi:
			issuer === 'https://orcid.org' ? 'https://pub.orcid.org' : 'https://pub.sandbox.orcid.org'
	};
}

function canonicalOrcid(value) {
	if (typeof value !== 'string') throw new Error('Invalid ORCID');
	const id = value.replace(/^https:\/\/orcid\.org\//, '');
	if (!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(id)) throw new Error('Invalid ORCID');
	const digits = id.replace(/-/g, '');
	let total = 0;
	for (let i = 0; i < 15; i++) total = (total + Number(digits[i])) * 2;
	const check = (12 - (total % 11)) % 11;
	if (digits[15] !== (check === 10 ? 'X' : String(check)))
		throw new Error('Invalid ORCID checksum');
	return 'https://orcid.org/' + id;
}

function subjectOrcid(value) {
	if (typeof value !== 'string' || value.indexOf('/') !== -1)
		throw new Error('Invalid ORCID subject');
	return canonicalOrcid(value);
}

function verified(user) {
	return !!(
		user &&
		user.orcidVerifiedAt &&
		user.orcid &&
		canonicalOrcid(user.orcid) === user.orcid
	);
}

function sameCredit(a, b) {
	return (
		a === b ||
		(!!a &&
			!!b &&
			typeof a === 'object' &&
			typeof b === 'object' &&
			Object.keys(a).length === Object.keys(b).length &&
			Object.keys(a).every((key) => a[key] === b[key]))
	);
}

function sameCredits(a, b) {
	return (
		a === b ||
		(Array.isArray(a) &&
			Array.isArray(b) &&
			a.length === b.length &&
			a.every((credit, index) => sameCredit(credit, b[index])))
	);
}

function credits(value, previous, requireCreators, lookupUser) {
	if (!Array.isArray(value) || value.length > 200)
		throw new Error('credits must be an array (max 200)');
	let creators = 0;
	const result = value.map((credit) => {
		if (!credit || typeof credit !== 'object' || Array.isArray(credit))
			throw new Error('Invalid credit');
		const allowed = ['type', 'name', 'orcid', 'role', 'provenance', 'userId', 'contributionRole'];
		if (Object.keys(credit).some((key) => allowed.indexOf(key) === -1))
			throw new Error('Unknown credit field');
		if (
			['person', 'org'].indexOf(credit.type) === -1 ||
			['creator', 'contributor'].indexOf(credit.role) === -1 ||
			['manual', 'oauth'].indexOf(credit.provenance) === -1
		)
			throw new Error('Invalid credit type, role or provenance');
		if (typeof credit.name !== 'string' || !credit.name.trim() || credit.name.length > 500)
			throw new Error('Credit name is required (max 500)');
		if (credit.orcid !== null && typeof credit.orcid !== 'string')
			throw new Error('Credit ORCID must be a string or null');
		const out = {
			type: credit.type,
			name: credit.name,
			orcid: credit.orcid === null ? null : canonicalOrcid(credit.orcid),
			role: credit.role,
			provenance: credit.provenance
		};
		if (credit.contributionRole !== undefined) {
			if (typeof credit.contributionRole !== 'string' || credit.contributionRole.length > 200)
				throw new Error('Invalid contributionRole');
			out.contributionRole = credit.contributionRole;
		}
		if (
			credit.type === 'org' &&
			(credit.orcid !== null || credit.userId !== undefined || credit.provenance !== 'manual')
		)
			throw new Error('Organizations cannot have an ORCID, userId or OAuth provenance');
		if (credit.userId !== undefined) {
			if (typeof credit.userId !== 'string' || !/^[a-z0-9]{15}$/.test(credit.userId))
				throw new Error('Invalid credit userId');
			const user = lookupUser(credit.userId);
			if (!verified(user) || user.orcid !== out.orcid)
				throw new Error('Credit userId must agree with a verified ORCID account');
			out.userId = credit.userId;
		}
		if (credit.provenance === 'oauth' && !out.userId) {
			// Deleted accounts leave immutable proof on existing attribution, not reusable proof.
			if (!(previous || []).some((old) => sameCredit(old, out)))
				throw new Error('OAuth provenance requires a verified linked account');
		}
		if (out.role === 'creator') {
			creators++;
			if (requireCreators && out.type === 'person' && !out.orcid)
				throw new Error('Every individual creator needs an ORCID before submission or publication');
		}
		return out;
	});
	if (requireCreators && !creators)
		throw new Error('At least one creator is required before submission or publication');
	return result;
}

const transitions = {
	draft: ['concept_submitted'],
	concept_submitted: ['editorial_review'],
	editorial_review: ['concept_accepted', 'concept_rejected'],
	concept_accepted: ['alpha_review'],
	concept_rejected: ['draft'],
	alpha_review: ['alpha_accepted', 'alpha_rejected', 'alpha_revisions'],
	alpha_revisions: ['alpha_review'],
	alpha_accepted: ['final_review'],
	alpha_rejected: ['draft'],
	final_review: ['published', 'final_revisions'],
	final_revisions: ['final_review'],
	published: ['draft']
};

function reviewStage(status) {
	if (['concept_submitted', 'editorial_review'].includes(status)) return 1;
	if (['alpha_review', 'alpha_revisions'].includes(status)) return 2;
	if (['final_review', 'final_revisions'].includes(status)) return 3;
	return 0;
}

function canTransition(from, to, roles) {
	if (!(transitions[from] || []).includes(to)) return false;
	if (roles.admin) return true;
	if (to === 'published' || (from === 'published' && to === 'draft')) return roles.owner;
	if (
		to === 'concept_submitted' ||
		to === 'draft' ||
		from === 'alpha_revisions' ||
		from === 'final_revisions'
	)
		return roles.owner || roles.author;
	return roles.board || roles.reviewer;
}

function publicProfile(person, employments) {
	const text = (value, max) =>
		typeof value === 'string'
			? value
					.replace(/<[^>]*>/g, '')
					.trim()
					.slice(0, max)
			: '';
	const name = person.name || {};
	const entries = [];
	for (const group of employments['affiliation-group'] || []) {
		for (const summary of group.summaries || []) {
			const job = summary['employment-summary'];
			if (job && !job['end-date']) entries.push(job);
		}
	}
	const job = entries[0] || {};
	const urls = [];
	for (const item of (person['researcher-urls'] || {})['researcher-url'] || []) {
		const url = (item.url || {}).value;
		if (typeof url === 'string' && /^https?:\/\/[^\s<>"']+$/.test(url) && url.length <= 2000)
			urls.push(url);
	}
	return {
		nickname: text(
			(name['credit-name'] || {}).value ||
				[(name['given-names'] || {}).value, (name['family-name'] || {}).value]
					.filter(Boolean)
					.join(' '),
			500
		),
		affiliation: text((job.organization || {}).name, 1000),
		titleRole: text(job['role-title'], 500),
		bio: text((person.biography || {}).content, 10000)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;'),
		socials: urls.slice(0, 20).join('\n')
	};
}

module.exports = {
	reviewStage,
	orcidEndpoints,
	canonicalOrcid,
	subjectOrcid,
	verified,
	credits,
	sameCredits,
	canTransition,
	publicProfile
};
