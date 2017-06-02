# renovate

> Keep npm dependencies up-to-date

##  Why

- Creates or updates Pull Requests for each dependency that needs updating
- Discovers and processes all `package.json` files in repository (supports monorepo architecture)
- Supports multiple major versions per-dependency at once
- Configurable via file, environment, CLI, and `package.json`
- Supports `yarn.lock` and `package-lock.json` files
- Supports GitHub and GitLab
- Self-hosted

## Install

```
$ npm install -g renovate
```

## Authentication

You need to select a repository user for `renovate` to assume the identity of, and generate a Personal Access Token. It's recommended that you use a dedicated "bot" account for this to avoid user confusion.

You can find instructions for GitHub here (select "repo" permissions): https://help.github.com/articles/creating-an-access-token-for-command-line-use/

You can find instructions for GitLab here: https://docs.gitlab.com/ee/api/README.html#personal-access-tokens

This token needs to be configured via file, environment variable, or CLI. See [docs/configuration.md](docs/configuration.md) for details.
The simplest way is to expose it as `GITHUB_TOKEN` or `GITLAB_TOKEN`.

## Usage

```
$ node renovate --help

  Usage: renovate [options] [repositories...]

  Options:

    -h, --help                           output usage information
    --enabled [boolean]                  Enable or disable renovate
    --onboarding [boolean]               Require a Configuration PR first
    --platform <string>                  Platform type of repository
    --endpoint <string>                  Custom endpoint to use
    --token <string>                     Repository Auth Token
    --autodiscover [boolean]             Autodiscover all repositories
    --github-app-id <integer>            GitHub App ID (enables GitHub App functionality if set)
    --github-app-key <string>            GitHub App Private Key (.pem file contents)
    --package-files <list>               Package file paths
    --dep-types <list>                   Dependency types
    --separate-major-releases [boolean]  If set to false, it will upgrade dependencies to latest release only, and not separate major/minor branches
    --ignore-deps <list>                 Dependencies to ignore
    --ignore-future [boolean]            Ignore versions tagged as "future"
    --ignore-unstable [boolean]          Ignore versions with unstable semver
    --respect-latest [boolean]           Ignore versions newer than npm "latest" version
    --recreate-closed [boolean]          Recreate PRs even if same ones were closed previously
    --rebase-stale-prs [boolean]         Rebase stale PRs (GitHub only)
    --pr-creation <string>               When to create the PR for a branch. Values: immediate, not-pending, status-success.
    --automerge <string>                 What types of upgrades to merge to base branch automatically. Values: none, minor or any
    --maintain-yarn-lock [boolean]       Keep yarn.lock files updated in base branch
    --group-name <string>                Human understandable name for the dependency group
    --group-slug <string>                Slug to use for group (e.g. in branch name). Will be calculated from groupName if null
    --labels <list>                      Labels to add to Pull Request
    --assignees <list>                   Assignees for Pull Request
    --reviewers <list>                   Requested reviewers for Pull Requests (GitHub only)
    --pin-versions [boolean]             Convert ranged versions in package.json to pinned versions
    --log-level <string>                 Logging level

  Examples:

    $ renovate --token abc123 singapore/lint-condo
    $ renovate --labels=renovate,dependency --ignore-unstable=false --log-level verbose singapore/lint-condo
    $ renovate singapore/lint-condo singapore/package-test
```

Note: The first time you run `renovate` on a repository, it will not upgrade any dependencies. Instead, it will create a Pull Request (Merge Request if GitLab) called 'Configure Renovate' and commit a default `renovate.json` file to the repository. This PR can be close unmerged if the default settings are fine for you. Also, this behaviour can be disabled if you set the `onboarding` configuration option to `false` before running.

## Deployment

See [deployment docs](docs/deployment.md) for details.

## Design Decisions

See [design decisions doc](docs/design-decisions.md) for details.
