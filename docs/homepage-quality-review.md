# Homepage quality review

Update: at the user's request, the original editorial copy and activity figures
were restored while retaining the layout and mobile fixes. Added descriptive
labels were removed. The scores below are historical assessments of the earlier
copy variant, not scores for the restored-copy version. Editorial copy is outside
the user's control and must not be rewritten to meet a scoring target.

Reviewed 2026-10-04 at http://localhost:60020/. Scope: public homepage, not the entire
website. These are screenshot-based self-assessments, not an official Awwwards jury
result or recognition. Scores reflect the weakest observed desktop/mobile experience.

Weights: design 40%, usability 30%, creativity 20%, content 10%. Each category is out
of 10. Acceptance threshold: every category at least 7.5; a weighted average alone
does not pass.

| Round | Design | Usability | Creativity | Content | Weighted |
| --- | --- | --- | --- | --- | --- |
| Baseline (desktop first viewport) | 7.2 | 7.4 | 7.8 | 6.5 | 7.31 |
| 1 (desktop and mobile) | 7.3 | 7.0 | 7.8 | 7.6 | 7.36 |
| 2 (desktop full page and mobile) | 7.5 | 7.6 | 7.5 | 7.7 | 7.55 |
| 3 (final desktop and mobile full pages) | 7.6 | 7.7 | 7.5 | 7.7 | 7.62 |

## Lowest-category blockers and changes

- Baseline: content repeated an institutional description in the headline and body,
  delaying the explanation of what readers and authors could do.
- Round 1: usability fell after inspecting mobile. Artwork came before the message
  and calls to action; source credits overlapped the model. The desktop-only baseline
  was not sufficient evidence of responsive quality.
- Round 2: creativity was the weakest category (tied with design). The interactive
  edition-derived point clouds are distinctive, but the diagrams and lower-page
  structure remain conventional. Full-page evidence justified a more conservative
  creativity score than the first viewport alone. All categories met the threshold.
- Round 3: creativity remains 7.5 for the same reason; no score inflation for minor
  fixes. Improved the publishing-section label contrast and scoped the mobile
  copy-first layout to the minimal hero variant, preserving other hero variants.

Implemented clearer reader/author copy, a stronger headline hierarchy, visible
rotation guidance and model controls, a reachable pause button, mobile copy/CTA-first
ordering, separate mobile model credits, numbered section labels, live catalogue
figures instead of unsourced static activity counts, lighter benefit sections, and
a forest-green submission action.

## Evidence

Each round was rendered in the existing local preview and captured before scoring.
Screenshots are local browser artifacts under `.playwright-mcp/`, not committed assets:

- Baseline: `quality-baseline.png`, `quality-baseline-full.png`.
- Round 1: `quality-round-1.png`, `quality-round-1-mobile.png`.
- Round 2: `quality-round-2-desktop.png`, `quality-round-2-mobile.png`,
  `quality-round-2-full.png`.
- Final: `quality-final-desktop.png`, `quality-final-full.png`,
  `quality-final-mobile.png`, `quality-final-mobile-full.png`.

Desktop viewport: 1440 × 1000. Mobile viewport: 390 × 844. Full-page captures followed
scrolling through the page to activate lazy media and reveal effects.

Focused browser checks confirmed pause/resume state, next-model interaction, visible
keyboard focus on Browse editions, both main actions within the initial mobile
viewport, no mobile horizontal overflow, and removal of the motion-pause control
under reduced motion. These are smoke checks, not a complete accessibility audit.

No new media, dependencies, GSAP, smooth-scroll engine, or Three.js were added.
The existing particle renderer, reduced-motion behavior, edition credits/licenses,
catalogue imagery, and site design system were retained. The design-first UI skill
guided hierarchy and constrained iteration. Refero's index was readable but its
individual style specification was not accessible; no external design-system claims
or copied assets were used.

Typechecks, lint, production build, complete navigation/data-loading tests, and a
full accessibility audit remain deferred until finalization. The baseline browser
reported an existing `/favicon.ico` 404. No production records were changed, and
nothing was committed, pushed, or deployed.
