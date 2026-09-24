import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from 'bun:test';
import {
	classify,
	nextVersion,
	releaseNotes,
	prependChangelog,
	stableReleaseTags,
	updateCitation
} from './release';

const commits = (...messages: string[]) =>
	messages.map((message) => ({ hash: 'abcdef123456', message }));

test('Conventional Commits select highest bump and reset lower fields', () => {
	for (const type of ['fix', 'perf'])
		expect(nextVersion('1.2.9', commits(`${type}(viewer): faster`))).toBe('1.2.10');
	expect(nextVersion('1.2.9', commits('fix: bug', 'feat: addition'))).toBe('1.3.0');
	for (const message of [
		'feat!: incompatible',
		'refactor(api)!: incompatible',
		'chore: change\n\nBREAKING CHANGE: incompatible',
		'fix: change\n\nBREAKING-CHANGE: incompatible'
	])
		expect(nextVersion('0.14.3', commits(message))).toBe('1.0.0');
	expect(
		nextVersion('1.2.3', commits('docs: docs', 'chore(release): v1.2.3', 'Merge pull request'))
	).toBeNull();
	expect(nextVersion('1.2.3', [])).toBeNull();
	expect(classify('fix missing colon')).toBeNull();
	for (const invalid of ['v1.2.3', '01.2.3', '1.2', '1.2.3-beta.1'])
		expect(() => nextVersion(invalid, [])).toThrow();
});

test('stable releases ignore valid prerelease tags without accepting malformed tags', () => {
	expect(stableReleaseTags(['v2.0.0-beta.1', 'v0.14.0'])).toEqual(['v0.14.0']);
	expect(() => stableReleaseTags(['v2.0.beta'])).toThrow();
});

