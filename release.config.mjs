// Checks/build run locally; GitHub receives the exact prebuilt archive.
export default {
	repository: 'PURE3D-EU/pure3d',
	checks: [
		['bun', '--no-env-file', 'test', 'src', 'scripts', 'pocketbase'],
		['bun', '--no-env-file', 'run', 'check'],
		[
			'curl',
			'--fail',
			'--silent',
			'--show-error',
			'--max-time',
			'30',
			'https://api.pure3d.eu/api/pure3d/orcid/ready'
		]
	],
	buildEnv: {
		APP_BASE_PATH: '',
		PUBLIC_POCKETBASE_URL: 'https://api.pure3d.eu',
		PUBLIC_ASSET_BASE_URL: 'https://api.pure3d.eu/assets'
	}
};
