// Vite/unplugin-icons resolves these virtual modules at build time.
declare module '~icons/*' {
	import type { Component } from 'svelte';
	import type { SVGAttributes } from 'svelte/elements';
	const component: Component<SVGAttributes<SVGSVGElement>>;
	export default component;
}
