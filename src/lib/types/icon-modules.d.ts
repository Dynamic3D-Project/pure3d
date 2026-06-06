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
