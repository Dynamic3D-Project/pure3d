// Initial menu content only. Runtime navigation is edited in PocketBase through Admin → Menus.
const p = (label: string, slug: string) => ({ label, href: `/resources/${slug}` });
export const navigation = [
	{
		label: 'Explore',
		groups: [
			{
				label: 'Discover 3D scholarship',
				prominent: true,
				links: [
					{ label: 'Collections', href: '/collections' },
					{ label: 'Editions', href: '/editions' },
					p('Forthcoming editions', 'forthcoming-editions')
				]
			},
			{
				label: 'Start exploring',
				links: [
					{ label: 'Try the demo', href: '/demo' },
					p('Pilot projects & partners', 'pilot-projects'),
					p('3D Registry', '3d-registry')
				]
			}
		]
	},
	{
		label: 'Publish',
		groups: [
			{
				label: 'Share your research',
				prominent: true,
				links: [
					p('Publication process', 'publication-process'),
					p('Submission guidelines', 'submission-guidelines'),
					p('Start a submission', 'start-submission')
				]
			},
			{
				label: 'Review & quality',
				links: [
					p('Evaluation criteria', 'evaluation-guidelines'),
					p('Editorial board & reviewers', 'editorial-board-reviewers')
				]
			},
			{
				label: 'Help along the way',
				links: [
					{ label: 'Documentation', href: '/documentation' },
					p('3D model FAQ', '3d-model-faq-troubleshooting'),
					p('Contact us', 'contact')
				]
			}
		]
	},
	{
		label: 'Resources',
		groups: [
			{
				label: 'Ideas & updates',
				prominent: true,
				links: [
					{ label: 'All resources', href: '/resources' },
					{ label: 'News', href: '/resources?kind=news' },
					{ label: 'Articles & stories', href: '/resources?kind=article' },
					{ label: 'Publications', href: '/resources?kind=publication' }
				]
			},
			{
				label: 'Learn & take part',
				links: [
					{ label: 'Presentations & workshops', href: '/resources?kind=presentation' },
					p('Video & multimedia', 'multimedia'),
					p('Voyager tutorials', 'voyager-video-tutorials'),
					p('3D model FAQ', '3d-model-faq-troubleshooting'),
					{ label: 'Documentation', href: '/documentation' }
				]
			},
			{
				label: 'Research initiatives',
				links: [
					p('PURE3D 2.0', 'pure3d-2-0'),
					p('OPER3D', 'oper3d'),
					p('Dynamic3D', 'dynamic3d'),
					p('Paradata in 3D Scholarship', 'paradata-in-3d-scholarship')
				]
			}
		]
	},
	{
		label: 'About',
		groups: [
			{
				label: 'Meet PURE3D',
				prominent: true,
				links: [p('Our mission', 'about'), p('Team', 'team'), p('Contact', 'contact')]
			},
			{
				label: 'People & partnerships',
				links: [
					p('Governance & advisory board', 'governance'),
					p('Pilot projects & partners', 'pilot-projects'),
					p('Testimonials', 'testimonials')
				]
			},
			{
				label: 'Our partners',
				links: [
					p('DANS', 'dans'),
					p('CLARIAH', 'clariah'),
					p('4D Research Lab', '4d-research-lab'),
					p('Erfgoed Leiden en Omstreken', 'erfgoed-leiden-en-omstreken')
				]
			}
		]
	}
];
