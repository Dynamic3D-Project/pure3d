import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

type Release = {
	id: number;
	draft: boolean;
	tag_name: string;
	assets: { id: number; name: string; state: string }[];
};
const gh = (args: string[]): Buffer =>
	execFileSync('gh', args, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1024 * 1024 * 1024 });
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

// Reconcile server state on every retry, including a lost successful upload response.
export function publishRelease(
	repository: string,
	tag: string,
	notes: string,
	files: string[],
	run = gh,
	read: (file: string) => Buffer = readFileSync
) {
	const endpoint = `repos/${repository}/releases/tags/${tag}`;
	const lookup = (): Release | null => {
		try {
			return JSON.parse(run(['api', endpoint]).toString());
		} catch (error) {
			if (/\(HTTP 404\)/.test(String((error as { stderr?: Buffer }).stderr))) return null;
			throw error;
		}
	};
	let release = lookup();
	if (!release) {
		run([
			'release',
			'create',
			tag,
			'--repo',
			repository,
			'--verify-tag',
			'--draft',
			'--title',
			tag,
			'--notes',
			notes
		]);
		release = lookup();
	}
	if (!release || release.tag_name !== tag) throw new Error('Release identity mismatch');
	for (const file of files) {
		const matches = release.assets.filter((asset) => asset.name === file);
		if (matches.length > 1) throw new Error(`Duplicate release asset: ${file}`);
		const asset = matches[0];
		if (asset) {
			const bytes = run([
				'api',
				`repos/${repository}/releases/assets/${asset.id}`,
				'-H',
				'Accept: application/octet-stream'
			]);
			if (asset.state !== 'uploaded' || sha(bytes) !== sha(read(file)))
				throw new Error(`Remote asset differs: ${file}; refusing replacement`);
		} else {
			if (!release.draft) throw new Error(`Published release missing ${file}; refusing mutation`);
			run(['release', 'upload', tag, file, '--repo', repository]);
			const uploaded = lookup()?.assets.find((item) => item.name === file);
			if (
				!uploaded ||
				uploaded.state !== 'uploaded' ||
				sha(
					run([
						'api',
						`repos/${repository}/releases/assets/${uploaded.id}`,
						'-H',
						'Accept: application/octet-stream'
					])
				) !== sha(read(file))
			)
				throw new Error(`Upload verification failed: ${file}`);
		}
	}
	if (release.draft)
		run([
			'release',
			'edit',
			tag,
			'--repo',
			repository,
			'--title',
			tag,
			'--notes',
			notes,
			'--draft=false'
		]);
	if (lookup()?.draft !== false) throw new Error('Release publication not confirmed');
}
