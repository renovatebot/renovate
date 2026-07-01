[prek](https://prek.j178.dev) is a Git hooks framework compatible with the [pre-commit](https://pre-commit.com/) hook ecosystem.
Renovate supports updating hook repository `rev` values in [`prek.toml`](https://prek.j178.dev/configuration/) files.

Renovate updates the `rev` field in remote `[[repos]]` entries:

```toml
[[repos]]
repo = "https://github.com/astral-sh/ruff-pre-commit"
rev = "v0.15.6"
hooks = [{ id = "ruff", args = ["--fix"] }]
```

GitHub and GitLab repositories are supported, including custom hosts configured via `hostRules`.
`local`, `meta`, and `builtin` repositories are ignored.

### SHA Pins

When `rev` is pinned to a commit SHA with a recognized version comment, Renovate updates the SHA and comment together.
Supported comment forms include `# frozen: v1.44.0`, `# v1.44.0`, `# @v1.44.0`, `# pin @v1.44.0`, `# tag=v1.44.0`, and `# renovate: pin @v1.44.0`.

```toml
[[repos]]
repo = "https://github.com/crate-ci/typos"
rev = "631208b7aac2daa8b707f55e7331f9112b0e062d" # frozen: v1.44.0
hooks = [{ id = "typos" }]
```

Bare SHA refs without a recognized version comment are surfaced as `unspecified-version` and not updated.

### Additional Dependencies

Renovate has partial support for `additional_dependencies`, currently for Node.js, Python, and Go only.
You must add the `language` field to your hooks for Renovate to extract these dependencies.

#### Go

```toml
[[repos]]
repo = "https://github.com/rhysd/actionlint"
rev = "v1.7.7"

[[repos.hooks]]
id = "actionlint"
language = "golang"
additional_dependencies = [
    "github.com/wasilibs/go-shellcheck/cmd/shellcheck@v0.10.0",
]
```

#### Node.js

```toml
[[repos]]
repo = "https://github.com/pre-commit/mirrors-prettier"
rev = "v3.1.0"

[[repos.hooks]]
id = "prettier"
language = "node"
additional_dependencies = [
    "@trivago/prettier-plugin-sort-imports@^5.2.2",
    "prettier@^3.6.2",
]
```

#### Python

```toml
[[repos]]
repo = "https://github.com/psf/black"
rev = "19.3b0"

[[repos.hooks]]
id = "black"
language = "python"
additional_dependencies = [
    "requests==1.1.1",
]
```

Hook `additional_dependencies` from `local` repositories are extracted.
`meta` and `builtin` repository hooks are ignored.

`minimum_prek_version` is not managed by Renovate.
