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

Default configuration can be found in [lib/config/default.js](../lib/config/default.js)

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
      depTypes: ['dependencies', 'devDependencies', 'optionalDependencies'],
      labels: ['renovate'],
    },
    'singapore/repo3',
  ]
}
```

### CLI

```
$ node renovate --help

  Usage: renovate [options] [repositories...]

  Options:

    -h, --help                   output usage information
    --enabled [boolean]          Enable or disable renovate
    --onboarding [boolean]       Require a Configuration PR first
    --token <string>             GitHub Auth Token
    --package-files <list>       Package file paths
    --dep-types <list>           Dependency types
    --ignore-deps <list>         Dependencies to ignore
    --ignore-future [boolean]    Ignore versions tagged as "future"
    --ignore-unstable [boolean]  Ignore versions with unstable semver
    --respect-latest [boolean]   Ignore versions newer than npm "latest" version
    --recreate-closed [boolean]  Recreate PRs even if same ones were closed previously
    --labels <list>              Labels to add to Pull Request
    --assignees <list>           Assignees for Pull Request
    --log-level <string>         Logging level

  Examples:

    $ renovate --token abc123 singapore/lint-condo
    $ renovate --ignore-unstable=false --log-level verbose singapore/lint-condo
    $ renovate singapore/lint-condo singapore/package-test
```

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
| `token` | GitHub Auth Token | string | `null` | `GITHUB_TOKEN` | `--token` |
| `repositories` | GitHub repositories | list | `[]` | `RENOVATE_REPOSITORIES` |  |
| `packageFiles` | Package file paths | list | `[]` | `RENOVATE_PACKAGE_FILES` | `--package-files` |
| `depTypes` | Dependency types | list | `["dependencies", "devDependencies", "optionalDependencies"]` | `RENOVATE_DEP_TYPES` | `--dep-types` |
| `ignoreDeps` | Dependencies to ignore | list | `[]` | `RENOVATE_IGNORE_DEPS` | `--ignore-deps` |
| `ignoreFuture` | Ignore versions tagged as "future" | boolean | `true` | `RENOVATE_IGNORE_FUTURE` | `--ignore-future` |
| `ignoreUnstable` | Ignore versions with unstable semver | boolean | `true` | `RENOVATE_IGNORE_UNSTABLE` | `--ignore-unstable` |
| `respectLatest` | Ignore versions newer than npm "latest" version | boolean | `true` | `RENOVATE_RESPECT_LATEST` | `--respect-latest` |
| `recreateClosed` | Recreate PRs even if same ones were closed previously | boolean | `false` | `RENOVATE_RECREATE_CLOSED` | `--recreate-closed` |
| `branchName` | Branch name template | string | `"renovate/{{depName}}-{{newVersionMajor}}.x"` |  |  |
| `commitMessage` | Commit message template | string | `"Update dependency {{depName}} to version {{newVersion}}"` |  |  |
| `prTitle` | Pull Request title template | string | `"{{#if isPin}}Pin{{else}}Update{{/if}} dependency {{depName}} to version {{#if isMajor}}{{newVersionMajor}}.x{{else}}{{newVersion}}{{/if}}"` |  |  |
| `prBody` | Pull Request body template | string | `"This Pull Request updates dependency {{depName}} from version {{currentVersion}} to {{newVersion}}\n\n{{changelog}}"` |  |  |
| `labels` | Labels to add to Pull Request | list | `[]` | `RENOVATE_LABELS` | `--labels` |
| `assignees` | Assignees for Pull Request | list | `[]` | `RENOVATE_ASSIGNEES` | `--assignees` |
| `logLevel` | Logging level | string | `"info"` | `LOG_LEVEL` | `--log-level` |
