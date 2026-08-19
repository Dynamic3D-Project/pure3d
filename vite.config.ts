import { execSync } from 'child_process';
import devtoolsJson from 'vite-plugin-devtools-json';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import Icons from 'unplugin-icons/vite';

const getVersion = (): string => {
	try {
		return execSync('git describe --tags --always').toString().trim();
	} catch {
		return 'dev';
	}
};

export default defineConfig({
	server: {
		host: '0.0.0.0',
		port: 14273,
		allowedHosts: ['m3-max.tail33436f.ts.net']
	},
	define: {
		__APP_VERSION__: JSON.stringify(getVersion()),
		__BUILD_DATE__: JSON.stringify(new Date().toISOString())
	},
	plugins: [
		sveltekit(),
		paraglideVitePlugin({
			project: './locale/project.inlang',
			outdir: './src/lib/paraglide'
		}),
		devtoolsJson(),
		Icons({
			compiler: 'svelte',
			autoInstall: true
		})
	]
});
