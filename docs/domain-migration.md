# pure3d.eu migration

## Agreed scope

- Public frontend: `https://pure3d.eu`, still hosted by GitHub Pages.
- `www.pure3d.eu` redirects to the apex.
- PocketBase and assets: `https://api.pure3d.eu`, on the existing OVH server
  at `57.129.98.223`; preserve `/assets/project/...` paths.
- User authorised scoped DNS, TLS and hosting changes. Preserve application data,
  the existing site until replacement is ready, and rollback access. No schema
  migration is needed.
- User explicitly confirmed the previous subdomains and Microsoft 365 mail setup
  are no longer needed. Replace them with a self-managed OVH zone and the existing
  OVH MX Plan mailbox `info@pure3d.eu`. OVH mailbox existence and active service
  were verified in the user's authenticated control panel. Do not read mailbox
  contents, reset its password or send messages without additional authorisation.
- User subsequently explicitly authorised the migration commit/push and checked
  local release to GitHub Pages. No unrelated changes or pull request authorised.

## Discovery — 22 October 2026

- Checkout: `main`, initially clean. Actual repository: `PURE3D-EU/pure3d`.
  Release configuration still names the previous organisation and needs updating.
- GitHub account `ctwhome` has repository admin permission. Pages uses Actions,
  currently has no custom domain, and serves `https://pure3d-eu.github.io/pure3d/`.
- Authoritative DNS: `ns1.surfnet.nl`, `ns1.zurich.surf.net`,
  `ns0.socialhistoryservices.org`. An OVH zone must not be assumed authoritative.
- Apex A: `195.169.88.33`, TTL 38400. `www` CNAME: `pure3d.eu`, TTL 38400.
  No apex AAAA or CAA observed. MX points to Microsoft 365; preserve it and all
  unrelated TXT, DKIM, autodiscover and other mail records.
- OVH SSH access verified using the existing approved key. Proxy:
  `pure3d-archive-proxy-1`, nginx 1.29.8, configuration mounted read-only from
  `/opt/pure3d-archive/deploy/proxy.conf`.
- Existing API HTTPS: `main.57-129-98-223.sslip.io`; keep available during cutover.
  Asset CORS currently allows only the old GitHub organisation origin.
- Certbot timer exists, but the current certificate uses standalone validation
  while nginx occupies port 80. Establish working unattended renewal for the
  new certificate without interrupting existing services.
- PocketBase data and hooks are mounted separately. Do not change either as
  part of proxy configuration.

## Progress

- [x] Confirm domain layout, hosting choice and live-change authorisation.
- [x] Inspect GitHub Pages, current DNS and OVH proxy without mutations.
- [x] Read-only source discovery of OAuth, assets and frontend domain settings.
- [x] Inspect the user's OVH domain/DNS access in task-isolated Chrome. The OVH
      zone is not yet authoritative; its existing full zone has been saved privately.
- [x] Verify active OVH MX Plan and `info` account, and read required DKIM CNAMEs.
- [x] Capture the full original OVH zone privately and proxy backup before writes.
      Full SURF zone transfer was refused; user explicitly waived preservation of
      that configuration. Original nameservers and observed mail records are above.
- [x] Stage and verify API/OVH mail records on both OVH nameservers; switch
      delegation to OVH. Task `603646780` completed; `.eu` registry read-back confirms
      `dns111.ovh.net` and `ns111.ovh.net`. Both Cloudflare and Google public DNS now
      resolve the API to `57.129.98.223`.
- [x] Add API proxy, HTTPS, restricted asset CORS and scheduled webroot renewal.
- [x] Verify renewal dry-run and API realtime. Verified so far: API health,
      ORCID readiness, valid API TLS and asset HTTP 206 byte ranges with apex CORS.
      Local system DNS still cached an API lookup failure at the last check; explicit
      address resolution with TLS verification and public recursive DNS both work.
- [x] Verify API health, published edition reads, asset ranges and realtime SSE
      (`PB_CONNECT`). Certbot simulated renewal including proxy reload succeeded.
