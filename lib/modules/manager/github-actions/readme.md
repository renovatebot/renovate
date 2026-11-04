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

Actions pinned to a bare SHA without a version comment are disabled by default, because Renovate cannot determine which branch or tag the SHA belongs to.
To enable updates, add a tag or branch name as a version comment, as shown above.

### Reusable workflows

A job-level `uses:` which points at `owner/repo/.github/workflows/<file>.yml@<ref>` calls a [reusable workflow](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows) instead of running an action, so Renovate gives it the `workflow` `depType`.
Every other `uses:` reference to a repository keeps the `action` `depType`, including an action in a subdirectory such as `github/codeql-action/init@v3`.

Use `matchDepTypes` to configure the two separately.
For example, to keep pinning action digests but leave reusable workflow calls on their tag:

```json
{
  "extends": ["helpers:pinGitHubActionDigests"],
  "packageRules": [
    {
      "matchDepTypes": ["workflow"],
      "pinDigests": false
    }
  ]
}
```

### GitHub Actions lockfile (`actions.lock`)

!!! warning "This feature is flagged as experimental"
  Experimental features might be changed at any time.
  <br /> <br />
  Due to GitHub classing this functionality as a "public preview", there may be changes to Renovate's functionality - in a possibly breaking manner - while GitHub work to stabilise the feature.

