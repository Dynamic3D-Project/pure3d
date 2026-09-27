# Performance rollout

These changes do not optimize or replace any model or preservation texture. A frontend release
alone cannot apply PocketBase rules, hooks, image derivatives or origin proxy configuration.

## Origin transport and caching

The production origin currently identifies itself as Nginx 1.29.8. Its configuration and TLS
termination are not managed by this checkout. The following is an operator change, not an
automatically installed replacement configuration.

1. Save the effective proxy configuration and establish rollback before editing. Inspect
   `nginx -T` on the actual TLS terminator; do not replace upstream routing, CORS, authentication,
   range support or certificate settings with a generic configuration.
2. Enable `http2 on;` in the existing TLS `server` block (supported by the reported Nginx
   version). Keep HTTP/1.1 available. Verify the binary includes HTTP/2 support and that no
   earlier load balancer still terminates TLS without HTTP/2.
3. Enable compression for JSON and other text responses, not already compressed AVIF/GLB
   assets. Example directives in the existing server context:

   ```nginx
   http2 on;
   gzip on;
   gzip_vary on;
   gzip_min_length 1024;
   gzip_types application/json application/javascript text/css image/svg+xml;
   ```

4. Only on the existing **public legacy asset** location, set explicit freshness. Legacy
   filenames can be overwritten, so do not give them a year-long immutable policy. A
   conservative initial value is:

   ```nginx
   add_header Cache-Control "public, max-age=3600, must-revalidate";
   ```

   Preserve ETag, Last-Modified, byte ranges and all existing CORS headers, including
   `Vary: Origin`. Adding any `add_header` inside a location can stop inherited headers from
   being inherited: inspect the effective configuration and preserve the full header set.
   Avoid duplicate upstream Cache-Control headers. Do not apply public caching to API JSON,
   authenticated files, reviewer material or protected downloads. PocketBase's existing
   `/api/files/` policy should not be overridden indiscriminately.

5. Only content-addressed derivatives with a new URL for every content change may use
   `public, max-age=31536000, immutable`. Confirm the actual derivative naming scheme first.
6. Run `nginx -t`, reload only after success, and retain the prior configuration for rollback.

Verify with an HTTP/2-capable curl build (check `curl -V` for HTTP2):

```sh
curl --http2 -sS -o /dev/null -w '%{http_version}\n' \
  https://main.57-129-98-223.sslip.io/api/health
curl --http2 -sSI \
  https://main.57-129-98-223.sslip.io/assets/project/3/edition/1/icon.avif
curl --http2 --compressed -sS -D - -o /dev/null \
  'https://main.57-129-98-223.sslip.io/api/collections/editions/records?perPage=55&fields=id&skipTotal=1'
```

Also verify CORS from the frontend origin, conditional 304 responses, byte-range 206 responses,
anonymous denials for private resources, and cold/warm browser transfers. Never infer HTTP/2
from the Nginx configuration alone: test negotiated protocol at the public hostname.

## Backend and frontend order

- Run the permission/privacy integration suite against an isolated PocketBase instance before
  applying schema rules. Back up the real backend immediately before an authorized update.
- Review the exact rule/field diff. Existing `scripts/align-production-workflow.ts` defaults to
  a dry-run but aligns more than performance rules; do not execute its apply mode without
  reviewing every proposed change and its required fresh backup/private journal.
- Install compatible hooks and any new queue/derivative schema before enabling their consumers.
  Keep mail delivery explicitly disabled during tests. Never replay historical submitted
  feedback as new mail merely because a worker was introduced.
- Publish derivative images through an authorized asset rollout; do not rename or delete
  legacy originals. Check representative AVIF dimensions and response bytes, not just URLs
  containing a thumbnail parameter.
- Release the frontend through the repository's intentional local release process only when
  release authorization is given. See [releases.md](releases.md).
- Repeat the original catalogue, collection, image-start and model-loading measurements on
  production after deployment. Record sample counts and cold/warm state; local results are
  not production measurements.

No proxy reload, production schema update, asset upload, email send or release is performed by
this document.