- [x] Register `https://api.pure3d.eu/api/oauth2-redirect` in the existing ORCID
      application, retaining the old callback during transition. Do not reapply
      ORCID configuration: that rotates the users token secret.
- [x] Update only PocketBase `meta.appURL` to `https://pure3d.eu`, preserving
      other settings and privately backing up prior metadata. Read-back matched.
- [x] Update production build configuration to empty `APP_BASE_PATH`, new API
      and assets origins, and the actual GitHub repository.
- [x] Update frontend metadata, production detection and defensive URL defaults.
      Review global `noindex` for public launch. Use pathname keys in the derivative
      manifest so new API URLs still select bundled card images.
- [x] Update current operational documentation; preserve historical records.
- [x] Verify the final build and affected public feature workflows before release.
      Baseline lint failures and transitional preview transport are recorded below.
- [x] Coordinate root-based frontend release, Pages custom domain and apex DNS.
      Do not switch the current public site before the replacement is ready.
- [ ] Verify apex/www HTTPS, deep links, login, assets, Voyager, metadata and
      old URL behaviour. Browser storage does not migrate: users must sign in again.

## Next action and rollback

The user explicitly approved replacing the old DNS and mail configuration after
being warned about unknown records. Stage OVH mail/API records first, temporarily
retaining apex A `195.169.88.33` and `www` pointing to the apex. Switch nameservers
to `dns111.ovh.net` and `ns111.ovh.net` only after validating the staged zone.
No DS record was observed. The final intended zone is `docs/pure3d.eu.zone`;
its GitHub Pages apex/www records must wait for the root-based frontend cutover.

Before each live change record its previous state and restoration procedure.
Keep the old API hostname, archive/legacy routes, certificates and data intact.
Restore the previous proxy configuration on nginx validation or health failure.
Rollback of the frontend requires the matching Pages domain setting, DNS and
prebuilt frontend archive; changing DNS alone is not a complete rollback.

## Live infrastructure receipt

- Original proxy SHA-256:
  `82379181721423110dada652c0dbd26065129cbd3f186e68ad9f55f02d488294`.
- Private root-owned server backup:
  `/var/backups/pure3d-domain-20261022.1CHbMW/proxy.conf`.
  Intermediate `proxy.http-only.conf` is beside it. Nginx configuration was tested
  and gracefully reloaded; no PocketBase container restart or data migration.
- Installed API proxy SHA-256:
  `8f979d653ef047bf58a908441f780430281ad100bb8235d67e9483eaeca9e90b`.
- API certificate: `/etc/letsencrypt/live/api.pure3d.eu/`, expires 20 January 2027.
  Webroot `/etc/letsencrypt/webroot` is served through the existing read-only
  certificate mount. Renewal uses the existing certbot timer and a proxy reload
  deploy hook. Private keys remain on the server.
- Old API endpoint remains healthy. First immediate post-reload TLS probe hit an
  old worker; the subsequent fresh probe verified the correct API certificate.
- Application mail sender was already `info@pure3d.eu`, SMTP enabled; neither
  SMTP credentials nor mailbox passwords have been changed or exposed.
- `info` OVH MX Plan mailbox is active. DKIM CNAMEs have been staged and verified;
  signing activation was accepted by OVH and reported as in progress. Verify final
  signing state and mailbox delivery separately. Existing PocketBase SMTP uses
  `smtp.mail.ovh.net:465`, TLS, username/sender `info@pure3d.eu`; no credential changes.

## Release checkpoint

- Migration source committed and pushed as
  `03e95e740ceda9dab933e0530ae27ff1e70ee7a3`.
- Checked local release `v0.21.1` published with release commit
  `b126a29c35e9a3346d52918141aedb43dfa4e0b1`. Release archive SHA-256:
  `f275fee51c6b33763bb4f9404621b05cfcbc184a9fdeb6913df6b42b0f25a42d`.
- Pages workflow `39764916721` completed successfully. No Actions build was run;
  the workflow verified and deployed the prebuilt release archive.
