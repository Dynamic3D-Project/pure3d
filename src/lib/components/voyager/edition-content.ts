export interface EditionContentItem {
	id: string;
	title: string;
	tags: string[];
	steps: number;
}

type ContentRecord = Record<string, unknown>;

export function parseAnnotationCategories(value: unknown): string[] {
	return typeof value === 'string'
		? [
				...new Set(
					value
						.split(',')
						.map((tag) => tag.trim())
						.filter(Boolean)
				)
			]
		: [];
}

export function filterAnnotations(
	items: EditionContentItem[],
	activeCategories: string[]
): EditionContentItem[] {
	const categories = new Set(items.flatMap((item) => item.tags));
	if (!categories.size) return items;
	const selected = new Set(activeCategories);
	if (!selected.size) return [];
	if ([...categories].every((category) => selected.has(category))) return items;
	return items.filter((item) => item.tags.some((category) => selected.has(category)));
}

function record(value: unknown): ContentRecord {
	return value && typeof value === 'object' ? (value as ContentRecord) : {};
}

function strings(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.filter((entry): entry is string => typeof entry === 'string' && !!entry.trim());
	}
	return typeof value === 'string' && value.trim() ? [value] : [];
}

function localized(
	item: ContentRecord,
	singular: string,
	plural: string,
	language: string
): string[] {
	const translations = record(item[plural]);
	const code = language.toUpperCase();
	const translated =
		translations[code] ?? translations[code.toLowerCase()] ?? translations.EN ?? translations.en;
	return strings(translated).length ? strings(translated) : strings(item[singular]);
}

export function localizedValue(
	item: unknown,
	singular: string,
	plural: string,
	language: string
): string {
	const content = record(item);
	const value = localized(content, singular, plural, language)[0];
	if (value) return value.trim();
	return Object.values(record(content[plural])).flatMap(strings)[0]?.trim() ?? '';
}

export function normalizeEditionContent(
	items: unknown[],
	language: string,
	kind: 'annotation' | 'story' | 'tour'
): EditionContentItem[] {
	return items.map((item, index) => {
		const content = record(item);
		const tags = [
			...new Set([...strings(content.tags), ...localized(content, 'tags', 'taglist', language)])
		];
		const id = typeof content.id === 'string' ? content.id : '';

		return {
			id,
			title:
				localizedValue(item, 'title', 'titles', language) ||
				id ||
				`${kind === 'story' ? 'Story' : kind === 'tour' ? 'Guided tour' : 'Annotation'} ${index + 1}`,
			tags,
			steps: Array.isArray(content.steps) ? content.steps.length : 0
		};
	});
}
