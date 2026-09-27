function pageSize(value) {
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed < 1) return 25;
	return Math.min(parsed, 100);
}
function validPrefix(value) {
	return !value.startsWith('/') && !value.split('/').includes('..');
}
function pageObjects(objects, cursor, limit) {
	objects.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
	const result = [];
	let hasMore = false;
	for (const object of objects) {
		if (object.isDir || (cursor && object.key <= cursor)) continue;
		if (result.length === limit) {
			hasMore = true;
			break;
		}
		result.push(object);
	}
	return { objects: result, hasMore, nextCursor: hasMore ? result[result.length - 1].key : '' };
}
module.exports = { pageObjects, pageSize, validPrefix };
