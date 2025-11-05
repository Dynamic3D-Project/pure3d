<script lang="ts">
	import VoyagerViewer from '$lib/components/voyager/VoyagerViewer.svelte';
</script>

<svelte:head>
	<title>Test Voyager Setup | Pure 3D</title>
</svelte:head>

<div class="container mx-auto px-4 py-12 max-w-6xl">
	<div class="text-center mb-8">
		<h1 class="text-4xl font-bold mb-4">Voyager Setup Test</h1>
		<p class="text-base-content/70">
			Testing your locally hosted Voyager installation
		</p>
	</div>

	<!-- Test 1: Direct Voyager HTML -->
	<div class="card bg-base-200 shadow-xl mb-8">
		<div class="card-body">
			<h2 class="card-title">Test 1: Direct Voyager HTML Access</h2>
			<p class="text-sm text-base-content/70 mb-4">
				Check if Voyager files are accessible at /voyager/
			</p>

			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<a
					href="/voyager/voyager-explorer.html"
					target="_blank"
					class="btn btn-outline"
				>
					Open Voyager Explorer →
				</a>
				<a
					href="/voyager/voyager-mini.html"
					target="_blank"
					class="btn btn-outline"
				>
					Open Voyager Mini →
				</a>
			</div>

			<div class="alert alert-info mt-4">
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
				</svg>
				<span class="text-xs">
					These should open Voyager without any models (empty viewer). If you see errors, check that Voyager is in static/voyager/
				</span>
			</div>
		</div>
	</div>

	<!-- Test 2: Component with Smithsonian Content (Iframe) -->
	<div class="card bg-base-200 shadow-xl mb-8">
		<div class="card-body">
			<h2 class="card-title">Test 2: VoyagerViewer Component (Iframe Mode)</h2>
			<p class="text-sm text-base-content/70 mb-4">
				Testing iframe embedding with Smithsonian content
			</p>

			<VoyagerViewer
				url="https://3d-api.si.edu/voyager/3d_package:d8c6443e-4ebc-11ea-b77f-2e728ce88125"
				title="Apollo 11 Command Module"
				direct={false}
			/>

			<div class="alert alert-success mt-4">
				<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<span class="text-xs">
					✅ If you see the Apollo 11 model above, iframe mode is working perfectly!
				</span>
			</div>
		</div>
	</div>

	<!-- Test 3: Component with Local Script (Direct Mode) -->
	<div class="card bg-base-200 shadow-xl mb-8">
		<div class="card-body">
			<h2 class="card-title">Test 3: VoyagerViewer Component (Direct Mode)</h2>
			<p class="text-sm text-base-content/70 mb-4">
				Testing direct embedding with locally hosted Voyager script
			</p>

			<div class="alert alert-warning mb-4">
				<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
				</svg>
				<div>
					<p class="font-bold text-sm">This needs your own 3D model</p>
					<p class="text-xs">
						To test this, add a GLB file to <code>/static/models/example/models/example.glb</code>
					</p>
				</div>
			</div>

			<VoyagerViewer
				url="/models/example/"
				document="document.json"
				title="Example Model"
				direct={true}
				showControls={true}
			/>

			<div class="alert alert-info mt-4">
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
				</svg>
				<div class="text-xs">
					<p class="font-bold mb-2">Expected Results:</p>
					<ul class="list-disc ml-4">
						<li>If you added a model: You'll see it with camera controls</li>
						<li>If no model yet: You'll see a loading spinner or error (that's OK!)</li>
						<li>Check browser console (F12) for any error messages</li>
					</ul>
				</div>
			</div>
		</div>
	</div>

	<!-- Status Checklist -->
	<div class="card bg-base-100 shadow-xl">
		<div class="card-body">
			<h2 class="card-title">Setup Checklist</h2>

			<div class="space-y-3">
				<div class="form-control">
					<label class="label cursor-pointer justify-start gap-3">
						<input type="checkbox" class="checkbox checkbox-primary" />
						<span class="label-text">
							Voyager files exist in <code class="text-xs">static/voyager/</code>
						</span>
					</label>
				</div>

				<div class="form-control">
					<label class="label cursor-pointer justify-start gap-3">
						<input type="checkbox" class="checkbox checkbox-primary" />
						<span class="label-text">
							<code class="text-xs">static/voyager/js/voyager-explorer.min.js</code> exists
						</span>
					</label>
				</div>

				<div class="form-control">
					<label class="label cursor-pointer justify-start gap-3">
						<input type="checkbox" class="checkbox checkbox-primary" />
						<span class="label-text">
							Test 1: Direct HTML links work
						</span>
					</label>
				</div>

				<div class="form-control">
					<label class="label cursor-pointer justify-start gap-3">
						<input type="checkbox" class="checkbox checkbox-primary" />
						<span class="label-text">
							Test 2: Iframe mode shows Apollo 11 model
						</span>
					</label>
				</div>

				<div class="form-control">
					<label class="label cursor-pointer justify-start gap-3">
						<input type="checkbox" class="checkbox checkbox-primary" />
						<span class="label-text">
							<code class="text-xs">static/models/example/document.json</code> exists
						</span>
					</label>
				</div>

				<div class="form-control">
					<label class="label cursor-pointer justify-start gap-3">
						<input type="checkbox" class="checkbox checkbox-primary" />
						<span class="label-text">
							(Optional) Added your own GLB model to test Direct Mode
						</span>
					</label>
				</div>
			</div>

			<div class="divider"></div>

			<div class="prose prose-sm max-w-none">
				<h3 class="text-base font-semibold mb-2">Quick Commands</h3>
				<div class="mockup-code text-xs">
					<pre><code># Check if Voyager files exist
ls static/voyager/js/voyager-explorer.min.js

# Create models directory
mkdir -p static/models/example/models

# Download a free test model (Blender's Suzanne monkey)
# Or use your own GLB file</code></pre>
				</div>
			</div>
		</div>
	</div>

	<!-- Navigation -->
	<div class="flex gap-4 justify-center mt-8">
		<a href="/voyager-api-demo" class="btn btn-primary">
			View Full API Demo
		</a>
		<a href="/collections" class="btn btn-outline">
			Back to Collections
		</a>
	</div>
</div>
