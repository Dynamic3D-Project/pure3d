#!/usr/bin/env bun
/**
 * Migration: Documentation Pages
 *
 * 1. Creates `documentation` collection (title, slug, content, summary, order, isPublished)
 * 2. Seeds 7 initial documentation pages with placeholder content
 *
 * Idempotent — safe to re-run.
 *
 * Run: bun scripts/migrate-documentation.ts
 */

const PB_URL = process.env.POCKETBASE_URL || 'http://127.0.0.1:8090';
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL || 'admin@admin.local';
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD || '1234567890';

let authToken = '';

async function authenticate() {
	const response = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			identity: ADMIN_EMAIL,
			password: ADMIN_PASSWORD
		})
	});

	if (!response.ok) {
		throw new Error(`Auth failed: ${await response.text()}`);
	}

	const data = await response.json();
	authToken = data.token;
	console.log('Authenticated as superuser\n');
}

async function apiRequest(path: string, method = 'GET', body?: unknown) {
	const response = await fetch(`${PB_URL}${path}`, {
		method,
		headers: {
			'Content-Type': 'application/json',
			Authorization: authToken
		},
		body: body ? JSON.stringify(body) : undefined
	});

	const text = await response.text();
	if (!response.ok) {
		throw new Error(`${method} ${path} failed (${response.status}): ${text}`);
	}
	return text ? JSON.parse(text) : null;
}

async function collectionExists(name: string): Promise<boolean> {
	try {
		await apiRequest(`/api/collections/${name}`);
		return true;
	} catch {
		return false;
	}
}

// --- Step 1: Create documentation collection ---
async function createDocumentationCollection() {
	console.log('--- Step 1: Create documentation collection ---');

	if (await collectionExists('documentation')) {
		console.log('  documentation already exists, skipping\n');
		return;
	}

	await apiRequest('/api/collections', 'POST', {
		name: 'documentation',
		type: 'base',
		fields: [
			{ name: 'title', type: 'text', required: true },
			{ name: 'slug', type: 'text', required: true },
			{ name: 'content', type: 'editor', required: false },
			{ name: 'summary', type: 'text', required: false },
			{ name: 'order', type: 'number', required: false },
			{ name: 'isPublished', type: 'bool', required: false }
		],
		indexes: [
			'CREATE UNIQUE INDEX idx_documentation_slug ON documentation (slug)',
			'CREATE INDEX idx_documentation_order ON documentation ("order")',
			'CREATE INDEX idx_documentation_published ON documentation (isPublished)'
		],
		listRule: '',
		viewRule: '',
		createRule: '@request.auth.id != ""',
		updateRule: '@request.auth.id != ""',
		deleteRule: '@request.auth.id != ""'
	});

	console.log('  Created documentation collection\n');
}

