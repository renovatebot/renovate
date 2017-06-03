# Configuration

## Configuration Methods

Configuration is supported via any or all of the below:
- Configuration file
- Environment
- CLI
- `renovate.json` in target repository
- `renovate` field of `package.json` in target repository

The above are listed in reverse order of preference.
i.e. `package.json` settings will override `renovate.json` settings, CLI, which overrides env, which overrides the config file, which overrides defaults.

### Default Configuration

Default configuration values can be found in [lib/config/definitions.js](../lib/config/definitions.js)

### Configuration File

You can override default configuration using a configuration file, with default name `config.js` in the working directory. If you need an alternate location or name, set it in the environment variable `RENOVATE_CONFIG_FILE`.

Using a configuration file gives you very granular configuration options. For instance, you can override most settings at the global (file), repository, or package level. e.g. apply one set of labels for `backend/package.json` and a different set for `frontend/package.json` in the same repository.

```javascript
module.exports = {
  labels: ['upgrade'],
  depTypes: ['dependencies', 'devDependencies'],
  repositories: [
    {
      repository: 'singapore/repo1',
      packageFiles: [
        'package.json',
        {
          fileName: 'frontend/package.json',
          labels: ['upgrade', 'frontend']
        },
      ],
    },
    {
      repository: 'singapore/repo2',
      depTypes: [
        'dependencies',
        'devDependencies',
        {
          depType: 'optionalDependencies',
          labels: ['renovate', 'optional'],
        },
      ],
      labels: ['renovate'],
    },
    'singapore/repo3',
  ],
  packages: [
    {
      package: 'jquery',
      labels: ['jquery', 'uhoh'],
    },
  ],
}
```

### CLI

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
    --yarn-cache-folder <string>         Location of yarn cache folder to use. Set to empty string to disable
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

To configure any `<list>` items, separate with commas. E.g. `renovate --labels=renovate,dependency`.

### renovate.json

If you add a `renovate.json` file to the root of your repository, you can use this to override default settings.
If you leave the `packageFiles` field empty then `renovate` will still auto-discover all `package.json` files in the repository.

### package.json

If you add configuration options to your `package.json` then these will override any other settings above.
Obviously, you can't set repository or package file location with this method.

```json
"renovate": {
  "labels": [
    "upgrade",
    "bot"
  ]
}
```

## Configuration Options

