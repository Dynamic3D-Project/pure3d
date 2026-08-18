const SEARCHABLE_FIELDS = [
	'title',
	'description',
	'authors',
	'tags',
	'dcTitle',
	'dcSubtitle',
	'dcAbstract',
	'dcDescription',
	'dcCreator',
	'dcContributor',
	'dcInstitution',
	'dcContact',
	'dcSubject',
	'dcKeyword',
	'dcAudience',
	'dcLanguage',
	'dcSource',
	'dcCoveragePeriod',
	'dcCoveragePlace',
	'dcCoverageCountry',
	'dcCoverageTemporal',
	'dcCoverageGeo',
	'dcRightsHolder',
	'dcRightsLicense',
	'dcDatePublished',
	'dcDateUnPublished',
	'dcDateCreated',
	'dcDateModified',
	'dcFunder',
	'dcProvenance',
	'dcDoi'
] as const;

export function editionMatchesQuery(edition: object, query: string): boolean {
	const normalizedQuery = query.trim().toLowerCase();
	if (!normalizedQuery) return true;
	const record = edition as Record<string, unknown>;

	return SEARCHABLE_FIELDS.some((field) => {
		const value = record[field];
		const values = Array.isArray(value) ? value : [value];
		return values.some(
			(item) => typeof item === 'string' && item.toLowerCase().includes(normalizedQuery)
		);
	});
}
