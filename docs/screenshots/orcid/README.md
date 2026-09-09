# ORCID Browser Evidence

## Live OVH Verification

Captured on 2026-09-09 at `https://main.57-129-98-223.sslip.io` after the authorized
OVH rollout on PocketBase 0.40.3. These four images show the real ORCID flow and
the requesting user's account, not synthetic identities. Email is masked in
profile captures; the admin list is filtered to the same public ORCID. No other
users, client secrets, tokens, or private reconciliation reports are shown.

| Image                                 | Observed state                                                                |
| ------------------------------------- | ----------------------------------------------------------------------------- |
| [16](16-live-orcid-consent.png)       | Real ORCID consent requesting only the ORCID iD                               |
| [17](17-live-orcid-admin-profile.png) | Successful live sign-in, Admin and ORCID verified badges, public profile data |
| [18](18-live-orcid-admin-access.png)  | Actual admin page access, filtered to the verified account                    |
| [19](19-live-orcid-admin-mobile.png)  | Verified admin profile at 390px with no horizontal overflow                   |

Live checks: OAuth authorization-code exchange HTTP 200, initial and returning
sign-in, automatic and explicit public-profile refresh HTTP 200, authenticated
admin configuration endpoint HTTP 200, exactly one matching external identity,
and consumption of the approved pending mapping. User password login is disabled
and `oidc` is the only enabled provider. Readiness reports all checks true.

The live flow exposed two failures absent from the original synthetic smoke:
ORCID omits the signing key's `alg`, and PocketBase resaves an account after the
proof-bearing save. Both were fixed without weakening signature/identity guards,
covered by native endpoint regressions, deployed, and followed by successful
live sign-ins. Initial failed attempts are not counted as successful checks.

The OVH migration preserved 145 records and 236 ordered credits. All 75 existing
accounts and their 60 collection/269 edition memberships were preserved; one
requested admin account was added. A private report retains 67 existing
privileged accounts requiring approved identity linking (including one with an
unverified existing ORCID candidate). Historical attribution remains unresolved,
not silently approved; new submission/publication still requires author ORCIDs.

The older `pure3d-database.ctwhome.com` backend and `pure3d.eu` DNS were not switched
by this deployment. Use the OVH URL above to exercise this release.

## Synthetic Verification

Captured from the actual rendered application on 2026-09-08 using Playwright,
Vite static preview at `http://127.0.0.1:60025`, and disposable PocketBase v0.35
at `http://127.0.0.1:60121`. No application files were edited.

**In screenshots 01-15, all accounts, biographies, works, ownership states and mappings are synthetic.**
The ORCID identifiers are existing integration-test values, not claims about the
people associated with those identifiers. Accounts use `example.test`. No live
ORCID sign-in, identity-provider token validation, production data, or production
writes were exercised. Do not describe these screenshots as live OAuth evidence.

## Screenshots

The following 12 images cover the main PR states. All PNGs were opened and
visually checked. Editor and metadata crops are screenshots of real rendered
elements, not reconstructed interfaces.

| File                                              | Observed State                                                                                 |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [01](01-synthetic-login-desktop.png)              | Desktop ORCID-only login, 1440px viewport                                                      |
| [02](02-synthetic-login-mobile.png)               | Mobile ORCID-only login, 390px viewport                                                        |
| [03](03-synthetic-profile-readonly-desktop.png)   | Synced read-only identity, refresh action, separate work and credit sections                   |
| [05](05-synthetic-admin-pending-approved.png)     | Saved administrator-reviewed mapping; ownership remains unverified                             |
| [06](06-synthetic-admin-verified-locked.png)      | Synthetic proof consumed the mapping; remapping controls locked                                |
| [07](07-synthetic-collection-ordered-credits.png) | Saved collection order: organization, person creator, person contributor                       |
| [08](08-synthetic-workflow-credit-mismatch.png)   | Verified author can add credit; unverified collaborator action is disabled with an explanation |
| [09](09-synthetic-edition-ordered-credits.png)    | Saved edition order after explicit credit addition and reorder                                 |
| [10](10-synthetic-public-credited-works.png)      | Logged-out public profile shows credited public works, not draft team membership               |
| [11](11-synthetic-public-collection-credits.png)  | Public collection separates creators and contributors                                          |
| [13](13-synthetic-orcid-search.png)               | ORCID search returns the matching public edition and collection                                |
| [14](14-synthetic-creator-citation-mobile.png)    | Mobile formatted citation uses creators only, with version history                             |

Supplemental responsive states:

