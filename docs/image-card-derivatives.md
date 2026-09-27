# Card image derivatives

PocketBase's `thumb` query does not resize the production AVIF files sampled on 26 September 2026. The original and `?thumb=760x475` responses had the same dimensions and byte length. The
frontend therefore does not synthesize `thumb` candidates. It uses responsive sources only when
they are listed in the checked manifest at `src/lib/utils/card-image-derivatives.json`.

For AVIF and legacy `project/.../icon.avif` sources, generate independent card files locally:

```sh
bun run images:card-derivatives -- \
  --source-root /safe/read-only-copy/card-sources \
  --output-root /safe/output/card-images \
  --manifest /safe/output/card-image-derivatives.json \
  --source-url-prefix https://assets.example/assets \
  --output-url-prefix https://assets.example/card-images
```

The source, output and manifest paths are all explicit. Output and manifest paths must be outside
the source tree. Directory scans accept only `icon*` and `cover*` image names. PocketBase uploads
with opaque names can be selected deliberately with `--sources FILE`, where `FILE` contains entries
such as `[{"path":"pbc/record/file.avif","url":"https://api.example/api/files/…"}]`. This avoids
scanning model texture trees.

Sharp writes separate AVIF files named for their measured width. Images smaller than a target are
not enlarged, and the manifest records the actual width rather than an invalid nominal descriptor.
The script never overwrites originals and does not inspect or modify GLB, GLTF, model textures or
other preservation assets.

The checked manifest is intentionally empty. A card falls back to its original URL unless an exact
full URL or pathname is present in that manifest, so nonexistent derivative URLs are never guessed.
After an explicitly authorized asset release uploads the files under stable/versioned URLs, copy
the validated public manifest into the checked path. This repository task does not write production
assets or credentials, and production rollout remains separate.
