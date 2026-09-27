// Test-only fixture copied into a disposable PocketBase hooks directory.
onBootstrap((event) => {
	event.next();
	const definitions = JSON.parse(toString($os.readFile(__hooks + '/feedback-schema.json')));
	for (const definition of definitions) {
		const collection = new Collection({ name: definition.name, type: 'base' });
		for (const field of definition.fields) collection.fields.add(new Field(field));
		for (const rule of ['listRule', 'viewRule', 'createRule', 'updateRule', 'deleteRule'])
			collection[rule] = '';
		event.app.save(collection);
	}
	const root = new Record(event.app.findCollectionByNameOrId('_superusers'), {
		email: 'root@example.test'
	});
	root.setPassword('local-test-password-only');
	event.app.save(root);
});
