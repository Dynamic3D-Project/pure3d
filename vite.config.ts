import { execSync } from 'child_process';
import devtoolsJson from 'vite-plugin-devtools-json';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
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
	define: {
		__APP_VERSION__: JSON.stringify(getVersion()),
		__BUILD_DATE__: JSON.stringify(new Date().toISOString())
	},
	plugins: [
		tailwindcss(),
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