| Name | Description | Type | Default value | Environment | CLI |
|------|-------------|------|---------------|-------------|-----|
| `enabled` | Enable or disable renovate | boolean | `true` | `RENOVATE_ENABLED` | `--enabled` |
| `onboarding` | Require a Configuration PR first | boolean | `true` | `RENOVATE_ONBOARDING` | `--onboarding` |
| `platform` | Platform type of repository | string | `"github"` | `RENOVATE_PLATFORM` | `--platform` |
| `endpoint` | Custom endpoint to use | string | `null` | `RENOVATE_ENDPOINT` | `--endpoint` |
| `token` | Repository Auth Token | string | `null` | `RENOVATE_TOKEN` | `--token` |
| `autodiscover` | Autodiscover all repositories | boolean | `false` | `RENOVATE_AUTODISCOVER` | `--autodiscover` |
| `githubAppId` | GitHub App ID (enables GitHub App functionality if set) | integer | `undefined` | `RENOVATE_GITHUB_APP_ID` | `--github-app-id` |
| `githubAppKey` | GitHub App Private Key (.pem file contents) | string | `null` | `RENOVATE_GITHUB_APP_KEY` | `--github-app-key` |
| `repositories` | List of Repositories | list | `[]` | `RENOVATE_REPOSITORIES` |  |
| `packageFiles` | Package file paths | list | `[]` | `RENOVATE_PACKAGE_FILES` | `--package-files` |
| `depTypes` | Dependency types | list | `["dependencies", "devDependencies", "optionalDependencies"]` | `RENOVATE_DEP_TYPES` | `--dep-types` |
| `separateMajorReleases` | If set to false, it will upgrade dependencies to latest release only, and not separate major/minor branches | boolean | `true` | `RENOVATE_SEPARATE_MAJOR_RELEASES` | `--separate-major-releases` |
| `ignoreDeps` | Dependencies to ignore | list | `[]` | `RENOVATE_IGNORE_DEPS` | `--ignore-deps` |
| `ignoreFuture` | Ignore versions tagged as "future" | boolean | `true` | `RENOVATE_IGNORE_FUTURE` | `--ignore-future` |
| `ignoreUnstable` | Ignore versions with unstable semver | boolean | `true` | `RENOVATE_IGNORE_UNSTABLE` | `--ignore-unstable` |
| `respectLatest` | Ignore versions newer than npm "latest" version | boolean | `true` | `RENOVATE_RESPECT_LATEST` | `--respect-latest` |
| `recreateClosed` | Recreate PRs even if same ones were closed previously | boolean | `false` | `RENOVATE_RECREATE_CLOSED` | `--recreate-closed` |
| `rebaseStalePrs` | Rebase stale PRs (GitHub only) | boolean | `false` | `RENOVATE_REBASE_STALE_PRS` | `--rebase-stale-prs` |
| `prCreation` | When to create the PR for a branch. Values: immediate, not-pending, status-success. | string | `"immediate"` | `RENOVATE_PR_CREATION` | `--pr-creation` |
| `automerge` | What types of upgrades to merge to base branch automatically. Values: none, minor or any | string | `"none"` | `RENOVATE_AUTOMERGE` | `--automerge` |
| `branchName` | Branch name template | string | `"renovate/{{depName}}-{{newVersionMajor}}.x"` | `RENOVATE_BRANCH_NAME` |  |
| `commitMessage` | Commit message template | string | `"Update dependency {{depName}} to version {{newVersion}}"` | `RENOVATE_COMMIT_MESSAGE` |  |
| `prTitle` | Pull Request title template | string | `"{{#if isPin}}Pin{{else}}Update{{/if}} dependency {{depName}} to version {{#if isRange}}{{newVersion}}{{else}}{{#if isMajor}}{{newVersionMajor}}.x{{else}}{{newVersion}}{{/if}}{{/if}}"` | `RENOVATE_PR_TITLE` |  |
| `prBody` | Pull Request body template | string | `"This Pull Request updates dependency {{depName}} from version `{{currentVersion}}` to `{{newVersion}}`\n\n{{changelog}}"` | `RENOVATE_PR_BODY` |  |
| `yarnCacheFolder` | Location of yarn cache folder to use. Set to empty string to disable | string | `"/tmp/yarn-cache"` | `RENOVATE_YARN_CACHE_FOLDER` | `--yarn-cache-folder` |
| `maintainYarnLock` | Keep yarn.lock files updated in base branch | boolean | `false` | `RENOVATE_MAINTAIN_YARN_LOCK` | `--maintain-yarn-lock` |
| `yarnMaintenanceBranchName` | Branch name template when maintaining yarn.lock | string | `"renovate/yarn-lock"` | `RENOVATE_YARN_MAINTENANCE_BRANCH_NAME` |  |
| `yarnMaintenanceCommitMessage` | Commit message template when maintaining yarn.lock | string | `"Renovate yarn.lock file"` | `RENOVATE_YARN_MAINTENANCE_COMMIT_MESSAGE` |  |
| `yarnMaintenancePrTitle` | Pull Request title template when maintaining yarn.lock | string | `"Renovate yarn.lock file"` | `RENOVATE_YARN_MAINTENANCE_PR_TITLE` |  |
| `yarnMaintenancePrBody` | Pull Request body template when maintaining yarn.lock | string | `"This PR regenerates yarn.lock files based on the existing `package.json` files."` | `RENOVATE_YARN_MAINTENANCE_PR_BODY` |  |
| `groupName` | Human understandable name for the dependency group | string | `null` | `RENOVATE_GROUP_NAME` | `--group-name` |
| `groupSlug` | Slug to use for group (e.g. in branch name). Will be calculated from groupName if null | string | `null` | `RENOVATE_GROUP_SLUG` | `--group-slug` |
| `groupBranchName` | Branch name template for the group | string | `"renovate/{{groupSlug}}"` | `RENOVATE_GROUP_BRANCH_NAME` |  |
| `groupCommitMessage` | Group commit message | string | `"Renovate {{groupName}} packages"` | `RENOVATE_GROUP_COMMIT_MESSAGE` |  |
| `groupPrTitle` | Pull Request title template for the group | string | `"Renovate {{groupName}} packages"` | `RENOVATE_GROUP_PR_TITLE` |  |
| `groupPrBody` | Pull Request body template for the group | string | `"This PR renovates the package group \"{{groupName}}\"."` | `RENOVATE_GROUP_PR_BODY` |  |
| `labels` | Labels to add to Pull Request | list | `[]` | `RENOVATE_LABELS` | `--labels` |
| `assignees` | Assignees for Pull Request | list | `[]` | `RENOVATE_ASSIGNEES` | `--assignees` |
| `reviewers` | Requested reviewers for Pull Requests (GitHub only) | list | `[]` | `RENOVATE_REVIEWERS` | `--reviewers` |
| `pinVersions` | Convert ranged versions in package.json to pinned versions | boolean | `true` | `RENOVATE_PIN_VERSIONS` | `--pin-versions` |
| `logLevel` | Logging level | string | `"info"` | `LOG_LEVEL` | `--log-level` |