- [04: corrected mobile profile spacing and refresh action](04-synthetic-profile-refreshed-mobile.png).
- [12: edition DOI and creator/contributor metadata on mobile](12-synthetic-edition-citation-credits-mobile.png).
- [15: verified author credited, unverified collaborator action disabled, tablet](15-synthetic-team-verified-credit-tablet.png).

## Final Server-Event Smoke

After the final activity/readiness backend changes, rebuilt the static app and
repeated the smoke test on a new disposable database. The launcher now copies
`activity-service.cjs` and `orcid-readiness.cjs` along with the four existing
hook files. It starts with only a synthetic superuser, invokes the real
`scripts/create-pocketbase-collections.ts` (including `alignOrcidSchema`), and
reads back every exported API rule to assert exact equality. No fixture-specific
rule relaxation or hand-patched notification schema remains. The UI seed route
requires superuser authentication and does not create audit/notification rows.

| Final Fresh Check        | Observed Result                                                                                                                                                                                 |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin pending mapping    | UI POST 200; target audit count increased from 0 to exactly 1; action `orcid_mapping_approved`, actor `users/admin0000000000`                                                                   |
| Author adds collaborator | Team membership POST 200; exactly one server-generated `user_assigned` audit attributed to `users/author000000000`                                                                              |
| Recipient notification   | Synthetic Collaborator authenticated in the browser; GET 200 returned exactly one `collaborator_added` notification addressed to `other0000000000`                                              |
| Notification link        | Server-generated absolute URL `http://127.0.0.1:60025/editions/uiedition000002/workflow`, based on the configured local app URL                                                                 |
| Recipient mark-read      | Browser fetch PATCH containing only `read` returned 200; GET readback confirmed `read: true`; read/unread toggling also passed                                                                  |
| Client event writes      | Zero browser POSTs to `auditLog` or `notifications`; zero rejected client PocketBase requests during the final smoke                                                                            |
| Edition credits          | Verified-author Add credit and reorder PATCHes returned 200; reload preserved organization, linked person creator, person contributor order; unverified collaborator Add credit stayed disabled |
| Collection credits       | Save Changes returned 200; backend readback exactly matched saved credit objects and order                                                                                                      |
| Schema/readiness         | Fixture startup asserts hooks/schema/credits true. After switching only the synthetic auth configuration to final ORCID-only settings, readiness returned 200 with all four checks true         |

Password authentication is enabled only for synthetic browser session setup,
so readiness initially reports `auth: false` by design. The final readiness
configuration check did not contact ORCID or validate any live credentials.
Notification read/mark-read was exercised through authenticated browser fetch,
not a notification UI control. No direct audit/notification create API request
was used to seed or test successful activity delivery.

The rendered admin, profile, credits and team UI remains consistent with the
existing screenshots; the activity change did not require recapturing them.
The citation limitation below is unchanged and was not modified in this task.

## Profile And Tablet Recheck

Rebuilt the current application after the profile/team fixes and ran a fresh
synthetic database. Recaptured 03, 04 and 08, and added 15; all four PNGs were
opened and visually checked. Other images retain the earlier captures of
unaffected areas. Screenshot 04 retains its original filename but now shows
the **pre-refresh** identity so the corrected title/affiliation spacing is
visible. The refresh success case was verified separately in the same run.

The previously reported profile/team defects are resolved in this build:

- Profile text is exactly `Research fellow at Example Research Institute` at
  desktop 1440px, tablet 1024px and mobile 390px. Screenshot 04 uses 390x1000.
- Mobile Refresh from ORCID reached the local synthetic profile endpoint,
  returned HTTP 200 and displayed `Profile refreshed from ORCID.`.
- Added the unverified Synthetic Collaborator through the Team UI. Add credit is disabled
  with `Link ORCID to add account credit; use the credit editor for an unlinked
contributor.` Two forced pointer-click attempts produced zero edition PATCH
  requests and zero matching credits in the backend.
- Verified author Add credit remained enabled and returned HTTP 200, adding
  exactly one OAuth-provenance creator with the verified ORCID and linked user
  ID. The row became Credited and no longer offered Add credit. Membership
  remained one author and one collaborator. Reload confirmed one linked author
  credit, zero unverified collaborator credits and the disabled action.
- At tablet size, collection Save Changes and edition reorder autosave both
  returned HTTP 200 and persisted organization, person creator, person
  contributor order. Admin reviewed mapping save also returned HTTP 200;
  its evidence checkbox gate remained enforced.

All tablet measurements below used **1024x768**, with overflow measured from
actual rendered client/scroll widths, not screenshots alone.

