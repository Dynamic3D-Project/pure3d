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

## Live activation — 23 October 2026

The user explicitly authorised using their open, signed-in OVH browser instance to add the
record. Added only `editions IN A 57.129.98.223`; a full before/after zone comparison verified
that all other records remained unchanged, excluding the automatically advanced SOA serial.
Both authoritative servers and Cloudflare/Google recursive resolvers returned the correct A
record. Private zone exports are retained under ignored `data/legacy-redirects-zone-*.txt`.

Installed the generated redirect map and dedicated HTTP/HTTPS virtual hosts on the existing
`pure3d-archive-proxy-1` nginx proxy. Existing proxy blocks were retained unchanged. Nginx
configuration validated before graceful reload; PocketBase was neither restarted nor modified.
The proxy configuration is a single-file bind mount, so installation preserved its inode rather
than replacing the mount source with a different inode. Before each write, its previous checksum
was checked against the captured version.

- Root-owned private rollback directory:
  `/var/backups/pure3d-legacy-redirects-20261023.XYy19w/`.
- Original proxy SHA-256:
  `8f979d653ef047bf58a908441f780430281ad100bb8235d67e9483eaeca9e90b`.
- Installed proxy SHA-256:
  `46b4fd931b659788a7c067c5b3fd0605d0e1dacc089e61a89b41682225e01e89`.
- Certificate: `/etc/letsencrypt/live/editions.pure3d.eu/`, expires 21 January 2027.
  Private keys remain on the server. Renewal uses the existing ACME webroot and scheduled
  Certbot renewal, with a scoped nginx validation/reload deploy hook.
  `certbot renew --cert-name editions.pure3d.eu --dry-run --run-deploy-hooks
--no-random-sleep-on-renew` passed, including the proxy validation/reload hook. The first
  dry run exceeded the command timeout while waiting in Certbot's random delay; only that
  exact task-owned sleeping process was stopped before the successful bounded retry.
- Actual public HTTPS request to the supplied URL returned HTTP301 with Location
  `https://pure3d.eu/editions/94bh25om9r9mskf`; query strings were retained.
- All 648 public redirect checks passed: every mapped publication slot over both HTTP and
  HTTPS, with bare, slash, index and versioned-index paths, retaining query parameters.
  Machine-readable results are in ignored `data/legacy-live-redirect-checks.json`.
- Fresh isolated headless-browser acceptance followed the real old hostname to the real apex,
  verified the Pieter De Graeff edition heading, and retained `?tour=2#annotation-example`.
  No routing overrides, mocked responses or TLS bypasses were used for live acceptance.
- A direct legacy scene URL redirected to the corresponding API asset path, not an edition
  page. A legacy image request followed its redirect and returned HTTP206, `image/png` and the
  requested byte range. Public API and backend health remained healthy.

The map includes every unambiguous currently public publication slot. One archived edition,
Clanwilliam House at `/project/1/edition/2/`, is not currently public and is deliberately not
re-published or exposed by the redirect task. The existing duplicate Petrol Lamp slot has the
explicit reviewed canonical destination described below. Refresh the map for later publications.

Frontend source changes were incorporated by a separate concurrent task in commit `7c33c8a`;
this task did not commit, push or release them. Current known legacy URLs redirect directly at
nginx and do not depend on a new frontend release. Verify any future frontend release separately.

Local browser checks passed for the supplied URL, imported editions, versioned Voyager paths,
collection links, HTML index pages, query strings, fragments and unknown-publication 404s. These
checks used the running local frontend with isolated read-only transport to the real production
API; live acceptance is recorded above separately. The initial browser check caught
SvelteKit's prohibition on reading fragments in `load`; fragments are now retained in the browser
after navigation instead. The duplicate Petrol Lamp publication slot uses an explicit reviewed
destination matching the published backup, without editing either database record.
