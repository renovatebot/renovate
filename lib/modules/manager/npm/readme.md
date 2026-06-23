### npm problems and workarounds

#### Invalid lock file (npm ci fails)

Unfortunately, `npm` itself sometimes generates invalid lock files which fail `npm ci`.
Try adding `"postUpdateOptions": ["npmInstallTwice"]` to tell Renovate run any `npm install` command (which is used to update lock files) twice.
This is less efficient than running npm once, but has been known to fix most problems of this type.

If this npm bug remains unfixed, and it becomes too frequent for Renovate users, then we may need to modify Renovate to do this by default.
Please post feedback to the Renovate repository "Discussions" if you're needing to use this feature frequently or widely.

### Yarn

#### Version Selection / Installation

If Renovate detects a `packageManager` setting for Yarn in `package.json` then it will use Corepack to install Yarn.

#### Yarn RC Discovery

For Yarn 2+ projects, Renovate reads inherited `.yarnrc.yml` files from the current package directory up through parent directories, with nearer files taking precedence.
This means you do not need to duplicate `.yarnrc.yml` next to every `yarn.lock` or `package.json` just for registry-related settings.

For legacy `.yarnrc`, Renovate still reads the nearest matching file.

#### HTTP Proxy Support

Yarn itself does not natively recognize/support the `HTTP_PROXY` and `HTTPS_PROXY` environment variables.

You can configure `RENOVATE_X_YARN_PROXY=true` as an environment variable to enable configuring of Yarn proxy (e.g. if you cannot configure these proxy settings yourself in `~/.yarnrc.yml`).

If set, and Renovate detects Yarn 2+, and one or both of those variables are present, then Renovate will run commands like `yarn config set --home httpProxy http://proxy` prior to executing `yarn install`.
This will result in the `~/.yarnrc.yml` file being created or modified with these settings, and the settings are not removed afterwards.

Configuration/conversion of `NO_PROXY` to Yarn config is not supported.
