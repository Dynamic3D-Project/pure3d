import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, renameSync } from 'node:fs';
import config from '../release.config.mjs';
import { createHash } from 'node:crypto';
import { publishRelease } from './release-publish';

export type Commit = { hash: string; message: string };
const semver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function classify(message: string) {
	const header = /^(\w+)(?:\([^)]+\))?(!)?: (.+)$/.exec(message.split('\n')[0]);
	if (!header) return null;
	if (header[2] || /^BREAKING(?: CHANGE| CHANGES|-CHANGE):\s*\S/m.test(message))
		return { level: 3, category: 'Breaking changes', subject: header[3] };
	if (header[1] === 'feat') return { level: 2, category: 'Features', subject: header[3] };
	if (header[1] === 'fix') return { level: 1, category: 'Fixes', subject: header[3] };
	if (header[1] === 'perf') return { level: 1, category: 'Performance', subject: header[3] };
	return null;
}

export function nextVersion(version: string, commits: Commit[]) {
	if (!semver.test(version)) throw new Error(`Invalid stable SemVer: ${version}`);
	const level = Math.max(0, ...commits.map((commit) => classify(commit.message)?.level ?? 0));
	if (!level) return null;
	const parts = version.split('.').map(BigInt);
	const index = 3 - level;
	parts[index] += 1n;
	for (let i = index + 1; i < 3; i++) parts[i] = 0n;
	return parts.join('.');
}

export function releaseNotes(version: string, date: string, commits: Commit[]) {
	const sections = ['Breaking changes', 'Features', 'Fixes', 'Performance'].flatMap((category) => {
		const entries = commits.flatMap(({ hash, message }) => {
			const change = classify(message);
			return change?.category === category ? [`- ${change.subject} (${hash.slice(0, 8)})`] : [];
		});
		return entries.length ? [`### ${category}\n\n${entries.join('\n')}`] : [];
	});
	return `## v${version} - ${date}\n\n${sections.join('\n\n')}\n`;
}

export function prependChangelog(previous: string, notes: string) {
	const heading = '# Changelog\n';
	const body = previous.startsWith(heading) ? previous.slice(heading.length).trimStart() : previous;
	if (body.includes(notes.split('\n')[0]))
		throw new Error('Changelog already contains this release');
	return `${heading}\n${notes}\n${body}`.trimEnd() + '\n';
}

export function updateCitation(source: string, version: string, date: string) {
	for (const field of ['version', 'date-released']) {
		if ((source.match(new RegExp(`^${field}:.*$`, 'gm')) ?? []).length !== 1)
			throw new Error(`Expected one CITATION.cff ${field}`);
	}
	return source
		.replace(/^version:.*$/m, `version: "${version}"`)
		.replace(/^date-released:.*$/m, `date-released: "${date}"`);
}

const git = (...args: string[]) =>
	execFileSync('git', ['--no-optional-locks', ...args], { encoding: 'utf8' }).trim();
const read = (file: string) => (existsSync(file) ? readFileSync(file, 'utf8') : null);
type State = {
	base: string;
	version: string;
	notes: string;
	files: Record<string, { before: string | null; after: string }>;
	archiveSha256?: string;
	pushed?: boolean;
	published?: boolean;
};