Renovate keeps the [GitHub Actions dependency lockfile](https://github.com/github/actions-lockfile) in sync.
The lockfile is an alternative to inline digest pinning: your workflows keep readable tags like `actions/checkout@v4.3.1`, and `.github/workflows/actions.lock` records the commit each tag resolved to.

If the repository has a `.github/workflows/actions.lock`, then Renovate regenerates it whenever it updates an action.
Renovate installs the [`gh-actions-lock`](https://github.com/github/gh-actions-lock) extension for the `gh` CLI, and runs `gh actions-lock` once per branch, from the repository root, after writing every updated workflow:

```sh
gh extension install github/gh-actions-lock --pin <version> --force
gh actions-lock --no-interactive --no-onboard --no-narrow --ignore-local-actions --json=findings
```

Renovate invokes `gh actions-lock` in a way that keeps the diff to the dependency being updated, by re-resolving only the refs which have changed, along with anything new they pull in transitively.
Every other pin stays as locked, including floating refs (like `@v4`) which have since moved upstream.
For a `ghActionsLock` constraint below v0.3.0, Renovate passes `--relock` (which also advances moved floating refs) and `--no-migrate-local-actions` instead of `--ignore-local-actions`.
With `binarySource=global`, Renovate assumes the installed extension is v0.3.0 or later.

- `--no-interactive`: don't hang, expecting an interactive terminal to answer prompts
- `--no-onboard`: only update workflows and actions which the lockfile already tracks, so an update pull request does not add unrelated workflows. Onboard them yourself by running `gh actions-lock`. Renovate omits this flag when an update replaces an action with a different one, as the lockfile has to learn about the new action
- `--no-narrow`: don't narrow a floating ref like `@v4` to `@v4.2.1`, which would contradict the version in the pull request
- `--ignore-local-actions`: don't migrate same-repo `uses: ./…` references to the `uses: $/…` form, and only warn when such a local action uses remote actions, which the lockfile cannot record
- `--json=findings`: print the findings as JSON, so that when `gh actions-lock` fails, Renovate reports each error finding on its own line, with the affected workflow and action, instead of the raw output

You do not need to configure anything: if there's no `actions.lock` file, then there's nothing to update.
Workflows which are not onboarded to the lockfile are skipped.
Local composite actions are still regenerated, as they can be transitive dependencies of a workflow which _is_ onboarded.

!!! note
  The lockfile is an alternative to inline digest pinning: your workflows keep readable tags like `actions/checkout@v4.3.1`, and `.github/workflows/actions.lock` records the commit each tag resolved to.
  <br><br>
  When updating the lockfile, `gh actions-lock` replaces digest pinned GitHub Actions to the version reference:

  ```diff
  -uses: actions/setup-java@1bcf9fb12cf4aa7d266a90ae39939e61372fe520 # v5.4.0
  +uses: actions/setup-java@v5.7.0
  ```

  Digests that are already pinned will be updated by Renovate, until they are removed by `gh actions-lock`.
  <br><br>
  This does not apply if your organization or repository enables the [_Require actions to be pinned to a full-length commit SHA_](https://github.blog/changelog/2025-08-15-github-actions-policy-now-supports-blocking-and-sha-pinning-actions/) policy, found in your Actions settings.
  If this is enabled, `gh actions-lock` leaves the digests in place, so your workflows stay digest pinned and Renovate carries on updating them.

Renovate pins the version of the `actions-lock` extension to provide deterministic updates, which is then bumped in a later Renovate release.

To use a different version, set the `ghActionsLock` constraint:

```json
{
  "constraints": {
    "ghActionsLock": "v0.4.0"
  }
}
```

The version must be a full release tag, as in the example above.

Because [`constraints`](../../../configuration-options.md#constraints) is mergeable, setting `"constraints": {}` does _not_ remove the pin: set the value to an empty string to always install the latest extension.

```json
{
  "constraints": {
    "ghActionsLock": ""
  }
}
```

You can also control the `gh` CLI version using `constraints.gh`.

!!! note
  With [`binarySource=global`](../../../self-hosted-configuration.md#binarysource), Renovate does _not_ install or re-pin the extension, as Renovate uses the tools installed by your administrator's deployment.
  <br><br>
  Both `gh` and the `gh-actions-lock` extension must already be available, and specifying `ghActionsLock` and `gh` in your repository's `constraints` will be ignored.
  <br><br>
  Pin the extension when you provision your image:

  ```sh
  gh extension install github/gh-actions-lock --pin v0.1.6
  ```

!!! note
  `gh actions-lock` resolves refs and repository IDs through the GitHub API, so it needs a token.
  Renovate takes the token from the `github` host rule matching your platform endpoint, and passes it as `GH_TOKEN`.
  On GitHub Enterprise Server Renovate passes that token using `GH_ENTERPRISE_TOKEN` and `GH_HOST`, and additionally passes the token from your `github.com` host rule as `GH_TOKEN`, because public actions are still resolved against `github.com`.

### Non-semver refs (branches and feature tags)

Renovate supports GitHub Actions that reference non-semver refs like branch names (`main`, `master`) or feature-oriented tags (`cargo-llvm-cov`).

When the action reference doesn't look like a version number (i.e., doesn't match `/^v?\d+/`), Renovate routes to the `github-digest` datasource which fetches both tags and branches.
Since these refs have no version ordering, only digest pinning updates are supported.

**Routing logic:**

- `actions/checkout@v4.2.0` → `github-tags` datasource (version updates)
- `actions/checkout@v4` → `github-tags` datasource (version updates)
- `taiki-e/install-action@cargo-llvm-cov` → `github-digest` datasource (digest pinning only)
- `actions/checkout@main` → `github-digest` datasource (digest pinning only)

When pinning, Renovate adds a comment to preserve the original ref:

```yaml
- uses: taiki-e/install-action@d8c10dae823f48238abff23fee4146b448aed2f1 # cargo-llvm-cov
```

Non-semver ref support is currently limited to GitHub-hosted actions.
Gitea and Forgejo support the same ref types, but Renovate does not yet handle them for these platforms.

### Steps nested in `parallel:` blocks

Renovate extracts dependencies from steps nested inside a [`parallel:`](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#example-running-steps-in-parallel) block, just as it does for regular sequential steps.
This includes both the action reference itself and any supported `with:` version inputs.

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - parallel:
          - uses: actions/setup-node@v5
            with:
              node-version: '20.0.0'
          - uses: actions/setup-go@v5
            with:
              go-version: '1.23'
```

### Docker container actions

For a [Docker container action](https://docs.github.com/en/actions/reference/workflows-and-actions/metadata-syntax#runs-for-docker-container-actions), Renovate extracts the image from `runs.image`:

```yaml
runs:
  using: 'docker'
  image: 'docker://ghcr.io/ossf/scorecard-action:v2.5.0'
```

Renovate can also pin and update the image's digest:

```yaml
runs:
  using: 'docker'
  image: 'docker://ghcr.io/ossf/scorecard-action:v2.5.0@sha256:1e1481c65fc2407d3fd6ab18a23c741eb4d1c0d9359ebafc4b3ab13aa61d8627'
```

Renovate ignores a `runs.image` which points at a local `Dockerfile`.

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

### Updating `with:` values in GitHub Actions

Both GitHub's own first-party Actions and Actions maintained by the wider community will commonly specify a version of a given tool using a `with:` block, such as:

```yaml
steps:
  - uses: actions/setup-node@v5
    with:
      node-version: '22.0.0'

- uses: astral-sh/setup-uv@v10.3.2
  with:
    version: '0.4.x'
```

Renovate supports extracting some of these input(s) from the following Actions, and performing automagic dependency updates accordingly.

A single step can yield more than one dependency.
For example, `pnpm/setup` declares both the pnpm version and the JavaScript runtime to install:

```yaml
steps:
  - uses: pnpm/setup@v1
    with:
      version: '12.0.0'
      runtime: 'node@24.1.0'
```

<!-- Autogenerate in https://github.com/renovatebot/renovate -->

<sup>1</sup> Default for the datasource used.

Depending on your use case, you may need to change `versioning` manually.
If you find a use case which you think Renovate could/should automatically detect and support without manual configuration, please raise [Suggest an Idea Discussion](https://github.com/renovatebot/renovate/discussions/new?category=suggest-an-idea).
