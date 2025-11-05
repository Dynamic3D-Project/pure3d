<script lang="ts">
	import VoyagerViewer from '$lib/components/voyager/VoyagerViewer.svelte';

	let activeMode = $state<'iframe' | 'direct'>('iframe');
</script>

<svelte:head>
	<title>Voyager API Demo | Pure 3D</title>
	<meta name="description" content="Demonstration of Voyager API integration modes" />
</svelte:head>

<div class="container mx-auto px-4 py-12 max-w-7xl">
	<!-- Header -->
	<div class="text-center mb-12">
		<h1 class="text-4xl md:text-5xl font-bold mb-4">Voyager API Demo</h1>
		<p class="text-lg text-base-content/70 max-w-3xl mx-auto">
			Compare iframe embedding vs direct component integration with full API control
		</p>
	</div>

	<!-- Mode Toggle -->
	<div class="flex justify-center mb-8">
		<div class="tabs tabs-boxed">
			<button
				class="tab"
				class:tab-active={activeMode === 'iframe'}
				onclick={() => (activeMode = 'iframe')}
			>
				Iframe Mode (Simple)
			</button>
			<button
				class="tab"
				class:tab-active={activeMode === 'direct'}
				onclick={() => (activeMode = 'direct')}
			>
				Direct Mode (Full API)
			</button>
		</div>
	</div>

	<!-- Explanation Cards -->
	<div class="grid md:grid-cols-2 gap-6 mb-12">
		<!-- Iframe Mode Info -->
		<div class="card bg-base-200 shadow-xl">
			<div class="card-body">
				<h2 class="card-title text-lg">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
						/>
					</svg>
					Iframe Mode
				</h2>
				<div class="prose prose-sm">
					<p class="text-base-content/80">
						<strong>Best for:</strong> Displaying Smithsonian collection items
					</p>
					<ul class="text-sm">
						<li>Simple HTML iframe tag</li>
						<li>No JavaScript required</li>
						<li>Works with Smithsonian's hosted content</li>
						<li>No programmatic control (cross-origin)</li>
					</ul>
				</div>
				<div class="alert alert-info mt-4">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						class="stroke-current shrink-0 w-6 h-6"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						></path>
					</svg>
					<span class="text-xs">This is what we're currently using in the editions pages</span>
				</div>
			</div>
		</div>

		<!-- Direct Mode Info -->
		<div class="card bg-base-200 shadow-xl">
			<div class="card-body">
				<h2 class="card-title text-lg">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
						/>
					</svg>
					Direct Mode
				</h2>
				<div class="prose prose-sm">
					<p class="text-base-content/80">
						<strong>Best for:</strong> Self-hosted content with custom controls
					</p>
					<ul class="text-sm">
						<li>Full JavaScript API access</li>
						<li>Programmatic camera control</li>
						<li>Annotation & article management</li>
						<li>Toggle UI elements dynamically</li>
						<li>Requires CORS-enabled content</li>
					</ul>
				</div>
				<div class="alert alert-warning mt-4">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="stroke-current shrink-0 h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
						/>
					</svg>
					<span class="text-xs">Requires self-hosted Voyager documents (SVX files)</span>
				</div>
			</div>
		</div>
	</div>

	<!-- Viewer Demo -->
	<div class="card bg-base-100 shadow-2xl">
		<div class="card-body">
			{#if activeMode === 'iframe'}
				<h2 class="card-title mb-4">Iframe Embedding Example</h2>
				<VoyagerViewer
					url="https://3d-api.si.edu/voyager/3d_package:d8c6443e-4ebc-11ea-b77f-2e728ce88125"
					title="Apollo 11 Command Module"
					direct={false}
				/>
				<div class="mt-4">
					<div class="mockup-code text-xs">
						<pre><code>&lt;VoyagerViewer
  url="https://3d-api.si.edu/voyager/3d_package:..."
  title="Apollo 11 Command Module"
  direct={'{false}'}
/&gt;</code></pre>
					</div>
				</div>
			{:else}
				<h2 class="card-title mb-4">Direct Embedding with API Controls</h2>
				<div class="alert alert-warning mb-4">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="stroke-current shrink-0 h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
						/>
					</svg>
					<div>
						<p class="font-bold">Demo Limitation</p>
						<p class="text-sm">
							This demo shows the UI controls, but Smithsonian's hosted content doesn't support
							direct embedding due to CORS restrictions. To use this mode, you'll need to:
						</p>
						<ul class="text-xs mt-2 ml-4 list-disc">
							<li>Self-host your Voyager documents (SVX files)</li>
							<li>Configure proper CORS headers on your server</li>
							<li>Use the document parameter to point to your SVX file</li>
						</ul>
					</div>
				</div>
				<VoyagerViewer
					url="https://3d-api.si.edu/content/document/3d_package:d8c6443e-4ebc-11ea-b77f-2e728ce88125/"
					document="document.json"
					title="Apollo 11 Command Module"
					direct={true}
					showControls={true}
				/>
				<div class="mt-4">
					<div class="mockup-code text-xs">
						<pre><code>&lt;VoyagerViewer
  url="https://your-domain.com/content/path/"
  document="document.json"
  title="Your 3D Model"
  direct={'{true}'}
  showControls={'{true}'}
/&gt;</code></pre>
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- API Documentation -->
	<div class="mt-12">
		<h2 class="text-2xl font-bold mb-6">Available API Methods</h2>
		<div class="overflow-x-auto">
			<table class="table table-zebra">
				<thead>
					<tr>
						<th>Method</th>
						<th>Description</th>
						<th>Parameters</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td><code class="text-sm">setCameraOrbit(yaw, pitch)</code></td>
						<td>Control camera rotation</td>
						<td>yaw: -180 to 180, pitch: -90 to 90</td>
					</tr>
					<tr>
						<td><code class="text-sm">setActiveAnnotation(id)</code></td>
						<td>Activate a specific annotation</td>
						<td>id: annotation identifier string</td>
					</tr>
					<tr>
						<td><code class="text-sm">setActiveArticle(id)</code></td>
						<td>Open a specific article</td>
						<td>id: article identifier string</td>
					</tr>
					<tr>
						<td><code class="text-sm">toggleAnnotations()</code></td>
						<td>Show/hide all annotations</td>
						<td>none</td>
					</tr>
					<tr>
						<td><code class="text-sm">toggleReader()</code></td>
						<td>Show/hide article reader</td>
						<td>none</td>
					</tr>
					<tr>
						<td><code class="text-sm">toggleTours()</code></td>
						<td>Show/hide tours panel</td>
						<td>none</td>
					</tr>
					<tr>
						<td><code class="text-sm">getAnnotations()</code></td>
						<td>Retrieve all available annotations</td>
						<td>none - returns array</td>
					</tr>
					<tr>
						<td><code class="text-sm">getArticles()</code></td>
						<td>Retrieve all available articles</td>
						<td>none - returns array</td>
					</tr>
					<tr>
						<td><code class="text-sm">getCameraOrbit()</code></td>
						<td>Get current camera position</td>
						<td>none - returns {'{yaw, pitch}'}</td>
					</tr>
					<tr>
						<td><code class="text-sm">setLanguage(id)</code></td>
						<td>Change interface language</td>
						<td>id: language code (e.g., 'en', 'es')</td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>

	<!-- Resources -->
	<div class="mt-12">
		<h2 class="text-2xl font-bold mb-6">Resources</h2>
		<div class="grid md:grid-cols-3 gap-4">
			<a
				href="https://smithsonian.github.io/dpo-voyager/explorer/api/"
				target="_blank"
				rel="noopener noreferrer"
				class="card bg-base-200 hover:bg-base-300 transition-colors"
			>
				<div class="card-body">
					<h3 class="card-title text-base">Official API Docs</h3>
					<p class="text-sm text-base-content/70">Complete Voyager Explorer API reference</p>
				</div>
			</a>
			<a
				href="https://smithsonian.github.io/dpo-voyager/explorer/api-examples/"
				target="_blank"
				rel="noopener noreferrer"
				class="card bg-base-200 hover:bg-base-300 transition-colors"
			>
				<div class="card-body">
					<h3 class="card-title text-base">API Examples</h3>
					<p class="text-sm text-base-content/70">Interactive examples from Smithsonian</p>
				</div>
			</a>
			<a
				href="https://github.com/Smithsonian/dpo-voyager"
				target="_blank"
				rel="noopener noreferrer"
				class="card bg-base-200 hover:bg-base-300 transition-colors"
			>
				<div class="card-body">
					<h3 class="card-title text-base">GitHub Repository</h3>
					<p class="text-sm text-base-content/70">Source code and documentation</p>
				</div>
			</a>
		</div>
	</div>
</div>
