# Releases

`main` is release branch and Git tags are version source of truth. Existing `v0.14.0` anchors
semantic-release history; `package.json` and `CITATION.cff` remain historical snapshots because
release automation does not create version-bump commits.

Every pull request and `main` push runs install, Svelte/TypeScript checks, and production build.
Pull requests stop there. After checks pass on `main`, semantic-release reads all tags and
Conventional Commits since latest release:

| Commit                         | Release |
| ------------------------------ | ------- |
| `fix:`                         | patch   |
| `feat:`                        | minor   |
| `type!:` or `BREAKING CHANGE:` | major   |
| anything else                  | none    |

For a release, semantic-release's `prepare` lifecycle builds `build/` with
`nextRelease.version`, copies SPA fallback, writes `build/version.json` with version and full
commit SHA, and creates `pure3d-vX.Y.Z.tar.gz`. GitHub Release receives that archive before same
`build/` directory is uploaded to GitHub Pages. Non-release commits build with a `dev+<short-sha>`
identifier and still deploy to existing `/pure3d` Pages destination. If a prior attempt pushed a tag but failed before release publication or Pages deployment, a rerun reconciles that exact tag: it restores the published archive when available or rebuilds and attaches it before deploying. It never falls back to a development build for a tagged commit.

Release job has only `contents: write`; Pages deployment has only `pages: write` and
`id-token: write`. Workflow fetches full history, never publishes to npm, never commits generated
files, and never depends on tag-triggered workflows.

Preview version and notes without publishing against a disposable local Git remote:

```sh
dry_run_dir=$(mktemp -d)
git clone --bare . "$dry_run_dir/pure3d.git"
SEMANTIC_RELEASE_LOCAL=1 bun run release -- --dry-run --no-ci \
  --repository-url "file://$dry_run_dir/pure3d.git"
```

Local mode only omits GitHub plugin, whose dry-run verification otherwise requires a GitHub token.
Never use `SEMANTIC_RELEASE_LOCAL=1` in release workflow.

## Squash merges

Pull-request titles must use Conventional Commit form because GitHub permits squash merges and the squash title becomes the commit analyzed on `main`. CI accepts `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`, `style`, and `test`, with optional scope and `!`; only `feat`, `fix`, or a breaking change creates a release.
