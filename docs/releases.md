# Releases

Releases are intentional local operations for `Dynamic3D-Project/pure3d`. Pushing `main`
only runs read-only CI (Conventional Commit PR title, unit tests, Svelte/TypeScript checks).
CI does not create releases or build. Tag pushes deploy verified prebuilt Release archives to Pages. No npm/store publisher applies
because this is a private-package static web app.

## Preview and release

```sh
make release-dry-run
# Only after explicit authorization, from clean main with dependencies installed:
make release
```

Dry-run reads local files and Git history only. It prints the proposed version, dated notes,
steps, and blockers even from a dirty feature branch. It does not fetch, install, run checks,
build, write files/state, stage, commit, tag, or publish. Cached origin/main and tags cannot
prove current remote synchronization; this limitation is printed explicitly.

A real release requires a clean index and working tree (including untracked files), `main`,
full history, and an existing stable `vX.Y.Z` baseline. It fetches origin/main and tags, then
requires HEAD to equal origin/main. Divergence is rejected; no automatic pull/rebase occurs.
Unsupported prerelease/malformed reachable `v*` tags are rejected rather than guessed.
The highest reachable stable version is the baseline; commits in `tag..HEAD` determine:

| Commit                                                                      | Release |
| --------------------------------------------------------------------------- | ------- |
| `fix:` or `perf:` (optional scope)                                          | patch   |
| `feat:`                                                                     | minor   |
| Any Conventional Commit with `!`, `BREAKING CHANGE:`, or `BREAKING-CHANGE:` | major   |
| Other commits                                                               | none    |

Major bumps apply literally, including 0.x. No qualifying commits means no release.
Squash PR titles must use Conventional Commit syntax; squash titles become main's commit messages.

The Bun script updates `package.json` and `CITATION.cff` version plus citation release date,
and prepends UTC-dated categorized notes to `CHANGELOG.md`. Bun's lockfile has no root version
field. Schema, CFF format, dependency and bundled Voyager versions are independent, not bumped.
Existing historical versions are not fabricated into a new changelog.

`release.config.mjs` lists actual local gates: existing Bun unit tests (including Docker Compose
configuration tests, requiring Docker CLI), Svelte/TypeScript checks, the existing ORCID backend
readiness gate (network access only during an authorized real release), then existing production
build and tar packaging. PocketBase binary integration tests remain separately opt-in and are
not claimed as part of these gates. Dependencies must already be installed; no release-time install.
The build retains organization Pages base `/pure3d` and existing public backend/asset endpoints.
It creates `build/404.html`, `build/version.json`, and ignored `pure3d-vX.Y.Z.tar.gz`.
The version metadata records the tested source commit before the version-only release commit;
retries retain that same source SHA. Build outputs are never committed.

After all gates pass, the command creates `chore(release): vX.Y.Z` and an annotated `vX.Y.Z`
tag. Signing and commit hooks are disabled for this controlled operation. It atomically pushes
main and the tag (never force), creates or reconciles a draft GitHub Release, uploads the exact
prebuilt archive and its `.sha256` sidecar, verifies downloaded bytes, then publishes the Release.
Existing matching assets are reused; conflicting assets are never overwritten. Published releases
are treated as immutable: missing/different assets block recovery. The GitHub CLI and existing
Git/gh authentication must be configured before an explicitly authorized real release.

The tag-triggered `pages.yml` waits up to 20 minutes for local publication, downloads only the
archive and checksum, verifies SHA-256, version and source parent commit, rejects unsafe tar
members, then uploads the verified site to Pages and deploys it. The verifier supports Python
3.9+: it validates every member before copying only regular files and directories into a fresh
destination. Absolute/traversing paths, symbolic/hard links and special files are rejected;
existing destinations are refused and archive permissions are not restored. No checkout, install or build
runs in that workflow. Main pushes run checks only. GitHub Pages must use GitHub Actions as its
source. The local command reports publication, not deployment completion; inspect the Pages run.
If publication takes longer than the wait window, finish `make release` and rerun the failed tag
workflow. No second tag or release is needed. Repository administrators should enable GitHub
immutable releases for server-enforced protection as well; this tool never replaces assets.

## Failure and retry

A pending release journal lives at `git rev-parse --git-path pure3d-release.json`. It saves the
source SHA, exact before/after contents, chosen date and notes before changing tracked files.
Run `make release` again after resolving a failed gate. Only the recorded original/prepared
file contents are accepted; unrelated changes, moved HEAD, conflicting tags, or remote movement
block recovery. The journal checkpoints the completed build's SHA-256, atomic push, and publication. Before a
build checkpoint, checks/build rerun; afterward retries require the exact saved archive and skip
checks/build. Missing or changed checkpointed bytes block recovery; restore the original archive.
Retries finish a missing commit/tag, safely repeat the atomic push, reconcile server assets even
when a previous successful response was lost, and remove the journal only after verified publication. It never duplicates changelog entries or force-replaces tags.
If a gate requires source changes, inspect and abandon the pending release first: restore only
journal-owned changes after reviewing them, unstage those paths, and remove the journal. Do not
remove a completed release commit/tag automatically.

An exclusive `pure3d-release.lock` directory beside the journal prevents concurrent local runs.
Ordinary failures release the lock. After a killed process, verify no release process remains,
then remove only that stale lock directory and retry. Do not delete the journal to bypass checks.

For workflow changes, run `bun --no-env-file test scripts/release.test.ts`,
`make release-dry-run`, and `git diff --check`. Never exercise the mutating command in the
project checkout merely to test release tooling.
