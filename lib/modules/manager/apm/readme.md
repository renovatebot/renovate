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

### Per-package tags in monorepos

A repository that publishes several packages usually tags each one separately, for example `foo--v1.2.0` and `bar--v3.0.0`.
Renovate recognises the per-package forms that `apm outdated` resolves: `<name>--v<version>`, `<name>-v<version>` and `<name>_v<version>`.

For a dependency pinned to one of these tags, Renovate only considers tags of the same package, and keeps the prefix in the new value:

```yaml
dependencies:
  apm:
    - owner/skills/plugins/foo#foo--v1.0.0
    - owner/skills/plugins/bar#<sha> # bar--v1.0.0
```

Here `foo` is updated to `foo--v1.1.0` but never to `bar--v3.0.0` or a repository-wide `v2.0.0`, and the SHA pin moves to the commit of the newer `bar--v` tag.
The prefix is taken from the pinned tag itself, so it does not need to match the subpath.
Repository-wide tags such as `v1.2.3` are unaffected.

When an `apm.lock.yaml` lockfile is present, Renovate refreshes it by running `apm install` after updating the manifest.
This requires the `apm` CLI to be available (for example, with `binarySource=global`).
