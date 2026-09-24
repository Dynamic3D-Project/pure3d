import { GlobalRole } from '$lib/types/roles';

export function canPreviewEditionViewer(role: GlobalRole, userId: string | null): boolean {
	return role === GlobalRole.Admin && !!userId;
}

export function useExperimentalEditionViewer(
	role: GlobalRole,
	userId: string | null,
	preferenceOwner: string | null,
	enabled: boolean
): boolean {
	return canPreviewEditionViewer(role, userId) && userId === preferenceOwner && enabled;
}

export function editionViewerPreferenceKey(prefix: string, userId: string): string {
	return `${prefix}:edition-viewer-experiment:${userId}`;
}
