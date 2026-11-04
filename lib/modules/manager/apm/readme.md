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

When an `apm.lock.yaml` lockfile is present, Renovate refreshes it by running `apm install` after updating the manifest.
This requires the `apm` CLI to be available (for example, with `binarySource=global`).

### Registries

APM can also install packages from a [registry](https://microsoft.github.io/apm/guides/registries/), such as a JFrog Artifactory [Agent Packages repository](https://docs.jfrog.com/artifactory/docs/agent-packages-repositories), instead of a Git host.
Renovate looks those packages up with the [`apm` datasource](../../datasource/apm/index.md), so they can be updated on networks where the Git host is not reachable.

Declare the registry in the `registries:` block of `apm.yml`.
Renovate follows the same routing as `apm install`:

- Plain `owner/repo#<version>` entries route to the `default` registry when one is set.
- `- id: owner/repo` entries route to their `registry:`, or to the default registry when `registry:` is omitted.
- `- git:` and `- path:` entries are not updated.

```yaml
name: your-project
version: 1.0.0
registries:
  corp-main:
    url: https://artifactory.example.com/artifactory/api/agentpackages/apm-local
  default: corp-main
dependencies:
  apm:
    - acme/code-review-prompts#^2.0.0
    - registry: corp-main
      id: acme/security-baseline
      version: 1.4.0
```

A registry which is configured only in `~/.apm/config.json` is not visible to Renovate, so such dependencies are skipped.
Declare the registry URL in `apm.yml` instead.

The registry usually needs a token, which you provide with a `hostRules` entry for the `apm` host type.
See the [`apm` datasource](../../datasource/apm/index.md) documentation.
