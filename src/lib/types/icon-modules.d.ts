// Ambient declarations for virtual icon modules resolved by Vite/unplugin-icons
// These are not resolved by svelte-check/TypeScript language server but work at build time.
declare module '~icons/*' {
	const component: any;
	export default component;
}

declare module '~icons/heroicons/*' {
	const component: any;
	export default component;
}

declare module '~icons/lucide/*' {
	const component: any;
	export default component;
}

declare module '~icons/ph/*' {
	const component: any;
	export default component;
}

declare module '~icons/bi/*' {
	const component: any;
	export default component;
}

declare module '~icons/mingcute/*' {
	const component: any;
	export default component;
}

declare module '~icons/iconamoon/*' {
	const component: any;
	export default component;
}

declare module 'bun:test' {
	export const describe: any;
	export const expect: any;
	export const test: any;
}

declare module '@zerodevx/svelte-json-view' {
	export const JsonView: any;
}

declare module 'idb' {
	export function deleteDB(name: string): Promise<void>;
	export function openDB(
		name: string,
		version?: number,
		options?: {
			upgrade?: (db: any) => void;
		}
	): Promise<any>;
}

declare module 'vanilla-tilt' {
	const VanillaTilt: any;
	export default VanillaTilt;
}

declare module '@auth/sveltekit/client' {
	export const signIn: any;
	export const signOut: any;
}
