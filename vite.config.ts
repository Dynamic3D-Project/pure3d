import { execSync } from 'child_process';
import { readFileSync } from 'node:fs';
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

export default defineConfig(({ command, isPreview }) => ({
	server: {
		host: '0.0.0.0',
		port: 60020,
		allowedHosts: ['m3-max.tail33436f.ts.net'],
		...(command === 'serve' && !isPreview && process.env.DEV_HTTPS === '1'
			? {
					strictPort: true,
					https: {
						cert: readFileSync('.certs/localhost.pem'),
						key: readFileSync('.certs/localhost-key.pem')
					},
					proxy: {
						'^/api(?:/|$)': {
							target: process.env.DEV_POCKETBASE_TARGET,
							changeOrigin: true
						},
						'^/assets(?:/|\\?|$)': {
							target: process.env.DEV_ASSET_TARGET,
							changeOrigin: true,
							rewrite: (path: string) =>
								path.replace(
									/^\/assets(?=\/|\?|$)/,
									() => `/${encodeURIComponent(process.env.DEV_ASSET_BUCKET || 'pure3d-assets')}`
								)
						}
					}
				}
			: {})
	},
	preview: {
		port: 60025
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
}));
