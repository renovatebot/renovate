The `github-actions` manager extracts dependencies from GitHub Actions workflow and workflow template files.
It can also be used for Gitea and Forgejo Actions workflows as such are compatible with GitHub Actions workflows.

### Digest pinning and updating

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
The GitHub tag is in the format of `<PREFIX><SEPARATOR><VERSION>`.
_`PREFIX`_ and _`SEPARATOR`_ are optional.
Valid separators are the ASCII hyphen (`-`) or forward slash (`/`).
_`VERSION`_ can include the major, minor, and patch components and may optionally include a `v` prefix.
Here are the examples of valid GitHub tags:
`1.0.1`, `1.0`, `1`,
`v1.0.1`, `v1.0`, `v1`,
`prefix-1.0.1`, `prefix-1.0`, `prefix-1`,
`prefix-v1.0.1`, `prefix-v1.0`, `prefix-v1`.
`prefix/1.0.1`, `prefix/1.0`, `prefix/1`,
`prefix/v1.0.1`, `prefix/v1.0`, `prefix/v1`.

If you want to automatically pin action digests add the `helpers:pinGitHubActionDigests` preset to the `extends` array:

```json
{
  "extends": ["helpers:pinGitHubActionDigests"]
}
```

### Non-support of Variables

Renovate ignores any GitHub runners which are configured in variables.
For example, Renovate ignores the runner configured in the `RUNNER` variable:

```yaml
name: build
on: [push]

env:
  RUNNER: ubuntu-22.04

jobs:
  build:
    runs-on: ${{ env.RUNNER }}
```

### Ratchet support

The `github-action` manager understands `ratchet` comments, like `# ratchet:actions/checkout@v2.1.0`.
This means that Renovate will:

- update the version of a _pinned_ Ratchet version if needed
- not delete Ratchet comments after parsing them
- keep `# ratchet:exclude` comments

### with:version support for built-in Actions

Renovate supports updating the "with" version for `actions/setup-go`, `actions/setup-node`, and `actions/setup-python`, although not all syntaxes are supported out of the box.

By default, Renovate will use `npm`-style semver versioning for `go` and `python`, and Renovate's built-in `node` versioning for updating `node`.
The goal of these defaults is to match as closely as possible to what these GitHub Actions support.
For example, normally the `^` syntax is not used in `go` or `python`, but it's supported in their respective actions.

Depending on your use case, you may need to change `versioning` manually.
If you find a use case which you think Renovate could/should automatically detect and support without manual configuration, please raise a Discussion to suggest it.

### commonly used community actions

Renovate also supports some commonly used community actions:

- `astral-sh/setup-uv`
- `pnpm/action-setup`
- `pdm-project/setup-pdm`
- `jaxxstorm/action-install-gh-release`
- `sigoden/install-binary`
- `prefix-dev/setup-pixi`