| Area                 | Measured Widths (CSS px)                                                                  | Result                                            |
| -------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Profile              | Page client 1009, scroll 1009                                                             | No horizontal overflow                            |
| Admin user list      | Page client 1024, scroll 1009; table/container 687                                        | No horizontal overflow                            |
| Admin mapping dialog | Dialog left 256, right 768; client/scroll 512; page client/scroll 1024                    | Fits viewport; save interaction passed            |
| Collection credits   | Page client/scroll 1009; editor client/scroll 814; zero controls outside viewport         | No horizontal overflow                            |
| Edition credits      | Page client/scroll 1009; editor client/scroll 785; zero controls outside viewport         | No horizontal overflow                            |
| Workflow team        | Page client/scroll 1009; panel client/scroll 342; table scroll 514 within 342px container | Horizontal scrolling contained in table, not page |

The mobile profile also measured client/scroll 375/375, with zero horizontal
overflow. Browser scrollbars account for the viewport/client-width difference.

## Observed Checks

| Check                         | Result                                                                                                                       |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Login layouts                 | Rendered at 1440px and 390px; no live sign-in attempted                                                                      |
| Profile refresh               | UI action reached the real local fixture endpoint; HTTP 200; name and biography updated; success message displayed           |
| Profile outage                | Synthetic public-service failure returned HTTP 502; existing identity remained visible; retry succeeded                      |
| Read-only profile enforcement | Direct authenticated nickname overwrite rejected with HTTP 400, server-owned-fields message                                  |
| Admin review gate             | Mapping save disabled until evidence checkbox checked                                                                        |
| Admin checksum validation     | Invalid checksum showed inline/toast validation; direct backend request returned HTTP 400                                    |
| Conflicting identity          | Pending mapping to an already-owned ORCID rejected with HTTP 400                                                             |
| Pending save                  | UI POST returned HTTP 200 and normalized ORCID; `orcidVerifiedAt` remained null                                              |
| Pending ownership proof       | Existing `/_test/oauth` simulation returned HTTP 200; subsequent UI showed verified identity and disabled remapping          |
| Permission boundary           | Ordinary-user pending mapping mutation returned HTTP 403                                                                     |
| Collection credit order       | UI reorder and Save Changes returned HTTP 200; response and reopened editor preserved order                                  |
| Edition credit order          | UI reorder autosave returned HTTP 200 with matching canonical order                                                          |
| Explicit author credit        | Add credit returned HTTP 200; row became Credited; membership remained one author                                            |
| Required creator ORCID        | Submission with a person creator lacking ORCID rejected with HTTP 400                                                        |
| Public attribution            | Logged-out profile showed published credited work and excluded the draft; collection and edition separated contributor roles |
| Citation                      | Formatted citation contained person and organization creators, excluded contributor; Copy citation changed to Copied!        |
| ORCID search                  | Rendered matching edition and collection options from HTTP 200 synthetic backend responses                                   |
| Final fixture smoke           | Full application schema bootstrap, exactly-once server audit, server notification delivery and recipient mark-read succeeded |

## Remaining Limitations

1. **Preexisting citation availability:** the formatted citation is under Versions, and that
   tab only exists when a published sibling exists
   (`src/routes/editions/[slug]/+page.svelte:797`). A second synthetic published
   edition was added to capture it. A standalone edition exposed its DOI link,
   but not this formatted citation. No collection citation control was rendered.
2. **Narrow team panel:** the desktop team table has horizontal scrolling; its
   Remove action is off to the right in screenshot 08. Add credit is visible.
3. **Synthetic assets:** no 3D model was seeded. Voyager scene requests returned
   HTTP 404 for the local synthetic paths. Screenshots focus on credit UI, not
   model-loading success.

## Console And Network

- All non-loopback browser requests were blocked, including Google Fonts.
  Screenshots therefore use available fallback fonts. The browser also reported
  CSS-preload failures; the referenced local CSS was separately confirmed as
  HTTP 200, `text/css`, 244139 bytes. No blank/error-page screenshots were kept.
- Expected negative tests logged HTTP 400, 403 and 502 responses as listed above.
- Earlier fixture timestamp/notification-field issues were superseded by using
  the actual application bootstrap and final ORCID alignment. Final notification
  reads and recipient mark-read requests returned 200 under the app's rules.
- SvelteKit warned about `window.fetch` in load functions on public/collection
  routes. Tiptap warned about duplicate `link` and `underline` extensions in editors.
- Missing synthetic scene files returned local HTTP 404. No production asset
  host or ORCID API was contacted by the browser checks.
