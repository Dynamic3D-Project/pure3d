<script lang="ts">
	import VoyagerViewer from '$lib/components/voyager/VoyagerViewer.svelte';

	let activeMode = $state<'iframe' | 'direct'>('iframe');
</script>

<svelte:head>
	<title>Voyager API Demo | Pure 3D</title>
	<meta name="description" content="Demonstration of Voyager API integration modes" />
</svelte:head>

<div class=" mx-auto px-4 py-12">
	<!-- Header -->
	<div class="mb-12 text-center">
		<h1 class="mb-4 text-4xl font-bold md:text-5xl">Voyager API Demo</h1>
		<p class="mx-auto max-w-3xl text-lg text-base-content/70">
			Compare iframe embedding vs direct component integration with full API control
		</p>
	</div>

	<!-- Mode Toggle -->
	<div class="mb-8 flex justify-center">
		<div class="tabs-boxed tabs">
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
	<div class="mb-12 grid gap-6 md:grid-cols-2">
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
				<div class="mt-4 alert alert-info">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						class="h-6 w-6 shrink-0 stroke-current"
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
				<div class="mt-4 alert alert-warning">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6 shrink-0 stroke-current"
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
	<!-- <div class="card bg-base-100 shadow-2xl">
		<div class="card-body">
			{#if activeMode === 'iframe'}
				<h2 class="mb-4 card-title">Iframe Embedding Example</h2>
				<VoyagerViewer
					url="https://3d-api.si.edu/voyager/3d_package:d8c6443e-4ebc-11ea-b77f-2e728ce88125"
					title="Apollo 11 Command Module"
					direct={false}
				/>
				<div class="mt-4">
					<div class="mockup-code text-xs">
						<pre><code
								>&lt;VoyagerViewer
  url="https://3d-api.si.edu/voyager/3d_package:..."
  title="Apollo 11 Command Module"
  direct={'{false}'}
/&gt;</code
							></pre>
					</div>
				</div>
			{:else}
				<h2 class="mb-4 card-title">Direct Embedding with Full API Control</h2>
				<div class="mb-4 alert alert-info">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						class="h-6 w-6 shrink-0 stroke-current"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						></path>
					</svg>
					<div>
						<p class="font-bold">Clean UI - API Controlled</p>
						<p class="text-sm">
							All UI elements are hidden by default (<code class="text-xs">uiMode="none"</code>).
							Use the API controls below to toggle annotations, reader, tours, and other UI
							elements. This gives you complete programmatic control over the viewer experience.
						</p>
					</div>
				</div>
				<div class="mb-4 alert alert-warning">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6 shrink-0 stroke-current"
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
							Smithsonian's hosted content doesn't support direct embedding due to CORS
							restrictions. To fully test this mode with your own content:
						</p>
						<ul class="mt-2 ml-4 list-disc text-xs">
							<li>Self-host your Voyager documents (SVX files)</li>
							<li>Configure proper CORS headers on your server</li>
							<li>Update the url and document parameters</li>
						</ul>
					</div>
				</div>
				<VoyagerViewer
					url="https://3d-api.si.edu/content/document/3d_package:d8c6443e-4ebc-11ea-b77f-2e728ce88125/"
					document="document.json"
					title="Apollo 11 Command Module"
					direct={true}
					showControls={true}
					uiMode="none"
					enableControls={true}
					showPrompt={false}
				/>
				<div class="mt-4">
					<div class="mockup-code text-xs">
						<pre><code
								>&lt;VoyagerViewer
  url="https://your-domain.com/content/path/"
  document="document.json"
  title="Your 3D Model"
  direct={'{true}'}
  showControls={'{true}'}
  uiMode="none"           // Hide all UI elements initially
  enableControls={'{true}'}  // Keep camera controls enabled
  showPrompt={'{false}'}     // Hide interaction prompt
  showReader={'{false}'}     // Hide reader initially
/&gt;</code
							></pre>
					</div>
				</div>
			{/if}
		</div>
	</div> -->

	<!-- API Documentation -->
	<div class="mt-12">
		<h2 class="mb-6 text-2xl font-bold">Available API Methods</h2>
		<div class="overflow-x-auto">
			<table class="table table-zebra">
				<thead>
					<tr>
						<th>Category</th>
						<th>Method</th>
						<th>Description</th>
						<th>Parameters</th>
					</tr>
				</thead>
				<tbody>
					<!-- Camera Control -->
					<tr>
						<td rowspan="4" class="font-semibold">Camera</td>
						<td><code class="text-sm">setCameraOrbit(yaw, pitch)</code></td>
						<td>Set orbital camera angles</td>
						<td>yaw, pitch: degrees</td>
					</tr>
					<tr>
						<td><code class="text-sm">getCameraOrbit(type?)</code></td>
						<td>Get camera angles</td>
						<td>type: 'min'|'max'|'active' - returns [yaw, pitch]</td>
					</tr>
					<tr>
						<td><code class="text-sm">setCameraOffset(x, y, z)</code></td>
						<td>Set orbit navigation offset</td>
						<td>x, y, z: scene units</td>
					</tr>
					<tr>
						<td><code class="text-sm">getCameraOffset(type?)</code></td>
						<td>Get camera offset</td>
						<td>type: 'min'|'max'|'active' - returns [x, y, z]</td>
					</tr>

					<!-- Annotations -->
					<tr>
						<td rowspan="3" class="font-semibold">Annotations</td>
						<td><code class="text-sm">setActiveAnnotation(id)</code></td>
						<td>Activate specific annotation</td>
						<td>id: annotation identifier</td>
					</tr>
					<tr>
						<td><code class="text-sm">toggleAnnotations()</code></td>
						<td>Toggle all annotations visibility</td>
						<td>none</td>
					</tr>
					<tr>
						<td><code class="text-sm">getAnnotations()</code></td>
						<td>Get all annotations</td>
						<td>none - returns array</td>
					</tr>

					<!-- Articles -->
					<tr>
						<td rowspan="3" class="font-semibold">Articles</td>
						<td><code class="text-sm">setActiveArticle(id)</code></td>
						<td>Open specific article</td>
						<td>id: article identifier</td>
					</tr>
					<tr>
						<td><code class="text-sm">toggleReader()</code></td>
						<td>Toggle article reader panel</td>
						<td>none</td>
					</tr>
					<tr>
						<td><code class="text-sm">getArticles()</code></td>
						<td>Get all articles</td>
						<td>none - returns array</td>
					</tr>

					<!-- Tours -->
					<tr>
						<td rowspan="3" class="font-semibold">Tours</td>
						<td><code class="text-sm">setTourStep(tourIdx, stepIdx, interpolate?)</code></td>
						<td>Navigate to tour step</td>
						<td>tourIdx, stepIdx: indices; interpolate: boolean</td>
					</tr>
					<tr>
						<td><code class="text-sm">toggleTours()</code></td>
						<td>Toggle tours panel</td>
						<td>none</td>
					</tr>
					<tr>
						<td><code class="text-sm">getTours()</code></td>
						<td>Get all tours</td>
						<td>none - returns array</td>
					</tr>

					<!-- UI Controls -->
					<tr>
						<td rowspan="6" class="font-semibold">UI</td>
						<td><code class="text-sm">toggleTools()</code></td>
						<td>Toggle extended tools panel</td>
						<td>none</td>
					</tr>
					<tr>
						<td><code class="text-sm">toggleMeasurement()</code></td>
						<td>Toggle measurement tool</td>
						<td>none</td>
					</tr>
					<tr>
						<td><code class="text-sm">setBackgroundStyle(style)</code></td>
						<td>Set background appearance</td>
						<td>style: 'Solid'|'LinearGradient'|'RadialGradient'</td>
					</tr>
					<tr>
						<td><code class="text-sm">setBackgroundColor(color0, color1?)</code></td>
						<td>Set background color(s)</td>
						<td>color0, color1: CSS color values</td>
					</tr>
					<tr>
						<td><code class="text-sm">setLanguage(id)</code></td>
						<td>Change interface language</td>
						<td>id: ISO 639-1 code (e.g., 'en', 'es')</td>
					</tr>
					<tr>
						<td><code class="text-sm">enableAR()</code></td>
						<td>Request AR session</td>
						<td>none - platform dependent</td>
					</tr>
				</tbody>
			</table>
		</div>

		<!-- Events Section -->
		<div class="mt-8">
			<h3 class="mb-4 text-xl font-bold">Events</h3>
			<div class="overflow-x-auto">
				<table class="table table-zebra">
					<thead>
						<tr>
							<th>Event</th>
							<th>Description</th>
							<th>Event Detail</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td><code class="text-sm">model-load</code></td>
							<td>Fires after model loads</td>
							<td>derivative quality level</td>
						</tr>
						<tr>
							<td><code class="text-sm">annotation-active</code></td>
							<td>Fires when annotation state changes</td>
							<td>annotation ID or null</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</div>

	<!-- Resources -->
	<div class="mt-12">
		<h2 class="mb-6 text-2xl font-bold">Resources</h2>
		<div class="grid gap-4 md:grid-cols-3">
			<a
				href="https://smithsonian.github.io/dpo-voyager/explorer/api/"
				target="_blank"
				rel="noopener noreferrer"
				class="card bg-base-200 transition-colors hover:bg-base-300"
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
				class="card bg-base-200 transition-colors hover:bg-base-300"
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
				class="card bg-base-200 transition-colors hover:bg-base-300"
			>
				<div class="card-body">
					<h3 class="card-title text-base">GitHub Repository</h3>
					<p class="text-sm text-base-content/70">Source code and documentation</p>
				</div>
			</a>
		</div>
	</div>
</div>
