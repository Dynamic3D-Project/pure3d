# Performance server handoff

The website can deploy independently, but PocketBase hooks and Nginx cannot be installed through
PocketBase's administrator API. Do not treat a Pages deployment as a backend deployment.

## Already applied through the API

On 27 September 2026, after a fresh verified PocketBase backup, seven permission rules were
updated and read back across `editions`, `editionReviews`, and `reviewFeedback`. Their previous
values matched the reviewed baseline exactly. Records, field definitions, indexes and other
rules were preserved. The private operator journal retains the original collection schemas.

The same anonymous 55-ID request measured 268.6, 256.5, 258.3, 192.2 and 288.0 ms afterward
(median 258.3 ms), compared with the earlier 1,645.5 ms median. Anonymous review and feedback
lists still returned zero records. These are actual production API measurements.

## 1. Identify the service before changing anything

On the Ubuntu host, first inspect the service name and paths. Do not assume the service is
called `pocketbase` or that its working directory is `/opt/pocketbase`.

```sh
systemctl list-units --type=service --all | grep -i pocketbase
# Replace ACTUAL_UNIT with the discovered unit name:
sudo systemctl show ACTUAL_UNIT -p User -p WorkingDirectory -p FragmentPath -p ExecStart
```

Check the binary version using the executable named in `ExecStart`, and identify any explicit
`--hooksDir` and `--dir` arguments. Redact credentials if an existing command line happens to
contain them; do not share environment files or an unredacted service configuration.

## 2. Install the reviewed hook files

The performance release's optional server-hook archive contains only these eight files:

```text
feedback-email.pb.js
feedback-email-service.cjs
orcid.pb.js
orcid-service.cjs
orcid-readiness.cjs
publication-service.cjs
storage-dashboard.pb.js
storage-dashboard-service.cjs
```

Download the archive and its checksum from the same GitHub Release as the site. Verify its
SHA-256 and list its contents before extracting. Back up the **actual complete hooks directory**
and service configuration to a private, root-owned directory first. Compare the eight files with
the installed copies; preserve unrelated/custom hooks and investigate unexpected local edits.

Install the reviewed files together with appropriate ownership/read permissions for the service
user. Do not replace the database directory, object storage, service credentials or port settings.
Use the service manager to restart only the identified PocketBase service, then inspect its logs
and `/api/health`. Retain both the database backup and original hook files for rollback.

These hooks activate request-local permission batching, the cheaper public-review endpoint,
the lightweight readiness check and storage response pagination. The old-hook storage API is
supported temporarily by the released frontend, so publishing the site first does not render
the entire inventory at once.

## 3. Coordinate the email queue schema and worker

The four email queue fields were deliberately not exposed under the old server hook. After
the new hooks are installed, apply their additive schema migration using the maintainer checkout
and its existing private `.env`, with a fresh backup available:

```sh
POCKETBASE_URL=https://main.57-129-98-223.sslip.io \
  bun --env-file=.env scripts/add-feedback-email-queue-fields.ts --apply
```

This preserves existing fields and indexes and creates the queue fields/index if missing. It
does not submit feedback or send email. Read the schema back afterward to confirm the fields.

Only then enable `PURE3D_FEEDBACK_EMAIL_ENABLED=true` in the service's existing environment
configuration and restart PocketBase. Do not change SMTP credentials. Verify a single authorized
test submission reaches the intended recipients before considering mail delivery complete.
While the opt-in flag is disabled, newly submitted feedback is saved but not queued for email;
minimize this transition window if delivery is operationally required. Historical submissions
are not replayed. See [feedback email](feedback-email.md) for bounded retries and at-least-once
delivery semantics.

## 4. Enable HTTP/2 and asset freshness at the TLS terminator

Follow [performance rollout](performance-rollout.md): inspect and back up the actual Nginx
configuration, enable HTTP/2, compress text responses and add conservative cache freshness only
to public legacy assets. Preserve CORS, validators, ranges and private-resource protections.
Run `nginx -t` before reloading. Never apply public caching to all `/api/` responses.

## 5. Verify after the server update

- Public `/api/health` and `/api/pure3d/orcid/ready` succeed.
- Published editions remain visible; private editions/reviews remain protected for each role.
- An administrator can page storage results and sees the prefix-scan limitation accurately.
- Submitted feedback persists and the opted-in worker delivers to the intended recipients.
- The public hostname actually negotiates HTTP/2; cache headers, conditional 304s, range 206s and
  cross-origin requests work from the Pages origin.
- Repeat cold/warm collection and model tests without modifying any model or texture.

PocketBase's JavaScript filesystem API still scans an entire selected prefix internally. The
new response pagination reduces payload/rendering work; truly bounded backing-store enumeration
requires a different backend/storage API and is not claimed by this release.
