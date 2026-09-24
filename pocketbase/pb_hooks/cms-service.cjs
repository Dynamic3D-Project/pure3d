const editionIdPattern = /^[a-zA-Z0-9_-]{1,64}$/;
function attribute(tag, name) {
	const match = tag.match(new RegExp(`(?:^|\\s)${name}=(['"])(.*?)\\1`, 'i'));
	return match ? match[2] : null;
}
function safeComponentUrl(value) {
	return /^\/(?![\\/])/.test(value) || /^(https?:\/\/[^\s]+|mailto:[^\s]+)$/i.test(value);
}
function validateComponentHtml(html) {
	for (const match of html.matchAll(/\sdata-cms-[\w-]+=(['"])(.*?)\1/gi)) {
		if (/[<>]/.test(match[2])) return 'Invalid content component.';
	}
	for (const tag of html.matchAll(/<([a-z][\w-]*)\b[^>]*>/gi)) {
		const [, tagName] = tag;
		for (const match of tag[0].matchAll(/\s(data-cms-[\w-]+)=(['"])(.*?)\2/gi)) {
			const [, name, , value] = match;
			if (
				(name === 'data-cms-callout' &&
					tagName === 'aside' &&
					['info', 'success', 'warning'].includes(value)) ||
				(name === 'data-cms-actions' && tagName === 'div' && value === 'true') ||
				(name === 'data-cms-action' &&
					tagName === 'a' &&
					['primary', 'secondary'].includes(value)) ||
				(name === 'data-cms-expandable' && tagName === 'details' && value === 'true') ||
				(name === 'data-cms-editions' &&
					tagName === 'div' &&
					value.split(',').length <= 24 &&
					value.split(',').every((id) => editionIdPattern.test(id.trim())))
			)
				continue;
			return 'Invalid content component.';
		}
	}
	for (const tag of html.matchAll(
		/<a\b[^>]*\bdata-cms-action=(['"])(?:primary|secondary)\1[^>]*>/gi
	)) {
		const href = attribute(tag[0], 'href');
		if (!href || !safeComponentUrl(href)) return 'Unsafe content component link.';
	}
	return null;
}
function validateContent(e) {
	const r = e.record,
		kind = r.getString('kind'),
		layout = r.getString('layout');
	const componentError = validateComponentHtml(r.getString('body'));
	if (componentError) throw new BadRequestError(componentError);
	if (
		r.original().getString('slug') === 'documentation' &&
		r.original().getString('layout') === 'guide' &&
		(r.getString('slug') !== 'documentation' || layout !== 'guide' || r.getString('parent'))
	)
		throw new BadRequestError(
			'The documentation landing URL and root position are reserved. Its title and content remain editable.'
		);
	if (
		(kind === 'post' && layout !== 'article') ||
		(kind === 'page' && !['standard', 'guide'].includes(layout))
	)
		throw new BadRequestError('Choose a valid page or post layout.');
	let parent = r.getString('parent');
	const seen = new Set([r.id]);
	if (kind === 'post' && parent) throw new BadRequestError('Posts cannot have parent pages.');
	while (parent) {
		if (seen.has(parent)) throw new BadRequestError('Page hierarchy cannot contain a cycle.');
		seen.add(parent);
		const node = e.app.findRecordById('content', parent);
		if (node.getString('kind') !== 'page' || node.getString('layout') !== layout)
			throw new BadRequestError('Parent page must use the same layout.');
		if (r.getBool('isPublished') && !node.getBool('isPublished'))
			throw new BadRequestError('Publish the parent page first.');
		parent = node.getString('parent');
	}
	const children = e.app.findRecordsByFilter('content', 'parent = {:id}', '', 0, 0, { id: r.id });
	if (children.some((c) => c.getString('layout') !== layout))
		throw new BadRequestError('Move child pages before changing this layout.');
	if (!r.getBool('isPublished') && children.some((c) => c.getBool('isPublished')))
		throw new BadRequestError('Unpublish child pages first.');
	e.next();
}
function validateMenu(e) {
	let config;
	try {
		config = JSON.parse(e.record.getString('config'));
	} catch {
		throw new BadRequestError('Invalid menu configuration.');
	}
	const ids = new Set();
	const live = e.record.collection().name === 'cms_menus';
	function identity(item) {
		if (
			!item ||
			typeof item.id !== 'string' ||
			!item.id ||
			ids.has(item.id) ||
			typeof item.label !== 'string' ||
			!item.label.trim()
		)
			throw new BadRequestError('Menu items need unique IDs and labels.');
		ids.add(item.id);
	}
	function link(item) {
		identity(item);
		const t = item.target;
		if (
			!t ||
			!['content', 'category', 'collection', 'edition', 'route', 'external'].includes(t.type) ||
			typeof t.value !== 'string' ||
			!t.value
		)
			throw new BadRequestError('Select a valid link destination.');
		if (
			t.type === 'external' &&
			!(
				/^https?:\/\/[^\s]+$/i.test(t.value) ||
				/^mailto:[^\s]+$/i.test(t.value) ||
				/^\/(?!\/)[^\\\s]*$/.test(t.value)
			)
		)
			throw new BadRequestError('Unsafe link URL.');
		if (
			t.type === 'route' &&
			!['/', '/collections', '/editions', '/resources', '/demo', '/profile', '/reviews'].includes(
				t.value
			)
		)
			throw new BadRequestError('Unknown application route.');
		const collection =
			t.type === 'content'
				? 'content'
				: t.type === 'category'
					? 'cms_categories'
					: t.type === 'collection'
						? 'collections'
						: t.type === 'edition'
							? 'editions'
							: '';
		if (collection) {
			let record;
			try {
				record = e.app.findRecordById(collection, t.value);
			} catch {
				throw new BadRequestError('Select an existing link destination.');
			}
			if (
				live &&
				((t.type === 'content' && !record.getBool('isPublished')) ||
					(t.type === 'collection' && !record.getBool('isVisible')) ||
					(t.type === 'edition' && !record.getBool('isPublished')))
			)
				throw new BadRequestError('Publish the link destination before publishing this menu.');
		}
	}
	function introduction(item) {
		if (
			item != null &&
			(typeof item !== 'object' ||
				typeof item.heading !== 'string' ||
				!item.heading.trim() ||
				typeof item.description !== 'string' ||
				!item.description.trim())
		)
			throw new BadRequestError('Menu introductions need a heading and description.');
	}
	if (!config || !Array.isArray(config.items) || config.items.length > 30)
		throw new BadRequestError('Invalid menu configuration.');
	for (const item of config.items) {
		identity(item);
		if (!Array.isArray(item.groups) || item.groups.length > 20)
			throw new BadRequestError('Invalid menu groups.');
		introduction(item.introduction);
		if (item.direct && item.landing)
			throw new BadRequestError('A direct menu cannot also have a landing link.');
		if (item.direct) link(item.direct);
		if (item.landing) link(item.landing);
		for (const group of item.groups) {
			identity(group);
			if (!Array.isArray(group.links) || group.links.length > 200)
				throw new BadRequestError('Invalid menu links.');
			group.links.forEach(link);
		}
		if (item.featured) link(item.featured.link);
	}
	if (config.primary) link(config.primary);
	if (config.helpLink) link(config.helpLink);
	e.next();
}
function enforceMenuVersion(e) {
	const expected = e.requestInfo().headers['x_pure3d_menu_version'];
	e.app.runInTransaction((tx) => {
		e.app = tx;
		const current = tx.findRecordById(e.record.collection().name, e.record.id);
		if (!expected || expected !== current.getString('updated'))
			throw new BadRequestError('This menu changed. Reload before saving.');
		e.next();
	});
}
function deleteContent(e) {
	if (e.record.getString('layout') === 'guide' && e.record.getString('slug') === 'documentation')
		throw new BadRequestError(
			'The documentation landing page is required. Edit or unpublish it instead.'
		);
	if (e.app.findRecordsByFilter('content', 'parent = {:id}', '', 1, 0, { id: e.record.id }).length)
		throw new BadRequestError('Move or delete child pages first.');
	e.next();
}
function deleteMedia(e) {
	const needle = '/' + e.record.id + '/';
	if (
		e.app.findRecordsByFilter('content', 'body ~ {:needle} || coverUrl ~ {:needle}', '', 1, 0, {
			needle
		}).length
	)
		throw new BadRequestError('This file is used by a page or post. Remove its references first.');
	e.next();
}
module.exports = {
	validateContent,
	validateComponentHtml,
	validateMenu,
	enforceMenuVersion,
	deleteContent,
	deleteMedia
};
