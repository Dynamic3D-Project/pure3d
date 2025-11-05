# Voyager API Integration Guide

This guide explains how to integrate and control the Smithsonian's DPO Voyager 3D viewer in your application.

## Table of Contents

- [Overview](#overview)
- [Two Integration Approaches](#two-integration-approaches)
- [Iframe Mode (Simple)](#iframe-mode-simple)
- [Direct Mode (Full API)](#direct-mode-full-api)
- [VoyagerViewer Component](#voyagerviewer-component)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)

## Overview

The Smithsonian's DPO Voyager is a powerful 3D viewer with support for annotations, articles, tours, and more. You can integrate it in two ways:

1. **Iframe Mode**: Simple embedding with no programmatic control
2. **Direct Mode**: Full API access for programmatic control

## Two Integration Approaches

### Comparison Table

| Feature | Iframe Mode | Direct Mode |
|---------|-------------|-------------|
| Ease of Setup | ✅ Very Easy | ⚠️ Moderate |
| JavaScript Required | ❌ No | ✅ Yes |
| Smithsonian Content | ✅ Yes | ❌ No (CORS) |
| Self-Hosted Content | ✅ Yes | ✅ Yes |
| Programmatic Control | ❌ No | ✅ Full API |
| Camera Control | ❌ No | ✅ Yes |
| Annotation Control | ❌ No | ✅ Yes |
| Event Listeners | ❌ No | ✅ Yes |

## Iframe Mode (Simple)

### When to Use

- Displaying Smithsonian collection items
- Quick embedding without custom controls
- No need for programmatic interaction
- Cross-origin content (different domain)

### Implementation

```svelte
<script>
  import VoyagerViewer from '$lib/components/voyager/VoyagerViewer.svelte';
</script>

<VoyagerViewer
  url="https://3d-api.si.edu/voyager/3d_package:d8c6443e-4ebc-11ea-b77f-2e728ce88125"
  title="Apollo 11 Command Module"
  direct={false}
/>
```

### Raw HTML

```html
<iframe
  name="Smithsonian Voyager"
  src="https://3d-api.si.edu/voyager/3d_package:d8c6443e-4ebc-11ea-b77f-2e728ce88125"
  width="800"
  height="450"
  allow="xr; xr-spatial-tracking; fullscreen"
></iframe>
```

### Finding Voyager Package IDs

1. Visit [3d.si.edu](https://3d.si.edu)
2. Browse or search for a 3D model
3. Click on a model to open Voyager
4. Click "Share" in the menu
5. Copy the package ID from the URL

## Direct Mode (Full API)

### When to Use

- Self-hosted 3D content (SVX documents)
- Need programmatic camera control
- Want to control annotations/articles/tours
- Need to listen to Voyager events
- Building custom UI controls

### Requirements

1. **Self-hosted content**: Your SVX documents must be on your server
2. **CORS headers**: Your server must allow cross-origin requests
3. **Voyager script**: The component loads the Voyager JS library

### Implementation

```svelte
<script>
  import VoyagerViewer from '$lib/components/voyager/VoyagerViewer.svelte';
</script>

<VoyagerViewer
  url="https://your-domain.com/content/my-model/"
  document="document.json"
  title="My 3D Model"
  direct={true}
  showControls={true}
/>
```

### Why Smithsonian Content Doesn't Work in Direct Mode

Smithsonian's content is hosted on `3d-api.si.edu`, which has CORS restrictions that prevent JavaScript on your domain from accessing the Voyager component methods. This is a browser security feature.

**Solution**: Host your own Voyager documents (SVX files) on your server.

## VoyagerViewer Component

### Props

```typescript
interface Props {
  /** URL for iframe mode OR root path for direct mode */
  url: string;

  /** Document path (only for direct mode) */
  document?: string;

  /** Title for accessibility */
  title: string;

  /** Use direct embedding instead of iframe */
  direct?: boolean;

  /** Show control toolbar (only available in direct mode) */
  showControls?: boolean;

  /** UI mode - controls which UI elements are visible initially
   * Options: "none" (hide all), "none|title" (only title), "all" (show all)
   * Default: "none" for API-controlled mode
   */
  uiMode?: string;

  /** Enable/disable camera controls
   * Default: true
   */
  enableControls?: boolean;

  /** Show/hide interaction prompt
   * Default: false
   */
  showPrompt?: boolean;

  /** Show/hide reader initially
   * Default: false
   */
  showReader?: boolean;
}
```

### Examples

#### Basic Iframe

```svelte
<VoyagerViewer
  url="https://3d-api.si.edu/voyager/3d_package:abc123"
  title="My Model"
/>
```

#### Direct with Controls (Clean UI)

```svelte
<VoyagerViewer
  url="https://my-site.com/models/apollo/"
  document="scene.svx.json"
  title="Apollo Model"
  direct={true}
  showControls={true}
  uiMode="none"
  enableControls={true}
  showPrompt={false}
  showReader={false}
/>
```

This configuration provides:
- ✅ Clean viewer with no UI elements visible
- ✅ Camera controls enabled (user can orbit/zoom)
- ✅ Full API control to toggle UI elements
- ✅ No interaction prompts or popups

#### Show Specific UI Elements

```svelte
<!-- Show only title and menu -->
<VoyagerViewer
  url="https://my-site.com/models/apollo/"
  document="scene.svx.json"
  title="Apollo Model"
  direct={true}
  uiMode="none|title|menu"
/>
```

## UI Configuration

### Controlling Initial UI Visibility

The `uiMode` attribute controls which UI elements are visible when Voyager first loads. This is perfect for creating clean, API-controlled experiences.

#### UI Mode Options

```svelte
<!-- Hide everything (cleanest API-controlled mode) -->
<VoyagerViewer uiMode="none" />

<!-- Show only title -->
<VoyagerViewer uiMode="none|title" />

<!-- Show all UI elements (default Voyager behavior) -->
<VoyagerViewer uiMode="all" />

<!-- Combine multiple elements -->
<VoyagerViewer uiMode="none|title|menu|tools" />
```

#### Available UI Elements

The following elements can be combined in `uiMode` using the pipe (`|`) character:

- `title` - Scene/model title
- `menu` - Main menu bar
- `tools` - Tools panel
- `annotations` - Annotation markers
- `reader` - Article reader panel
- `tours` - Tours panel
- `all` - All UI elements
- `none` - No UI elements

#### Additional Configuration Attributes

```svelte
<!-- Disable camera controls completely -->
<VoyagerViewer enableControls={false} />

<!-- Hide the interaction prompt -->
<VoyagerViewer showPrompt={false} />

<!-- Start with reader open -->
<VoyagerViewer showReader={true} />
```

### Best Practices

**For API-Controlled Experiences:**
```svelte
<VoyagerViewer
  uiMode="none"
  enableControls={true}    // Allow user to orbit/zoom
  showPrompt={false}       // No popups
  showReader={false}       // Start clean
  showControls={true}      // Show your custom controls
/>
```

**For Standard Viewer:**
```svelte
<VoyagerViewer
  uiMode="all"
  direct={true}
/>
```

**For Minimal Viewer with Branding:**
```svelte
<VoyagerViewer
  uiMode="none|title"
  enableControls={true}
/>
```

## API Reference

### Methods

All methods are available when using `direct={true}` mode.

#### Camera Control

```javascript
// Set camera orbit position
setCameraOrbit(yaw: number, pitch: number)
// Parameters:
//   yaw: -180 to 180 degrees
//   pitch: -90 to 90 degrees

// Get current camera position
getCameraOrbit(type?: string)
// Parameters:
//   type: 'min' | 'max' | 'active' (optional)
// Returns: [yaw, pitch] in radians

// Set camera offset
setCameraOffset(x: number, y: number, z: number)
// Parameters: x, y, z in scene units

// Get camera offset
getCameraOffset(type?: string)
// Parameters:
//   type: 'min' | 'max' | 'active' (optional)
// Returns: [x, y, z]
```

#### Annotations

```javascript
// Activate a specific annotation
setActiveAnnotation(id: string)
// Pass empty string or invalid ID to deactivate

// Toggle annotation visibility
toggleAnnotations()

// Get all available annotations
getAnnotations()
// Returns: Array<{
//   id: string,
//   titles: { EN: string, ... },
//   ...
// }>
```

#### Articles

```javascript
// Open a specific article
setActiveArticle(id: string)

// Toggle article reader
toggleReader()

// Get all available articles
getArticles()
// Returns: Array<{
//   id: string,
//   titles: { EN: string, ... },
//   ...
// }>
```

#### Tours

```javascript
// Navigate to a specific tour step
setTourStep(tourIdx: number, stepIdx: number, interpolate?: boolean)
// Parameters:
//   tourIdx: tour index
//   stepIdx: step index within tour
//   interpolate: animate transition (optional)

// Toggle tours panel
toggleTours()
```

#### UI Controls

```javascript
// Toggle extended tools panel
toggleTools()

// Toggle measurement tool
toggleMeasurement()

// Set background style
setBackgroundStyle(style: string)
// Parameters:
//   style: 'Solid' | 'LinearGradient' | 'RadialGradient'

// Set background color(s)
setBackgroundColor(color0: string, color1?: string)
// Parameters:
//   color0: CSS color value
//   color1: CSS color value (optional, for gradients)

// Enable AR mode (platform dependent)
enableAR()

// Set interface language
setLanguage(languageCode: string)
// Parameters:
//   languageCode: ISO 639-1 code (e.g., 'en', 'es', 'fr')
```

### Events

Listen to events from Voyager:

```javascript
voyagerElement.addEventListener('model-load', (event) => {
  console.log('Model loaded:', event.detail);
  // event.detail contains model information
});

voyagerElement.addEventListener('annotation-active', (event) => {
  console.log('Active annotation ID:', event.detail);
  // event.detail contains the annotation ID (or null)
});
```

## Examples

### Example 1: Custom Camera Control

```svelte
<script lang="ts">
  import VoyagerViewer from '$lib/components/voyager/VoyagerViewer.svelte';

  let voyagerElement: HTMLElement | undefined;

  function rotateTo(yaw: number, pitch: number) {
    if (voyagerElement) {
      (voyagerElement as any).setCameraOrbit(yaw, pitch);
    }
  }
</script>

<div>
  <button onclick={() => rotateTo(0, -25)}>Front View</button>
  <button onclick={() => rotateTo(90, -25)}>Side View</button>
  <button onclick={() => rotateTo(180, -25)}>Back View</button>

  <voyager-explorer
    bind:this={voyagerElement}
    root="https://my-site.com/models/"
    document="model.json"
  />
</div>
```

### Example 2: Jump to Annotations

```svelte
<script lang="ts">
  import VoyagerViewer from '$lib/components/voyager/VoyagerViewer.svelte';
  import { onMount } from 'svelte';

  let voyagerElement: HTMLElement | undefined;
  let annotations = $state<any[]>([]);

  onMount(() => {
    if (voyagerElement) {
      voyagerElement.addEventListener('model-load', () => {
        annotations = (voyagerElement as any).getAnnotations();
      });
    }
  });

  function showAnnotation(id: string) {
    if (voyagerElement) {
      (voyagerElement as any).setActiveAnnotation(id);
    }
  }
</script>

<div class="annotation-list">
  {#each annotations as annotation}
    <button onclick={() => showAnnotation(annotation.id)}>
      {annotation.title}
    </button>
  {/each}
</div>

<voyager-explorer
  bind:this={voyagerElement}
  root="https://my-site.com/models/"
  document="model.json"
/>
```

### Example 3: Programmatic Tour

```svelte
<script lang="ts">
  import VoyagerViewer from '$lib/components/voyager/VoyagerViewer.svelte';

  let voyagerElement: HTMLElement | undefined;

  async function autoTour() {
    if (!voyagerElement) return;

    const annotations = (voyagerElement as any).getAnnotations();

    for (const annotation of annotations) {
      (voyagerElement as any).setActiveAnnotation(annotation.id);
      await new Promise(resolve => setTimeout(resolve, 3000)); // 3 sec each
    }
  }
</script>

<button onclick={autoTour}>Start Auto Tour</button>

<voyager-explorer
  bind:this={voyagerElement}
  root="https://my-site.com/models/"
  document="model.json"
/>
```

## Troubleshooting

### "Cannot read property 'setActiveAnnotation' of undefined"

**Cause**: Trying to call API methods before Voyager is loaded.

**Solution**: Wait for the `model-load` event or use a timeout:

```javascript
voyagerElement.addEventListener('model-load', () => {
  // Now safe to call API methods
  voyagerElement.setActiveAnnotation('abc123');
});
```

### "CORS policy blocked"

**Cause**: Trying to use Direct Mode with cross-origin content.

**Solution**: Either:
1. Use Iframe Mode for cross-origin content
2. Host your content on the same domain
3. Configure CORS headers on your content server

### No Methods Available

**Cause**: Using Iframe Mode but trying to call API methods.

**Solution**: Switch to Direct Mode (`direct={true}`)

### Voyager Not Loading

**Check**:
1. Is the URL correct?
2. Is the network connection working?
3. Are you using the correct document path?
4. Check browser console for errors

## Creating Your Own SVX Documents

To use Direct Mode with your own content, you need to create SVX (Scene Voyager XML) documents:

1. Use Voyager Story authoring tool
2. Export your scene as SVX format
3. Host the documents on your server
4. Ensure CORS headers are configured

### Example SVX Structure

```
my-model/
├── document.json          # Main scene file
├── models/
│   └── model.glb         # 3D model
├── articles/
│   └── article1.html     # Article content
└── images/
    └── thumbnail.jpg     # Preview images
```

## Additional Resources

- [Official Voyager Documentation](https://smithsonian.github.io/dpo-voyager/)
- [API Reference](https://smithsonian.github.io/dpo-voyager/explorer/api/)
- [API Examples](https://smithsonian.github.io/dpo-voyager/explorer/api-examples/)
- [GitHub Repository](https://github.com/Smithsonian/dpo-voyager)
- [Demo Page](/voyager-api-demo) - Compare both modes

## Summary

**Use Iframe Mode when:**
- You want to display Smithsonian collection items
- You don't need programmatic control
- You want the simplest implementation

**Use Direct Mode when:**
- You have self-hosted Voyager documents
- You need custom controls and interactions
- You want to build a guided experience
- You need to listen to events from Voyager

Both modes work great for different use cases. Choose based on your content source and control requirements!
