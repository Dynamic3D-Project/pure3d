# Hosting Voyager Yourself - Quick Guide

Good news! **Voyager Explorer is purely static** - no server-side code needed! You can serve it like any other static files.

## ❌ NO Server-Side Required

- ❌ No Node.js server needed
- ❌ No API routes needed (`/api/voyager` not necessary)
- ❌ No special backend endpoints
- ✅ Just static HTML, CSS, and JavaScript files
- ✅ Works on Netlify, Vercel, or any static host

## 📁 Where to Put Voyager Files

### Option 1: In `static` folder (Recommended)

Put Voyager files in your SvelteKit `static` folder:

```
pure3D-26/
├── static/
│   └── voyager/                    # Put Voyager here
│       ├── voyager-explorer.html   # Main viewer
│       ├── js/
│       │   └── voyager-explorer.min.js
│       ├── css/
│       └── fonts/
```

Then access at: `http://localhost:5173/voyager/voyager-explorer.html`

### Option 2: Use Smithsonian's CDN (Current approach)

You're already using this! Just load the script from their CDN:

```html
<script src="https://3d-api.si.edu/resources/js/voyager-explorer.min.js"></script>
```

## 🚀 Quick Setup (Self-Hosted)

### Step 1: Download Voyager

```bash
cd /tmp
# Get the latest release
wget https://github.com/Smithsonian/dpo-voyager/releases/download/v0.56.1/voyager-v0.56.1.zip
# Or use curl
curl -L -O https://github.com/Smithsonian/dpo-voyager/releases/download/v0.56.1/voyager-v0.56.1.zip

# Unzip
unzip voyager-v0.56.1.zip
```

### Step 2: Copy to Your Project

```bash
# Copy the dist folder contents to static/voyager
cd /Users/ctw/Sites/github/escience/Dynamic3D/pure3D-26
mkdir -p static/voyager
cp -r /tmp/voyager-v0.56.1/dist/* static/voyager/
```

### Step 3: Update Your Component

Update `VoyagerViewer.svelte` to use local Voyager:

```svelte
<script lang="ts">
  // Change this line:
  // script.src = 'https://3d-api.si.edu/resources/js/voyager-explorer.min.js';

  // To this:
  script.src = '/voyager/js/voyager-explorer.min.js';
</script>
```

## 📦 What You Get

The Voyager distribution includes:

```
dist/
├── voyager-explorer.html       # Standalone viewer
├── voyager-explorer-dev.html   # Dev version
├── voyager-story.html          # Authoring tool (needs WebDAV)
├── voyager-mini.html           # Lightweight viewer
├── js/
│   ├── voyager-explorer.min.js # Main component
│   ├── voyager-explorer.dev.js # Dev version
│   └── ...
├── css/
│   └── voyager-explorer.min.css
├── fonts/
└── images/
```

## 🎯 Your Documents Structure

For your own 3D content, create this structure:

```
static/
├── voyager/                    # Voyager app files
│   ├── js/
│   ├── css/
│   └── ...
└── models/                     # Your 3D content
    ├── apollo-11/
    │   ├── document.json       # Scene file
    │   ├── models/
    │   │   └── apollo.glb
    │   ├── articles/
    │   │   └── history.html
    │   └── images/
    │       └── thumb.jpg
    └── otoscopy/
        ├── document.json
        └── ...
```

## 🔧 Using Your Hosted Content

```svelte
<VoyagerViewer
  url="/models/apollo-11/"
  document="document.json"
  title="Apollo 11 Command Module"
  direct={true}
  showControls={true}
/>
```

## 🌐 Alternative: Keep Using Smithsonian's CDN

**Honestly, the easiest approach is what you're already doing:**

1. Use Smithsonian's CDN for the Voyager component
2. Host only YOUR document files (SVX) in `static/models/`
3. Load the script from their CDN

```svelte
<script>
  const script = document.createElement('script');
  script.src = 'https://3d-api.si.edu/resources/js/voyager-explorer.min.js';
  document.head.appendChild(script);
</script>

<voyager-explorer
  root="/models/apollo-11/"
  document="document.json"
/>
```

## ✅ Recommended Approach

**For your use case, I recommend:**

### For Smithsonian Content (Current editions pages)
- ✅ Keep using iframe mode
- ✅ No setup needed
- ✅ Works perfectly as-is

### For Your Own Custom Content (Future)
1. ✅ Keep using Smithsonian's CDN for the Voyager component
2. ✅ Host only your SVX documents in `static/models/`
3. ✅ Use Direct Mode with the VoyagerViewer component

## 🎬 Creating Your Own SVX Documents

To create the `document.json` files:

### Option 1: Use Voyager Story (GUI)
1. Download and run Voyager Story
2. Import your 3D models
3. Add annotations, articles, tours
4. Export as SVX

### Option 2: Manual JSON (Advanced)
Create a `document.json` file:

```json
{
  "asset": {
    "type": "application/si-dpo-3d.document+json",
    "version": "1.0"
  },
  "scene": 0,
  "scenes": [{
    "units": "cm",
    "name": "Main Scene",
    "nodes": [0],
    "setup": 0
  }],
  "nodes": [{
    "name": "Model",
    "model": 0
  }],
  "models": [{
    "units": "cm",
    "derivatives": [{
      "usage": "Web3D",
      "quality": "High",
      "assets": [{
        "uri": "models/model.glb",
        "type": "Model",
        "mimeType": "model/gltf-binary"
      }]
    }]
  }],
  "setups": [{
    "units": "cm",
    "interface": {
      "visible": true,
      "logo": true,
      "menu": true
    },
    "viewer": {
      "shader": "Default",
      "exposure": 1.0,
      "gamma": 2.0
    }
  }]
}
```

## 📝 Summary

**You DON'T need:**
- ❌ SvelteKit API routes
- ❌ Server-side endpoints
- ❌ Node.js backend
- ❌ Special hosting

**You DO need:**
- ✅ Static file hosting (you already have this)
- ✅ Your 3D model files (GLB/GLTF)
- ✅ SVX document files (JSON)
- ✅ Either self-hosted or CDN Voyager scripts

**Current Setup:**
Your current implementation using Smithsonian's iframes is **perfect** for displaying their content. No changes needed!

**For Full API Control:**
When you want to add your own models with custom controls:
1. Create SVX documents for your models
2. Put them in `static/models/`
3. Use the VoyagerViewer component with `direct={true}`
4. Load Voyager script from Smithsonian's CDN (or self-host)

That's it! No server-side code required. 🎉
