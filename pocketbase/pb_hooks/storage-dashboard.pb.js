routerAdd(
	'GET',
	'/api/pure3d/storage',
	(event) => {
		if (!event.auth || event.auth.getString('role') !== 'admin') {
			throw new ForbiddenError('Administrator access required.');
		}
		let filesystem;
		try {
			filesystem = event.app.newFilesystem();
			const objects = filesystem
				.list('')
				.filter((object) => !object.isDir)
				.map((object) => ({
					key: object.key,
					size: object.size,
					modified: object.modTime.format('2006-01-02T15:04:05.000Z07:00')
				}));
			return event.json(200, {
				bucket: event.app.settings().s3.bucket || 'local storage',
				objects
			});
		} finally {
			filesystem?.close();
		}
	},
	$apis.requireAuth('users')
);

routerAdd(
	'GET',
	'/api/pure3d/storage/download',
	(event) => {
		if (!event.auth || event.auth.getString('role') !== 'admin') {
			throw new ForbiddenError('Administrator access required.');
		}
		const key = event.request.url.query().get('key');
		if (!key || key.startsWith('/') || key.split('/').includes('..')) {
			throw new BadRequestError('Invalid object key.');
		}
		let filesystem;
		try {
			filesystem = event.app.newFilesystem();
			filesystem.serve(event.response, event.request, key, key.split('/').pop());
		} finally {
			filesystem?.close();
		}
	},
	$apis.requireAuth('users')
);

routerAdd(
	'DELETE',
	'/api/pure3d/storage',
	(event) => {
		if (!event.auth || event.auth.getString('role') !== 'admin') {
			throw new ForbiddenError('Administrator access required.');
		}
		const key = event.request.url.query().get('key');
		if (!key || key.startsWith('/') || key.split('/').includes('..')) {
			throw new BadRequestError('Invalid object key.');
		}
		const expectedSizeValue = event.request.url.query().get('size');
		const expectedModified = event.request.url.query().get('modified');
		if (expectedSizeValue === null || expectedSizeValue.trim() === '' || !expectedModified) {
			throw new BadRequestError('Object version is required.');
		}
		const expectedSize = Number(expectedSizeValue);
		if (!Number.isFinite(expectedSize)) throw new BadRequestError('Invalid object size.');
		let filesystem;
		try {
			filesystem = event.app.newFilesystem();
			if (!filesystem.exists(key)) throw new NotFoundError('Object not found.');
			const attributes = filesystem.attributes(key);
			const modified = attributes.modTime.format('2006-01-02T15:04:05.000Z07:00');
			if (attributes.size !== expectedSize || modified !== expectedModified) {
				throw new ApiError(
					409,
					'Object changed since the inventory was loaded. Refresh and retry.'
				);
			}
			filesystem.delete(key);
			return event.noContent(204);
		} finally {
			filesystem?.close();
		}
	},
	$apis.requireAuth('users')
);