// --- Step 2: Seed initial documentation pages ---
const SEED_PAGES = [
	{
		title: 'Submission Guidelines',
		slug: 'submission',
		order: 1,
		isPublished: true,
		summary: 'How to submit a 3D scholarly edition to PURE3D.',
		content: `<h2>Submitting Your 3D Scholarly Edition</h2>
<p>PURE3D welcomes submissions of 3D scholarly editions from researchers across the humanities and social sciences. This guide walks you through the submission process.</p>
<h3>Before You Begin</h3>
<ul>
<li>Ensure your 3D model is in a supported format (GLB, GLTF, OBJ, or PLY)</li>
<li>Prepare your annotations and contextual materials</li>
<li>Review our <a href="/documentation/evaluation">evaluation criteria</a></li>
</ul>
<h3>Submission Process</h3>
<ol>
<li>Create an account on the PURE3D platform</li>
<li>Start a new project and create an edition</li>
<li>Upload your 3D model and add annotations, articles, and tours</li>
<li>Submit your edition for peer review</li>
</ol>
<p>For detailed instructions on using the platform, see the <a href="/documentation/platform-guide">Platform Guide</a>.</p>`
	},
	{
		title: 'Evaluation Criteria',
		slug: 'evaluation',
		order: 2,
		isPublished: true,
		summary: 'Criteria used to evaluate 3D scholarly editions.',
		content: `<h2>Evaluation Criteria</h2>
<p>All submissions to PURE3D undergo peer review. Reviewers assess editions against the following criteria.</p>
<h3>Scholarly Merit</h3>
<ul>
<li>Originality and significance of the research contribution</li>
<li>Quality and depth of the scholarly argument</li>
<li>Appropriate use of 3D as a medium for the research question</li>
</ul>
<h3>Technical Quality</h3>
<ul>
<li>Model accuracy and resolution</li>
<li>Appropriate use of annotations and contextual materials</li>
<li>Navigation and user experience</li>
</ul>
<h3>Documentation</h3>
<ul>
<li>Completeness of paradata (decision-making documentation)</li>
<li>Metadata quality and standards compliance</li>
<li>Citation and attribution practices</li>
</ul>`
	},
	{
		title: 'Review Process',
		slug: 'review',
		order: 3,
		isPublished: true,
		summary: 'How the peer review process works for 3D editions.',
		content: `<h2>Peer Review Process</h2>
<p>PURE3D uses a structured multi-stage peer review process to ensure the quality of published 3D scholarly editions.</p>
<h3>Review Stages</h3>
<ol>
<li><strong>Concept Review</strong> — An initial assessment of the project proposal and its suitability for PURE3D.</li>
<li><strong>Alpha Review</strong> — Review of the first complete draft, focusing on scholarly content and technical implementation.</li>
<li><strong>Final Review</strong> — Assessment of the revised edition, ensuring all feedback has been addressed.</li>
</ol>
<h3>For Reviewers</h3>
<p>If you have been invited as a reviewer, you can access your assignments from the <strong>My Work</strong> page. Each assignment includes the edition to review, the evaluation criteria, and a feedback form.</p>
<h3>Timeline</h3>
<p>Each review stage typically takes 2–4 weeks. Authors receive detailed feedback and have the opportunity to revise their work between stages.</p>`
	},
	{
		title: 'Platform Guide',
		slug: 'platform-guide',
		order: 4,
		isPublished: true,
		summary: 'How to use the PURE3D platform for creating and managing editions.',
		content: `<h2>Platform Guide</h2>
<p>This guide covers the key features of the PURE3D platform for authors and editors.</p>
<h3>Getting Started</h3>
<ol>
<li>Register for an account and complete your profile</li>
<li>Create a new project from the dashboard</li>
<li>Add an edition to your project</li>
</ol>
<h3>Working with the 3D Viewer</h3>
<p>The PURE3D viewer is based on Voyager, a powerful tool for presenting and annotating 3D models. Key features include:</p>
<ul>
<li><strong>Annotations</strong> — Add interactive annotations to specific points on your model</li>
<li><strong>Articles</strong> — Write rich text articles that accompany your edition</li>
<li><strong>Tours</strong> — Create guided tours that walk viewers through your edition</li>
</ul>
<h3>Managing Your Edition</h3>
<p>Track the status of your edition from the dashboard. You can edit, preview, and submit your work at any stage.</p>`
	},
	{
		title: 'Tutorials',
		slug: 'tutorials',
		order: 5,
		isPublished: true,
		summary: 'Step-by-step tutorials for common tasks on PURE3D.',
		content: `<h2>Tutorials</h2>
<p>Step-by-step guides to help you get the most out of PURE3D.</p>
<h3>Creating Your First Edition</h3>
<p>Learn how to create a project, upload a 3D model, and publish your first edition. See the <a href="/documentation/platform-guide">Platform Guide</a> for an overview of the tools available.</p>
<h3>Adding Annotations</h3>
<p>Annotations are the core of a 3D scholarly edition. They allow you to attach interpretive content directly to points on your model.</p>
<h3>Writing Articles</h3>
<p>Articles provide space for extended scholarly discussion that accompanies your 3D edition.</p>
<h3>Building a Tour</h3>
<p>Tours guide viewers through your edition in a structured sequence, highlighting key features and arguments.</p>
<p>More tutorials will be added as the platform evolves. If you have suggestions, please contact the PURE3D team.</p>`
	},
	{
		title: 'FAQ',
		slug: 'faq',
		order: 6,
		isPublished: true,
		summary: 'Frequently asked questions about PURE3D.',
		content: `<h2>Frequently Asked Questions</h2>
<h3>What file formats are supported?</h3>
<p>PURE3D supports GLB, GLTF, OBJ, and PLY formats for 3D models.</p>
<h3>Is there a file size limit?</h3>
<p>We recommend keeping individual model files under 100MB for optimal loading performance. Contact the team if you need to work with larger files.</p>
<h3>Can I update my edition after publication?</h3>
<p>Published editions are versioned. You can create a new version of your edition with updates while preserving the original published version.</p>
<h3>How long does peer review take?</h3>
<p>Each review stage typically takes 2–4 weeks. The complete process from submission to publication usually spans 2–3 months.</p>
<h3>Who can I contact for support?</h3>
<p>For technical support or questions about the platform, contact the PURE3D team through the platform or visit <a href="https://pure3d.eu/">pure3d.eu</a>.</p>`
	},
	{
		title: 'Examples',
		slug: 'examples',
		order: 7,
		isPublished: true,
		summary: 'Examples of published 3D scholarly editions.',
		content: `<h2>Published 3D Scholarly Editions</h2>
<p>Browse examples of 3D scholarly editions published through PURE3D to see what is possible with the platform.</p>
<h3>Featured Editions</h3>
<p>Published editions can be found in the <a href="/collections">Collections</a> section of the platform. Each edition demonstrates different approaches to 3D scholarship.</p>
<h3>What Makes a Good Edition</h3>
<ul>
<li><strong>Rich annotations</strong> — Meaningful annotations that connect the 3D model to the scholarly narrative</li>
<li><strong>Contextual articles</strong> — Well-written articles that provide depth and context</li>
<li><strong>Guided tours</strong> — Tours that help viewers understand the key arguments</li>
<li><strong>Complete paradata</strong> — Transparent documentation of modeling decisions</li>
</ul>
<p>We encourage prospective authors to review existing editions before starting their own submissions. For submission guidelines, see the <a href="/documentation/submission">Submission Guidelines</a>.</p>`
	}
];

async function seedDocumentationPages() {
	console.log('--- Step 2: Seed documentation pages ---');

	for (const page of SEED_PAGES) {
		// Check if page with this slug already exists
		try {
			const existing = await apiRequest(
				`/api/collections/documentation/records?filter=slug="${page.slug}"&fields=id,slug`
			);
			if (existing.items && existing.items.length > 0) {
				console.log(`  "${page.title}" (${page.slug}) already exists, skipping`);
				continue;
			}
		} catch {
			// Collection might be empty, continue
		}

		await apiRequest('/api/collections/documentation/records', 'POST', page);
		console.log(`  Seeded "${page.title}" (${page.slug})`);
	}

	console.log('');
}

// --- Main ---
async function main() {
	console.log('Documentation Pages Migration\n');
	console.log(`PocketBase URL: ${PB_URL}\n`);

	await authenticate();
	await createDocumentationCollection();
	await seedDocumentationPages();

	console.log('Migration complete!');
}

main().catch((err) => {
	console.error('Migration failed:', err);
	process.exit(1);
});
