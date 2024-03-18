The `github-actions` manager extracts dependencies from GitHub Actions workflow and workflow template files.
It can also be used for Gitea and Forgejo Actions workflows as such are compatible with GitHub Actions workflows.

If you like to use digest pinning but want to follow the action version tag, you can use the sample below:

```yaml
name: build

on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3df4ab11eba7bda6032a0b82a6bb43b11571feac # v4.0.0
```

Renovate will update the commit SHA according to the GitHub tag you specified.
Renovate can update digests that use SHA1 and SHA256 algorithms.
The GitHub tag is in the format of `(prefix-)(v)1.0.0`, where `prefix` and `v` are optional and `1.0.0` is the version number.
Here are the examples of valid GitHub tags:
`1.0.1`, `1.0`, `1`,
`v1.0.1`, `v1.0`, `v1`,
`prefix-1.0.1`, `prefix-1.0`, `prefix-1`,
`prefix-v1.0.1`, `prefix-v1.0`, `prefix-v1`.

If you want to automatically pin action digests add the `helpers:pinGitHubActionDigests` preset to the `extends` array:

```json
{
  "extends": ["helpers:pinGitHubActionDigests"]
}
```

Renovate ignores any GitHub runners which are configured in variables.
For example, Renovate ignores the runner configured in the `RUNNER` variable:

```yaml
name: build
on: [push]

env:
  RUNNER: ubuntu-20.04

jobs:
  build:
    runs-on: ${{ env.RUNNER }}
```

The `github-action` manager understands `ratchet` comments, like `# ratchet:actions/checkout@v2.1.0`.
This means that Renovate will:

- update the version of a _pinned_ Ratchet version if needed
- not delete Ratchet comments after parsing them
- keep `# ratchet:exclude` comments