test('dated categorized notes preserve prior history without duplicate headings', () => {
	const notes = releaseNotes(
		'2.0.0',
		'2026-09-16',
		commits('feat!: remove old API', 'feat: viewer', 'fix: loading', 'perf: cache', 'docs: update')
	);
	expect(notes).toBe(
		'## v2.0.0 - 2026-09-16\n\n### Breaking changes\n\n- remove old API (abcdef12)\n\n### Features\n\n- viewer (abcdef12)\n\n### Fixes\n\n- loading (abcdef12)\n\n### Performance\n\n- cache (abcdef12)\n'
	);
	const previous = '# Changelog\n\n## v1.0.0 - 2026-01-01\n\nOld notes.\n';
	const result = prependChangelog(previous, notes);
	expect(result).toEndWith('## v1.0.0 - 2026-01-01\n\nOld notes.\n');
	expect(result.match(/# Changelog/g)?.length).toBe(1);
	expect(prependChangelog('', notes)).toBe('# Changelog\n\n' + notes);
	expect(() => prependChangelog(result, notes)).toThrow();
});

test('citation changes only authoritative version and release date', () => {
	const source = 'cff-version: 1.2.0\nversion: "0.14.0"\ndate-released: "2026-01-21"\n';
	expect(updateCitation(source, '0.15.0', '2026-09-16')).toBe(
		'cff-version: 1.2.0\nversion: "0.15.0"\ndate-released: "2026-09-16"\n'
	);
	expect(() => updateCitation('cff-version: 1.2.0\n', '1.0.0', '2026-09-16')).toThrow();
});

test('dry-run leaves working files, index, refs and release state unchanged', () => {
	const git = (...args: string[]) => {
		const result = Bun.spawnSync(['git', '--no-optional-locks', ...args]);
		expect(result.exitCode).toBe(0);
		return result.stdout.toString();
	};
	const snapshot = () => {
		const paths = git('ls-files', '--cached', '--others', '--exclude-standard', '-z')
			.split('\0')
			.filter(Boolean);
		paths.push(
			git('rev-parse', '--git-path', 'index').trim(),
			git('rev-parse', '--git-path', 'pure3d-release.json').trim()
		);
		return {
			refs: git('show-ref'),
			status: git('status', '--porcelain'),
			files: paths.map((path) => [
				path,
				existsSync(path) ? Bun.hash(readFileSync(path)).toString() : null
			])
		};
	};
	const before = snapshot();
	const result = Bun.spawnSync(['bun', '--no-env-file', 'scripts/release.ts', '--dry-run']);
	expect(result.exitCode).toBe(0);
	expect(result.stdout.toString()).toContain('Offline preview:');
	expect(snapshot()).toEqual(before);
});

import { publishRelease } from './release-publish';

test('publication recovers lost create/upload/publish responses without duplicating assets', () => {
	for (const failure of ['create', 'upload', 'edit']) {
		let release: {
			id: number;
			tag_name: string;
			draft: boolean;
			assets: { id: number; name: string; state: string }[];
		} | null = null;
		const calls: string[][] = [];
		let failed = false;
		const run = (args: string[]) => {
			calls.push(args);
			if (args[0] === 'api') {
				if (args[1].includes('/assets/')) return Buffer.from('exact bytes');
				if (!release) throw { stderr: Buffer.from('gh: Not Found (HTTP 404)') };
				return Buffer.from(JSON.stringify(release));
			}
			if (args[1] === 'create') release = { id: 1, tag_name: 'v1.2.3', draft: true, assets: [] };
			if (args[1] === 'upload')
				release!.assets.push({ id: release!.assets.length + 1, name: args[3], state: 'uploaded' });
			if (args[1] === 'edit') release!.draft = false;
			if (args[1] === failure && !failed) {
				failed = true;
				throw new Error('response lost');
			}
			return Buffer.from('');
		};
		const publish = () =>
			publishRelease(
				'org/repo',
				'v1.2.3',
				'notes',
				['site.tar.gz', 'site.tar.gz.sha256'],
				run,
				() => Buffer.from('exact bytes')
			);
		expect(publish).toThrow('response lost');
		publish();
		publish();
		expect(calls.filter((args) => args[1] === 'create')).toHaveLength(1);
		expect(calls.filter((args) => args[1] === 'upload')).toHaveLength(2);
		expect(calls.filter((args) => args[1] === 'edit')).toHaveLength(1);
		expect(calls.flat()).not.toContain('--clobber');
	}
});

test('publication refuses mismatched bytes, missing published assets and API failures', () => {
	for (const mode of ['mismatch', 'missing', 'unauthorized']) {
		const run = (args: string[]) => {
			if (mode === 'unauthorized') throw new Error('HTTP 401');
			if (args[0] !== 'api') throw new Error('Unexpected mutation');
			if (args[1].includes('/assets/')) return Buffer.from('different');
			return Buffer.from(
				JSON.stringify({
					id: 1,
					tag_name: 'v1.2.3',
					draft: false,
					assets: mode === 'missing' ? [] : [{ id: 1, name: 'site.tar.gz', state: 'uploaded' }]
				})
			);
		};
		expect(() =>
			publishRelease('org/repo', 'v1.2.3', 'notes', ['site.tar.gz'], run, () =>
				Buffer.from('original')
			)
		).toThrow(
			mode === 'mismatch'
				? 'Remote asset differs'
				: mode === 'missing'
					? 'Published release missing'
					: 'HTTP 401'
		);
	}
});

test('release checkpoints build before atomic push and clears state only after publication', () => {
	const source = readFileSync('scripts/release.ts', 'utf8');
	expect(source).toContain('if (state.archiveSha256)');
	expect(source).toContain('digest() !== state.archiveSha256');
	expect(source).toContain(
		"git('push', '--atomic', 'origin', 'HEAD:refs/heads/main', `refs/tags/${tag}:refs/tags/${tag}`)"
	);
	expect(source.indexOf('state.archiveSha256 = digest()')).toBeLessThan(
		source.indexOf("git('push'")
	);
	expect(source.indexOf('publishRelease(config.repository')).toBeLessThan(
		source.indexOf('rmSync(statePath)')
	);
});

test('Pages is tag-only and deploys verified prebuilt bytes; all Actions remain build-free', () => {
	const pages = readFileSync('.github/workflows/pages.yml', 'utf8');
	const checks = readFileSync('.github/workflows/release.yml', 'utf8');
	const parsed = Bun.YAML.parse(pages) as { jobs: { artifact: { steps: { run: string }[] } } };
	expect(
		Bun.spawnSync(['bash', '-n'], { stdin: Buffer.from(parsed.jobs.artifact.steps[0].run) })
			.exitCode
	).toBe(0);
	expect(pages).toContain("tags: ['v*']");
	expect(pages).not.toMatch(/branches:|workflow_dispatch:|pull_request:/);
	expect(pages).not.toMatch(/checkout@|setup-bun|setup-node|\binstall\b|run:.*build/);
	for (const workflow of [pages, checks])
		expect(workflow).not.toMatch(/run:.*(?:run build|release-build|run release)/);
	for (const evidence of [
		'.draft == false',
		'.prerelease == $prerelease',
		'gh release download',
		'hashlib.sha256',
		'Archive checksum mismatch',
		'Archive version/source mismatch',
		"'..' in path.parts",
		'upload-pages-artifact@',
		'needs: artifact',
		'deploy-pages@'
	])
		expect(pages).toContain(evidence);
});

test('Pages verifier accepts exact archives and rejects corruption, metadata and unsafe extraction', () => {
	const workflow = readFileSync('.github/workflows/pages.yml', 'utf8');
	const verifier = workflow
		.split("python3 - <<'PY'\n")[1]
		.split('\n          PY')[0]
		.replace(/^ {10}/gm, '');
	const result = Bun.spawnSync([
		'python3',
		'-c',
		`
import io, hashlib, json, os, pathlib, tarfile, tempfile
verifier = ${JSON.stringify(verifier)}
cases = {
    'valid': None,
    'checksum': 'Archive checksum mismatch',
    'version': 'Archive version/source mismatch',
    'source': 'Archive version/source mismatch',
    'missing-index': 'Missing index.html',
    'missing-fallback': 'Missing 404.html',
    **{mode: 'Unsafe archive member' for mode in [
        'traversal', 'absolute', 'symlink', 'hardlink', 'fifo', 'character', 'block'
    ]},
    **{mode: 'Extraction destination already exists' for mode in [
        'existing-directory', 'existing-symlink', 'dangling-symlink', 'nested-symlink'
    ]},
}
for mode, error in cases.items():
    with tempfile.TemporaryDirectory() as directory:
        os.chdir(directory)
        os.environ.update(TAG='v1.2.3', SOURCE_COMMIT='a' * 40)
        outside = pathlib.Path('outside')
        outside.mkdir()
        sentinel = outside / 'index.html'
        sentinel.write_text('untouched')
        if mode == 'existing-symlink':
            pathlib.Path('site').symlink_to(outside, target_is_directory=True)
        elif mode == 'dangling-symlink':
            pathlib.Path('site').symlink_to('absent', target_is_directory=True)
        elif mode in ['existing-directory', 'nested-symlink']:
            pathlib.Path('site').mkdir()
            if mode == 'nested-symlink':
                pathlib.Path('site/assets').symlink_to('../outside', target_is_directory=True)
        archive = pathlib.Path('pure3d-v1.2.3.tar.gz')
        with tarfile.open(archive, 'w:gz') as tar:
            metadata = {'version': 'v9.9.9' if mode == 'version' else 'v1.2.3', 'commit': 'b' * 40 if mode == 'source' else 'a' * 40}
            root = tarfile.TarInfo('./')
            root.type = tarfile.DIRTYPE
            root.mode = 0o000
            tar.addfile(root)
            for name, data in [('version.json', json.dumps(metadata)), ('index.html', 'index'), ('404.html', 'fallback'), ('assets/index.html', 'nested')]:
                if (mode == 'missing-index' and name == 'index.html') or (mode == 'missing-fallback' and name == '404.html'):
                    continue
                payload = data.encode()
                member = tarfile.TarInfo('./' + name)
                member.size = len(payload)
                tar.addfile(member, io.BytesIO(payload))
            if mode == 'traversal':
                tar.addfile(tarfile.TarInfo('../escape'))
            if mode == 'absolute':
                tar.addfile(tarfile.TarInfo(str(sentinel.resolve())))
            types = {'symlink': tarfile.SYMTYPE, 'hardlink': tarfile.LNKTYPE,
                     'fifo': tarfile.FIFOTYPE, 'character': tarfile.CHRTYPE, 'block': tarfile.BLKTYPE}
            if mode in types:
                member = tarfile.TarInfo('link')
                member.type = types[mode]
                member.linkname = '../outside/index.html'
                tar.addfile(member)
            # Explicit directories can follow their children in real tar archives.
            directory_member = tarfile.TarInfo('./assets/')
            directory_member.type = tarfile.DIRTYPE
            tar.addfile(directory_member)
        digest = hashlib.sha256(archive.read_bytes()).hexdigest()
        pathlib.Path(str(archive) + '.sha256').write_text(f'{digest}  {archive}\\n' if mode != 'checksum' else 'bad')
        try:
            exec(verifier)
        except SystemExit as failure:
            assert error is not None and str(failure) == error, (mode, str(failure))
        else:
            assert error is None, mode
            assert pathlib.Path('site/index.html').read_text() == 'index'
            assert pathlib.Path('site/assets/index.html').read_text() == 'nested'
        assert sentinel.read_text() == 'untouched', mode
        assert not pathlib.Path('escape').exists(), mode
        if error in ['Unsafe archive member', 'Archive checksum mismatch']:
            assert not pathlib.Path('site').exists(), mode
`
	]);
	expect(result.stderr.toString()).toBe('');
	expect(result.exitCode).toBe(0);
});
