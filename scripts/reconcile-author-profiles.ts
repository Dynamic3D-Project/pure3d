#!/usr/bin/env bun
import PocketBase from 'pocketbase';
import {
	profileDisplayName,
	profileNameKey,
	profileNames
} from '../src/lib/utils/profile-matching';

type Edition = {
	id: string;
	title?: string;
	dcTitle?: string;
	dcCreator?: unknown;
};

type Profile = Record<string, unknown> & { id: string };

type Candidate = {
	id: string;
	displayName: string;
};

type ReconciliationItem = {
	editionId: string;
	editionTitle: string;
	credit: string;
	profiles: Candidate[];
};

export type AuthorReconciliation = {
	matched: ReconciliationItem[];
	ambiguous: ReconciliationItem[];
	unmatched: ReconciliationItem[];
};

export function reconcileAuthorProfiles(
	editions: Edition[],
	profiles: Profile[]
): AuthorReconciliation {
	const profilesByName = new Map<string, Map<string, Candidate>>();

	for (const profile of profiles) {
		const candidate = { id: profile.id, displayName: profileDisplayName(profile) };
		for (const name of profileNames(profile)) {
			const key = profileNameKey(name);
			if (!key) continue;
			if (!profilesByName.has(key)) profilesByName.set(key, new Map());
			profilesByName.get(key)?.set(profile.id, candidate);
		}
	}

	const report: AuthorReconciliation = { matched: [], ambiguous: [], unmatched: [] };
	for (const edition of editions) {
		const credits = Array.isArray(edition.dcCreator)
			? edition.dcCreator.filter(
					(credit): credit is string => typeof credit === 'string' && !!credit.trim()
				)
			: [];

		for (const credit of credits) {
			const matches = new Map<string, Candidate>();
			for (const name of profileNames({ name: credit })) {
				for (const candidate of profilesByName.get(profileNameKey(name))?.values() ?? []) {
					matches.set(candidate.id, candidate);
				}
			}
			const item: ReconciliationItem = {
				editionId: edition.id,
				editionTitle: edition.dcTitle || edition.title || '(untitled)',
				credit,
				profiles: [...matches.values()]
			};
			if (item.profiles.length === 1) report.matched.push(item);
			else if (item.profiles.length > 1) report.ambiguous.push(item);
			else report.unmatched.push(item);
		}
	}

	return report;
}

function cell(value: string): string {
	return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function section(title: string, items: ReconciliationItem[]): string {
	if (items.length === 0) return `## ${title}\n\n_None._`;

	const rows = items.map((item) => {
		const profiles = item.profiles
			.map((profile) => `${cell(profile.displayName)} (\`${profile.id}\`)`)
			.join('<br>');
		return `| ${cell(item.editionTitle)} | \`${item.editionId}\` | ${cell(item.credit)} | ${profiles || '-'} |`;
	});

	return [
		`## ${title}`,
		'',
		'| Edition | Edition ID | Author credit | Candidate profiles |',
		'| --- | --- | --- | --- |',
		...rows
	].join('\n');
}

export function formatAuthorReconciliation(report: AuthorReconciliation): string {
	return [
		'# Author Profile Reconciliation',
		'',
		'This report uses normalized exact name matching and does not modify PocketBase.',
		'',
		`- Unique matches: ${report.matched.length}`,
		`- Ambiguous credits: ${report.ambiguous.length}`,
		`- Unmatched credits: ${report.unmatched.length}`,
		'',
		section('Ambiguous: manual review required', report.ambiguous),
		'',
		section('Unmatched: manual review required', report.unmatched),
		'',
		section('Unique matches', report.matched)
	].join('\n');
}

async function main() {
	const url = process.env.POCKETBASE_URL || 'http://localhost:60021';
	const email = process.env.POCKETBASE_ADMIN_EMAIL || process.env.PB_ADMIN_EMAIL;
	const password = process.env.POCKETBASE_ADMIN_PASSWORD || process.env.PB_ADMIN_PASSWORD;
	if (!email || !password) {
		throw new Error(
			'Set POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD before running this report.'
		);
	}

	const pb = new PocketBase(url);
	await pb.collection('_superusers').authWithPassword(email, password);
	const [editions, profiles] = await Promise.all([
		pb.collection('editions').getFullList({ sort: 'dcTitle,title' }),
		pb.collection('users').getFullList({ sort: 'nickname' })
	]);

	const report = reconcileAuthorProfiles(editions as Edition[], profiles as Profile[]);
	process.stdout.write(`${formatAuthorReconciliation(report)}\n`);
}

if (import.meta.main) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	});
}
