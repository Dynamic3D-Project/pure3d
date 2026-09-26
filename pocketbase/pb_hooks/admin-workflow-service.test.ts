import { expect, test } from 'bun:test';
import service from './admin-workflow-service.cjs';

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
