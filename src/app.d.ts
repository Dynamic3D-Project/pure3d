declare const __APP_VERSION__: string;
declare const __BUILD_DATE__: string;

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			pb_auth?: string;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

// unplugin-icons type definitions
declare module '~icons/*' {
	import type { SvelteComponent } from 'svelte';
	export default SvelteComponent;
}

export {};
