import type PocketBase from 'pocketbase';
import { Database } from 'bun:sqlite';
import { chmod, mkdtemp, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Verify a fresh recoverable database archive before an authorised production migration. */
export async function verifiedProductionBackup(pb: PocketBase, prefix: string) {
	const key = `${prefix}-${Date.now()}.zip`;
	await pb.backups.create(key);
	const backup = (await pb.backups.getFullList()).find((entry) => entry.key === key);
	if (!backup || backup.size <= 0) throw new Error('Backup was not created.');
	let bytes: Uint8Array;
	try {
		const response = await fetch(pb.backups.getDownloadURL(await pb.files.getToken(), key));
		if (!response.ok) throw new Error('Backup download failed.');
		bytes = new Uint8Array(await response.arrayBuffer());
	} catch {
		// Fetch errors can include the download URL's private file token. Never expose the cause.
		throw new Error('Could not download backup for verification.');
	}
	if (bytes.length !== backup.size) throw new Error('Backup download size mismatch.');
	const directory = await mkdtemp(join(tmpdir(), 'pure3d-production-backup-'));
	await chmod(directory, 0o700);
	const path = join(directory, key);
	await Bun.write(path, bytes);
	await chmod(path, 0o600);
	const integrity = Bun.spawnSync(['unzip', '-t', path], { stdout: 'pipe', stderr: 'pipe' });
	if (integrity.exitCode !== 0) throw new Error('Backup ZIP integrity verification failed.');
	const contents = Bun.spawnSync(['unzip', '-Z1', path], { stdout: 'pipe', stderr: 'pipe' });
	const databases = contents.stdout
		.toString()
		.trim()
		.split('\n')
		.filter((name) => /(^|\/)data\.db$/.test(name));
	if (contents.exitCode !== 0 || databases.length !== 1)
		throw new Error('Backup must contain exactly one application database.');
	const extracted = Bun.spawnSync(['unzip', '-p', path, databases[0]], {
		stdout: 'pipe',
		stderr: 'pipe'
	});
	if (extracted.exitCode !== 0) throw new Error('Could not verify backup database.');
	const databasePath = join(directory, 'verify.db');
	await Bun.write(databasePath, extracted.stdout);
	await chmod(databasePath, 0o600);
	const database = new Database(databasePath, { readonly: true });
	try {
		const result = database.query('PRAGMA integrity_check').values();
		if (JSON.stringify(result) !== '[["ok"]]')
			throw new Error('Backup SQLite integrity check failed.');
		if (
			!database
				.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'content'")
				.get()
		)
			throw new Error('Backup application database is missing its content table.');
	} finally {
		database.close();
		await unlink(databasePath);
	}
	console.log(`Verified production backup: ${key}; private local copy: ${path}`);
	return key;
}
