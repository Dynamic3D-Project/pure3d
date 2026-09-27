import { expect, test } from 'bun:test';
import { SubscriptionOwner } from './subscription-owner';

test('rejects an obsolete subscription setup after recipient changes', () => {
	const owner = new SubscriptionOwner();
	const first = owner.begin('first');
	const second = owner.begin('second');

	expect(first).not.toBeNull();
	expect(second).not.toBeNull();
	expect(owner.isCurrent(first!)).toBe(false);
	expect(owner.isCurrent(second!)).toBe(true);
});

test('immediately disposes a late realtime subscription from a stale owner', () => {
	const owner = new SubscriptionOwner();
	const first = owner.begin('first')!;
	owner.clear();
	let disposed = 0;

	owner.adopt(first, () => disposed++);

	expect(disposed).toBe(1);
});

test('does not repeat setup for the current recipient', () => {
	const owner = new SubscriptionOwner();
	expect(owner.begin('same')).not.toBeNull();
	expect(owner.begin('same')).toBeNull();
});

test('releases a failed setup so the same recipient can retry', () => {
	const owner = new SubscriptionOwner();
	const failed = owner.begin('same')!;

	owner.abandon(failed);

	expect(owner.begin('same')).not.toBeNull();
});
