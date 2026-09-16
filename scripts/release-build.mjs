import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { copyFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const VERSION_PATTERN = /^(?:v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?|dev\+[0-9a-f]{7,64})$/;
const ARCHIVE_PATTERN = /^pure3d-v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?\.tar\.gz$/;

function validate(version, commitSha, archive) {
	if (!VERSION_PATTERN.test(version)) throw new Error(`Invalid build version: ${version}`);
	if (!/^[0-9a-f]{40,64}$/.test(commitSha)) throw new Error(`Invalid commit SHA: ${commitSha}`);
	if (archive && !ARCHIVE_PATTERN.test(archive))
		throw new Error(`Invalid archive name: ${archive}`);
}

function run(command, args, options = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, { stdio: 'inherit', ...options });
		child.on('error', reject);
		child.on('exit', (code) =>
			code === 0 ? resolve() : reject(new Error(`${command} exited with status ${code}`))
		);
	});
}

export async function buildProduction(version, commitSha, archive) {
	validate(version, commitSha, archive);
	await run('bun', ['--no-env-file', 'run', 'build'], {
		env: { ...process.env, APP_VERSION: version, APP_COMMIT_SHA: commitSha }
	});
	await copyFile('build/index.html', 'build/404.html');
	await writeFile('build/version.json', `${JSON.stringify({ version, commit: commitSha })}\n`);
	if (archive) await run('tar', ['-czf', archive, '-C', 'build', '.']);
}

async function main() {
	if (process.argv[2] === '--check') {
		assert.doesNotThrow(() => validate('v1.2.3', 'a'.repeat(40), 'pure3d-v1.2.3.tar.gz'));
		assert.doesNotThrow(() => validate('dev+a1b2c3d', 'b'.repeat(40)));
		assert.throws(() => validate('latest', 'b'.repeat(40)));
		return;
	}

	const commitSha =
		process.env.GITHUB_SHA ?? execFileSync('git', ['rev-parse', 'HEAD']).toString().trim();
	await buildProduction(process.argv[2], commitSha, process.argv[3]);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
