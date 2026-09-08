import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { ScriptTarget, transpileModule } from 'typescript';
import { normalizeOrcid } from '../../lib/utils/credits';
import { EditionRole } from '../../lib/types/roles';
import type { Credit } from '../../lib/types/credits';

test('account-credit actions reject unverified identities and preserve existing manual duplicates', async () => {
	for (const path of [
		'../../lib/components/admin/MemberManager.svelte',
		'../../lib/components/workflow/CollaboratorManager.svelte'
	]) {
		const source = readFileSync(new URL(path, import.meta.url), 'utf8');
		const start = source.search(/\t(?:async )?function addCredit\(/);
		expect(start >= 0).toBe(true);
		const end = source.indexOf('\n\t}', start) + 4;
		// Exercise the actual Svelte handler without adding a browser-test dependency.
		const { outputText } = transpileModule(source.slice(start, end), {
			compilerOptions: { target: ScriptTarget.ESNext }
		});
		const manual: Credit = {
			type: 'person',
			name: 'Same name',
			role: 'contributor',
			orcid: null,
			provenance: 'manual'
		};
		const state = {
			credits: [{ ...manual }, { ...manual }],
			isReadOnly: false,
			actionLoading: false,
			savingCredits: false,
			loadError: false,
			normalizeOrcid,
			EditionRole,
			toast: {
				success() {},
				error() {
					throw new Error('Unexpected action error');
				}
			},
			oncreditssaved: async (credits: Credit[]) => {
				state.credits = credits;
			}
		};
		const addCredit = new Function('state', `with (state) { ${outputText}; return addCredit; }`)(
			state
		) as (member: object) => Promise<void>;
		const member = {
			userId: 'exact-account-id',
			nickname: manual.name,
			role: EditionRole.Collaborator,
			orcid: 'https://orcid.org/0000-0002-1825-0097',
			orcidVerifiedAt: ''
		};
		for (const identity of [
			member,
			{ ...member, orcid: '' },
			{ ...member, orcid: 'invalid', orcidVerifiedAt: '2026-09-08' }
		]) {
			await addCredit(identity);
			await addCredit(identity);
			expect(state.credits).toEqual([manual, manual]);
		}
		const verified = { ...member, orcidVerifiedAt: '2026-09-08' };
		await addCredit(verified);
		await addCredit(verified);
		expect(state.credits).toEqual([
			manual,
			manual,
			{ ...manual, userId: member.userId, orcid: member.orcid, provenance: 'oauth' }
		]);
	}
});