function main() {
	const args = process.argv.slice(2);
	if (args.some((arg) => arg !== '--dry-run'))
		throw new Error('Usage: bun scripts/release.ts [--dry-run]');
	const dry = args.includes('--dry-run');
	const plan =
		'Steps: fetch/preflight; version/changelog; checks; build/archive + SHA-256; release commit; annotated tag; atomic push main + tag; create/update draft GitHub Release; verify/upload exact archive + checksum; publish Release; tag-triggered Pages verifies and deploys archive (no build).';
	console.log(plan);
	if (dry)
		console.log(
			'Offline preview: origin/main and tags are cached; live synchronization is NOT verified.'
		);
	process.chdir(git('rev-parse', '--show-toplevel'));
	const statePath = git('rev-parse', '--git-path', 'pure3d-release.json');
	let state: State | null = read(statePath) ? JSON.parse(read(statePath)!) : null;
	const head = git('rev-parse', 'HEAD');
	const blockers: string[] = [];
	if (git('branch', '--show-current') !== 'main') blockers.push('Checkout main first.');
	if (git('rev-parse', '--is-shallow-repository') === 'true')
		blockers.push('Full Git history required.');
	const status = git('status', '--porcelain', '--untracked-files=all');
	if (!state && status) blockers.push('Working tree and index must be clean.');
	if (!dry && blockers.length) throw new Error(blockers.join('\n'));
	if (!dry) {
		const origin = git('remote', 'get-url', '--push', 'origin');
		if (
			![
				`git@github.com:${config.repository}.git`,
				`https://github.com/${config.repository}.git`,
				`https://github.com/${config.repository}`
			].includes(origin)
		)
			throw new Error('origin push URL must match configured GitHub repository.');
	}
	if (!dry)
		git(
			'fetch',
			'--no-recurse-submodules',
			'origin',
			'refs/heads/main:refs/remotes/origin/main',
			'--tags'
		);
	let remote = '';
	try {
		remote = git('rev-parse', 'refs/remotes/origin/main');
	} catch {
		blockers.push('origin/main is missing.');
	}
	if (remote && remote !== (state?.base ?? head)) {
		if (!(state && remote === head && git('rev-parse', 'HEAD^') === state.base))
			blockers.push('main must equal origin/main (no ahead/behind commits).');
	}

	if (!state) {
		const tags = git('tag', '--merged', 'HEAD', '--list', 'v*', '--sort=-version:refname')
			.split('\n')
			.filter(Boolean);
		if (tags.some((tag) => !semver.test(tag.slice(1))))
			throw new Error('Only stable vX.Y.Z release tags supported.');
		const latest = tags[0];
		if (!latest)
			throw new Error('Missing vX.Y.Z baseline tag; establish release history explicitly.');
		const commits = git('log', '--format=%H%x00%B%x00', `${latest}..HEAD`)
			.split('\0\n')
			.filter(Boolean)
			.map((record) => {
				const [hash, message] = record.trim().split('\0');
				return { hash, message };
			});
		const version = nextVersion(latest.slice(1), commits);
		if (!version) {
			console.log('No releasable commits since ' + latest);
			if (blockers.length) console.log(blockers.join('\n'));
			if (!dry && blockers.length) throw new Error('Release preflight failed.');
			return;
		}
		const date = new Date().toISOString().slice(0, 10);
		const notes = releaseNotes(version, date, commits);
		const pkg = JSON.parse(read('package.json')!);
		pkg.version = version;
		const outputs = {
			'package.json': JSON.stringify(pkg, null, '\t') + '\n',
			'CITATION.cff': updateCitation(read('CITATION.cff')!, version, date),
			'CHANGELOG.md': prependChangelog(read('CHANGELOG.md') ?? '', notes)
		};
		state = {
			base: head,
			version,
			notes,
			files: Object.fromEntries(
				Object.entries(outputs).map(([file, after]) => [file, { before: read(file), after }])
			)
		};
	}
	const tag = `v${state.version}`;
	const message = `chore(release): ${tag}`;
	const committed = head !== state.base;
	if (committed && status)
		blockers.push('Committed release retry requires a clean index and working tree.');
	if (
		committed &&
		(git('rev-parse', 'HEAD^') !== state.base || git('log', '-1', '--format=%B') !== message)
	)
		throw new Error('HEAD changed outside pending release; inspect release state.');
	const paths = Object.keys(state.files);
	if (paths.sort().join(',') !== ['CHANGELOG.md', 'CITATION.cff', 'package.json'].sort().join(','))
		throw new Error('Invalid release state files.');
	const changed = git('diff', '--name-only', state.base).split('\n').filter(Boolean);
	const staged = git('diff', '--cached', '--name-only').split('\n').filter(Boolean);
	const untracked = git('ls-files', '--others', '--exclude-standard').split('\n').filter(Boolean);
	if ([...changed, ...staged, ...untracked].some((file) => !paths.includes(file)))
		blockers.push('Unrelated changes block release.');
	for (const [file, contents] of Object.entries(state.files)) {
		const current = read(file);
		if (
			current !== contents.after &&
			(committed || state.archiveSha256 || current !== contents.before)
		)
			blockers.push(`Unexpected edits in ${file}.`);
		if (committed && git('show', `HEAD:${file}`) !== contents.after.trim())
			blockers.push(`Release commit differs in ${file}.`);
	}
	const tagged = git('tag', '--list', tag) !== '';
	if (
		tagged &&
		(!committed ||
			git('rev-parse', `${tag}^{}`) !== head ||
			git('cat-file', '-t', `refs/tags/${tag}`) !== 'tag')
	)
		blockers.push(`${tag} already exists with conflicting target/type.`);
	console.log(`${dry ? 'Preview' : 'Release'}: ${tag}\n${state.notes}`);
	console.log(
		`Update: ${paths.join(', ')}\nChecks: ${config.checks.map((command) => command.join(' ')).join('; ')}\nPackage: pure3d-${tag}.tar.gz\nCommit: ${message}\nAnnotated tag: ${tag}\nPublish: GitHub Release archive + SHA-256; Pages via tag workflow. No signing.`
	);
	if (dry) {
		console.log(blockers.length ? `Blocked:\n${blockers.join('\n')}` : 'Local preflight passed.');
		return;
	}
	if (blockers.length) throw new Error(blockers.join('\n'));

	const save = () => {
		writeFileSync(statePath + '.tmp', JSON.stringify(state, null, 2) + '\n');
		renameSync(statePath + '.tmp', statePath);
	};
	save();
	const archive = `pure3d-${tag}.tar.gz`;
	const checksum = `${archive}.sha256`;
	const digest = () => createHash('sha256').update(readFileSync(archive)).digest('hex');
	if (state.archiveSha256) {
		if (!existsSync(archive) || digest() !== state.archiveSha256)
			throw new Error(
				'Checkpoint archive missing or changed; restore exact archive, never rebuild published bytes.'
			);
	} else {
		for (const [file, { after }] of Object.entries(state.files)) writeFileSync(file, after);
		for (const command of config.checks)
			execFileSync(command[0], command.slice(1), { stdio: 'inherit' });
		// Preserve source provenance: archive records the tested source commit before version-only commit.
		execFileSync('bun', ['--no-env-file', 'scripts/release-build.mjs', tag, archive], {
			stdio: 'inherit',
			env: { ...process.env, ...config.buildEnv, GITHUB_SHA: state.base }
		});
		if (git('rev-parse', 'HEAD') !== head) throw new Error('HEAD changed during release checks.');
		if (
			[
				git('diff', '--name-only', state.base),
				git('diff', '--cached', '--name-only'),
				git('ls-files', '--others', '--exclude-standard')
			]
				.join('\n')
				.split('\n')
				.filter(Boolean)
				.some((file) => !paths.includes(file))
		)
			throw new Error('Checks changed unrelated tracked files.');
		for (const [file, { after }] of Object.entries(state.files))
			if (read(file) !== after) throw new Error(`Checks changed ${file}.`);
		state.archiveSha256 = digest();
		save();
	}
	writeFileSync(checksum, `${state.archiveSha256}  ${archive}\n`);
	if (!committed) {
		git('add', '--', ...paths);
		git('-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgSign=false', 'commit', '-m', message);
	}
	if (!tagged) git('-c', 'tag.gpgSign=false', 'tag', '-a', tag, '-m', state.notes);
	// Repeating an atomic push after an interrupted response is safe; never force refs.
	git('push', '--atomic', 'origin', 'HEAD:refs/heads/main', `refs/tags/${tag}:refs/tags/${tag}`);
	state.pushed = true;
	save();
	publishRelease(config.repository, tag, state.notes, [archive, checksum]);
	state.published = true;
	save();
	rmSync(statePath);
	console.log(
		`Published: ${tag}. Pages deployment runs asynchronously; inspect tag workflow for deployment status.`
	);
}

if (import.meta.main) {
	let lock: string | undefined;
	try {
		if (!process.argv.includes('--dry-run')) {
			const path = git('rev-parse', '--path-format=absolute', '--git-path', 'pure3d-release.lock');
			mkdirSync(path);
			lock = path;
		}
		main();
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	} finally {
		if (lock) rmSync(lock, { recursive: true });
	}
}
