import { expect, test } from 'bun:test';
import service from './admin-workflow-service.cjs';

class TestContext {
	constructor(...args: unknown[]) {
		void args;
	}
}

class TestRecord {
	constructor(
		readonly collection: unknown,
		readonly data: Record<string, unknown>
	) {}
}

class TestForbiddenError extends Error {}
class TestBadRequestError extends Error {}

Object.assign(globalThis, {
	Context: TestContext,
	Record: TestRecord,
	ForbiddenError: TestForbiddenError,
	BadRequestError: TestBadRequestError
});

function edition(values: Record<string, unknown>) {
	return {
		id: 'edition123',
		values,
		getString(field: string) {
			const value = this.values[field];
			return typeof value === 'string' ? value : '';
		},
		set(field: string, value: unknown) {
			this.values[field] = value;
		}
	};
}

function event(role: string | null, expectedStatus = 'published', currentStatus = 'published') {
	const record = edition({
		status: currentStatus,
		isPublished: true,
		reviewStage: 3,
		publishedAt: '2025-02-11T10:26:20Z',
		publishedBy: 'publisher123',
		dcDatePublished: '2025-02-11T10:26:20Z',
		peerReviewStamp: true,
		peerReviewKind: 'Peer reviewed',
		publicationRequest: '{"rightsConfirmed":true}',
		publicationSubmittedAt: '2025-02-10T10:26:20Z',
		workflowDecision: 'Published after review.',
		sceneDocument: 'scene.svx.json',
		credits: '[{"name":"Creator"}]'
	});
	const saved: unknown[] = [];
	const tx = {
		findRecordById: () => record,
		findCollectionByNameOrId: () => ({ name: 'auditLog' }),
		saveWithContext: (_context: unknown, savedRecord: unknown) => saved.push(savedRecord)
	};
	const auth = role
		? {
				id: `${role}123`,
				isSuperuser: () => false,
				collection: () => ({ name: 'users' }),
				getString: (field: string) => (field === 'role' ? role : '')
			}
		: null;
	return {
		event: {
			auth,
			requestInfo: () => ({ body: { expectedStatus, reason: 'Correct the public metadata.' } }),
			request: { pathValue: () => record.id },
			app: { runInTransaction: (callback: (transaction: typeof tx) => void) => callback(tx) },
			json: (status: number, body: unknown) => ({ status, body })
		},
		record,
		saved
	};
}

test('administrative overrides retain structural workflow paths and require an audit reason', () => {
	expect(
		service.error('alpha_accepted', 'alpha_review', 'The prior round needs reconsideration.')
	).toBe('');
	expect(
		service.error('final_accepted', 'final_review', 'New evidence requires a new review round.')
	).toBe('');
	expect(service.error('draft', 'final_review', 'Skip all workflow stages.')).not.toBe('');
	expect(
		service.error('publication_requested', 'published', 'Publish without confirmation.')
	).not.toBe('');
	expect(service.error('final_accepted', 'final_review', '')).not.toBe('');
});

test('administrative review starts retain stage-specific round isolation', () => {
	expect(service.reviewStage('alpha_review')).toBe(2);
	expect(service.reviewStage('final_review')).toBe(3);
	expect(service.reviewStage('publication_requested')).toBe(3);
	expect(service.reviewStage('draft')).toBe(0);
});

test('unpublishing requires a fresh published state and an auditable reason', () => {
	expect(service.unpublishError('published', 'Correct the published metadata and scene.')).toBe('');
	expect(
		service.unpublishError('final_revisions', 'Correct the published metadata and scene.')
	).not.toBe('');
	expect(service.unpublishError('published', '')).not.toBe('');
});

test('only an admin can atomically unpublish a published edition and audit the transition', () => {
	const fixture = event('admin');
	const response = service.unpublish(fixture.event);

	expect(response).toMatchObject({ status: 200, body: { status: 'final_revisions' } });
	expect(fixture.record.values).toMatchObject({
		status: 'final_revisions',
		isPublished: false,
		reviewStage: 3,
		publishedAt: '',
		publishedBy: '',
		peerReviewStamp: false,
		peerReviewKind: '',
		publicationRequest: '',
		publicationSubmittedAt: '',
		workflowDecision: '',
		sceneDocument: 'scene.svx.json',
		credits: '[{"name":"Creator"}]',
		dcDatePublished: '2025-02-11T10:26:20Z'
	});
	expect(fixture.record.values.dcDateUnPublished).toEqual(expect.any(String));
	expect(fixture.saved).toHaveLength(2);
	expect(fixture.saved[1]).toMatchObject({
		data: {
			action: 'edition_unpublished',
			targetType: 'edition',
			targetId: 'edition123',
			performedBy: 'users/admin123',
			details: {
				from: 'published',
				to: 'final_revisions',
				reason: 'Correct the public metadata.'
			}
		}
	});
});

test('unpublish rejects unauthenticated and non-admin callers and stale published state', () => {
	for (const role of [null, 'user', 'author', 'editor', 'editorial_board'])
		expect(() => service.unpublish(event(role).event)).toThrow(TestForbiddenError);
	expect(() => service.unpublish(event('admin', 'published', 'final_accepted').event)).toThrow(
		TestBadRequestError
	);
});