- The final regression recheck produced the same font/CSS-preload, SvelteKit
  fetch and Tiptap warnings and local synthetic scene 404s. All exercised
  PocketBase data reads and writes succeeded (HTTP 200; realtime POSTs 204),
  including notification reads/writes. No new profile/team backend errors.

## Reproduction

Start the fixture from the repository root using the supplied native binary:

```sh
PB_TEST_BINARY=/var/folders/78/t7tp8f_557d8qdc94shsqp0w0000gn/T/opencode/pure3d-pb035/pocketbase \
  bun --no-env-file pocketbase/tests/orcid-ui-fixture.ts
```

The launcher prints its PID, the PocketBase PID and a fresh temporary directory.
It copies six enforcing hook/service files plus test-only hooks into that
directory, runs the real app schema bootstrap using explicit synthetic local
credentials, asserts API rules and readiness, and configures the notification
app URL to `http://127.0.0.1:60025`. Never deploy the fixture hooks. Stop the
printed launcher PID with SIGTERM when finished.

Build and preview with explicit public origins; do not reuse a production build:

```sh
env -i PATH="$PATH" HOME="$HOME" \
  PUBLIC_POCKETBASE_URL=http://127.0.0.1:60121 \
  PUBLIC_ASSET_BASE_URL=http://127.0.0.1:60121 APP_BASE_PATH='' \
  bun --no-env-file run build

env -i PATH="$PATH" HOME="$HOME" \
  PUBLIC_POCKETBASE_URL=http://127.0.0.1:60121 \
  PUBLIC_ASSET_BASE_URL=http://127.0.0.1:60121 APP_BASE_PATH='' \
  bun --no-env-file run preview --host 127.0.0.1 --port 60025 --strictPort
```

The static build embeds the synthetic backend URL. **Rebuild with the intended
deployment environment before shipping.** The existing Docker frontend was not
stopped or changed.

Authenticate synthetic accounts through the local PocketBase password endpoint
using `admin@example.test` or `author@example.test` and
`local-test-password-only`, then store the returned token/record in the normal
`pocketbase_auth` browser storage format. This is fixture session setup, not an
application password-login feature or ORCID sign-in test.

In the isolated Playwright context, block every non-loopback request. Rewrite
only `/api/pure3d/orcid/profile-refresh` to
`http://127.0.0.1:60121/_test/profile`. That endpoint invokes the real refresh
service with the existing integration fixture's synthetic upstream response.
For the outage case, send `{"fail":true}` to the same fixture endpoint.

## Verification And Processes

- Explicit-environment static build passed.
- `bun run check` passed with zero errors and warnings.
- Focused Prettier and ESLint checks passed for the two fixture source files.
- Repository-wide `bun run lint` failed on existing broad formatting debt;
  unrelated files were left untouched.
- `git diff --check` passed.
- Capture run: launcher PID 17932, backend PID 17933, temporary directory
  `orcid-ui-KVRGE4` under the approved temporary root.
- Fresh final smoke run: launcher PID 27797, backend PID 27798, directory
  `orcid-ui-9nJYuB` under that root.
- Preview: Bun PID 17408, Vite/Node PID 17409.
- Failed fixture startup backend PID 27100 was also stopped explicitly.
- Final post-fix regression run: launcher PID 33131, backend PID 33132,
  temporary directory `orcid-ui-tw8AS3`; preview Bun PID 33290 and Vite/Node
  PID 33291. The explicit-environment static build passed again. Build output
  is in `orcid-ui-recheck-build.log` under the approved temporary root.
- Post-fix `bun run check` passed with zero errors and warnings
  (`orcid-ui-recheck-check.log`). README Prettier and `git diff --check` passed.
- Final activity smoke: launcher PID 78689, backend PID 78690, temporary
  directory `orcid-ui-iHQdb9`; preview Bun PID 76097 and Vite/Node PID 76098.
  The preliminary activity run used launcher/backend PIDs 75696/75697 and
  directory `orcid-ui-ByuROj`, and was stopped before the fresh final run.
- Final activity logs: `orcid-ui-activity-build.log`,
  `orcid-ui-activity-final-fixture.log` and the fixture's `bootstrap.log`, all
  under the approved temporary root. Full bootstrap/rule/readiness assertions
  passed on the final fixture source.
- Final `bun run check` passed with zero errors/warnings
  (`orcid-ui-activity-check.log`); focused fixture/README Prettier, fixture
  ESLint and `git diff --check` passed. All six activity-run PIDs above were
  confirmed absent after shutdown; Playwright was closed.
- All listed fixture and preview processes were stopped after verification.
  Temporary synthetic databases/logs were retained; no broad cleanup was run.
