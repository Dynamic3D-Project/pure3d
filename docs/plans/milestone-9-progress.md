# Milestone 9 implementation checkpoint

Working on `main`; user will test and close issues. No commits, pushes, deployments or GitHub mutations authorised. Starting tree clean, main ahead of origin by one commit.

## Delegated ownership

- Landing #85–91, #94: sol session `ses_eab88433dffeciQkfAPxwiB9W4`; `src/routes/home3/**` and landing-only assets.
- Workflow #75, #78: terra session `ses_eab881abaffeFrC99BjQpUe7nW`; workflow UI/services/backend except CMS hooks.
- Navigation #76, #80, #92: sol session `ses_eab87f35affeah3SzRUcaCdenC`; navigation UI/model/store and CMS hooks menu logic.
- Editorial #81–83, #93, #95: sol session `ses_eab87c4d3ffe0cXKLGR0P470cF`; resources/documentation/new editorial routes, lib/content.ts and dedicated content update scripts/components.
- Metadata #79: original terra session `ses_eab879860ffeS8N00creOw1hwx` cancelled without a result. Replacement sol session `ses_eab416c1effe98NFNJkLWizASA` completed; edition metadata heading contrast and temporary removal of Versions/Printables tabs per latest issue comment.
- Logo options #84: sol session `ses_eab876ee9ffepwPGx27UhOnPOH`; docs/prototypes/milestone-9-logo-options only. User selection needed before live replacement.
- British English #96: luna session `ses_eab875362ffeZ2ms7A376HAlWQ`; initial read-only inventory, apply sweep after concurrent writers finish.

## Open decisions

- #86 explicitly leaves replacement object and new descriptive sentences TBD. Ask user before inventing assets/copy.
- #82 contact recipient/delivery mechanism must be established; never show fake delivery success.
- #79 inspect attached field list and determine any undefined controlled vocabularies before asking user.
- #84 present actual logo options for selection.

## Requirement reconciliation (implementation, not verified completion)

- #75 implemented guarded legacy admin workflow transitions; user/runtime testing pending.
- #76 implemented inactive-draft target validation parity; production hooks not deployed.
- #78 existing unpublish feature/backend reviewed; focused existing backend suite passed. User testing pending.
- #79 latest feedback implemented: stronger metadata headings/labels, removed Versions/Printables from desktop/compact navigation. Requested metadata schema/editor fields already existed from prior implementation (confirmed live issue comment and code mapping). Existing vocabulary selectors retained; no authoritative missing vocabulary seeds invented. Coordinator reviewed diff and actual feedback image. User/runtime testing pending.
- #80 implemented explicit clickable submenu headings and prominent publishing callout.
- #81 implemented published learning-material cards at `/learning-materials`.
- #82 implemented CMS-backed contact design at `/resources/contact`; user decision on mail-client fallback pending.
- #83 implemented Activities & Outputs heading/description.
- #84 three rendered SVG options delivered; awaiting choice, no replacement of selected design.
- #85 partial: copy, approved two-model rotation, edition links and no unrelated fallback done; seven further edition mappings found but scenes return HTTP 403; local Docker/OrbStack unavailable. Bolex record not found. Need local service access and Bolex mapping. Accent-colour comment deferred explicitly for discussion.
- #86 partial: supplied heading/description/stage labels done; replacement object and new descriptive sentences explicitly TBD, user answer pending.
- #87 implemented workflow heading/copy/five-stage graphic.
- #88 implemented collection description.
- #89 implemented community heading/copy/audience cards.
- #90 implemented proposal CTA text and links.
- #91 implemented all six institutions with official public logos. Coordinator read all actual assets; user visual acceptance pending.
- #92 footer heading links/rendering updated; configured footer remains curated/independent. Full header replication vs curated footer decision pending, no remote CMS edits.
- #93 implemented PURE3D and Access Learning Resources CTA.
- #94 implemented two latest real published posts, no fabricated news.
- #95 implemented checklist/heading and removed identity-review section, preserving backend identity rules.
- #96 initial and final shared-file copy sweeps done/reviewed. Metadata UI uses existing British-English labels; no technical field identifiers renamed.

## Next steps

All delegated sessions returned (original metadata worker cancelled, replacement completed). Remaining work genuinely needs user input/access: logo 1/2/3; #86 replacement object/descriptive copy or permission to draft; #82 accept email-client fallback or configure real delivery; #85 start OrbStack/local assets plus Bolex edition mapping; #92 full-header mirror vs curated footer structure. Seven requested hero edition mappings are recorded in landing worker result; anonymous production scenes all 403, Docker socket unavailable. No deployment or production data changes made. Full final integrated verification has NOT run; known navigation syntax errors were fixed and affected components compiled. Continue once user answers rather than claim milestone complete.

Navigation follow-up completed and reviewed: explicit optional group landing links round-trip through editor, frontend/backend validation, directory resolution, publishable filtering and header/footer. Corrected contact route to `/resources/contact`. Worker caught/fixed introduced `const_tag_invalid_placement`; narrow compiler invocation passed Header and SiteFooter. Earlier workflow worker's full check failed on these then-current concurrent edits (not established pre-existing failures); no full integrated check yet. Workflow UI adds reason-required admin legacy override via existing guarded audited endpoint. Existing #78 unpublish implementation reviewed in backend; worker ran focused existing suite (5 passed). Worker also ran formatting/lint checks despite requested active cadence; no full verification claim.

Logo comparison delivered in chat as actual rendered PNG `/var/folders/78/t7tp8f_557d8qdc94shsqp0w0000gn/T/opencode/milestone-9-logo-comparison.png`; awaiting user choice 1/2/3. Inline choice-page call timed out; PNG is successful delivery. Task-owned docs preview runs at http://127.0.0.1:60026/prototypes/milestone-9-logo-options/index.html via shell sh_1547e054c001oNFE1WE3suX3sj. Playwright task context uses this URL; screenshot path outside tool allowed roots was rejected, so PNG was generated with existing sharp and read directly instead.

Landing first batch reviewed: #87–90, #94 implemented; #85 only mining lamp/Rembrandt so far; #86 images/copy pending user; #91 four supporter logos still text. Landing worker resumed to locate remaining public assets, official logos, fix conceptual fallback and exact Get Started link. Logo options delivered, coordinator read actual SVGs and requested optical fixes (clipped numeral and narrow D); user selection still pending. Editorial worker resumed to preserve contact CMS body/edit controls/draft notice, finish title branding and explicit learning publication filtering.

Editorial worker completed #81–83, #93, #95: new `/learning-materials`, existing `/resources/contact` redesigned with honest mailto composition using the existing published address. User decision pending whether email-app fallback is sufficient. Coordinator read changed files; no runtime verification yet. Navigation worker follow-up owns `src/lib/cms.ts` to add explicit group landing links (replace naming heuristic) and learning route support. Contact route is `/resources/contact`, not `/contact`; reconcile route allowlist before completion.

#96 initial copy-only batch applied and reviewed in demo/design/alternative-home routes, feedback, site settings, admin content title and documentation seed. No checks run (live implementation). Remaining copy sweep in files owned by active workers deferred until their changes settle.

Receive worker results, surface concrete questions, review affected files/evidence, coordinate shared-file follow-ups, apply British English sweep after writes settle. Reconcile all 21 issues with implementation. User testing remains pending; routine final quality gates deferred until requested.
