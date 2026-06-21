# Voyager Workshop Sample

This folder contains a small starter package for a short Voyager Story workshop.

## Files

- `scene.svx.json`: Voyager scene document with lighting, navigation, one model, and one starter annotation.
- `workshop-artifact.obj`: Small OBJ model referenced by the scene document.

## Workshop Use

1. Start Voyager locally.
2. Open Story author mode with this folder as the asset root:

   `http://localhost:8001/voyager-story-dev.html?mode=author&root=workshop-sample/&document=scene.svx.json`

3. Edit the starter annotation, add a new annotation, adjust the view, then save or export the scene package.
4. To use a participant model, place their model in this folder and update the `uri` in `scene.svx.json`, or import it through Voyager Story if the workshop instance supports upload.

Voyager uses `*.svx.json` for scene documents. If someone says "SBX JSON" in the workshop context, they probably mean this SVX Voyager scene file unless your deployment has a separate SBX importer.
