The `apm` manager keeps [APM (Agent Package Manager)](https://github.com/microsoft/apm) dependencies up to date.

Renovate reads the `apm.yml` manifest and updates the git-pinned entries under `dependencies.apm` and `devDependencies.apm`.
Each entry uses the form `[host/]owner/repo[/subpath]#<ref>`, for example:

```yaml
name: your-project
version: 1.0.0
dependencies:
  apm:
    - microsoft/apm-sample-package#v1.0.0
    - gitlab.com/team/project#v2.3.0
devDependencies:
  apm:
    - owner/repo#v1.2.3
```

Only entries that pin an exact `#<ref>` are updated.
Entries without a `#<ref>` are skipped because there is no version to bump.

APM also documents pinning to a commit SHA with the release tag kept as a trailing comment (`owner/repo#<sha> # v2.0.0`).
With `pinDigests` enabled (part of the `config:best-practices` preset) Renovate keeps both the SHA and the tag comment current, the same way it does for `github-actions` (`uses: owner/action@<sha> # v4`).
A SHA pin without a tag comment is skipped, as there is no version to track.

A ref that Renovate's default versioning cannot read as a version, such as a branch (`owner/repo#main`, or `owner/repo#<sha> # main`), is followed by its commit instead.
On GitHub hosts this uses the `github-digest` datasource, as `github-actions` does for `uses: owner/action@main`, and on other hosts it uses `git-refs`, both with `exact` versioning.
Renovate then updates the SHA of a branch-pinned commit as the branch moves, and with `pinDigests` it pins a plain branch ref to its commit, keeping the branch as the comment.
A branch whose name the default versioning reads as a version, such as `release/2024`, is still looked up as a tag.

When an `apm.lock.yaml` lockfile is present, Renovate refreshes it by running `apm install` after updating the manifest.
This requires the `apm` CLI to be available (for example, with `binarySource=global`).

With `lockFileMaintenance` enabled, Renovate runs `apm install --update` instead, which re-resolves each dependency to the latest ref `apm.yml` allows without editing `apm.yml`.
Renovate keeps `apm.lock.yaml` in place for both commands: it is APM's record of which deployed files it owns, and without it APM skips the committed files instead of updating them.

For private dependencies on github.com, Renovate passes `apm install` the token its `github-tags` lookups use, as `GITHUB_APM_PAT`: that of a `github-tags` host rule for `https://api.github.com/`, or else of the `github` one.
Dependencies on other hosts get no credentials from Renovate.
