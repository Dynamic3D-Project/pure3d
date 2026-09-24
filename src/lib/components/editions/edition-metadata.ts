/** Human-readable document label; never use this value to fetch protected files. */
export function sceneDocumentLabel(document: string): string {
	return document.split(/[?#]/, 1)[0];
}
