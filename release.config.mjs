const parserOpts = {
	headerPattern: /^(\w*)(?:\((.*)\))?!?: (.*)$/,
	headerCorrespondence: ['type', 'scope', 'subject'],
	breakingHeaderPattern: /^(\w*)(?:\((.*)\))?!: (.*)$/,
	breakingHeaderCorrespondence: ['type', 'scope', 'subject'],
	noteKeywords: ['BREAKING CHANGE', 'BREAKING CHANGES']
};

const github = [
	'@semantic-release/github',
	{
		assets: [{ path: 'pure3d-v*.tar.gz', label: 'Production site artifact' }],
		successComment: false,
		failComment: false,
		failTitle: false,
		labels: false,
		releasedLabels: false
	}
];

export default {
	branches: ['main'],
	tagFormat: 'v${version}',
	plugins: [
		[
			'@semantic-release/commit-analyzer',
			{
				parserOpts,
				releaseRules: [
					{ type: '*', release: false },
					{ breaking: true, release: 'major' },
					{ type: 'feat', release: 'minor' },
					{ type: 'fix', release: 'patch' }
				]
			}
		],
		['@semantic-release/release-notes-generator', { parserOpts }],
		'./scripts/release-build.mjs',
		...(process.env.SEMANTIC_RELEASE_LOCAL === '1' ? [] : [github])
	]
};
