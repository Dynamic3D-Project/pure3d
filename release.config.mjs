// Checks/build run locally; GitHub receives the exact prebuilt archive.
export default {
	repository: 'Dynamic3D-Project/pure3d',
	checks: [
		['bun', '--no-env-file', 'test', 'src', 'scripts', 'pocketbase/tests/orcid.test.ts'],
		['bun', '--no-env-file', 'run', 'check'],
		[
			'curl',
			'--fail',
			'--silent',
			'--show-error',
			'--max-time',
			'30',
			'https://main.57-129-98-223.sslip.io/api/pure3d/orcid/ready'
		]
	],
	buildEnv: {
		APP_BASE_PATH: '/pure3d',
		PUBLIC_POCKETBASE_URL: 'https://main.57-129-98-223.sslip.io',
		PUBLIC_ASSET_BASE_URL: 'https://main.57-129-98-223.sslip.io/assets'
	}
};
