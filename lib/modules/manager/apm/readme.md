The `apm` manager keeps [APM (Agent Package Manager)](https://github.com/danielmeppiel/apm) dependencies up to date.

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

The datasource is selected dynamically from the git host:

- `github.com` (the default when no host is given) uses the `github-tags` datasource
- `gitlab.com` and hosts matching a `gitlab` `hostRules` entry use the `gitlab-tags` datasource
- any other host uses the generic `git-tags` datasource

Only entries that pin an exact `#<ref>` are updated.
Entries without a `#<ref>` are skipped because there is no version to bump.

When an `apm.lock.yaml` lockfile is present, Renovate refreshes it by running `apm install` after updating the manifest.
This requires the `apm` CLI to be available (for example, with `binarySource=global`).

Model Context Protocol (MCP) server entries under `dependencies.mcp` are not managed.
They are identified by an MCP registry name (for example `io.github.github/github-mcp-server`) and carry no version to pin, so there is nothing for Renovate to update.
