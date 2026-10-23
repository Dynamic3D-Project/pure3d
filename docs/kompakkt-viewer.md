# Kompakkt viewer preview

Issue: [#101](https://github.com/PURE3D-EU/pure3d/issues/101).

Voyager remains the default. `PUBLIC_KOMPAKKT_VIEWER=1` exposes a separate **Kompakkt · external
preview** switch in both edition layouts. It is disabled by default; no schema changes, model
conversion, Kompakkt account or hosted Kompakkt model record is required. Configure the public
environment value for the frontend build and restart/rebuild the preview or deployment as usual.

## Prerequisites before enabling

- Approve sending public model URLs and visitor network information to `https://kompakkt.de`.
- Serve the scene, model and every companion anonymously over public HTTPS, without credentials,
  signed query strings or redirects. Local/private network assets are not supported.
- Configure the asset host to permit browser CORS requests from `https://kompakkt.de`, including
  model and companion downloads. The application also checks public assets from its own origin.
- Verify an actual model render, not merely an iframe `load` event. The standalone protocol does
  not provide this integration with a trusted model-ready/error message.

**Known deployment blocker:** the existing public example
`https://api.pure3d.eu/assets/project/1/edition/1/25north_map.glb` was observed by the coordinator
to fail in the hosted Kompakkt viewer because the asset response lacked `Access-Control-Allow-Origin`.
Keep the flag off until CORS is separately authorised, configured and browser-verified. This
feature does not change remote CORS, deploy backend code or modify assets.

The coordinator independently confirmed protocol compatibility in headless Playwright: applying
a browser-only CORS response override allowed that public model to render as `standalone_entity`
with the upstream viewer bootstrapped (104 meshes, 47,625 vertices). This did not change the remote
server and does not satisfy the production CORS prerequisite.

## How it works

Selecting Kompakkt first displays a privacy notice. Only **Load external Kompakkt viewer** begins
public asset checks; no Kompakkt document is requested before that explicit opt-in. It independently
fetches the edition's scene without cookies or authorisation and resolves the active scene's single
model through its `Web3D` derivative, preferring GLB over glTF. Existing uploaded-asset filename
rewriting is reused. An `.svx.json` document itself is never passed as a model.

The model is loaded using the upstream standalone protocol:

```text
https://kompakkt.de/viewer/?standalone=true&resource=<encoded absolute model URL>&minimal=true
```

This was checked against upstream
[ProcessingService.loadStandaloneEntity](https://github.com/Kompakkt/Viewer/blob/master/src/app/services/processing/processing.service.ts).
It loads the resource through Babylon, with optional settings and annotations that this integration
intentionally does not supply. No conversion of Voyager annotations, stories, tours, camera, units,
lighting, node transforms or positioning is promised. The edition's descriptive content remains
available alongside the viewer. Kompakkt edits do not save back to Pure3D.

The development `/asset-proxy/` prefix is replaced with the configured `PUBLIC_ASSET_BASE_URL`
(or the existing default `https://api.pure3d.eu/assets`) before sharing URLs. It does not send a
localhost proxy address to Kompakkt or introduce a new public relay. A genuinely local asset base
is unsupported. To test existing remote assets, configure the public upstream base explicitly.

## Limits and failure handling

- Only explicitly published editions are eligible. Unpublished editions never start asset checks.
- Only a single model in the active scene is supported; composed/multiple-model scenes must use
  Voyager. Only glTF 2 `.glb`/`.gltf` `Web3D` model assets are considered.
- Scene and model metadata checks are bounded to 4 MiB each. GLB downloads are cancelled after
  reading the JSON header; the external viewer subsequently downloads the model itself.
- Asset URLs must stay within the edition's asset directory. Query strings, fragments, user-info,
  non-HTTPS URLs and literal-IP/local hostnames are rejected, rather than stripping tokens.
  Public hostnames must actually resolve to public assets; DNS/network policy remains the asset
  operator's responsibility.
- Buffer/image companions are checked anonymously and must resolve in place. Embedded standard
  base64 buffers/images are supported. Relocated companion uploads are rejected: use a
  self-contained GLB or Voyager instead. No model binary or glTF document is rewritten.
- Unsupported scenes, invalid metadata, failed public requests and preflight timeouts show a useful
  message and allow retry. A cross-origin iframe load is **not** treated as model-ready; model errors
  remain inside Kompakkt, with a persistent explanation to return to Voyager.
- Switching away unmounts the active runtime. Returning to Voyager creates a fresh Voyager instance;
  navigating editions or changing layout resets the runtime choice to Voyager. Opt-in is not stored.

## Focused verification

With the flag off, confirm no Kompakkt control or external document request appears. With the flag
on, check original and experimental layouts, explicit opt-in, an anonymous compatible model, private
editions, incompatible/composed scenes, unsafe/tokenised URLs, missing assets, retry, mobile layout,
keyboard access, switching back during loading, and navigation to another edition. Verify Voyager
annotations/tours still work after returning. Render tests require asset CORS as described above.
