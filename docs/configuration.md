# Configuration

## Configuration Methods

Configuration is supported via any or all of the below:
- Configuration file
- Environment
- CLI
- `package.json` of target repository

The above are listed in reverse order of preference.
i.e. `package.json` options will override, CLI, which overrides env, which overrides the config file, which overrides defaults.

### Default Configuration

Default configuration can be found in [lib/config/default.js](../lib/config/default.js)

### Configuration File

You can override default configuration using a configuration file, with default name `config.js` in the working directory. If you need an alternate location or name, set it in the environment variable `RENOVATE_CONFIG_FILE`.

Using a configuration file gives you very granular configuration options. For instance, you can override most settings at the global (file), repository, or package level. e.g. apply one set of labels for `backend/package.json` and a different set for `frontend/package.json` in the same repository.

```javascript
module.exports = {
  labels: ['defaults'],
  depTypes: ['dependencies', 'devDependencies'],
  repositories: [
    {
      repository: 'singapore/repo1',
      packageFiles: [
        'package.json',
        {
          fileName: 'frontend/package.json',
          labels: ['frontend']
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

    -h, --help                               output usage information
    -t, --token <token>                      GitHub Auth Token
    -p, --package-files <list>               List of package.json file names
    -d, --dep-types <list>                   List of dependency types
    -i, --ignore-deps <list>                 List of dependencies to ignore
    -b, --labels <list>                      List of labels to apply
    -r, --ignore-future [true/false]         Ignore versions tagged as "future"
    -r, --ignore-unstable [true/false]       Ignore versions with unstable semver
    -r, --respect-latest [true/false]        Ignore versions newer than dependency's "latest"
    -r, --recreate-closed [true/false]       Recreate PR even if same was previously closed
    -r, --recreate-unmergeable [true/false]  Recreate PR if existing branch is unmergeable
    -l, --log-level <level>                  Log Level

  Examples:

    $ renovate --token abc123 singapore/lint-condo
    $ renovate --ignore-unstable=false -l verbose singapore/lint-condo
    $ renovate singapore/lint-condo singapore/package-test
```

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

| Option | Description | Default value | File | Environment | CLI |
|---------------------|---------------------------------------------------------|-----------------------------------------------------------|---------------------------|--------------------------|---------------------------|
| Token | GitHub Personal Access Token |  | `token` | `GITHUB_TOKEN` | `--token` |
| Repositories | List of Repositories |  | `repositories` | `RENOVATE_REPOS` | Space-delimited arguments |
| Package Files | Package file location(s) | `[]` | `repository.packageFiles` | `RENOVATE_PACKAGE_FILES` | `--package-files` |
| Dependency Types | Sections of package.json to renovate | `dependencies`, `devDependencies`, `optionalDependencies` | `depTypes` | `RENOVATE_DEP_TYPES` | `--dep-types` |
| Ignore Dependencies | Dependencies to be ignored |  | `ignoreDeps` | `RENOVATE_IGNORE_DEPS` | `--ignore-deps` |
| Labels | Labels to add to Pull Requests |  | `labels` | `RENOVATE_LABELS` | `--labels` |
| Ignore Future | Ignore versions tagged as "future" | `true` | `ignoreFuture` | `RENOVATE_IGNORE_FUTURE` | `--ignore-future` |
| Ignore Unstable | Ignore versions with unstable semver | `true` | `ignoreUnstable` | `RENOVATE_IGNORE_UNSTABLE` | `--ignore-unstable` |
| Respect latest | Respect the "latest" tag in npm and don't upgrade past it | `true` | `respectLatest` | `RENOVATE_RESPECT_LATEST` | `--respect-latest` |
| Recreate Closed | Create New PR even if same one was previously closed | `false` | `recreateClosed` | `RENOVATE_RECREATE_CLOSED` | `--recreate-closed` |
| Recreate Unmergeable | Close and recreate PR if existing one is unmergeable | `true` | `recreateUnmergeable` | `RENOVATE_RECREATE_UNMERGEABLE` | `--recreate-unmergeable` |
| Log Level | Log Level | `info` | `logLevel` | `LOG_LEVEL` | `--log-level` |
| Templates | String templates for commit, branch and PR | Multiple | `templates` |  |  |
