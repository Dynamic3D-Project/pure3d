import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { publishRelease } from './release-publish';

test('explicit patch previews maintenance changes without reducing feature bumps or releasing an empty range', () => {
	const directory = mkdtempSync(join(tmpdir(), 'pure3d-release-preview-'));
	const run = (command: string[]) => {
		const result = Bun.spawnSync(command, {
			cwd: directory,
			env: { PATH: process.env.PATH!, HOME: process.env.HOME! }
		});
		if (result.exitCode !== 0) throw new Error(result.stderr.toString());
		return result.stdout.toString();
	};
	const git = (...args: string[]) => run(['git', ...args]);
	const commit = (message: string) => {
		git('add', '.');
		git(
			'-c',
			'user.name=Synthetic release test',
			'-c',
			'user.email=release@example.test',
			'-c',
			'core.hooksPath=/dev/null',
			'-c',
			'commit.gpgSign=false',
			'commit',
			'-m',
			message
		);
		git('update-ref', 'refs/remotes/origin/main', git('rev-parse', 'HEAD').trim());
	};
	const preview = (...args: string[]) =>
		run([
			process.execPath,
			'--no-env-file',
			new URL('./release.ts', import.meta.url).pathname,
			'--dry-run',
			...args
		]);
	try {
		git('init', '--initial-branch=main');
		writeFileSync(join(directory, 'package.json'), '{"version":"1.2.3"}\n');
		writeFileSync(
			join(directory, 'CITATION.cff'),
			'version: "1.2.3"\ndate-released: "2026-01-01"\n'
		);
		writeFileSync(join(directory, 'CHANGELOG.md'), '# Changelog\n');
		commit('chore: baseline');
		git('-c', 'tag.gpgSign=false', 'tag', 'v1.2.3');
		expect(preview('--patch')).toContain('No releasable commits since v1.2.3');
		writeFileSync(join(directory, 'README.md'), 'Test maintenance\n');
		commit('test: focus suite on feature integrations');
		expect(preview()).toContain('No releasable commits since v1.2.3');
		const patch = preview('--patch');
		expect(patch).toContain('Preview: v1.2.4');
		expect(patch).toContain('### Maintenance');
		expect(patch).toContain('test: focus suite on feature integrations');
		expect(readFileSync(join(directory, 'package.json'), 'utf8')).toBe('{"version":"1.2.3"}\n');
		expect(git('status', '--porcelain')).toBe('');
		writeFileSync(join(directory, 'README.md'), 'Feature addition\n');
		commit('feat: add a feature');
		expect(preview('--patch')).toContain('Preview: v1.3.0');
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
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

test('publication recovers lost create/upload/publish responses without duplicating assets', () => {
	for (const failure of [null, 'create', 'upload', 'edit']) {
		type ReleaseFixture = {
			id: number;
			tag_name: string;
			draft: boolean;
			assets: { id: number; name: string; state: string }[];
		};
		let release: ReleaseFixture | null = null;
		const releases: ReleaseFixture[] = [];
		let failed = false;
		const run = (args: string[]) => {
			if (args.includes('--clobber')) throw new Error('Asset replacement is forbidden');
			const action =
				args[0] === 'api' && args[1] === 'repos/org/repo/releases' && args.includes('POST')
					? 'create'
					: args[1].startsWith('https://uploads.github.com/') && args.includes('POST')
						? 'upload'
						: args.includes('PATCH')
							? 'edit'
							: null;
			if (args[0] === 'api' && !action) {
				if (args[1].includes('/git/ref/tags/'))
					return Buffer.from(JSON.stringify({ ref: 'refs/tags/v1.2.3' }));
				if (args[1].includes('/assets/')) return Buffer.from('exact bytes');
				if (args[1].includes('/releases?'))
					return Buffer.from(JSON.stringify([[], release && failure ? [release] : []]));
				if (args[1].includes('/tags/') && release?.draft)
					throw { stderr: Buffer.from('gh: Not Found (HTTP 404)') };
				if (!release) throw { stderr: Buffer.from('gh: Not Found (HTTP 404)') };
				return Buffer.from(JSON.stringify(release));
			}
			if (action === 'create') {
				release = { id: releases.length + 1, tag_name: 'v1.2.3', draft: true, assets: [] };
				releases.push(release);
			}
			if (action === 'upload')
				release!.assets.push({
					id: release!.assets.length + 1,
					name: new URL(args[1]).searchParams.get('name')!,
					state: 'uploaded'
				});
			if (action === 'edit') release!.draft = false;
			if (failure && action === failure && !failed) {
				failed = true;
				throw new Error('response lost');
			}
			return Buffer.from(action === 'create' ? JSON.stringify(release) : '');
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
		if (failure) expect(publish).toThrow('response lost');
		else publish();
		publish();
		publish();
		expect(releases).toHaveLength(1);
		expect(releases[0].draft).toBe(false);
		expect(releases[0].assets.map((asset) => asset.name)).toEqual([
			'site.tar.gz',
			'site.tar.gz.sha256'
		]);
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
