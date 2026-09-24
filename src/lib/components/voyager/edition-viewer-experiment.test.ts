import { expect, test } from 'bun:test';
import { GlobalRole } from '$lib/types/roles';
import {
	canPreviewEditionViewer,
	editionViewerPreferenceKey,
	useExperimentalEditionViewer
} from './edition-viewer-experiment';

test('only a signed-in global admin can preview the experimental layout', () => {
	expect(canPreviewEditionViewer(GlobalRole.Admin, 'admin-a')).toBeTrue();
	expect(canPreviewEditionViewer(GlobalRole.Admin, null)).toBeFalse();
	for (const role of [GlobalRole.User, GlobalRole.EditorialBoard]) {
		expect(useExperimentalEditionViewer(role, 'account', 'account', true)).toBeFalse();
	}
});

test('defaults off and cannot inherit another account’s preference or survive logout', () => {
	expect(useExperimentalEditionViewer(GlobalRole.Admin, 'admin-a', 'admin-a', false)).toBeFalse();
	expect(useExperimentalEditionViewer(GlobalRole.Admin, 'admin-a', 'admin-a', true)).toBeTrue();
	expect(useExperimentalEditionViewer(GlobalRole.Admin, 'admin-b', 'admin-a', true)).toBeFalse();
	expect(useExperimentalEditionViewer(GlobalRole.User, null, 'admin-a', true)).toBeFalse();
});

test('preferences are isolated by backend and account', () => {
	expect(editionViewerPreferenceKey('local', 'a')).not.toBe(
		editionViewerPreferenceKey('prod', 'a')
	);
	expect(editionViewerPreferenceKey('local', 'a')).not.toBe(
		editionViewerPreferenceKey('local', 'b')
	);
});
