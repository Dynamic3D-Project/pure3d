# Legacy public links

The public frontend is static. Legacy URLs are handled by client-side SvelteKit pages,
not server endpoints. The release archive includes `404.html` for GitHub Pages deep links.

Supported page paths:

- `/project/<collection number>`, with an optional trailing slash or `/index.html`.
- `/project/<collection number>/edition/<edition number>`, with an optional trailing
  slash, `/index.html` or `/index-voyager-<version>.html`.
- `/index.html`, `/projects.html`, `/editions.html`, `/about.html` and
  `/call_for_projects.html`.

Collection and edition lookups use public publication numbers, require visible collections
and published editions, and reject ambiguous matches. Query strings and fragments are retained.
Other files under a numeric project path go to asset storage, not to an HTML edition page.

## Old hostname

`editions.pure3d.eu` must continue to resolve and serve valid HTTPS. Application changes alone
cannot repair an absent DNS record or certificate. Required DNS: `editions IN A 57.129.98.223`.
Keep all unrelated DNS, mail, API settings and backend data unchanged.

Generate the nginx map using public records only:

```sh
bun --env-file=.env scripts/generate-legacy-redirects.ts > data/legacy-redirects.nginx.conf
```

Include the generated map at nginx HTTP scope. In the old hostname's HTTP/HTTPS server blocks,
retain ACME validation and use the following routing rules:

```nginx
if ($pure3d_legacy_destination != "") {
    return 301 $pure3d_legacy_destination$is_args$args;
}
# Newly published pages can still resolve through the application's live lookup.
location ~ ^/project/[1-9][0-9]*(?:/edition/[1-9][0-9]*)?(?:/(?:index(?:-voyager-[0-9.]+)?\.html)?)?$ {
    return 301 https://pure3d.eu$request_uri;
}
# Keep direct article, model, image and audio URLs as files.
location /project/ {
    return 301 https://api.pure3d.eu/assets$request_uri;
}
location / {
    return 301 https://pure3d.eu$request_uri;
}
```

Browsers retain the original fragment through an HTTP redirect whose Location has no fragment.
The map preserves query strings explicitly. The map must be refreshed when publications change;
the application lookup provides a fallback for new publication slots.

Before live changes, back up the existing proxy configuration, inspect its mounts, validate
nginx configuration, provision a certificate using the existing ACME webroot, and gracefully
reload only the identified proxy. Restore the backed-up configuration if validation or health
checks fail. Never restart PocketBase or change schema for these redirects.

## Acceptance

Verify DNS on both authoritative servers and public recursive resolvers; valid TLS for the
old hostname; HTTP and HTTPS permanent redirects; every public collection and edition's legacy
URL; query/fragment preservation; file links remaining files; and unknown/private records not
being exposed. Test without insecure TLS flags or local-only DNS overrides before claiming live
acceptance. Frontend release, DNS/TLS activation and redirect checks are separate outcomes.

The supplied example `/project/18/edition/1/index.html` maps to
`https://pure3d.eu/editions/94bh25om9r9mskf` (The Private Library of Pieter De Graeff).

Implementation is local until separately released. No DNS, TLS or proxy changes have yet been
applied by this redirect task.

Local browser checks passed for the supplied URL, imported editions, versioned Voyager paths,
collection links, HTML index pages, query strings, fragments and unknown-publication 404s. These
checks used the running local frontend with isolated read-only transport to the real production
API; they do not establish that the old hostname works live. The initial browser check caught
SvelteKit's prohibition on reading fragments in `load`; fragments are now retained in the browser
after navigation instead. The duplicate Petrol Lamp publication slot uses an explicit reviewed
destination matching the published backup, without editing either database record.