- Final apex A records and www CNAME from `docs/pure3d.eu.zone` are now installed.
  Both OVH nameservers and Cloudflare/Google public recursive DNS verified them.
  An HTTP request directly to the Pages address with the real domain returned
  `version.json` identifying `v0.21.1` and source `03e95e74...`.
- Pages `cname=pure3d.eu` was read back. At the last check, GitHub had not yet
  provisioned its apex/www certificate. A bounded task-owned background check
  verifies TLS without bypasses and will enable HTTPS enforcement only when
  both hostnames have valid certificates. Do not claim HTTPS acceptance yet.
- Frontend verification: `bun --no-env-file test src scripts pocketbase` passed
  (40 passed, 30 skipped); `bun --no-env-file run check` passed (0 errors,
  7 existing warnings); production `bun --no-env-file run build` passed with
  empty base path and new API/assets origins. Root `/_app` paths and no old API
  origin in runtime build assets were verified. README formatting was repaired.
- `bun run lint` remains failing on 29 baseline formatting files. A separate
  `bunx --no-install eslint .` run failed on 8 errors and 1 warning in untouched
  source files. Do not silently repair unrelated lint debt or claim lint passed.
- Managed Playwright preview exercised the real root build at a routed
  `https://pure3d.eu` origin: homepage data/navigation loaded with zero console
  errors; edition `/editions/4ze4q66v8wbs87n` loaded metadata, a non-zero Voyager
  canvas and both GLB asset resources. This was a pre-release preview, not the live
  domain: frontend requests were routed to local preview port 60025, and API
  transport used the existing HTTPS alias because the local network resolver
  still cached NXDOMAIN. No mock data or TLS-verification bypass was used.
  Remove these managed-page route overrides before any live-domain acceptance.
- A task-owned Vite preview is running on 127.0.0.1:60025. Retain during iteration.
- ORCID callback registration completed in the existing production application;
  its public client ID was checked against production PocketBase. Updated
  application website to `https://pure3d.eu/`, retained the existing callbacks,
  and reloaded settings to verify persistence. The developer page unexpectedly
  exposed its client secret in browser text output; user was informed and then
  explicitly authorised rotation. Do not repeat or commit any credential.
- ORCID secret rotation completed after a fresh verified PocketBase backup
  `pure3d-before-orcid-secret-rotation-20261022-1792666338896.zip`. Captured the
  replacement privately, verified it persisted after reloading ORCID, updated
  only the matching provider credential, and privately updated the existing
  local `.env` credential. Read-back showed all non-OAuth collection settings
  unchanged. The users token secret was not included in the update payload.
  An ORCID token request with a deliberately invalid authorisation code returned
  `invalid_grant`, rather than `invalid_client`; backend readiness also passed.
  Deleted the temporary plaintext credential file. ORCID states that the previous
  secret is discarded within 24 hours. Full end-user sign-in remains unverified.
- User authorised exactly one standard SMTP test to `info@pure3d.eu`. The request
  timed out at 30 seconds; nginx recorded client cancellation (499), so it was
  not resent. Do not claim delivery or send another test without authorisation.
  Direct TLS/TCP probes from the VPS to OVH SMTP ports 465 and 587 timed out;
  host iptables OUTPUT policy was ACCEPT. A local probe reached the same SMTP
  service, so credentials cannot yet be blamed. Investigate source-IP/network
  restrictions with OVH before changing passwords, firewall rules or providers.
- Remaining: valid Pages TLS/HTTPS enforcement and final live acceptance, final
  DKIM activation state, actual mail delivery, and a user-driven sign-in journey.
- The local DNS resolver (Tailscale/router) still returned NXDOMAIN while both
  public recursive resolvers and the VPS resolved the API. A local cache flush
  did not resolve this. Do not change the user's network/Tailscale settings.
  If needed, a process-scoped curl resolver configuration may pin only the
  verified API address while retaining normal certificate verification; disclose
  it as a transitional test transport, not proof of local DNS propagation.
