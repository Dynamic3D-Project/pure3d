/* eslint-disable @typescript-eslint/no-require-imports -- PocketBase handlers use isolated Goja contexts. */
onRecordValidate((e) => require(__hooks + '/cms-service.cjs').validateContent(e), 'content');
onRecordValidate(
	(e) => require(__hooks + '/cms-service.cjs').validateMenu(e),
	'cms_menus',
	'cms_menu_drafts'
);
onRecordUpdateRequest(
	(e) => require(__hooks + '/cms-service.cjs').enforceMenuVersion(e),
	'cms_menus',
	'cms_menu_drafts'
);
onRecordDeleteRequest((e) => require(__hooks + '/cms-service.cjs').deleteContent(e), 'content');
onRecordDeleteRequest(
	(e) => require(__hooks + '/cms-service.cjs').deleteMedia(e),
	'content_assets'
);
