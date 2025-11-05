# Example Model Directory

This is an example structure for hosting your own 3D models with Voyager.

## Current Structure

```
example/
├── document.json       # ✅ Voyager scene configuration (created)
├── models/            # ⚠️ Put your GLB/GLTF files here
│   └── example.glb    # 🔴 You need to add this
├── articles/          # 📄 Optional: HTML articles
└── images/            # 🖼️ Optional: Thumbnails, etc.
```

## To Use This Example:

### 1. Add Your 3D Model

Place your GLB or GLTF file in the `models/` subdirectory:

```bash
# Create the models directory
mkdir -p models

# Copy your 3D model (replace with your actual file)
cp /path/to/your/model.glb models/example.glb
```

### 2. Update the Component

Use the VoyagerViewer component in your Svelte page:

```svelte
<script>
  import VoyagerViewer from '$lib/components/voyager/VoyagerViewer.svelte';
</script>

<VoyagerViewer
  url="/models/example/"
  document="document.json"
  title="My Example Model"
  direct={true}
  showControls={true}
/>
```

### 3. View in Browser

Navigate to your page and you'll see:
- The 3D model loaded in Voyager
- Camera controls (yaw/pitch sliders)
- Display toggles (annotations, reader, tours)
- Any annotations you've defined

## Customizing the Scene

Edit `document.json` to customize:

### Background Colors
```json
"background": {
  "style": "RadialGradient",
  "color0": [0.2, 0.25, 0.3],  // Top color (RGB 0-1)
  "color1": [0.01, 0.03, 0.05] // Bottom color
}
```

### Camera Settings
```json
"navigation": {
  "orbit": {
    "minOrbitX": -90,  // Min horizontal rotation
    "maxOrbitX": 90,   // Max horizontal rotation
    "minDistance": 0.1, // Min zoom distance
    "maxDistance": 100  // Max zoom distance
  }
}
```

### Interface Options
```json
"interface": {
  "visible": true,    // Show/hide UI
  "logo": true,       // Show Voyager logo
  "menu": true,       // Show menu button
  "tools": true       // Show tool buttons
}
```

### Adding Annotations

```json
"annotations": [
  {
    "id": "point-1",
    "title": "Important Feature",
    "lead": "Description of this feature",
    "marker": "Standard",
    "position": [0, 1, 0],      // XYZ position
    "direction": [0, 0, 1]      // Camera look direction
  }
]
```

## Where to Get 3D Models

### Free Sources:
- **Sketchfab**: https://sketchfab.com (CC-licensed models)
- **Smithsonian Open Access**: https://3d.si.edu
- **Poly Haven**: https://polyhaven.com/models
- **Google Poly Archive**: Via Internet Archive

### Your Own Models:
- Export from Blender as GLB/GLTF
- Convert from OBJ/FBX using Blender
- Photogrammetry software exports

## File Size Tips

Keep GLB files under 50MB for web performance:

```bash
# Use Draco compression (in Blender export settings)
# Or use gltf-transform CLI tool:
npm install -g @gltf-transform/cli
gltf-transform optimize input.glb output.glb
```

## Need More Examples?

Check the Smithsonian's demo assets for more complex scenes:
https://smithsonian.github.io/dpo-voyager/introduction/demo-assets/
