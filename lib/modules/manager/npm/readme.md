### npm problems and workarounds

#### Invalid lock file (npm ci fails)

Unfortunately, `npm` itself sometimes generates invalid lock files which fail `npm ci`.
Try adding `"postUpdateOptions": ["npmInstallTwice"]` to tell Renovate run any `npm install` command (which is used to update lock files) twice.
This is less efficient than running npm once, but has been known to fix most problems of this type.
Renovate already runs `npm install` twice during lock file maintenance, because regenerating a lock file from scratch is known to need a second pass.

If this npm bug remains unfixed, and it becomes too frequent for Renovate users, then we may need to modify Renovate to do this by default.
Please post feedback to the Renovate repository "Discussions" if you are needing to use this feature frequently or widely.

### Transitive dependencies in `package-lock.json`

When vulnerability alerts are enabled, Renovate also extracts every package which `package-lock.json` (or `npm-shrinkwrap.json`) installs, but no `package.json` declares, with the `package-lock.json` `depType`.
These are skipped for routine updates, and only updated to remediate a vulnerability.

Renovate updates them with `npm update <name>`, which keeps to the ranges the packages which depend on them declare:

- each locked version moves to the newest version its dependents allow, which may be newer than the lowest version which fixes the vulnerability
- a version which its dependents do not allow to move stays where it is, as Renovate does not update the dependents, and if nothing else in the branch changes, no pull request is raised

Where the lock file ends up differing from what the pull request proposes, Renovate adds a comment to the pull request saying which versions are locked.

Only `lockfileVersion` 2 and 3 are supported, and Yarn and pnpm lock files are not.

### Yarn

#### Version Selection / Installation

If Renovate detects a `packageManager` setting for Yarn in `package.json` then it will use Corepack to install Yarn.

#### HTTP Proxy Support

Yarn itself does not natively recognize/support the `HTTP_PROXY` and `HTTPS_PROXY` environment variables.

You can configure `RENOVATE_X_YARN_PROXY=true` as an environment variable to enable configuring of Yarn proxy (e.g. if you cannot configure these proxy settings yourself in `~/.yarnrc.yml`).

If set, and Renovate detects Yarn 2+, and one or both of those variables are present, then Renovate will run commands like `yarn config set --home httpProxy http://proxy` prior to executing `yarn install`.
This will result in the `~/.yarnrc.yml` file being created or modified with these settings, and the settings are not removed afterwards.

Configuration/conversion of `NO_PROXY` to Yarn config is not supported.
